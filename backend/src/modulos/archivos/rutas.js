import { Router } from "express";
import { ErrorApi } from "../../errores.js";

/**
 * GET /api/archivos/<clave> — archivos públicos del catálogo guardados con
 * ALMACEN=bd (o disco en desarrollo). Solo se sirven las carpetas del catálogo:
 * las imágenes de referencia de los clientes y los PDF son privados y aquí dan 404
 * (los PDF salen por /api/cotizaciones/:token/pdf).
 */
const PUBLICAS = ["productos/", "tematicas/"];

export function rutasArchivos({ almacen }) {
  const r = Router();
  r.get("/*ruta", async (req, res) => {
    const clave = req.params.ruta.join("/");
    const noExiste = () => new ErrorApi(404, "NO_ENCONTRADO", "El archivo no existe.");
    if (!PUBLICAS.some((p) => clave.startsWith(p)) || !almacen.leerConTipo) throw noExiste();
    let archivo;
    try {
      archivo = await almacen.leerConTipo(clave);
    } catch (e) {
      if (/Clave de almacenamiento/.test(e.message)) throw noExiste();
      throw e;
    }
    if (!archivo) throw noExiste();
    res.set({
      "Content-Type": archivo.mime,
      // Las claves nunca se sobrescriben (guardar falla con EEXIST): el contenido no cambia.
      "Cache-Control": "public, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff"
    });
    res.send(archivo.bytes);
  });
  return r;
}
