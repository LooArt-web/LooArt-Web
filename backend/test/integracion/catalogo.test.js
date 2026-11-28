import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { crearApp } from "../../src/app.js";
import { baseLimpia, registroEnMemoria } from "./ayudantes.js";
import { sembrarCatalogo, RELOJ } from "./datos-catalogo.js";

let app, pool;
const almacen = { urlPublica: (clave) => `https://archivos.prueba/${clave}` };

before(async () => {
  let config;
  ({ config, pool } = await baseLimpia());
  await sembrarCatalogo(pool);
  app = crearApp({ config, db: pool, almacen, reloj: RELOJ, registro: registroEnMemoria() });
});
after(async () => {
  await pool?.end();
});

test("GET /api/catalogo/categorias lista solo las activas", async () => {
  const r = await request(app).get("/api/catalogo/categorias");
  assert.equal(r.status, 200);
  assert.deepEqual(
    r.body.datos.map((c) => c.nombre),
    ["[Prueba] Stickers", "[Prueba] Termos"]
  );
  assert.deepEqual(Object.keys(r.body.datos[0]).sort(), ["descripcion", "id", "nombre"]);
});

test("GET /api/catalogo/productos: activos, de categoría activa, con imagen principal y maqueta", async () => {
  const r = await request(app).get("/api/catalogo/productos");
  assert.equal(r.status, 200);
  assert.deepEqual(
    r.body.datos.map((p) => p.id),
    [20, 10]
  );
  const termo = r.body.datos.find((p) => p.id === 10);
  assert.equal(termo.maqueta, "termo");
  assert.deepEqual(termo.categoria, { id: 1, nombre: "[Prueba] Termos" });
  assert.deepEqual(termo.imagenPrincipal, {
    url: "https://archivos.prueba/productos/10/principal.webp",
    textoAlternativo: "Termo negro"
  });
  const pin = r.body.datos.find((p) => p.id === 20);
  assert.equal(pin.imagenPrincipal, null, "la imagen del reverso no es la principal");
});

test("GET /api/catalogo/productos?categoria= filtra por categoría", async () => {
  const r = await request(app).get("/api/catalogo/productos?categoria=2");
  assert.deepEqual(
    r.body.datos.map((p) => p.id),
    [20]
  );
  const oculta = await request(app).get("/api/catalogo/productos?categoria=3");
  assert.deepEqual(oculta.body.datos, [], "una categoría inactiva no muestra productos");
});

test("GET /api/catalogo/productos/:id trae variantes activas con rangos vigentes HOY en CDMX (D1)", async () => {
  const r = await request(app).get("/api/catalogo/productos/10");
  assert.equal(r.status, 200);
  assert.equal(r.body.nombre, "[Prueba] Termo");
  assert.equal(r.body.variantes.length, 1, "la variante inactiva no aparece");
  const [v] = r.body.variantes;
  assert.deepEqual(v, {
    id: 100,
    nombre: "500 ml",
    presentacion: "",
    material: "Acero",
    cantidadMinima: 1,
    precios: [
      { desde: 1, hasta: 11, precioUnitario: "180.00" },
      { desde: 12, hasta: null, precioUnitario: "160.50" } // vigente hasta hoy: sí aplica
    ]
  });
});

test("el detalle trae colores activos en orden y la galería con su cara y el modelo 3D (D2, D11)", async () => {
  const termo = (await request(app).get("/api/catalogo/productos/10")).body;
  assert.deepEqual(termo.colores, [
    { nombre: "Negro", hex: "#2A2733" },
    { nombre: "Blanco", hex: "#F4F1EC" }
  ]);
  assert.deepEqual(
    termo.galeria.map((a) => [a.tipo, a.cara, a.orden, a.url]),
    [
      ["IMAGEN", "frente", 1, "https://archivos.prueba/productos/10/principal.webp"],
      ["IMAGEN", "frente", 2, "https://archivos.prueba/productos/10/lado.webp"],
      ["MODELO_3D", "frente", 1, "https://archivos.prueba/productos/10/termo.glb"]
    ]
  );
  const pin = (await request(app).get("/api/catalogo/productos/20")).body;
  assert.equal(pin.maqueta, "pin");
  assert.deepEqual(pin.recorte, { borde: 6, cara: "frente" });
  assert.deepEqual(
    pin.galeria.map((a) => a.cara),
    ["reverso"]
  );
  assert.equal(pin.variantes[0].cantidadMinima, 10);
  assert.deepEqual(
    pin.variantes[0].precios,
    [],
    "sin precio vigente: el front no deja cotizarla (RN-008)"
  );
});

test("un producto inactivo, de categoría inactiva o inexistente responde 404", async () => {
  for (const id of [11, 30, 999999]) {
    const r = await request(app).get(`/api/catalogo/productos/${id}`);
    assert.equal(r.status, 404, `id ${id}`);
    assert.equal(r.body.error.codigo, "NO_ENCONTRADO");
  }
});

test("GET /api/tematicas: activas, con motivo o con URL de su imagen (D4)", async () => {
  const r = await request(app).get("/api/tematicas");
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.datos, [
    {
      id: 2,
      nombre: "[Prueba] Con imagen",
      descripcion: "Patrón propio",
      imagen: "https://archivos.prueba/tematicas/2/patron.png",
      motivo: null
    },
    { id: 1, nombre: "[Prueba] Estrellas", descripcion: null, imagen: null, motivo: "estrellas" }
  ]);
});

test("el catálogo público se puede guardar en caché un minuto", async () => {
  const r = await request(app).get("/api/catalogo/categorias");
  assert.equal(r.headers["cache-control"], "public, max-age=60");
});
