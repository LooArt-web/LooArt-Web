import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import request from "supertest";
import { crearApp } from "../../src/app.js";
import { baseLimpia, registroEnMemoria } from "./ayudantes.js";
import { sembrarCatalogo, RELOJ } from "./datos-catalogo.js";
import {
  PNG,
  CLIENTE,
  almacenTemporal,
  archivosGuardados,
  enviarCotizacion,
  contar
} from "./ayudantes-cotizacion.js";

let config, pool, app, dir, almacen;
const SIN_LIMITE = { cotizaciones: { ventanaMs: 60_000, max: 10_000 } };

before(async () => {
  ({ config, pool } = await baseLimpia());
  await sembrarCatalogo(pool);
});
beforeEach(async () => {
  await pool.query("DELETE FROM cotizaciones");
  await pool.query("DELETE FROM clientes");
  await pool.query("DELETE FROM folio_secuencia");
  ({ dir, almacen } = await almacenTemporal());
  app = crearApp({
    config,
    db: pool,
    almacen,
    reloj: RELOJ,
    limites: SIN_LIMITE,
    registro: registroEnMemoria()
  });
});
after(async () => {
  await pool?.end();
});

const RENGLON_TERMO = {
  idVariante: 100,
  cantidad: 12,
  color: "Negro",
  idTematica: 1,
  texto: "Feliz cumpleaños",
  diseno: {
    modo: "centro",
    tamano: 0.45,
    separacion: 0.2,
    intercalado: true,
    angulo: 0,
    escala: 1,
    posX: 0.5,
    posY: 0.5,
    cara: "frente"
  }
};

test("alta completa: 201, montos del servidor, snapshots, personalización, imagen e historial", async () => {
  const r = await enviarCotizacion(
    app,
    { cliente: CLIENTE, renglones: [RENGLON_TERMO, { idVariante: 100, cantidad: 2 }] },
    { imagen_0: { buffer: PNG, nombre: "referencia.png", tipo: "image/png" } }
  );
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.folio, "LA-2026-000001");
  assert.match(r.body.token, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(r.body.fechaEmision, "2026-11-27 12:00:00");
  assert.equal(r.body.fechaVencimiento, "2026-12-27");
  // 12 × 160.50 (mayoreo) + 2 × 180.00 = 1926.00 + 360.00
  assert.equal(r.body.subtotal, "2286.00");
  assert.equal(r.body.total, "2286.00");
  assert.deepEqual(r.body.estatus, { clave: "NUEVA", nombre: "Nueva" });

  const [[cli]] = await pool.query("SELECT nombre, telefono, email, codigo_postal FROM clientes");
  assert.deepEqual(cli, {
    nombre: "Ana Pérez",
    telefono: "5512345678",
    email: "ana@ejemplo.com",
    codigo_postal: "01000"
  });
  const [det] = await pool.query(
    `SELECT cantidad, precio_unitario_snapshot AS p, subtotal, producto_snapshot AS prod,
            variante_snapshot AS v, es_precio_estimado AS est
       FROM detalle_cotizacion ORDER BY id_detalle`
  );
  assert.deepEqual(det, [
    {
      cantidad: 12,
      p: "160.50",
      subtotal: "1926.00",
      prod: "[Prueba] Termo",
      v: "500 ml · Acero",
      est: 0
    },
    {
      cantidad: 2,
      p: "180.00",
      subtotal: "360.00",
      prod: "[Prueba] Termo",
      v: "500 ml · Acero",
      est: 0
    }
  ]);
  const [pers] = await pool.query(
    "SELECT color, id_tematica, texto_personalizado, diseno FROM personalizaciones"
  );
  assert.equal(pers.length, 1, "el renglón sin personalización no crea registro");
  assert.equal(pers[0].id_tematica, 1);
  assert.equal(pers[0].diseno.modo, "centro");

  const [[arch]] = await pool.query(
    "SELECT ruta, nombre_archivo, tipo_mime, tamano_bytes FROM archivos_referencia"
  );
  assert.match(arch.ruta, /^referencias\/2026\/[0-9a-f-]{36}\.png$/);
  assert.equal(arch.nombre_archivo, "referencia.png");
  assert.equal(arch.tamano_bytes, PNG.length);
  assert.ok(existsSync(path.join(dir, arch.ruta)), "el archivo quedó guardado");

  const [[h]] = await pool.query(
    "SELECT id_usuario, id_estatus_anterior, id_estatus_nuevo FROM historial_estatus"
  );
  assert.deepEqual(h, { id_usuario: null, id_estatus_anterior: null, id_estatus_nuevo: 1 });
});

test("si un renglón no es válido no se guarda nada: ni cliente, ni folio, ni archivos", async () => {
  const r = await enviarCotizacion(
    app,
    { cliente: CLIENTE, renglones: [RENGLON_TERMO, { idVariante: 101, cantidad: 3 }] },
    { imagen_0: { buffer: PNG, nombre: "ref.png", tipo: "image/png" } }
  );
  assert.equal(r.status, 422);
  assert.equal(r.body.error.codigo, "PRODUCTO_NO_DISPONIBLE");
  assert.match(r.body.error.mensaje, /renglón 2/);
  for (const t of ["cotizaciones", "clientes", "detalle_cotizacion", "archivos_referencia"]) {
    assert.equal(await contar(pool, t), 0, t);
  }
  assert.equal(await contar(pool, "folio_secuencia"), 0, "el ROLLBACK deshace el consecutivo");
  assert.deepEqual(await archivosGuardados(dir), [], "se borró la imagen ya subida");
});

test("si falla el almacenamiento a la mitad, se borra lo subido y no se toca la BD", async () => {
  let n = 0;
  const fallaElSegundo = {
    ...almacen,
    guardar: async (...a) => {
      if (++n === 2) throw new Error("R2 no responde");
      return almacen.guardar(...a);
    }
  };
  const app2 = crearApp({
    config,
    db: pool,
    almacen: fallaElSegundo,
    reloj: RELOJ,
    limites: SIN_LIMITE,
    registro: registroEnMemoria()
  });
  const r = await enviarCotizacion(
    app2,
    { cliente: CLIENTE, renglones: [RENGLON_TERMO, { ...RENGLON_TERMO, color: "Blanco" }] },
    {
      imagen_0: { buffer: PNG, nombre: "a.png", tipo: "image/png" },
      imagen_1: { buffer: PNG, nombre: "b.png", tipo: "image/png" }
    }
  );
  assert.equal(r.status, 500);
  assert.equal(await contar(pool, "cotizaciones"), 0);
  assert.deepEqual(await archivosGuardados(dir), []);
});

test("20 altas simultáneas reciben 20 folios distintos y consecutivos (RN-020)", async () => {
  const respuestas = await Promise.all(
    Array.from({ length: 20 }, () =>
      enviarCotizacion(app, { cliente: CLIENTE, renglones: [{ idVariante: 100, cantidad: 1 }] })
    )
  );
  assert.ok(
    respuestas.every((r) => r.status === 201),
    respuestas.map((r) => r.status).join()
  );
  const folios = respuestas.map((r) => r.body.folio).sort();
  const esperados = Array.from(
    { length: 20 },
    (_, i) => `LA-2026-${String(i + 1).padStart(6, "0")}`
  );
  assert.deepEqual(folios, esperados);
});

test("cantidad menor al mínimo, sin precio vigente o temática inactiva responden 422", async () => {
  const casos = [
    [{ idVariante: 200, cantidad: 9 }, "CANTIDAD_MINIMA"],
    [{ idVariante: 200, cantidad: 10 }, "SIN_PRECIO"],
    [{ idVariante: 100, cantidad: 1, idTematica: 3 }, "TEMATICA_NO_DISPONIBLE"],
    [{ idVariante: 999, cantidad: 1 }, "PRODUCTO_NO_DISPONIBLE"]
  ];
  for (const [renglon, codigo] of casos) {
    const r = await enviarCotizacion(app, { cliente: CLIENTE, renglones: [renglon] });
    assert.equal(r.status, 422, codigo);
    assert.equal(r.body.error.codigo, codigo);
  }
  assert.equal(await contar(pool, "cotizaciones"), 0);
});

test("la misma variante en dos renglones con personalización distinta se cotiza por separado", async () => {
  const r = await enviarCotizacion(app, {
    cliente: CLIENTE,
    renglones: [
      { idVariante: 100, cantidad: 1, color: "Negro" },
      { idVariante: 100, cantidad: 1, color: "Blanco" }
    ]
  });
  assert.equal(r.status, 201);
  assert.equal(r.body.subtotal, "360.00");
  assert.equal(await contar(pool, "personalizaciones"), 2);
});

test("una cotización emitida el 31-dic a las 23:30 en CDMX es del año 2026 y vence el 31-ene", async () => {
  const appAnioNuevo = crearApp({
    config,
    db: pool,
    almacen,
    reloj: () => new Date("2027-01-01T05:30:00Z"),
    limites: SIN_LIMITE,
    registro: registroEnMemoria()
  });
  const r = await enviarCotizacion(appAnioNuevo, {
    cliente: CLIENTE,
    renglones: [{ idVariante: 100, cantidad: 1 }]
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.folio, "LA-2026-000001");
  assert.equal(r.body.fechaEmision, "2026-12-31 23:30:00");
  assert.equal(r.body.fechaVencimiento, "2027-01-31");
});

test("GET /api/cotizaciones/:token devuelve la cotización, sin datos de contacto ni la imagen", async () => {
  const alta = await enviarCotizacion(
    app,
    { cliente: CLIENTE, renglones: [RENGLON_TERMO] },
    { imagen_0: { buffer: PNG, nombre: "ref.png", tipo: "image/png" } }
  );
  const r = await request(app).get(`/api/cotizaciones/${alta.body.token}`);
  assert.equal(r.status, 200);
  assert.equal(r.headers["cache-control"], "no-store");
  assert.equal(r.body.folio, alta.body.folio);
  assert.deepEqual(r.body.cliente, { nombre: "Ana Pérez" });
  assert.equal(r.body.costoEntrega, null);
  assert.equal(r.body.total, "1926.00");
  const [ren] = r.body.renglones;
  assert.deepEqual(
    { ...ren, personalizacion: undefined },
    {
      producto: "[Prueba] Termo",
      variante: "500 ml · Acero",
      cantidad: 12,
      precioUnitario: "160.50",
      subtotal: "1926.00",
      personalizacion: undefined
    }
  );
  assert.equal(ren.personalizacion.tematica, "[Prueba] Estrellas");
  assert.equal(ren.personalizacion.tieneImagen, true);
  assert.ok(!JSON.stringify(r.body).includes("5512345678"), "no expone el celular");
  assert.ok(!JSON.stringify(r.body).includes("referencias/"), "no expone la ruta de la imagen");
});

test("la cotización no se consulta por folio ni con un token inexistente (RN-021)", async () => {
  const alta = await enviarCotizacion(app, {
    cliente: CLIENTE,
    renglones: [{ idVariante: 100, cantidad: 1 }]
  });
  for (const t of [alta.body.folio, "A".repeat(32)]) {
    const r = await request(app).get(`/api/cotizaciones/${t}`);
    assert.equal(r.status, 404, t);
    assert.equal(r.body.error.codigo, "NO_ENCONTRADO");
  }
});

test("si la BD falla DESPUÉS de tomar el folio, el ROLLBACK lo devuelve y no se salta ninguno", async () => {
  // Pool que falla al insertar el renglón, es decir, con el folio ya asignado.
  const poolQueFalla = {
    query: (...a) => pool.query(...a),
    getConnection: async () => {
      const cx = await pool.getConnection();
      const original = cx.query.bind(cx);
      cx.query = (sql, ...resto) =>
        String(sql).includes("INSERT INTO detalle_cotizacion")
          ? Promise.reject(
              Object.assign(new Error("se cayó la BD"), { code: "PROTOCOL_CONNECTION_LOST" })
            )
          : original(sql, ...resto);
      return cx;
    }
  };
  const appFalla = crearApp({
    config,
    db: poolQueFalla,
    almacen,
    reloj: RELOJ,
    limites: SIN_LIMITE,
    registro: registroEnMemoria()
  });
  const fallida = await enviarCotizacion(
    appFalla,
    { cliente: CLIENTE, renglones: [RENGLON_TERMO] },
    { imagen_0: { buffer: PNG, nombre: "ref.png", tipo: "image/png" } }
  );
  assert.equal(fallida.status, 500);
  assert.deepEqual(await archivosGuardados(dir), [], "también se borró la imagen");

  const buena = await enviarCotizacion(app, {
    cliente: CLIENTE,
    renglones: [{ idVariante: 100, cantidad: 1 }]
  });
  assert.equal(buena.body.folio, "LA-2026-000001", "el folio de la alta fallida se reutiliza");
});
