/**
 * Celular de México a 10 dígitos (RN-012). Acepta espacios, guiones, puntos,
 * paréntesis y un "+52"/"52" inicial. Las ladas en México no empiezan con 0 ni 1.
 * @param {string} texto
 * @returns {string|null} "5512345678", o null si no es válido.
 */
export function normalizarCelular(texto) {
  if (typeof texto !== "string" || !/^[+\d\s().-]+$/.test(texto)) return null;
  let digitos = texto.replace(/\D/g, "");
  if (digitos.length === 12 && digitos.startsWith("52")) digitos = digitos.slice(2);
  return /^[2-9]\d{9}$/.test(digitos) ? digitos : null;
}
