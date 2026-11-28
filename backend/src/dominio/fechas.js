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

const formatoHora = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_NEGOCIO,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
});

/**
 * @param {Date} ahora
 * @returns {string} "AAAA-MM-DD HH:MM:SS" en la Ciudad de México (DATETIME de MySQL).
 */
export function ahoraMx(ahora) {
  return `${hoyMx(ahora)} ${formatoHora.format(ahora)}`;
}

/**
 * Un mes calendario después, sin desbordar el fin de mes (31-ene → 28/29-feb). RN-019.
 * @param {string} fecha "AAAA-MM-DD"
 * @returns {string} "AAAA-MM-DD"
 */
export function sumarUnMes(fecha) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  const [a, mes, d] = m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [];
  // Se valida que la fecha exista (sin 30-feb ni mes 13) reconstruyéndola en UTC.
  const valida = m && new Date(Date.UTC(a, mes - 1, d)).toISOString().slice(0, 10) === fecha;
  if (!valida) throw new TypeError("Fecha inválida");

  const anioSig = mes === 12 ? a + 1 : a;
  const mesSig = mes === 12 ? 1 : mes + 1;
  const ultimoDia = new Date(Date.UTC(anioSig, mesSig, 0)).getUTCDate();
  const dia = Math.min(d, ultimoDia);
  return `${anioSig}-${String(mesSig).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
