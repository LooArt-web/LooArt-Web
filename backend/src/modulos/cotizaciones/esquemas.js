import { z } from "zod";
import { ErrorApi } from "../../errores.js";
import { normalizarCelular } from "../../dominio/cliente.js";

const id = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
/** Texto opcional: se recorta; vacío equivale a no enviarlo. */
const textoOpcional = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => s || undefined)
    .optional();

/** Igual que normalizarDiseno() de js/vista-previa.js, pero sin corregir: rechaza. */
const diseno = z
  .object({
    modo: z.enum(["centro", "repetida", "envolvente"]),
    tamano: z.number().min(0).max(1),
    separacion: z.number().min(0).max(0.6),
    intercalado: z.boolean(),
    angulo: z.number().min(-180).max(180),
    escala: z.number().min(0.4).max(1.8),
    posX: z.number().min(0).max(1),
    posY: z.number().min(0).max(1),
    cara: z.enum(["frente", "reverso", "ambos"])
  })
  .strict();

const renglon = z
  .object({
    idVariante: id,
    cantidad: z.number().int().min(1).max(100_000),
    color: textoOpcional(80),
    idTematica: id.optional(),
    tema: textoOpcional(150), // temática escrita por el comprador
    texto: textoOpcional(500),
    descripcion: textoOpcional(2000),
    diseno: diseno.optional()
  })
  .strict()
  .refine((r) => !(r.idTematica && r.tema), "Elige una temática o escribe la tuya, no ambas");

const cliente = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(2)
      .max(120)
      .regex(/^[\p{L}\p{M}' .-]+$/u),
    celular: z.string().transform((s, ctx) => {
      const n = normalizarCelular(s);
      if (!n) ctx.addIssue({ code: "custom", message: "Celular inválido" });
      return n ?? z.NEVER;
    }),
    correo: z.string().trim().toLowerCase().max(150).pipe(z.email()),
    cp: z.string().regex(/^\d{5}$/)
  })
  .strict();

const cotizacion = z.object({ cliente, renglones: z.array(renglon).min(1).max(50) }).strict();

const invalido = () => new ErrorApi(400, "DATOS_INVALIDOS", "Revisa los datos de la cotización.");

/** Campo `datos` del multipart → objeto validado. */
export function validarCotizacion(texto) {
  if (typeof texto !== "string") throw invalido();
  let crudo;
  try {
    crudo = JSON.parse(texto);
  } catch {
    throw invalido();
  }
  const r = cotizacion.safeParse(crudo);
  if (!r.success) throw invalido();
  return r.data;
}

/**
 * Imágenes de referencia: campo `imagen_N`, una por renglón como máximo (RN-025, RN-026).
 * @returns {Map<number, Express.Multer.File>} índice del renglón → archivo
 */
export function validarImagenes(archivos = [], numRenglones) {
  const porRenglon = new Map();
  for (const a of archivos) {
    const m = /^imagen_(0|[1-9]\d?)$/.exec(a.fieldname);
    const i = m ? Number(m[1]) : -1;
    if (i < 0 || i >= numRenglones || porRenglon.has(i)) throw invalido();
    porRenglon.set(i, a);
  }
  return porRenglon;
}
