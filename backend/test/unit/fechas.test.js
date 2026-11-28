import { test } from "node:test";
import assert from "node:assert/strict";
import { hoyMx } from "../../src/dominio/fechas.js";

test("hoyMx da la fecha de la Ciudad de México, no la de UTC", () => {
  // 05:30 del 1-ene en UTC son las 23:30 del 31-dic en CDMX (UTC-6).
  assert.equal(hoyMx(new Date("2027-01-01T05:30:00Z")), "2026-12-31");
  assert.equal(hoyMx(new Date("2027-01-01T06:00:00Z")), "2027-01-01");
});

test("hoyMx rechaza fechas inválidas", () => {
  assert.throws(() => hoyMx(new Date("no-es-fecha")), TypeError);
  assert.throws(() => hoyMx("2026-01-01"), TypeError);
});
