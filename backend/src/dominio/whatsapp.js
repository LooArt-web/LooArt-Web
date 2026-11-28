/**
 * Mensaje de WhatsApp de una cotización (RF-016, D10).
 *
 * El texto lleva el enlace público de consulta, nunca el token suelto, y el
 * número del negocio sale de la configuración (WHATSAPP_NEGOCIO).
 */
import { formatearPesos } from "./formato.js";

/**
 * @param {{ folio: string, cliente: { nombre: string, celular: string },
 *   renglones: Array<{ cantidad: number, producto: string, variante: string }>,
 *   subtotal: string, costoEntrega: string | null, total: string, enlacePublico: string }} c
 * @returns {string}
 */
export function textoWhatsApp(c) {
  const lineas = [
    "Hola, quiero dar seguimiento a mi cotización de LooArt.",
    "",
    `Folio: ${c.folio}`,
    `Nombre: ${c.cliente.nombre}`,
    `Celular: ${c.cliente.celular}`,
    "",
    ...c.renglones.map((r) => `- ${r.cantidad} × ${r.producto} (${r.variante})`),
    "",
    `Subtotal: ${formatearPesos(c.subtotal)}`
  ];
  if (c.costoEntrega === null) {
    lineas.push(`Total: ${formatearPesos(c.total)} MXN`, "El costo de envío se cotiza aparte.");
  } else {
    lineas.push(
      `Envío: ${formatearPesos(c.costoEntrega)}`,
      `Total: ${formatearPesos(c.total)} MXN`
    );
  }
  lineas.push("", `Ver cotización: ${c.enlacePublico}`);
  return lineas.join("\n");
}

/**
 * @param {string} numero Solo dígitos, con lada de país.
 * @param {string} texto
 * @returns {string} Enlace https://wa.me con el texto codificado.
 */
export function enlaceWhatsApp(numero, texto) {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
