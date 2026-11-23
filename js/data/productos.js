/*
 * Catálogo de productos.
 *
 * El cliente enviará la lista real de productos, categorías, variantes, fotos
 * y precios. Mientras tanto:
 *   - Solo Termo y Stickers son reales (mínimos confirmados en el cuestionario:
 *     termos 1 pza, stickers 10 pzas, resto 5 pzas).
 *   - Las opciones entre corchetes y las entradas con `pendiente: true` son
 *     marcadores de posición.
 *   - TODOS LOS PRECIOS SON DE EJEMPLO (ver `config.preciosDeEjemplo`).
 *
 * Precios (MXN):
 *   precio  = precio unitario normal.
 *   mayoreo = { desde, precio }: a partir de `desde` piezas aplica `precio` por pieza.
 *
 * Para agregar una foto: guárdala en assets/img/ y pon su ruta en `imagen`.
 */
window.LooArt = window.LooArt || {};

window.LooArt.config = {
  preciosDeEjemplo: true,   /* pon false cuando el cliente entregue precios reales */
  vigenciaMeses: 1,         /* vigencia de la cotización */
  whatsapp: "525661939690"  /* número del negocio, con lada de país */
};

window.LooArt.productos = [
  {
    id: "termo", nombre: "Termo", categoria: "Termos", minimo: 1, imagen: null,
    precio: 180, mayoreo: { desde: 12, precio: 160 },
    presentaciones: ["[Presentación A]", "[Presentación B]"],
    colores: ["[Color 1]", "[Color 2]", "[Color 3]"]
  },
  {
    id: "stickers", nombre: "Stickers", categoria: "Stickers", minimo: 10, imagen: null,
    precio: 6, mayoreo: { desde: 50, precio: 4.5 },
    presentaciones: ["[Presentación A]", "[Presentación B]"],
    colores: []
  },
  {
    id: "producto-3", nombre: "Producto 3", categoria: "Categoría 3", minimo: 5, imagen: null, pendiente: true,
    precio: 120, mayoreo: { desde: 10, precio: 100 },
    presentaciones: ["[Presentación A]", "[Presentación B]"],
    colores: ["[Color 1]", "[Color 2]"]
  },
  {
    id: "producto-4", nombre: "Producto 4", categoria: "Categoría 3", minimo: 5, imagen: null, pendiente: true,
    precio: 90, mayoreo: { desde: 10, precio: 75 },
    presentaciones: ["[Presentación A]", "[Presentación B]"],
    colores: ["[Color 1]", "[Color 2]"]
  }
];

/*
 * Temáticas prediseñadas. Según el cliente, para este proyecto están
 * disponibles en todos los productos. "Otra (libre)" se agrega al final
 * desde la vista y permite escribir una temática propia.
 */
window.LooArt.tematicas = ["[Temática 1]", "[Temática 2]", "[Temática 3]"];
