import { Router } from "express";
import { crearServicioCatalogo } from "./servicio.js";
import { validarId, validarConsultaProductos, validarConsultaVacia } from "./esquemas.js";

/** El catálogo cambia poco: el navegador y Cloudflare pueden guardarlo un minuto. */
function cacheCorta(_req, res, next) {
  res.set("Cache-Control", "public, max-age=60");
  next();
}

/**
 * Catálogo público, de solo lectura (RF-007, RF-008).
 *   GET /api/catalogo/categorias
 *   GET /api/catalogo/productos?categoria=
 *   GET /api/catalogo/productos/:id
 *   GET /api/tematicas
 */
export function rutasCatalogo(deps) {
  const servicio = crearServicioCatalogo(deps);
  const catalogo = Router();
  catalogo.use(cacheCorta);

  catalogo.get("/categorias", async (req, res) => {
    validarConsultaVacia(req.query);
    res.json({ datos: await servicio.categorias() });
  });

  catalogo.get("/productos", async (req, res) => {
    const filtro = validarConsultaProductos(req.query);
    res.json({ datos: await servicio.productos(filtro) });
  });

  catalogo.get("/productos/:id", async (req, res) => {
    const id = validarId(req.params.id);
    validarConsultaVacia(req.query);
    res.json(await servicio.producto(id));
  });

  const tematicas = Router();
  tematicas.use(cacheCorta);
  tematicas.get("/", async (req, res) => {
    validarConsultaVacia(req.query);
    res.json({ datos: await servicio.tematicas() });
  });

  return { catalogo, tematicas };
}
