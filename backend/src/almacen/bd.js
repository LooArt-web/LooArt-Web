/**
 * Almacenamiento en la BD (tabla almacen_objeto, V003) — PROPUESTO / TEMPORAL.
 * ADR-002: el hosting gratuito (Render) no conserva el disco y R2 pide tarjeta,
 * así que mientras tanto los archivos viven en TiDB. Misma interfaz que disco y R2:
 * cambiar a R2 después es solo poner ALMACEN=r2.
 */
import { ErrorApi } from "../errores.js";
import { validarClave, codificarClave } from "./clave.js";

/** 5 MB: debajo del tamaño máximo de un registro en TiDB (6 MB). */
export const MAX_BYTES_BD = 5 * 1024 * 1024;

export function crearAlmacenBd({ db, urlBase = "/api/archivos" }) {
  return {
    urlPublica: (clave) => `${urlBase}/${codificarClave(clave)}`,

    async guardar(clave, buffer, mime) {
      validarClave(clave);
      if (buffer.length > MAX_BYTES_BD) {
        throw new ErrorApi(
          413,
          "ARCHIVO_DEMASIADO_GRANDE",
          "El archivo pasa de 5 MB, el máximo mientras los archivos se guardan en la base de datos."
        );
      }
      try {
        // execute (protocolo binario): el Buffer viaja como bytes, no como texto hexadecimal.
        await db.execute(
          "INSERT INTO almacen_objeto (clave, mime, bytes, tamano) VALUES (?, ?, ?, ?)",
          [clave, mime, buffer, buffer.length]
        );
      } catch (e) {
        // Igual que writeFile con flag "wx": nunca sobrescribe.
        if (e.code === "ER_DUP_ENTRY")
          throw Object.assign(new Error("Ya existe"), { code: "EEXIST" });
        throw e;
      }
    },

    async leer(clave) {
      validarClave(clave);
      const [[f]] = await db.query("SELECT bytes FROM almacen_objeto WHERE clave = ?", [clave]);
      return f ? Buffer.from(f.bytes) : null;
    },

    /** Archivo y tipo, para servirlo por HTTP. */
    async leerConTipo(clave) {
      validarClave(clave);
      const [[f]] = await db.query("SELECT mime, bytes FROM almacen_objeto WHERE clave = ?", [
        clave
      ]);
      return f ? { mime: f.mime, bytes: Buffer.from(f.bytes) } : null;
    },

    async borrar(clave) {
      validarClave(clave);
      await db.query("DELETE FROM almacen_objeto WHERE clave = ?", [clave]);
    },

    async listar(prefijo) {
      // LEFT() en lugar de LIKE: el prefijo se compara literal, sin comodines.
      const [filas] = await db.query(
        "SELECT clave FROM almacen_objeto WHERE LEFT(clave, CHAR_LENGTH(?)) = ? ORDER BY clave",
        [prefijo, prefijo]
      );
      return filas.map((f) => f.clave);
    }
  };
}
