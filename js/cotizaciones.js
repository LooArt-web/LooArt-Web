/*
 * Cotizaciones generadas y datos del cliente.
 * Se guardan en el navegador (localStorage); cuando exista servidor,
 * este módulo es el único que habrá que cambiar.
 *
 * Forma de una cotización:
 * { folio, estado, emision, vence, moneda, cliente:{nombre,celular,correo,cp},
 *   items:[{ uid, id, nombre, presentacion, color, cantidad, tematica,
 *            tematicaLibre, texto, descripcion, imagen,
 *            precioUnitario, mayoreo, subtotal }],
 *   subtotal, total, preciosDeEjemplo }
 */
window.LooArt = window.LooArt || {};

window.LooArt.cotizaciones = (function () {
  var CLAVE = "looart.cotizaciones";
  var CLAVE_CLIENTE = "looart.cliente";
  var LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; /* sin 0/O ni 1/I para evitar confusiones */

  function leerJSON(clave, defecto) {
    try {
      var v = JSON.parse(localStorage.getItem(clave));
      return v === null || v === undefined ? defecto : v;
    } catch (e) {
      return defecto;
    }
  }

  function escribirJSON(clave, valor) {
    try {
      localStorage.setItem(clave, JSON.stringify(valor));
      return true;
    } catch (e) {
      return false;
    }
  }

  function leer() {
    var datos = leerJSON(CLAVE, []);
    return Array.isArray(datos) ? datos : [];
  }

  function buscar(folio) {
    return leer().filter(function (c) { return c.folio === folio; })[0] || null;
  }

  /* Folio con forma LA-AAMMDD-XXXX (fecha + 4 caracteres al azar). */
  function generarFolio(fecha) {
    var existentes = leer().map(function (c) { return c.folio; });
    var aa = String(fecha.getFullYear()).slice(2);
    var mm = String(fecha.getMonth() + 1).padStart(2, "0");
    var dd = String(fecha.getDate()).padStart(2, "0");
    var folio;
    do {
      var sufijo = "";
      for (var i = 0; i < 4; i++) sufijo += LETRAS.charAt(Math.floor(Math.random() * LETRAS.length));
      folio = "LA-" + aa + mm + dd + "-" + sufijo;
    } while (existentes.indexOf(folio) !== -1);
    return folio;
  }

  /* Suma meses sin desbordar (31 ene + 1 mes = 28 feb, no 3 mar). */
  function sumarMeses(fecha, meses) {
    var d = new Date(fecha.getTime());
    var dia = d.getDate();
    d.setMonth(d.getMonth() + meses);
    if (d.getDate() < dia) d.setDate(0);
    return d;
  }

  function formatoFecha(iso) {
    return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" })
      .format(new Date(iso));
  }

  /*
   * Guarda una cotización. Si el navegador se queda sin espacio, reintenta
   * sin el contenido de las imágenes (conserva su nombre).
   * Devuelve { ok, sinImagenes }.
   */
  function guardar(cotizacion) {
    var lista = leer();
    lista.push(cotizacion);
    if (escribirJSON(CLAVE, lista)) return { ok: true, sinImagenes: false };

    var ligera = JSON.parse(JSON.stringify(cotizacion));
    ligera.items.forEach(function (it) {
      if (it.imagen) it.imagen = { nombre: it.imagen.nombre, omitida: true };
    });
    lista = leer();
    lista.push(ligera);
    if (escribirJSON(CLAVE, lista)) return { ok: true, sinImagenes: true };
    return { ok: false, sinImagenes: false };
  }

  return {
    leer: leer,
    buscar: buscar,
    guardar: guardar,
    generarFolio: generarFolio,
    sumarMeses: sumarMeses,
    formatoFecha: formatoFecha,
    leerCliente: function () { return leerJSON(CLAVE_CLIENTE, {}); },
    guardarCliente: function (c) { return escribirJSON(CLAVE_CLIENTE, c); }
  };
})();
