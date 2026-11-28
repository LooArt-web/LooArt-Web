/**
 * PDF de una cotización (RF-015).
 *
 * Se arma solo con los snapshots guardados (producto, variante y precio al
 * momento de cotizar) y los datos de contacto del cliente: nunca se lee el
 * catálogo actual, así que un cambio de precio posterior no altera el PDF.
 *
 * Usa Helvetica, que viene incluida en pdfkit y codifica WinAnsi. Lo que no
 * cabe en esa codificación (emojis, otros alfabetos) se cambia por "?".
 */
import PDFDocument from "pdfkit";
import { formatearPesos } from "./formato.js";

// Caracteres de WinAnsi fuera de Latin-1 (rango 0x80–0x9F de Windows-1252).
const EXTRA_WINANSI = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

/**
 * @param {string | null | undefined} s
 * @returns {string} El texto con "?" en lugar de lo que Helvetica no puede mostrar.
 */
export function textoPdfSeguro(s) {
  if (s === null || s === undefined) return "";
  let r = "";
  for (const ch of String(s)) {
    const cp = ch.codePointAt(0);
    const ok =
      ch === "\n" ||
      (cp >= 0x20 && cp <= 0x7e) ||
      (cp >= 0xa0 && cp <= 0xff) ||
      EXTRA_WINANSI.has(ch);
    r += ok ? ch : "?";
  }
  return r;
}

const MARGEN = 50;
const COL = { producto: 50, cantidad: 330, unitario: 390, subtotal: 480, fin: 562 };

/**
 * @param {object} c Cotización como la arma la consulta por token, más
 *   `cliente: { nombre, celular, correo, cp }`.
 * @returns {Promise<Buffer>}
 */
export function generarPdfCotizacion(c) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margin: MARGEN,
      info: { Title: `Cotización ${c.folio}`, Author: "LooArt" }
    });
    const partes = [];
    doc.on("data", (b) => partes.push(b));
    doc.on("end", () => resolve(Buffer.concat(partes)));
    doc.on("error", reject);

    const limite = () => doc.page.height - MARGEN;
    const asegurarEspacio = (alto) => {
      if (doc.y + alto > limite()) {
        doc.addPage();
        encabezadoTabla();
      }
    };
    const t = textoPdfSeguro;

    function encabezadoTabla() {
      const y = doc.y;
      doc.font("Helvetica-Bold").fontSize(9);
      doc.text("Producto", COL.producto, y, { width: COL.cantidad - COL.producto - 10 });
      doc.text("Cant.", COL.cantidad, y, { width: 50, align: "right" });
      doc.text("P. unitario", COL.unitario, y, { width: 80, align: "right" });
      doc.text("Subtotal", COL.subtotal, y, { width: COL.fin - COL.subtotal, align: "right" });
      doc
        .moveTo(MARGEN, doc.y + 2)
        .lineTo(COL.fin, doc.y + 2)
        .stroke();
      doc.moveDown(0.5);
      doc.font("Helvetica").fontSize(9);
    }

    // Encabezado
    doc.font("Helvetica-Bold").fontSize(18).text("LooArt — Cotización", MARGEN, MARGEN);
    doc.moveDown(0.3).font("Helvetica").fontSize(10);
    doc.text(`Folio: ${t(c.folio)}`);
    doc.text(`Emisión: ${t(String(c.fechaEmision).slice(0, 10))}`);
    doc.text(`Vence: ${t(c.fechaVencimiento)}`);
    if (c.estatus?.nombre) doc.text(`Estatus: ${t(c.estatus.nombre)}`);

    // Cliente
    doc.moveDown(0.8).font("Helvetica-Bold").fontSize(11).text("Cliente", MARGEN);
    doc.font("Helvetica").fontSize(10);
    doc.text(`Nombre: ${t(c.cliente.nombre)}`);
    doc.text(`Celular: ${t(c.cliente.celular)}`);
    if (c.cliente.correo) doc.text(`Correo: ${t(c.cliente.correo)}`);
    if (c.cliente.cp) doc.text(`C. P.: ${t(c.cliente.cp)}`);

    // Renglones
    doc.moveDown(0.8);
    encabezadoTabla();
    const anchoProducto = COL.cantidad - COL.producto - 10;
    for (const r of c.renglones) {
      const nombre = `${t(r.producto)} (${t(r.variante)})`;
      const detalles = detallesPersonalizacion(r.personalizacion).map(t);
      const alto =
        doc.heightOfString(nombre, { width: anchoProducto }) +
        detalles.reduce((s, d) => s + doc.heightOfString(d, { width: anchoProducto - 8 }), 0) +
        6;
      asegurarEspacio(alto);

      const y = doc.y;
      doc.font("Helvetica").fontSize(9);
      doc.text(String(r.cantidad), COL.cantidad, y, { width: 50, align: "right" });
      doc.text(formatearPesos(r.precioUnitario), COL.unitario, y, { width: 80, align: "right" });
      doc.text(formatearPesos(r.subtotal), COL.subtotal, y, {
        width: COL.fin - COL.subtotal,
        align: "right"
      });
      doc.text(nombre, COL.producto, y, { width: anchoProducto });
      doc.fillColor("#555555");
      for (const d of detalles) doc.text(d, COL.producto + 8, doc.y, { width: anchoProducto - 8 });
      doc.fillColor("black");
      doc.moveDown(0.4);
    }

    // Totales
    asegurarEspacio(70);
    doc.moveTo(MARGEN, doc.y).lineTo(COL.fin, doc.y).stroke();
    doc.moveDown(0.4).fontSize(10);
    const fila = (etiqueta, valor, negrita = false) => {
      const y = doc.y;
      doc.font(negrita ? "Helvetica-Bold" : "Helvetica");
      doc.text(etiqueta, COL.unitario - 60, y, { width: 140, align: "right" });
      doc.text(valor, COL.subtotal, y, { width: COL.fin - COL.subtotal, align: "right" });
    };
    fila("Subtotal", formatearPesos(c.subtotal));
    if (c.costoEntrega !== null && c.costoEntrega !== undefined) {
      fila("Envío", formatearPesos(c.costoEntrega));
    }
    fila(`Total (${t(c.moneda ?? "MXN")})`, formatearPesos(c.total), true);

    doc.moveDown(1).font("Helvetica").fontSize(9);
    if (c.costoEntrega === null || c.costoEntrega === undefined) {
      doc.text("El costo de envío se cotiza aparte.", MARGEN);
    }
    doc.text(
      "Precios en pesos mexicanos. Esta cotización no compromete un pedido; " +
        "la confirmación se acuerda por WhatsApp.",
      MARGEN
    );
    doc.end();
  });
}

function detallesPersonalizacion(p) {
  if (!p) return [];
  const d = [];
  if (p.color) d.push(`Color: ${p.color}`);
  if (p.tematica) d.push(`Temática: ${p.tematica}`);
  if (p.tema) d.push(`Tema: ${p.tema}`);
  if (p.texto) d.push(`Texto: ${p.texto}`);
  if (p.descripcion) d.push(`Indicaciones: ${p.descripcion}`);
  if (p.tieneImagen) d.push("Con imagen de referencia");
  return d;
}
