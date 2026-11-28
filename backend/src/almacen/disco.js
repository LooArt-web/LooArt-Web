/**
 * Almacenamiento en disco para desarrollo y pruebas (A4). Misma interfaz que R2.
 * Las claves las genera el servidor; aun así se validan para que nunca salgan de `dir`.
 */
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".glb": "model/gltf-binary"
};
const CLAVE_VALIDA = /^[a-z0-9][a-z0-9/_.-]*$/;
const codificar = (clave) => clave.split("/").map(encodeURIComponent).join("/");

export function crearAlmacenDisco({ dir, urlBase = "/api/archivos" }) {
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
      await writeFile(destino, buffer, { flag: "wx" }); // nunca sobrescribe (EEXIST)
    },
    async leer(clave) {
      try {
        return await readFile(ruta(clave));
      } catch (e) {
        if (e.code === "ENOENT") return null;
        throw e;
      }
    },
    async leerConTipo(clave) {
      const bytes = await this.leer(clave);
      return bytes
        ? { mime: MIME[path.extname(clave)] ?? "application/octet-stream", bytes }
        : null;
    },
    async borrar(clave) {
      await rm(ruta(clave), { force: true });
    }
  };
}
