/**
 * Precio aplicable por rango de cantidad y vigencia (RN-002, RN-008).
 * Los precios van en centavos enteros; las fechas, en texto "AAAA-MM-DD"
 * (se comparan como texto, que en ese formato ordena igual que la fecha).
 *
 * @typedef {{ desde: number, hasta: number|null, precio: number,
 *             vigenteDesde: string, vigenteHasta: string|null, activo: boolean }} Rango
 */

/**
 * Rangos activos cuya vigencia incluye `hoy`, ordenados por `desde`.
 * @param {Rango[]} rangos
 * @param {string} hoy "AAAA-MM-DD" en la zona del negocio.
 * @returns {Rango[]}
 */
export function rangosVigentes(rangos, hoy) {
  return rangos
    .filter(
      (r) => r.activo && r.vigenteDesde <= hoy && (r.vigenteHasta === null || hoy <= r.vigenteHasta)
    )
    .sort((a, b) => a.desde - b.desde);
}

/**
 * @param {Rango[]} rangos
 * @param {number} cantidad Entero positivo.
 * @param {string} hoy "AAAA-MM-DD".
 * @returns {number|null} Precio unitario en centavos, o null si no hay rango (RN-008).
 */
export function precioAplicable(rangos, cantidad, hoy) {
  if (!Number.isSafeInteger(cantidad) || cantidad < 1) throw new TypeError("Cantidad inválida");
  // Si por error hubiera rangos traslapados (se impiden en la fase 6), gana el de `desde` mayor.
  const r = rangosVigentes(rangos, hoy)
    .filter((x) => x.desde <= cantidad && (x.hasta === null || cantidad <= x.hasta))
    .at(-1);
  return r ? r.precio : null;
}
