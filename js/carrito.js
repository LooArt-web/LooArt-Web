/*
 * Carrito de cotización.
 * Guarda los productos elegidos en el navegador (localStorage) para que la
 * cotización no se pierda al cambiar de vista. No requiere cuenta.
 * Cada elemento tendrá la forma: { id, cantidad, ...características }.
 */
window.LooArt = window.LooArt || {};

window.LooArt.carrito = (function () {
  var CLAVE = "looart.cotizacion";

  function leer() {
    try {
      var datos = JSON.parse(localStorage.getItem(CLAVE));
      return Array.isArray(datos) ? datos : [];
    } catch (e) {
      return [];
    }
  }

  function guardar(items) {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(items));
      return true;
    } catch (e) {
      return false; /* almacenamiento lleno o no disponible */
    }
  }

  return {
    leer: leer,
    guardar: guardar,
    contar: function () { return leer().length; }
  };
})();
