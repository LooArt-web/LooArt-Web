import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { crearApp } from "../../src/app.js";
import { baseLimpia, registroEnMemoria } from "../integracion/ayudantes.js";
import { sembrarCatalogo, RELOJ } from "../integracion/datos-catalogo.js";
import {
  PNG,
  CLIENTE,
  almacenTemporal,
  archivosGuardados,
  enviarCotizacion,
  contar
} from "../integracion/ayudantes-cotizacion.js";

let config, pool, app, dir;
const RENGLON = { idVariante: 100, cantidad: 1 };

before(async () => {
  ({ config, pool } = await baseLimpia());
  await sembrarCatalogo(pool);
});
beforeEach(async () => {
  let almacen;
  ({ dir, almacen } = await almacenTemporal());
  app = crearApp({
    config,
    db: pool,
    almacen,
    reloj: RELOJ,
    limites: { cotizaciones: { ventanaMs: 60_000, max: 1000 } },
    registro: registroEnMemoria()
  });
});
after(async () => {
  await pool?.end();
});

test("un .exe renombrado a .png se rechaza y no se guarda nada (RN-026)", async () => {
  const exe = Buffer.concat([Buffer.from("MZ\x90\x00", "latin1"), Buffer.alloc(64)]);
  const r = await enviarCotizacion(
    app,
    { cliente: CLIENTE, renglones: [RENGLON] },
    { imagen_0: { buffer: exe, nombre: "foto.png", tipo: "image/png" } }
  );
  assert.equal(r.status, 422);
  assert.equal(r.body.error.codigo, "ARCHIVO_NO_PERMITIDO");
  assert.deepEqual(await archivosGuardados(dir), []);
});

test("una imagen de más de 5 MB responde 413", async () => {
  const grande = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
  const r = await enviarCotizacion(
    app,
    { cliente: CLIENTE, renglones: [RENGLON] },
    { imagen_0: { buffer: grande, nombre: "g.png", tipo: "image/png" } }
  );
  assert.equal(r.status, 413);
  assert.equal(r.body.error.codigo, "ARCHIVO_DEMASIADO_GRANDE");
});

test("una imagen para un renglón que no existe o con otro nombre de campo responde 400", async () => {
  for (const campo of ["imagen_1", "foto", "imagen_00"]) {
    const r = await enviarCotizacion(
      app,
      { cliente: CLIENTE, renglones: [RENGLON] },
      { [campo]: { buffer: PNG, nombre: "a.png", tipo: "image/png" } }
    );
    assert.equal(r.status, 400, campo);
  }
});

test("cuerpo inválido responde 400 sin guardar: propiedades extra, precios, enteros parciales, celular", async () => {
  const antes = await contar(pool, "cotizaciones");
  const malos = [
    { cliente: CLIENTE, renglones: [{ ...RENGLON, precioUnitario: "0.01" }] },
    { cliente: CLIENTE, renglones: [RENGLON], total: "1.00" },
    { cliente: CLIENTE, renglones: [{ idVariante: "100", cantidad: "12abc" }] },
    { cliente: CLIENTE, renglones: [{ idVariante: 100, cantidad: 1.5 }] },
    { cliente: { ...CLIENTE, celular: "12345" }, renglones: [RENGLON] },
    { cliente: { ...CLIENTE, cp: "1234A" }, renglones: [RENGLON] },
    { cliente: { ...CLIENTE, correo: "no-es-correo" }, renglones: [RENGLON] },
    { cliente: { ...CLIENTE, admin: true }, renglones: [RENGLON] },
    { cliente: CLIENTE, renglones: [] },
    { cliente: CLIENTE, renglones: [{ ...RENGLON, idTematica: 1, tema: "Mi tema" }] },
    { cliente: CLIENTE, renglones: [{ ...RENGLON, diseno: { modo: "centro" } }] }
  ];
  for (const datos of malos) {
    const r = await enviarCotizacion(app, datos);
    assert.equal(r.status, 400, JSON.stringify(datos));
    assert.equal(r.body.error.codigo, "DATOS_INVALIDOS");
  }
  const sinDatos = await request(app).post("/api/cotizaciones").send({ cliente: CLIENTE });
  assert.equal(sinDatos.status, 400, "JSON sin multipart");
  const jsonRoto = await request(app).post("/api/cotizaciones").field("datos", "{no-json");
  assert.equal(jsonRoto.status, 400);
  assert.equal(await contar(pool, "cotizaciones"), antes);
});

test("el alta tiene límite de peticiones por IP (429)", async () => {
  const { almacen } = await almacenTemporal();
  const limitada = crearApp({
    config,
    db: pool,
    almacen,
    reloj: RELOJ,
    limites: { cotizaciones: { ventanaMs: 60_000, max: 2 } },
    registro: registroEnMemoria()
  });
  const estados = [];
  for (let i = 0; i < 3; i++) {
    estados.push(
      (await enviarCotizacion(limitada, { cliente: CLIENTE, renglones: [RENGLON] })).status
    );
  }
  assert.deepEqual(estados, [201, 201, 429]);
});

test("un token mal formado responde 404 sin consultar la BD", async () => {
  const sinBd = crearApp({
    config,
    db: {
      query: async () => assert.fail("no debió consultar"),
      getConnection: async () => assert.fail("no")
    },
    registro: registroEnMemoria()
  });
  for (const t of ["corto", "x".repeat(33), "%27%20OR%201%3D1%20--%20aaaaaaaaaaaaaaaa"]) {
    const r = await request(sinBd).get(`/api/cotizaciones/${t}`);
    assert.equal(r.status, 404, t);
  }
});
