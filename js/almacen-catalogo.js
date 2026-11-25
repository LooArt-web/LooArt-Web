/*
 * Almacén del catálogo.
 * Si el administrador editó el catálogo desde el panel, esos cambios (guardados
 * en localStorage) reemplazan a los datos de ejemplo de js/data/productos.js.
 * Debe cargarse justo después de productos.js.
 *
 * Cuando exista servidor, solo hay que cambiar este archivo para leer y
 * guardar el catálogo por API en lugar de localStorage.
 */
(function () {
  var L = window.LooArt;
  var CLAVE = "looart.catalogo";

  /* Copia de los datos originales, para poder restaurarlos */
  var base = JSON.parse(JSON.stringify({ productos: L.productos, tematicas: L.tematicas }));

  function leer() {
    try {
      var d = JSON.parse(localStorage.getItem(CLAVE));
      if (d && Array.isArray(d.productos) && Array.isArray(d.tematicas)) return d;
    } catch (e) { /* datos dañados: se usan los de ejemplo */ }
    return null;
  }

  var guardado = leer();
  if (guardado) {
    L.productos = guardado.productos;
    L.tematicas = guardado.tematicas;
  }

  /* `visible: false` oculta un producto del catálogo (productos de temporada).
   * También se normalizan datos guardados con versiones anteriores:
   * los colores eran texto y ahora son { nombre, hex }. */
  L.productos.forEach(function (p) {
    if (p.visible === undefined) p.visible = true;
    p.presentaciones = p.presentaciones || [];
    p.colores = (p.colores || []).map(function (c) {
      return typeof c === "string" ? { nombre: c, hex: null } : c;
    });
    p.modelo = p.modelo || "caja";
  });

  L.catalogo = {
    base: base,
    personalizado: !!guardado,
    guardar: function (productos, tematicas) {
      try {
        localStorage.setItem(CLAVE, JSON.stringify({ productos: productos, tematicas: tematicas }));
        return true;
      } catch (e) {
        return false;
      }
    },
    restaurar: function () {
      try { localStorage.removeItem(CLAVE); } catch (e) { /* sin acceso */ }
    }
  };
})();
