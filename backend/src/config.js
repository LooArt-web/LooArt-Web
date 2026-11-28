/**
 * Configuración leída de variables de entorno y validada al arrancar.
 * Si algo falta o es inválido, el servidor no arranca, y el error nombra
 * la variable sin mostrar su valor (podría ser una contraseña).
 */
import { z } from "zod";

const texto = z.string().trim().min(1);
const puerto = z.coerce.number().int().min(1).max(65535);
const opcional = z.string().trim().optional();

const origen = z.string().refine((o) => {
  try {
    const u = new URL(o);
    return (u.protocol === "https:" || u.protocol === "http:") && u.origin === o;
  } catch {
    return false;
  }
});

const esquema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PUERTO: puerto.default(3000),
    DB_HOST: texto,
    DB_PUERTO: puerto.default(3306),
    DB_USUARIO: texto,
    DB_CLAVE: texto,
    DB_NOMBRE: texto,
    DB_TLS: z.enum(["true", "false"]).default("false"),
    ORIGENES_PERMITIDOS: z
      .string()
      .transform((s) =>
        s
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean)
      )
      .pipe(z.array(origen).min(1)),
    SECRETO_ORIGEN: z.string().trim().min(32).optional(),
    ALMACEN: z.enum(["disco", "r2"]).default("disco"),
    R2_CUENTA: opcional,
    R2_LLAVE: opcional,
    R2_SECRETO: opcional,
    R2_BUCKET: opcional,
    R2_URL_PUBLICA: opcional,
    WHATSAPP_NEGOCIO: z.string().regex(/^\d{12,13}$/),
    URL_SITIO: origen,
    SESION_HORAS: z.coerce.number().int().min(1).max(24).default(8),
    BLOQUEO_MINUTOS: z.coerce.number().int().min(1).max(1440).default(15)
  })
  .superRefine((v, ctx) => {
    if (v.ALMACEN !== "r2") return;
    for (const k of ["R2_CUENTA", "R2_LLAVE", "R2_SECRETO", "R2_BUCKET", "R2_URL_PUBLICA"]) {
      if (!v[k]) ctx.addIssue({ code: "custom", path: [k], message: "requerida con ALMACEN=r2" });
    }
  });

const CLAVES = Object.keys(esquema.shape);

function congelar(obj) {
  for (const v of Object.values(obj)) if (v && typeof v === "object") congelar(v);
  return Object.freeze(obj);
}

/**
 * @param {Record<string, string | undefined>} env Normalmente `process.env`.
 * @returns {Readonly<object>} Configuración congelada.
 */
export function leerConfig(env) {
  const entrada = {};
  for (const k of CLAVES) if (env[k] !== undefined && env[k] !== "") entrada[k] = env[k];

  const r = esquema.safeParse(entrada);
  if (!r.success) {
    const variables = [...new Set(r.error.issues.map((i) => String(i.path[0])))];
    throw new Error(`Configuración inválida o incompleta: ${variables.join(", ")}`);
  }
  const v = r.data;
  return congelar({
    entorno: v.NODE_ENV,
    puerto: v.PUERTO,
    db: {
      host: v.DB_HOST,
      puerto: v.DB_PUERTO,
      usuario: v.DB_USUARIO,
      clave: v.DB_CLAVE,
      nombre: v.DB_NOMBRE,
      tls: v.DB_TLS === "true"
    },
    origenesPermitidos: v.ORIGENES_PERMITIDOS,
    secretoOrigen: v.SECRETO_ORIGEN ?? null,
    almacen: {
      tipo: v.ALMACEN,
      r2:
        v.ALMACEN === "r2"
          ? {
              cuenta: v.R2_CUENTA,
              llave: v.R2_LLAVE,
              secreto: v.R2_SECRETO,
              bucket: v.R2_BUCKET,
              urlPublica: v.R2_URL_PUBLICA
            }
          : null
    },
    whatsappNegocio: v.WHATSAPP_NEGOCIO,
    urlSitio: v.URL_SITIO,
    sesionHoras: v.SESION_HORAS,
    bloqueoMinutos: v.BLOQUEO_MINUTOS
  });
}
