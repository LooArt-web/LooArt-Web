import { test } from "node:test";
import assert from "node:assert/strict";
import { aCentavos, aTextoDecimal } from "../../src/dominio/dinero.js";

test("aCentavos convierte el texto DECIMAL de MySQL a centavos enteros", () => {
  assert.equal(aCentavos("123.45"), 12345);
  assert.equal(aCentavos("12"), 1200);
  assert.equal(aCentavos("12.5"), 1250);
  assert.equal(aCentavos("0.05"), 5);
});

test("aCentavos suma sin errores de coma flotante", () => {
  // Con float: 0.1 + 0.2 = 0.30000000000000004
  assert.equal(aCentavos("0.10") + aCentavos("0.20"), 30);
});

test("aCentavos no pierde precisión con el máximo de DECIMAL(12,2)", () => {
  assert.equal(aCentavos("1234567890.99"), 123456789099);
  assert.equal(aCentavos("9999999999.99"), 999999999999);
});

test("aCentavos rechaza lo que no es un importe válido", () => {
  for (const malo of ["1.234", "abc", "1e3", "-1.00", "", " 1.00", "1.", ".5", "0x10", "١٢"]) {
    assert.throws(() => aCentavos(malo), TypeError, `debió rechazar ${JSON.stringify(malo)}`);
  }
  assert.throws(() => aCentavos(12.5), TypeError, "solo acepta texto");
  assert.throws(() => aCentavos(null), TypeError);
});

test("aTextoDecimal convierte centavos al texto que espera MySQL", () => {
  assert.equal(aTextoDecimal(12345), "123.45");
  assert.equal(aTextoDecimal(5), "0.05");
  assert.equal(aTextoDecimal(0), "0.00");
  assert.equal(aTextoDecimal(1200), "12.00");
  assert.equal(aTextoDecimal(999999999999), "9999999999.99");
});

test("aTextoDecimal rechaza centavos que no son enteros no negativos", () => {
  for (const malo of [1.5, -1, NaN, Infinity, "100", Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => aTextoDecimal(malo), TypeError, `debió rechazar ${String(malo)}`);
  }
});
