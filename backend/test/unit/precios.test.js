import { test } from "node:test";
import assert from "node:assert/strict";
import { rangosVigentes, precioAplicable } from "../../src/dominio/precios.js";

const HOY = "2026-11-27";
/** Rango con valores por omisión; precio en centavos. */
const r = (o) => ({
  desde: 1,
  hasta: null,
  precio: 1000,
  vigenteDesde: "2026-01-01",
  vigenteHasta: null,
  activo: true,
  ...o
});

test("rangosVigentes deja solo los activos cuya vigencia incluye hoy, ordenados por cantidad", () => {
  const rangos = [
    r({ desde: 12, precio: 900 }),
    r({ desde: 1, hasta: 11, precio: 1000 }),
    r({ precio: 1, activo: false }),
    r({ precio: 2, vigenteHasta: "2026-11-26" }), // venció ayer
    r({ precio: 3, vigenteDesde: "2026-11-28" }), // empieza mañana
    r({ precio: 4, vigenteHasta: HOY }) // termina hoy: sí aplica
  ];
  assert.deepEqual(
    rangosVigentes(rangos, HOY).map((x) => x.precio),
    [1000, 4, 900]
  );
});

test("precioAplicable respeta los bordes de los rangos (desde y hasta incluidos)", () => {
  const rangos = [r({ desde: 1, hasta: 11, precio: 1800 }), r({ desde: 12, precio: 1600 })];
  assert.equal(precioAplicable(rangos, 1, HOY), 1800);
  assert.equal(precioAplicable(rangos, 11, HOY), 1800);
  assert.equal(precioAplicable(rangos, 12, HOY), 1600);
  assert.equal(precioAplicable(rangos, 5000, HOY), 1600);
});

test("precioAplicable devuelve null si no hay rango vigente para esa cantidad (RN-008)", () => {
  assert.equal(precioAplicable([r({ desde: 10 })], 9, HOY), null);
  assert.equal(precioAplicable([r({ vigenteHasta: "2026-01-31" })], 5, HOY), null);
  assert.equal(precioAplicable([], 5, HOY), null);
});

test("precioAplicable solo acepta cantidades enteras positivas", () => {
  for (const mala of [0, -1, 1.5, NaN, "5"]) {
    assert.throws(() => precioAplicable([r({})], mala, HOY), TypeError, String(mala));
  }
});
