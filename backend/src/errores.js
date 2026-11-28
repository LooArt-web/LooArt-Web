/**
 * Errores de la API con forma única:
 *   { "error": { "codigo", "mensaje", "idSolicitud" } }
 * Nunca se devuelven trazas, mensajes de SQL ni datos internos.
 */

export class ErrorApi extends Error {
  /**
   * @param {number} status Código HTTP (4xx o 5xx).
   * @param {string} codigo Código estable en MAYÚSCULAS para el front.
   * @param {string} mensaje Texto para mostrar a la persona.
   */
  constructor(status, codigo, mensaje) {
    super(mensaje);
    this.name = "ErrorApi";
    this.status = status;
    this.codigo = codigo;
  }
}

/** Errores que lanza express.json() y que sí son culpa de la petición. */
const ERRORES_DE_CUERPO = {
  "entity.too.large": [413, "CUERPO_DEMASIADO_GRANDE", "La petición es demasiado grande."],
  "entity.parse.failed": [400, "JSON_INVALIDO", "El cuerpo no es un JSON válido."],
  "encoding.unsupported": [415, "CODIFICACION_NO_SOPORTADA", "Codificación no soportada."]
};

/** Errores de multer (subida de archivos) que son culpa de la petición. */
const ERRORES_DE_SUBIDA = {
  LIMIT_FILE_SIZE: [413, "ARCHIVO_DEMASIADO_GRANDE", "Cada imagen debe pesar 5 MB o menos."],
  LIMIT_FIELD_VALUE: [413, "CUERPO_DEMASIADO_GRANDE", "La petición es demasiado grande."]
};

export function noEncontrado(_req, _res, next) {
  next(new ErrorApi(404, "NO_ENCONTRADO", "El recurso no existe."));
}

/**
 * @param {{ error: (obj: object) => void }} registro Destino de los logs.
 */
export function manejadorErrores(registro) {
  // Express reconoce un manejador de errores por sus 4 parámetros.
  return (err, req, res, _next) => {
    let status, codigo, mensaje;
    if (err instanceof ErrorApi) {
      ({ status, codigo, message: mensaje } = err);
    } else if (ERRORES_DE_CUERPO[err.type]) {
      [status, codigo, mensaje] = ERRORES_DE_CUERPO[err.type];
    } else if (err.name === "MulterError") {
      [status, codigo, mensaje] = ERRORES_DE_SUBIDA[err.code] ?? [
        400,
        "DATOS_INVALIDOS",
        "Los archivos enviados no son válidos."
      ];
    } else {
      [status, codigo, mensaje] = [500, "ERROR_INTERNO", "Ocurrió un error inesperado."];
      // Solo el tipo y el código: el mensaje crudo puede traer SQL o datos personales.
      registro.error({
        nivel: "error",
        idSolicitud: req.idSolicitud,
        metodo: req.method,
        ruta: req.baseUrl + req.path,
        tipo: err.name,
        codigo: err.code ?? null
      });
    }
    res.status(status).json({ error: { codigo, mensaje, idSolicitud: req.idSolicitud } });
  };
}
