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
 */
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

  r.post("/", limiteAlta, subida.any(), async (req, res) => {
    const datos = validarCotizacion(req.body?.datos);
    const imagenes = validarImagenes(req.files, datos.renglones.length);
    res.status(201).json(await servicio.crear(datos, imagenes));
  });

  r.get("/:token", async (req, res) => {
    // Un token mal formado se trata igual que uno inexistente: no da pistas.
    if (!TOKEN_VALIDO.test(req.params.token)) {
      throw new ErrorApi(404, "NO_ENCONTRADO", "La cotización no existe.");
    }
    res.set("Cache-Control", "no-store");
    res.json(await servicio.consultar(req.params.token));
  });

  return r;
}
