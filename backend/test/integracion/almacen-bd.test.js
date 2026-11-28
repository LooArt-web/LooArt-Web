import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { baseLimpia } from "./ayudantes.js";
import { crearAlmacenBd, MAX_BYTES_BD } from "../../src/almacen/bd.js";

let pool, almacen;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

before(async () => {
  ({ pool } = await baseLimpia());
  almacen = crearAlmacenBd({ db: pool });
});
beforeEach(async () => {
  await pool.query("DELETE FROM almacen_objeto");
});
after(async () => {
  await pool?.end();
});

test("guardar y leer devuelven exactamente los mismos bytes", async () => {
  await almacen.guardar("productos/10/a.png", PNG, "image/png");
  const leido = await almacen.leer("productos/10/a.png");
  assert.ok(Buffer.isBuffer(leido));
  assert.ok(leido.equals(PNG));
});

test("leer una clave que no existe devuelve null", async () => {
  assert.equal(await almacen.leer("productos/10/no-existe.png"), null);
});

test("guardar una clave que ya existe falla con code EEXIST y no la sobrescribe", async () => {
  await almacen.guardar("productos/10/a.png", PNG, "image/png");
  await assert.rejects(almacen.guardar("productos/10/a.png", Buffer.from("otro"), "image/png"), {
    code: "EEXIST"
  });
  assert.ok((await almacen.leer("productos/10/a.png")).equals(PNG));
});

test("borrar elimina el archivo y no falla si ya no existe", async () => {
  await almacen.guardar("pdfs/2026/x.pdf", Buffer.from("%PDF-1.4"), "application/pdf");
  await almacen.borrar("pdfs/2026/x.pdf");
  assert.equal(await almacen.leer("pdfs/2026/x.pdf"), null);
  await almacen.borrar("pdfs/2026/x.pdf");
});

test("listar devuelve las claves con ese prefijo, en orden", async () => {
  for (const c of ["pdfs/2026/b.pdf", "pdfs/2026/a.pdf", "productos/1/x.png"]) {
    await almacen.guardar(
      c,
      Buffer.from("x"),
      c.endsWith(".pdf") ? "application/pdf" : "image/png"
    );
  }
  assert.deepEqual(await almacen.listar("pdfs/"), ["pdfs/2026/a.pdf", "pdfs/2026/b.pdf"]);
  assert.deepEqual(await almacen.listar("pdfs%"), [], "el prefijo no es un patrón LIKE");
});

test("un archivo de más de 5 MB se rechaza con un mensaje claro, sin tocar la BD", async () => {
  const grande = Buffer.alloc(MAX_BYTES_BD + 1, 1);
  await assert.rejects(almacen.guardar("productos/1/modelo.glb", grande, "model/gltf-binary"), {
    status: 413,
    codigo: "ARCHIVO_DEMASIADO_GRANDE"
  });
  assert.deepEqual(await almacen.listar("productos/"), []);
});

test("claves inválidas se rechazan antes de llegar a la BD", async () => {
  for (const mala of ["../x.png", "/abs.png", "Mayus.png", "a/../../b.png"]) {
    await assert.rejects(almacen.guardar(mala, PNG, "image/png"), /Clave/, mala);
  }
});

test("urlPublica apunta a /api/archivos con la clave codificada", () => {
  assert.equal(almacen.urlPublica("productos/10/a b.png"), "/api/archivos/productos/10/a%20b.png");
});
