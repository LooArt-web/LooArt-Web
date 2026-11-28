/**
 * Folio LA-AAAA-NNNNNN, consecutivo por año (RN-020).
 * El consecutivo lo da MySQL (folio_secuencia) dentro de la transacción del alta.
 */
export function formatearFolio(anio, consecutivo) {
  if (!Number.isInteger(consecutivo) || consecutivo < 1 || consecutivo > 999999) {
    throw new RangeError("Consecutivo de folio fuera de rango");
  }
  return `LA-${anio}-${String(consecutivo).padStart(6, "0")}`;
}
