import { test } from "node:test";
import assert from "node:assert/strict";
import { ahoraMx, sumarUnMes } from "../../src/dominio/fechas.js";

test("ahoraMx da fecha y hora de CDMX en formato DATETIME de MySQL", () => {
  assert.equal(ahoraMx(new Date("2027-01-01T05:30:09Z")), "2026-12-31 23:30:09");
  assert.equal(ahoraMx(new Date("2026-11-27T18:00:00Z")), "2026-11-27 12:00:00");
});

test("sumarUnMes suma un mes calendario (RN-019)", () => {
  assert.equal(sumarUnMes("2026-11-27"), "2026-12-27");
  assert.equal(sumarUnMes("2026-12-15"), "2027-01-15", "cambia de año");
});

test("sumarUnMes no se desborda a fin de mes", () => {
  assert.equal(sumarUnMes("2026-01-31"), "2026-02-28");
  assert.equal(sumarUnMes("2028-01-31"), "2028-02-29", "año bisiesto");
  assert.equal(sumarUnMes("2026-03-31"), "2026-04-30");
  assert.equal(sumarUnMes("2026-01-29"), "2026-02-28");
});

test("sumarUnMes rechaza fechas inválidas", () => {
  for (const mala of ["2026-02-30", "2026-13-01", "27/11/2026", ""]) {
    assert.throws(() => sumarUnMes(mala), TypeError, mala);
  }
});
