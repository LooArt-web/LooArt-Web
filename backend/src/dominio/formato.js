/**
 * Formato de importes para textos dirigidos a personas (WhatsApp y PDF).
 */
import { aCentavos } from "./dinero.js";

/**
 * @param {string} texto Importe DECIMAL, p. ej. "2286.00".
 * @returns {string} Pesos con separador de miles, p. ej. "$2,286.00".
 */
export function formatearPesos(texto) {
  const centavos = aCentavos(texto);
  const pesos = String(Math.trunc(centavos / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${pesos}.${String(centavos % 100).padStart(2, "0")}`;
}
