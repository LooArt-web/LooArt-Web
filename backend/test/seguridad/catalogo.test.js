import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { crearApp } from "../../src/app.js";
import { leerConfig } from "../../src/config.js";
import { registroEnMemoria } from "../integracion/ayudantes.js";

const config = leerConfig({
  NODE_ENV: "test",
  DB_HOST: "127.0.0.1",
  DB_USUARIO: "x",
  DB_CLAVE: "x",
  DB_NOMBRE: "looart1",
  ORIGENES_PERMITIDOS: "https://looart-web.pages.dev"
});
// Si la validación falla, la BD nunca debe consultarse.
const dbQueNoSeUsa = {
  query: async () => {
    throw new Error("no debió llegar a la BD");
  }
};
const app = crearApp({
  config,
  db: dbQueNoSeUsa,
  almacen: { urlPublica: (c) => c },
  registro: registroEnMemoria()
});

test("ids que no son enteros positivos responden 400 sin tocar la BD", async () => {
  for (const malo of ["12abc", "0", "-1", "1.5", "1e3", "%20%201", "99999999999999999999"]) {
    const r = await request(app).get(`/api/catalogo/productos/${malo}`);
    assert.equal(r.status, 400, malo);
    assert.equal(r.body.error.codigo, "ID_INVALIDO", malo);
  }
});

test("parámetros de consulta desconocidos o mal formados responden 400", async () => {
  for (const q of ["categoria=12abc", "categoria=1&categoria=2", "orden=nombre", "categoria="]) {
    const r = await request(app).get(`/api/catalogo/productos?${q}`);
    assert.equal(r.status, 400, q);
    assert.equal(r.body.error.codigo, "CONSULTA_INVALIDA", q);
  }
  const r = await request(app).get("/api/catalogo/categorias?x=1");
  assert.equal(r.status, 400);
});

test("el catálogo es de solo lectura: otros métodos responden 404", async () => {
  for (const metodo of ["post", "put", "delete"]) {
    const r = await request(app)[metodo]("/api/catalogo/productos/1");
    assert.equal(r.status, 404, metodo);
  }
});
