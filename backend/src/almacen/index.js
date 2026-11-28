/**
 * Almacenamiento de archivos (A4). La BD guarda la clave, nunca el archivo.
 *   disco → desarrollo y pruebas (carpeta backend/almacen-local, fuera de git)
 *   bd    → hosting sin disco persistente ni R2 (ADR-002, temporal): tabla almacen_objeto
 *   r2    → producción. Solo arma URLs; guardar y borrar llegan con el
 *           despliegue (fase 11), así que por ahora fallan de forma explícita.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crearAlmacenDisco } from "./disco.js";
import { crearAlmacenBd } from "./bd.js";

const DIR_LOCAL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../almacen-local");
const codificar = (clave) => clave.split("/").map(encodeURIComponent).join("/");

export function crearAlmacen(config, db) {
  if (config.almacen.tipo === "bd") return crearAlmacenBd({ db });
  if (config.almacen.tipo !== "r2") return crearAlmacenDisco({ dir: DIR_LOCAL });
  const base = config.almacen.r2.urlPublica.replace(/\/+$/, "");
  const pendiente = async () => {
    throw new Error("El almacenamiento en R2 se implementa en la fase 11");
  };
  return {
    urlPublica: (clave) => `${base}/${codificar(clave)}`,
    guardar: pendiente,
    leer: pendiente,
    borrar: pendiente
  };
}
