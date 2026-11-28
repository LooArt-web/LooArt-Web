import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { crearApp } from "../../src/app.js";
import { baseLimpia, registroEnMemoria } from "./ayudantes.js";
import { crearAlmacenBd } from "../../src/almacen/bd.js";

let pool, app, almacen;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7, 7]);

before(async () => {
  let config;
  ({ config, pool } = await baseLimpia());
  almacen = crearAlmacenBd({ db: pool });
  app = crearApp({ config, db: pool, almacen, registro: registroEnMemoria() });
  await almacen.guardar("productos/10/termo.png", PNG, "image/png");
  await almacen.guardar("tematicas/1/patron.png", PNG, "image/png");
  await almacen.guardar("referencias/2026/cliente.png", PNG, "image/png");
  await almacen.guardar(
    "pdfs/2026/la-2026-000001-abc.pdf",
    Buffer.from("%PDF-1.4"),
    "application/pdf"
  );
});
after(async () => {
  await pool?.end();
});

const pedir = (ruta) =>
  request(app)
    .get(ruta)
    .buffer(true)
    .parse((res, cb) => {
      const partes = [];
      res.on("data", (b) => partes.push(b));
      res.on("end", () => cb(null, Buffer.concat(partes)));
    });

test("sirve una imagen del catálogo con su tipo y caché pública", async () => {
  const r = await pedir("/api/archivos/productos/10/termo.png");
  assert.equal(r.status, 200);
  assert.equal(r.headers["content-type"], "image/png");
  assert.equal(r.headers["cache-control"], "public, max-age=86400, immutable");
  assert.equal(r.headers["x-content-type-options"], "nosniff");
  assert.ok(r.body.equals(PNG));
});

test("sirve las imágenes de temáticas", async () => {
  assert.equal((await pedir("/api/archivos/tematicas/1/patron.png")).status, 200);
});

test("las imágenes de referencia de clientes y los PDF NO se sirven por esta ruta", async () => {
  for (const ruta of [
    "/api/archivos/referencias/2026/cliente.png",
    "/api/archivos/pdfs/2026/la-2026-000001-abc.pdf"
  ]) {
    const r = await pedir(ruta);
    assert.equal(r.status, 404, ruta);
  }
});

test("un archivo inexistente o una clave inválida dan 404", async () => {
  for (const ruta of [
    "/api/archivos/productos/10/no.png",
    "/api/archivos/productos/..%2F..%2Fsecreto",
    "/api/archivos/productos/MAYUS.png"
  ]) {
    assert.equal((await pedir(ruta)).status, 404, ruta);
  }
});
