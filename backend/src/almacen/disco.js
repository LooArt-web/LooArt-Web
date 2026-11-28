/**
 * Almacenamiento en disco para desarrollo y pruebas (A4). Misma interfaz que R2.
 * Las claves las genera el servidor; aun así se validan para que nunca salgan de `dir`.
 */
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";

const CLAVE_VALIDA = /^[a-z0-9][a-z0-9/_.-]*$/;
const codificar = (clave) => clave.split("/").map(encodeURIComponent).join("/");

export function crearAlmacenDisco({ dir, urlBase = "/archivos" }) {
  const ruta = (clave) => {
    const r = path.resolve(dir, clave);
    if (
      !CLAVE_VALIDA.test(clave) ||
      clave.includes("..") ||
      !r.startsWith(path.resolve(dir) + path.sep)
    ) {
      throw new Error("Clave de almacenamiento inválida");
    }
    return r;
  };
  return {
    urlPublica: (clave) => `${urlBase}/${codificar(clave)}`,
    async guardar(clave, buffer) {
      const destino = ruta(clave);
      await mkdir(path.dirname(destino), { recursive: true });
      await writeFile(destino, buffer, { flag: "wx" }); // nunca sobrescribe
    },
    async borrar(clave) {
      await rm(ruta(clave), { force: true });
    }
  };
}
