/**
 * Dinero en centavos enteros (RN-005, ADR-001).
 *
 * mysql2 devuelve las columnas DECIMAL como texto ("123.45"). Aquí se
 * convierten a centavos sin pasar nunca por `float`, para que 0.10 + 0.20
 * dé exactamente 0.30. Hacia MySQL se manda otra vez como texto.
 */

const IMPORTE = /^(\d+)(?:\.(\d{1,2}))?$/;

/**
 * @param {string} texto Importe no negativo con hasta 2 decimales, p. ej. "123.45".
 * @returns {number} Centavos enteros, p. ej. 12345.
 */
export function aCentavos(texto) {
  const partes = typeof texto === "string" ? IMPORTE.exec(texto) : null;
  if (!partes) throw new TypeError("Importe inválido");
  const centavos = Number(partes[1]) * 100 + Number((partes[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(centavos)) throw new TypeError("Importe fuera de rango");
  return centavos;
}

/**
 * @param {number} centavos Entero no negativo.
 * @returns {string} Texto DECIMAL, p. ej. "123.45".
 */
export function aTextoDecimal(centavos) {
  if (!Number.isSafeInteger(centavos) || centavos < 0) {
    throw new TypeError("Centavos inválidos");
  }
  const pesos = Math.trunc(centavos / 100);
  const resto = String(centavos % 100).padStart(2, "0");
  return `${pesos}.${resto}`;
}
