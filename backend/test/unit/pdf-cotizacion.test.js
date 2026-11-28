import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFParse } from "pdf-parse";
import { generarPdfCotizacion, textoPdfSeguro } from "../../src/dominio/pdf-cotizacion.js";

function renglon(extra = {}) {
  return {
    producto: "[Prueba] Termo",
    variante: "500 ml · Acero",
    cantidad: 12,
    precioUnitario: "160.50",
    subtotal: "1926.00",
    personalizacion: null,
    ...extra
  };
}

function cotizacion(extra = {}) {
  return {
    folio: "LA-2026-000001",
    fechaEmision: "2026-11-27 12:00:00",
    fechaVencimiento: "2026-12-27",
    estatus: { clave: "NUEVA", nombre: "Nueva" },
    cliente: { nombre: "Ana Pérez", celular: "5512345678", correo: "ana@ejemplo.com", cp: "06700" },
    moneda: "MXN",
    renglones: [renglon()],
    subtotal: "1926.00",
    costoEntrega: null,
    total: "1926.00",
    ...extra
  };
}

async function leer(buffer) {
  const p = new PDFParse({ data: buffer });
  try {
    return await p.getText();
  } finally {
    await p.destroy();
  }
}

test("el PDF empieza con la firma %PDF-", async () => {
  const b = await generarPdfCotizacion(cotizacion());
  assert.ok(Buffer.isBuffer(b));
  assert.equal(b.subarray(0, 5).toString("latin1"), "%PDF-");
});

test("el PDF muestra folio, fechas, cliente, renglón, total y aviso de envío", async () => {
  const { text } = await leer(await generarPdfCotizacion(cotizacion()));
  for (const esperado of [
    "LA-2026-000001",
    "Emisión: 2026-11-27",
    "Vence: 2026-12-27",
    "Ana Pérez",
    "5512345678",
    "ana@ejemplo.com",
    "06700",
    "[Prueba] Termo",
    "500 ml · Acero",
    "$160.50",
    "$1,926.00",
    "Total",
    "El costo de envío se cotiza aparte"
  ]) {
    assert.ok(text.includes(esperado), `falta en el PDF: ${esperado}`);
  }
});

test("con costo de entrega lo muestra y ya no dice que se cotiza aparte", async () => {
  const { text } = await leer(
    await generarPdfCotizacion(cotizacion({ costoEntrega: "150.00", total: "2076.00" }))
  );
  assert.ok(text.includes("$150.00"));
  assert.ok(text.includes("$2,076.00"));
  assert.ok(!text.includes("se cotiza aparte"));
});

test("el PDF incluye la personalización del renglón", async () => {
  const pers = {
    color: "Rojo",
    tematica: "[Prueba] Navidad",
    tema: null,
    texto: "Feliz año",
    descripcion: "Letras doradas",
    diseno: null,
    tieneImagen: true
  };
  const { text } = await leer(
    await generarPdfCotizacion(cotizacion({ renglones: [renglon({ personalizacion: pers })] }))
  );
  for (const esperado of [
    "Rojo",
    "[Prueba] Navidad",
    "Feliz año",
    "Letras doradas",
    "Con imagen de referencia"
  ]) {
    assert.ok(text.includes(esperado), `falta en el PDF: ${esperado}`);
  }
});

test("un emoji no rompe el PDF: se muestra como ?", async () => {
  const pers = {
    color: null,
    tematica: null,
    tema: null,
    texto: "Hola 🎉 mundo",
    descripcion: null,
    diseno: null,
    tieneImagen: false
  };
  const { text } = await leer(
    await generarPdfCotizacion(cotizacion({ renglones: [renglon({ personalizacion: pers })] }))
  );
  assert.ok(text.includes("Hola ? mundo"));
});

test("con 50 renglones el PDF ocupa más de una página y no pierde ninguno", async () => {
  const renglones = Array.from({ length: 50 }, (_, i) =>
    renglon({ producto: `[Prueba] Producto ${String(i + 1).padStart(2, "0")}` })
  );
  const { text, total } = await leer(await generarPdfCotizacion(cotizacion({ renglones })));
  assert.ok(total > 1, `páginas: ${total}`);
  for (let i = 1; i <= 50; i++) {
    assert.ok(text.includes(`Producto ${String(i).padStart(2, "0")}`), `falta el renglón ${i}`);
  }
});

test("textoPdfSeguro conserva acentos, ñ, ×, · y signos; cambia lo demás por ?", () => {
  assert.equal(textoPdfSeguro("¿Ñandú? ¡Sí! 12 × 3 · €"), "¿Ñandú? ¡Sí! 12 × 3 · €");
  assert.equal(textoPdfSeguro("a🎉b中c"), "a?b?c");
  assert.equal(textoPdfSeguro(null), "");
});
