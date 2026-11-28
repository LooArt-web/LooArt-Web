import { test } from "node:test";
import assert from "node:assert/strict";
import { formatearPesos } from "../../src/dominio/formato.js";
import { textoWhatsApp, enlaceWhatsApp } from "../../src/dominio/whatsapp.js";

const ENLACE = "https://looart-web.pages.dev/folio.html?t=abcdefghijklmnopqrstuvwxyz012345";
const NUMERO_PRUEBA = "520000000000";

function cotizacion(extra = {}) {
  return {
    folio: "LA-2026-000001",
    cliente: { nombre: "Ana Pérez", celular: "5512345678" },
    renglones: [{ cantidad: 12, producto: "[Prueba] Termo", variante: "500 ml · Acero" }],
    subtotal: "2286.00",
    costoEntrega: null,
    total: "2286.00",
    enlacePublico: ENLACE,
    ...extra
  };
}

test("formatearPesos separa miles y siempre muestra dos decimales", () => {
  assert.equal(formatearPesos("2286.00"), "$2,286.00");
  assert.equal(formatearPesos("0.50"), "$0.50");
  assert.equal(formatearPesos("1234567.89"), "$1,234,567.89");
  assert.equal(formatearPesos("7"), "$7.00");
});

test("el texto lleva folio, cliente, renglones, total y enlace, en ese orden", () => {
  const t = textoWhatsApp(cotizacion());
  const esperadas = [
    "Folio: LA-2026-000001",
    "Nombre: Ana Pérez",
    "Celular: 5512345678",
    "- 12 × [Prueba] Termo (500 ml · Acero)",
    "Total: $2,286.00 MXN",
    `Ver cotización: ${ENLACE}`
  ];
  let desde = 0;
  for (const linea of esperadas) {
    const i = t.indexOf(linea, desde);
    assert.ok(i >= desde, `falta o está fuera de orden: ${linea}`);
    desde = i + linea.length;
  }
});

test("sin costo de entrega avisa que el envío se cotiza aparte", () => {
  const t = textoWhatsApp(cotizacion());
  assert.match(t, /El costo de envío se cotiza aparte\./);
  assert.doesNotMatch(t, /Envío:/);
});

test("con costo de entrega lo muestra y el total ya lo incluye", () => {
  const t = textoWhatsApp(cotizacion({ costoEntrega: "150.00", total: "2436.00" }));
  assert.match(t, /Envío: \$150\.00/);
  assert.match(t, /Total: \$2,436\.00 MXN/);
  assert.doesNotMatch(t, /se cotiza aparte/);
});

test("el texto nunca incluye el token suelto fuera del enlace público", () => {
  const t = textoWhatsApp(cotizacion());
  assert.equal(t.split("abcdefghijklmnopqrstuvwxyz012345").length, 2);
});

test("el enlace conserva caracteres especiales, acentos y saltos de línea", () => {
  const texto = textoWhatsApp(
    cotizacion({
      cliente: { nombre: "Ñandú & Hijos #1?", celular: "5512345678" },
      renglones: [{ cantidad: 3, producto: "Taza 100%\nedición", variante: "Única" }]
    })
  );
  const enlace = enlaceWhatsApp(NUMERO_PRUEBA, texto);
  assert.ok(enlace.startsWith(`https://wa.me/${NUMERO_PRUEBA}?text=`));
  const parametro = enlace.split("?text=")[1];
  assert.doesNotMatch(parametro, /[&#?\n ]/);
  assert.equal(decodeURIComponent(parametro), texto);
});
