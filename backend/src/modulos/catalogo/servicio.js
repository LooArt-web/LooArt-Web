/**
 * Arma las respuestas del catálogo público (contrato D1 de PLAN.md).
 * El dinero viaja como texto decimal exacto ("180.00"), nunca como float.
 */
import * as repo from "./repositorio.js";
import { aCentavos, aTextoDecimal } from "../../dominio/dinero.js";
import { hoyMx } from "../../dominio/fechas.js";
import { rangosVigentes } from "../../dominio/precios.js";
import { ErrorApi } from "../../errores.js";

export function crearServicioCatalogo({ db, almacen, reloj }) {
  const url = (clave) => (clave ? almacen.urlPublica(clave) : null);

  const resumen = (p) => ({
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion,
    maqueta: p.maqueta,
    categoria: { id: p.idCategoria, nombre: p.nombreCategoria },
    imagenPrincipal: p.rutaPrincipal
      ? { url: url(p.rutaPrincipal), textoAlternativo: p.altPrincipal }
      : null
  });

  return {
    categorias: () => repo.categoriasActivas(db),

    productos: async (filtro) => (await repo.productosActivos(db, filtro)).map(resumen),

    async producto(id) {
      const p = await repo.productoActivo(db, id);
      if (!p) throw new ErrorApi(404, "NO_ENCONTRADO", "El producto no existe.");

      const variantes = await repo.variantesActivas(db, id);
      const [precios, colores, galeria] = await Promise.all([
        repo.preciosDeVariantes(
          db,
          variantes.map((v) => v.id)
        ),
        repo.coloresActivos(db, id),
        repo.galeriaActiva(db, id)
      ]);

      const hoy = hoyMx(reloj());
      const rangos = precios.map((r) => ({
        ...r,
        activo: r.activo === 1,
        precio: aCentavos(r.precio)
      }));

      return {
        ...resumen(p),
        recorte: p.recorte,
        colores,
        galeria: galeria.map(({ ruta, ...a }) => ({ ...a, url: url(ruta) })),
        variantes: variantes.map((v) => ({
          ...v,
          precios: rangosVigentes(
            rangos.filter((r) => r.idVariante === v.id),
            hoy
          ).map((r) => ({
            desde: r.desde,
            hasta: r.hasta,
            precioUnitario: aTextoDecimal(r.precio)
          }))
        }))
      };
    },

    tematicas: async () =>
      (await repo.tematicasActivas(db)).map((t) => ({ ...t, imagen: url(t.imagen) }))
  };
}
