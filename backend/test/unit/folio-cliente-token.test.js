import { test } from "node:test";
import assert from "node:assert/strict";
import { formatearFolio } from "../../src/dominio/folio.js";
import { normalizarCelular } from "../../src/dominio/cliente.js";
import { generarToken, TOKEN_VALIDO } from "../../src/dominio/token.js";

test("formatearFolio arma LA-AAAA-NNNNNN (RN-020)", () => {
  assert.equal(formatearFolio(2026, 1), "LA-2026-000001");
  assert.equal(formatearFolio(2027, 123456), "LA-2027-123456");
});

test("formatearFolio rechaza consecutivos fuera de rango", () => {
  for (const malo of [0, -1, 1.5, 1000000])
    assert.throws(() => formatearFolio(2026, malo), RangeError);
});

test("normalizarCelular deja 10 dígitos y quita un +52 inicial (RN-012)", () => {
  assert.equal(normalizarCelular("55 1234 5678"), "5512345678");
  assert.equal(normalizarCelular("(55) 1234-5678"), "5512345678");
  assert.equal(normalizarCelular("+52 55 1234 5678"), "5512345678");
  assert.equal(normalizarCelular("525512345678"), "5512345678");
});

test("normalizarCelular devuelve null si no son 10 dígitos válidos", () => {
  for (const malo of [
    "12345",
    "55123456789",
    "55-1234-567a",
    "+1 555 123 4567",
    "",
    "0512345678"
  ]) {
    assert.equal(normalizarCelular(malo), null, malo);
  }
});

test("generarToken: 32 caracteres URL-seguros y distintos cada vez (RN-021)", () => {
  const vistos = new Set();
  for (let i = 0; i < 1000; i++) {
    const t = generarToken();
    assert.match(t, TOKEN_VALIDO);
    vistos.add(t);
  }
  assert.equal(vistos.size, 1000);
});
