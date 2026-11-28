import { Router } from "express";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import { crearServicioCotizaciones } from "./servicio.js";
import { validarCotizacion, validarImagenes } from "./esquemas.js";
import { ErrorApi } from "../../errores.js";
import { TOKEN_VALIDO } from "../../dominio/token.js";

/** Imágenes en memoria: se validan sus bytes antes de subirlas (RN-026). */
const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 50, fields: 1, fieldSize: 200 * 1024, parts: 51 }
});

/**
 * POST /api/cotizaciones          multipart: `datos` (JSON) + `imagen_N` opcionales
 * GET  /api/cotizaciones/:token   consulta pública, solo con el token (RN-021)
 * GET  /api/cotizaciones/:token/pdf               PDF de la cotización (RF-015)
 * GET  /api/cotizaciones/:token/mensaje-whatsapp  texto y enlace wa.me (RF-016)
 */

const FOLIO_VALIDO = /^LA-\d{4}-\d{6}$/;

/** PDF: 20 descargas por IP cada 15 minutos si no se configura otra cosa. */
const LIMITE_PDF = { ventanaMs: 15 * 60 * 1000, max: 20 };

/** Tope del alta completa (datos + imágenes): 4 imágenes de 5 MB. Protege la memoria de Render. */
export const MAX_CUERPO_ALTA = 20 * 1024 * 1024;

/** Sin Content-Length no se puede saber el tamaño antes de leer: se rechaza. */
function limitarCuerpo(req, res, next) {
  const largo = req.get("content-length");
  if (largo === undefined) {
    res.set("Connection", "close");
    return next(new ErrorApi(411, "LONGITUD_REQUERIDA", "La petición debe indicar su tamaño."));
  }
  if (Number(largo) > MAX_CUERPO_ALTA) {
    res.set("Connection", "close");
    return next(
      new ErrorApi(
        413,
        "CUERPO_DEMASIADO_GRANDE",
        "La cotización pasa de 20 MB entre todas las imágenes."
      )
    );
  }
  next();
}

/** Un token mal formado se trata igual que uno inexistente: no da pistas. */
function exigirToken(req, _res, next) {
  if (!TOKEN_VALIDO.test(req.params.token)) {
    return next(new ErrorApi(404, "NO_ENCONTRADO", "La cotización no existe."));
  }
  next();
}

export function rutasCotizaciones({ limites, ...deps }) {
  const servicio = crearServicioCotizaciones(deps);
  const r = Router();

  const limiteAlta = rateLimit({
    windowMs: limites.cotizaciones.ventanaMs,
    limit: limites.cotizaciones.max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(
        new ErrorApi(429, "DEMASIADAS_PETICIONES", "Espera unos minutos antes de volver a cotizar.")
      )
  });

  r.post("/", limiteAlta, limitarCuerpo, subida.any(), async (req, res) => {
    const datos = validarCotizacion(req.body?.datos);
    const imagenes = validarImagenes(req.files, datos.renglones.length);
    res.status(201).json(await servicio.crear(datos, imagenes));
  });

  const pdf = limites.pdf ?? LIMITE_PDF;
  const limitePdf = rateLimit({
    windowMs: pdf.ventanaMs,
    limit: pdf.max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(
        new ErrorApi(
          429,
          "DEMASIADAS_PETICIONES",
          "Espera unos minutos antes de volver a descargar."
        )
      )
  });

  r.get("/:token", exigirToken, async (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(await servicio.consultar(req.params.token));
  });

  r.get("/:token/pdf", limitePdf, exigirToken, async (req, res) => {
    const { folio, buffer } = await servicio.pdf(req.params.token);
    // El folio lo genera el servidor; aun así se valida antes de ponerlo en una cabecera.
    if (!FOLIO_VALIDO.test(folio)) throw new Error("Folio con formato inesperado");
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${folio}.pdf"`,
      "Cache-Control": "private, no-store"
    });
    res.send(buffer);
  });

  r.get("/:token/mensaje-whatsapp", exigirToken, async (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(await servicio.mensajeWhatsapp(req.params.token));
  });

  return r;
}
