/**
 * Fechas de negocio en la zona de la Ciudad de México (RN-019).
 * El servidor puede correr en UTC; "hoy" para LooArt es el día en CDMX.
 */
export const ZONA_NEGOCIO = "America/Mexico_City";

const formatoDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_NEGOCIO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

/**
 * @param {Date} ahora Normalmente `new Date()`; se inyecta para poder probar.
 * @returns {string} "AAAA-MM-DD" en la Ciudad de México.
 */
export function hoyMx(ahora) {
  if (!(ahora instanceof Date) || Number.isNaN(ahora.getTime())) {
    throw new TypeError("Fecha inválida");
  }
  return formatoDia.format(ahora); // en-CA ya da AAAA-MM-DD
}
