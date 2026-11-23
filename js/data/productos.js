/*
 * Catálogo de productos (sin precios en esta versión).
 *
 * El cliente enviará la lista real de productos, categorías, variantes y fotos.
 * Mientras tanto, solo Termo y Stickers son reales (mínimos confirmados
 * en el cuestionario: termos 1 pza, stickers 10 pzas, resto 5 pzas).
 * Las opciones entre corchetes y las entradas con `pendiente: true` son
 * marcadores de posición que se reemplazan con la información del cliente.
 *
 * Para agregar una foto: guárdala en assets/img/ y pon su ruta en `imagen`.
 */
window.LooArt = window.LooArt || {};

window.LooArt.productos = [
  {
    id: "termo", nombre: "Termo", categoria: "Termos", minimo: 1, imagen: null,
    presentaciones: ["[Presentación A]", "[Presentación B]"],
    colores: ["[Color 1]", "[Color 2]", "[Color 3]"]
  },
  {
    id: "stickers", nombre: "Stickers", categoria: "Stickers", minimo: 10, imagen: null,
    presentaciones: ["[Presentación A]", "[Presentación B]"],
    colores: []
  },
  {
    id: "producto-3", nombre: "Producto 3", categoria: "Categoría 3", minimo: 5, imagen: null, pendiente: true,
    presentaciones: ["[Presentación A]", "[Presentación B]"],
    colores: ["[Color 1]", "[Color 2]"]
  },
  {
    id: "producto-4", nombre: "Producto 4", categoria: "Categoría 3", minimo: 5, imagen: null, pendiente: true,
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
