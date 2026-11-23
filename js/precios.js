/*
 * Cálculo de precios. Solo depende de los datos del producto.
 * Cuando haya servidor, esta lógica se repite del lado del servidor
 * para que el total no pueda alterarse desde el navegador.
 */
window.LooArt = window.LooArt || {};

window.LooArt.precios = (function () {
  var formatoMXN = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

  function aplicaMayoreo(producto, cantidad) {
    return !!producto.mayoreo && cantidad >= producto.mayoreo.desde;
  }

  function unitario(producto, cantidad) {
    return aplicaMayoreo(producto, cantidad) ? producto.mayoreo.precio : producto.precio;
  }

  function subtotal(producto, cantidad) {
    /* Se redondea a centavos para evitar errores de coma flotante */
    return Math.round(unitario(producto, cantidad) * cantidad * 100) / 100;
  }

  return {
    formato: function (n) { return formatoMXN.format(n); },
    aplicaMayoreo: aplicaMayoreo,
    unitario: unitario,
    subtotal: subtotal
  };
})();
