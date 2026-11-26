/* Vista 4: Folio, mensaje de WhatsApp y PDF */
(function () {
  var datos = window.LooArt;
  var cotizaciones = datos.cotizaciones;
  var precios = datos.precios;
  var config = datos.config;

  var LIBRE = "Otra (libre)";
  var MAX_IDEA_WHATSAPP = 150; /* la idea completa va en el PDF */

  function $(id) { return document.getElementById(id); }

  function crear(etiqueta, clase, texto) {
    var el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto) el.textContent = texto;
    return el;
  }

  var folio = new URLSearchParams(window.location.search).get("folio");
  var c = folio ? cotizaciones.buscar(folio) : null;

  if (!c) {
    $("no-encontrado").hidden = false;
    return;
  }

  var fecha = cotizaciones.formatoFecha;

  function money(n) { return precios.formato(n); }

  /* Especificaciones de un producto como pares [etiqueta, valor] */
  function especificaciones(it, recortarIdea) {
    var lista = [];
    if (it.presentacion) lista.push(["Presentación", it.presentacion]);
    if (it.color) lista.push(["Color", it.color]);
    if (it.tematica) lista.push(["Temática", it.tematica === LIBRE ? "Libre: " + it.tematicaLibre : it.tematica]);
    if (it.texto) lista.push(["Texto en el producto", it.texto]);
    if (it.descripcion) {
      var idea = it.descripcion;
      if (recortarIdea && idea.length > MAX_IDEA_WHATSAPP) idea = idea.slice(0, MAX_IDEA_WHATSAPP).trim() + "…";
      lista.push(["Idea", idea]);
    }
    if (it.imagen && it.imagen.nombre) lista.push(["Imagen de referencia", it.imagen.nombre]);
    if (it.imagen && it.diseno && window.LooArt.vistaPrevia) {
      lista.push(["Colocación de la imagen", window.LooArt.vistaPrevia.describirDiseno(it.diseno)]);
    }
    return lista;
  }

  /* ---------- Pantalla ---------- */
  $("vista").hidden = false;
  document.title = "Cotización " + c.folio + " | LooArt";
  $("aviso-demo").hidden = !c.preciosDeEjemplo;
  $("folio").textContent = c.folio;
  $("emision").textContent = fecha(c.emision);
  $("vence").textContent = fecha(c.vence);
  $("cuantos").textContent = c.items.length;
  $("total").textContent = money(c.total);

  c.items.forEach(function (it) {
    var li = crear("li", "linea");
    var cab = crear("div", "linea__cabecera");
    cab.appendChild(crear("span", "", it.nombre + " × " + it.cantidad));
    cab.appendChild(crear("span", "", money(it.subtotal)));
    li.appendChild(cab);

    var precio = money(it.precioUnitario) + " c/u" + (it.mayoreo ? " · precio de mayoreo" : "");
    li.appendChild(crear("p", "linea__detalle", precio));

    var specs = especificaciones(it, false).map(function (e) { return e[0] + ": " + e[1]; }).join(" · ");
    if (specs) li.appendChild(crear("p", "linea__detalle", specs));
    $("lineas").appendChild(li);
  });

  $("titulo").focus();

  /* ---------- Copiar folio ---------- */
  $("copiar").addEventListener("click", function () {
    var aviso = $("estado-copia");
    var texto = "Folio copiado: " + c.folio;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(c.folio).then(
        function () { aviso.textContent = texto; $("copiar").textContent = "Folio copiado"; },
        function () { aviso.textContent = "No se pudo copiar. Escríbelo a mano: " + c.folio; }
      );
    } else {
      aviso.textContent = "No se pudo copiar. Escríbelo a mano: " + c.folio;
    }
  });

  /* ---------- WhatsApp ---------- */
  function mensajeWhatsApp() {
    var l = [];
    l.push("Hola, LooArt. Quiero continuar con mi cotización.");
    l.push("");
    l.push("*Folio: " + c.folio + "*");
    l.push("Emitida: " + fecha(c.emision) + " · Vence: " + fecha(c.vence));
    l.push("");
    l.push("*Datos de contacto*");
    l.push("Nombre: " + c.cliente.nombre);
    l.push("Celular: " + c.cliente.celular);
    l.push("Correo: " + c.cliente.correo);
    l.push("C.P.: " + c.cliente.cp);
    l.push("");
    l.push("*Productos*");
    c.items.forEach(function (it, i) {
      l.push((i + 1) + ". " + it.nombre + " × " + it.cantidad + " — " + money(it.subtotal) + (it.mayoreo ? " (mayoreo)" : ""));
      especificaciones(it, true).forEach(function (e) { l.push("   • " + e[0] + ": " + e[1]); });
    });
    l.push("");
    l.push("*Total estimado: " + money(c.total) + " MXN* (envío aparte)");
    if (c.preciosDeEjemplo) l.push("_Precios de ejemplo (demostración)_");
    return l.join("\n");
  }

  $("whatsapp").href = "https://wa.me/" + config.whatsapp + "?text=" + encodeURIComponent(mensajeWhatsApp());

  /* ---------- PDF (impresión del navegador) ---------- */
  function construirDocumento() {
    var doc = crear("div", "doc");

    var enc = crear("div", "doc__encabezado");
    var marca = crear("div", "doc__marca", "Loo");
    marca.appendChild(crear("span", "", "Art"));
    enc.appendChild(marca);
    var info = crear("div", "doc__folio");
    info.appendChild(crear("span", "", "Cotización"));
    info.appendChild(crear("strong", "", c.folio));
    info.appendChild(crear("span", "", "Emitida: " + fecha(c.emision)));
    info.appendChild(document.createElement("br"));
    info.appendChild(crear("span", "", "Vence: " + fecha(c.vence)));
    enc.appendChild(info);
    doc.appendChild(enc);

    doc.appendChild(crear("h2", "", "Datos del cliente"));
    doc.appendChild(crear("p", "", "Nombre: " + c.cliente.nombre));
    doc.appendChild(crear("p", "", "Celular: " + c.cliente.celular));
    doc.appendChild(crear("p", "", "Correo: " + c.cliente.correo));
    doc.appendChild(crear("p", "", "Código postal: " + c.cliente.cp));

    doc.appendChild(crear("h2", "", "Productos"));
    var tabla = crear("table", "doc__tabla");
    var cabeza = document.createElement("thead");
    var filaCab = document.createElement("tr");
    ["Producto", "Cant.", "P. unitario", "Subtotal"].forEach(function (t, i) {
      filaCab.appendChild(crear("th", i ? "num" : "", t));
    });
    cabeza.appendChild(filaCab);
    tabla.appendChild(cabeza);

    var cuerpo = document.createElement("tbody");
    c.items.forEach(function (it) {
      var fila = document.createElement("tr");
      var celda = document.createElement("td");
      celda.appendChild(crear("strong", "", it.nombre));
      especificaciones(it, false).forEach(function (e) {
        celda.appendChild(crear("div", "doc__spec", e[0] + ": " + e[1]));
      });
      fila.appendChild(celda);
      fila.appendChild(crear("td", "num", String(it.cantidad)));
      fila.appendChild(crear("td", "num", money(it.precioUnitario) + (it.mayoreo ? " (mayoreo)" : "")));
      fila.appendChild(crear("td", "num", money(it.subtotal)));
      cuerpo.appendChild(fila);
    });
    tabla.appendChild(cuerpo);
    doc.appendChild(tabla);

    doc.appendChild(crear("p", "doc__total", "Total estimado: " + money(c.total) + " MXN"));

    var notas = crear("div", "doc__notas");
    notas.appendChild(crear("p", "", "Cotización válida hasta el " + fecha(c.vence) + "."));
    notas.appendChild(crear("p", "", "El costo de envío no está incluido: es adicional y se calcula por WhatsApp al generar la orden."));
    notas.appendChild(crear("p", "", "Precio estimado, sujeto a confirmación por el negocio."));
    if (c.preciosDeEjemplo) notas.appendChild(crear("p", "", "Precios de ejemplo para demostración."));
    doc.appendChild(notas);

    return doc;
  }

  $("documento").appendChild(construirDocumento());

  $("pdf").addEventListener("click", function () {
    var tituloOriginal = document.title;
    document.title = "Cotizacion-" + c.folio; /* nombre sugerido del archivo PDF */
    window.addEventListener("afterprint", function restaurar() {
      document.title = tituloOriginal;
      window.removeEventListener("afterprint", restaurar);
    });
    window.print();
  });
})();
