import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import request from "supertest";
import { PDFParse } from "pdf-parse";
import { crearApp } from "../../src/app.js";
import { baseLimpia, registroEnMemoria } from "./ayudantes.js";
import { sembrarCatalogo, RELOJ } from "./datos-catalogo.js";
import {
  CLIENTE,
  almacenTemporal,
  archivosGuardados,
  enviarCotizacion
} from "./ayudantes-cotizacion.js";

let config, pool, app, dir, almacen, registro;
const SIN_LIMITE = {
  cotizaciones: { ventanaMs: 60_000, max: 10_000 },
  pdf: { ventanaMs: 60_000, max: 10_000 }
};
const NO_EXISTE = "A".repeat(32);

before(async () => {
  ({ config, pool } = await baseLimpia());
  await sembrarCatalogo(pool);
});
beforeEach(async () => {
  await pool.query("DELETE FROM cotizaciones");
  await pool.query("DELETE FROM clientes");
  await pool.query("DELETE FROM folio_secuencia");
  ({ dir, almacen } = await almacenTemporal());
  registro = registroEnMemoria();
  app = crearApp({ config, db: pool, almacen, reloj: RELOJ, limites: SIN_LIMITE, registro });
});
after(async () => {
  await pool?.end();
});

async function nuevaCotizacion() {
  const r = await enviarCotizacion(app, {
    cliente: CLIENTE,
    renglones: [{ idVariante: 100, cantidad: 12, color: "Negro", texto: "Feliz cumpleaños" }]
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
}

const pedirPdf = (token) =>
  request(app)
    .get(`/api/cotizaciones/${token}/pdf`)
    .buffer(true)
    .parse((res, cb) => {
      const partes = [];
      res.on("data", (b) => partes.push(b));
      res.on("end", () => cb(null, Buffer.concat(partes)));
    });

async function textoDe(buffer) {
  const p = new PDFParse({ data: buffer });
  try {
    return (await p.getText()).text;
  } finally {
    await p.destroy();
  }
}

const rutaPdf = async (folio) => {
  const [[f]] = await pool.query("SELECT pdf_ruta AS r FROM cotizaciones WHERE folio = ?", [folio]);
  return f.r;
};

test("GET …/pdf descarga el PDF con cabeceras de archivo privado y guarda pdf_ruta", async () => {
  const { folio, token } = await nuevaCotizacion();
  const r = await pedirPdf(token);
  assert.equal(r.status, 200);
  assert.match(r.headers["content-type"], /^application\/pdf/);
  assert.equal(r.headers["content-disposition"], `attachment; filename="${folio}.pdf"`);
  assert.equal(r.headers["cache-control"], "private, no-store");
  const texto = await textoDe(r.body);
  assert.ok(texto.includes(folio));
  assert.ok(texto.includes("ana@ejemplo.com"), "el PDF lleva los datos de contacto");
  const ruta = await rutaPdf(folio);
  assert.match(ruta, /^pdfs\/2026\/la-2026-000001-[0-9a-f]{16}\.pdf$/);
  assert.ok(existsSync(path.join(dir, ruta)));
});

test("dos descargas seguidas reutilizan el mismo archivo sin volver a guardarlo", async () => {
  const { folio, token } = await nuevaCotizacion();
  let guardados = 0;
  const guardar = almacen.guardar;
  almacen.guardar = async (...a) => {
    guardados++;
    return guardar(...a);
  };
  await pedirPdf(token);
  const primera = await rutaPdf(folio);
  const r = await pedirPdf(token);
  assert.equal(r.status, 200);
  assert.equal(await rutaPdf(folio), primera);
  assert.equal(guardados, 1);
});

test("si cambian el envío y el total, se genera un PDF nuevo y se borra el anterior", async () => {
  const { folio, token } = await nuevaCotizacion();
  await pedirPdf(token);
  const anterior = await rutaPdf(folio);
  await pool.query(
    "UPDATE cotizaciones SET costo_entrega = 150, total = total + 150 WHERE folio = ?",
    [folio]
  );
  const r = await pedirPdf(token);
  assert.equal(r.status, 200);
  const nueva = await rutaPdf(folio);
  assert.notEqual(nueva, anterior);
  assert.ok(!existsSync(path.join(dir, anterior)), "el PDF anterior se borra");
  assert.ok((await textoDe(r.body)).includes("$150.00"));
});

test("el PDF usa el precio guardado aunque el catálogo cambie después", async () => {
  const { token } = await nuevaCotizacion();
  const cambiar = (precio) =>
    pool.query(
      "UPDATE precios SET precio_unitario = ? WHERE id_variante = 100 AND cantidad_desde = 12",
      [precio]
    );
  await cambiar("999.00");
  let texto;
  try {
    texto = await textoDe((await pedirPdf(token)).body);
  } finally {
    await cambiar("160.50");
  }
  assert.ok(texto.includes("$160.50"));
  assert.ok(!texto.includes("$999.00"));
});

test("si el archivo se perdió del almacén, el PDF se regenera", async () => {
  const { folio, token } = await nuevaCotizacion();
  await pedirPdf(token);
  await rm(path.join(dir, await rutaPdf(folio)));
  const r = await pedirPdf(token);
  assert.equal(r.status, 200);
  assert.ok((await textoDe(r.body)).includes(folio));
  assert.ok(existsSync(path.join(dir, await rutaPdf(folio))));
});

test("dos descargas simultáneas del primer PDF responden 200 y dejan un solo archivo", async () => {
  const { token } = await nuevaCotizacion();
  const [a, b] = await Promise.all([pedirPdf(token), pedirPdf(token)]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  const pdfs = (await archivosGuardados(dir)).filter((n) => n.endsWith(".pdf"));
  assert.equal(pdfs.length, 1);
});

test("GET …/mensaje-whatsapp da el texto y el enlace al número del negocio", async () => {
  const { folio, token } = await nuevaCotizacion();
  const r = await request(app).get(`/api/cotizaciones/${token}/mensaje-whatsapp`);
  assert.equal(r.status, 200);
  assert.equal(r.headers["cache-control"], "no-store");
  assert.ok(r.body.enlace.startsWith(`https://wa.me/${config.whatsappNegocio}?text=`));
  assert.ok(r.body.texto.includes(`Folio: ${folio}`));
  assert.ok(r.body.texto.includes(`${config.urlSitio}/folio.html?t=${token}`));
  assert.equal(decodeURIComponent(r.body.enlace.split("?text=")[1]), r.body.texto);
});

test("un token inexistente o mal formado da el mismo 404 en PDF y WhatsApp", async () => {
  const cuerpos = [];
  for (const token of [NO_EXISTE, "corto", "LA-2026-000001"]) {
    for (const final of ["pdf", "mensaje-whatsapp"]) {
      const r = await request(app).get(`/api/cotizaciones/${token}/${final}`);
      assert.equal(r.status, 404, `${token}/${final}`);
      cuerpos.push(`${r.body.error.codigo}|${r.body.error.mensaje}`);
    }
  }
  assert.equal(new Set(cuerpos).size, 1);
});

test("el celular y el correo del cliente nunca aparecen en el registro", async () => {
  const { token } = await nuevaCotizacion();
  await pedirPdf(token);
  await request(app).get(`/api/cotizaciones/${token}/mensaje-whatsapp`);
  const todo = registro.lineas.join("\n");
  assert.ok(!todo.includes("5512345678"));
  assert.ok(!todo.toLowerCase().includes("ana@ejemplo.com"));
});

test("si otra petición ya guardó el mismo PDF (EEXIST), la descarga responde 200", async () => {
  const { folio, token } = await nuevaCotizacion();
  almacen.guardar = async () => {
    throw Object.assign(new Error("ya existe"), { code: "EEXIST" });
  };
  const r = await pedirPdf(token);
  assert.equal(r.status, 200);
  assert.match(await rutaPdf(folio), /^pdfs\/2026\//);
});

test("una petición lenta no regresa pdf_ruta a una clave anterior", async () => {
  const { folio, token } = await nuevaCotizacion();
  await pool.query(
    "UPDATE cotizaciones SET pdf_ruta = 'pdfs/2026/otra.pdf', actualizado_en = actualizado_en WHERE folio = ?",
    [folio]
  );
  const { guardarPdfRuta } = await import("../../src/modulos/cotizaciones/repositorio.js");
  const [[c]] = await pool.query("SELECT id_cotizacion AS id FROM cotizaciones WHERE folio = ?", [
    folio
  ]);
  const cambio = await guardarPdfRuta(pool, c.id, "pdfs/2026/vieja.pdf", null);
  assert.equal(cambio, false);
  assert.equal(await rutaPdf(folio), "pdfs/2026/otra.pdf");
  assert.equal((await pedirPdf(token)).status, 200);
});
