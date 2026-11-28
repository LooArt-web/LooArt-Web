/**
 * Alta y consulta pública de cotizaciones (RF-009 a RF-014).
 *
 * Orden del alta (A5 de PLAN.md):
 *   1. Validar cuerpo e imágenes (bytes reales).
 *   2. Subir las imágenes con nombre generado por el servidor.
 *   3. Una transacción: recalcular precios con la BD, cliente, folio, cotización,
 *      renglones, personalizaciones, archivos e historial.
 *   4. Si algo falla después de subir, se borran las imágenes: nunca queda un
 *      registro apuntando a un archivo inexistente ni un archivo sin registro.
 */
import { randomUUID } from "node:crypto";
import * as repo from "./repositorio.js";
import { conTransaccion } from "../../db.js";
import { ErrorApi } from "../../errores.js";
import { aCentavos, aTextoDecimal } from "../../dominio/dinero.js";
import { ahoraMx, hoyMx, sumarUnMes } from "../../dominio/fechas.js";
import { precioAplicable } from "../../dominio/precios.js";
import { formatearFolio } from "../../dominio/folio.js";
import { generarToken } from "../../dominio/token.js";
import { detectarImagen, EXTENSION } from "../../dominio/archivos.js";

const noDisponible = (n, codigo, mensaje) =>
  new ErrorApi(422, codigo, `Producto del renglón ${n}: ${mensaje}`);

const varianteSnapshot = (v) => [v.nombre, v.presentacion, v.material].filter(Boolean).join(" · ");

const tienePersonalizacion = (r, conImagen) =>
  conImagen ||
  ["color", "idTematica", "tema", "texto", "descripcion", "diseno"].some((k) => r[k] !== undefined);

export function crearServicioCotizaciones({ db, almacen, reloj, registro }) {
  /** Valida bytes reales y sube; devuelve índice del renglón → datos del archivo guardado. */
  async function subirImagenes(imagenes, anio) {
    const preparadas = new Map();
    for (const [i, a] of imagenes) {
      const mime = detectarImagen(a.buffer);
      if (!mime) {
        throw new ErrorApi(422, "ARCHIVO_NO_PERMITIDO", "La imagen debe ser JPG, PNG o WebP.");
      }
      preparadas.set(i, {
        ruta: `referencias/${anio}/${randomUUID()}.${EXTENSION[mime]}`,
        mime,
        tamano: a.size,
        nombre: a.originalname.slice(-255) || "imagen",
        buffer: a.buffer
      });
    }
    const subidas = [];
    try {
      for (const p of preparadas.values()) {
        await almacen.guardar(p.ruta, p.buffer, p.mime);
        subidas.push(p.ruta);
      }
    } catch (e) {
      await borrarSilencioso(subidas);
      throw e;
    }
    return preparadas;
  }

  async function borrarSilencioso(rutas) {
    for (const ruta of rutas) {
      await almacen.borrar(ruta).catch(() => {
        // Queda huérfano: lo limpia la depuración programada (fase 9). Sin datos personales.
        registro.error({ nivel: "error", evento: "archivo_huerfano", ruta });
      });
    }
  }

  async function crear(datos, imagenes) {
    const ahora = reloj();
    const fechaEmision = ahoraMx(ahora);
    const hoy = hoyMx(ahora);
    const anio = Number(hoy.slice(0, 4));

    const archivos = await subirImagenes(imagenes, anio);
    try {
      return await conTransaccion(db, (cx) =>
        guardar(cx, datos, archivos, { fechaEmision, hoy, anio })
      );
    } catch (e) {
      await borrarSilencioso([...archivos.values()].map((a) => a.ruta));
      throw e;
    }
  }

  async function guardar(cx, { cliente, renglones }, archivos, { fechaEmision, hoy, anio }) {
    const ids = [...new Set(renglones.map((r) => r.idVariante))];
    const variantes = new Map((await repo.variantesCotizables(cx, ids)).map((v) => [v.id, v]));
    const precios = (await repo.preciosActivos(cx, ids)).map((p) => ({
      ...p,
      activo: true,
      precio: aCentavos(p.precio)
    }));
    const idsTematica = [...new Set(renglones.map((r) => r.idTematica).filter(Boolean))];
    const tematicas = new Set(await repo.tematicasActivas(cx, idsTematica));

    // RN-014: el precio sale de la BD; el navegador no puede mandarlo (esquema estricto).
    const calculados = renglones.map((r, i) => {
      const n = i + 1;
      const v = variantes.get(r.idVariante);
      if (!v) throw noDisponible(n, "PRODUCTO_NO_DISPONIBLE", "ya no está disponible.");
      if (r.cantidad < v.cantidadMinima) {
        throw noDisponible(n, "CANTIDAD_MINIMA", `el mínimo es ${v.cantidadMinima} piezas.`);
      }
      const precio = precioAplicable(
        precios.filter((p) => p.idVariante === v.id),
        r.cantidad,
        hoy
      );
      if (precio === null) throw noDisponible(n, "SIN_PRECIO", "no tiene precio vigente.");
      if (r.idTematica && !tematicas.has(r.idTematica)) {
        throw noDisponible(n, "TEMATICA_NO_DISPONIBLE", "la temática ya no está disponible.");
      }
      return { r, v, precio, subtotal: precio * r.cantidad };
    });

    const subtotal = calculados.reduce((s, c) => s + c.subtotal, 0);
    if (!Number.isSafeInteger(subtotal))
      throw new ErrorApi(422, "IMPORTE_EXCEDIDO", "El importe es demasiado grande.");
    // P1 (respondida): los precios de la versión de Luis son definitivos → NUEVA (T1), sin estimados.
    const estatus = await repo.estatusPorClave(cx, "NUEVA");

    const idCliente = await repo.insertarCliente(cx, cliente); // P2: un registro nuevo por cotización
    // El folio se toma al final, para que el bloqueo de la fila del año dure lo menos posible.
    const folio = formatearFolio(anio, await repo.siguienteConsecutivo(cx, anio));
    const token = generarToken();
    const fechaVencimiento = sumarUnMes(hoy);
    const idCotizacion = await repo.insertarCotizacion(cx, {
      idCliente,
      idEstatus: estatus.id,
      folio,
      token,
      fechaEmision,
      fechaVencimiento,
      subtotal: aTextoDecimal(subtotal),
      total: aTextoDecimal(subtotal) // RN-017: el envío se acuerda aparte (costo_entrega NULL)
    });

    for (const [i, { r, v, precio }] of calculados.entries()) {
      const idDetalle = await repo.insertarDetalle(cx, {
        idCotizacion,
        idVariante: v.id,
        cantidad: r.cantidad,
        precio: aTextoDecimal(precio),
        producto: v.producto,
        variante: varianteSnapshot(v)
      });
      const archivo = archivos.get(i);
      if (!tienePersonalizacion(r, !!archivo)) continue;
      const idPersonalizacion = await repo.insertarPersonalizacion(cx, { ...r, idDetalle });
      if (archivo) await repo.insertarArchivoReferencia(cx, { ...archivo, idPersonalizacion });
    }
    await repo.insertarHistorialInicial(cx, idCotizacion, estatus.id);

    return {
      folio,
      token,
      fechaEmision,
      fechaVencimiento,
      subtotal: aTextoDecimal(subtotal),
      total: aTextoDecimal(subtotal),
      estatus: { clave: estatus.clave, nombre: estatus.nombre }
    };
  }

  async function consultar(token) {
    const c = await repo.cotizacionPorToken(db, token);
    if (!c) throw new ErrorApi(404, "NO_ENCONTRADO", "La cotización no existe.");
    return {
      folio: c.folio,
      fechaEmision: c.fechaEmision,
      fechaVencimiento: c.fechaVencimiento,
      estatus: { clave: c.estatusClave, nombre: c.estatusNombre },
      cliente: { nombre: c.nombreCliente },
      moneda: c.moneda,
      renglones: c.renglones.map((r) => ({
        producto: r.producto,
        variante: r.variante,
        cantidad: r.cantidad,
        precioUnitario: r.precioUnitario,
        subtotal: r.subtotal,
        personalizacion: r.idPers
          ? {
              color: r.color,
              tematica: r.tematica,
              tema: r.tema,
              texto: r.texto,
              descripcion: r.descripcion,
              diseno: r.diseno,
              tieneImagen: r.tieneImagen === 1
            }
          : null
      })),
      subtotal: c.subtotal,
      costoEntrega: c.costoEntrega,
      total: c.total,
      avisoEnvio: "El costo de envío no está incluido; se acuerda por WhatsApp."
    };
  }

  return { crear, consultar };
}
