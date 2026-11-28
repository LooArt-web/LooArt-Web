/**
 * Almacenamiento de archivos (A4). En esta fase solo arma URLs públicas;
 * guardar y borrar llegan en la fase 3. La BD guarda la clave, nunca el archivo.
 */

/** Codifica cada segmento de la clave sin tocar las "/". */
const codificar = (clave) => clave.split("/").map(encodeURIComponent).join("/");

/**
 * @param {{ almacen: { tipo: "disco"|"r2", r2: { urlPublica: string } | null } }} config
 * @returns {{ urlPublica: (clave: string) => string }}
 */
export function crearAlmacen(config) {
  const base =
    config.almacen.tipo === "r2" ? config.almacen.r2.urlPublica.replace(/\/+$/, "") : "/archivos";
  return { urlPublica: (clave) => `${base}/${codificar(clave)}` };
}
