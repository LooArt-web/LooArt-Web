/*
 * Vista "Mis cotizaciones" (mis-cotizaciones.html).
 * Muestra los folios que el cliente generó desde este navegador, con su
 * estado y vigencia. Lee los mismos datos que cotizaciones.js, así que
 * cuando exista servidor no hay que cambiar nada aquí.
 */
(function () {
  var L = window.LooArt;
  var raiz = document.getElementById("historial");
  if (!raiz) return;

  var DIA = 86400000;
  var NS = "http://www.w3.org/2000/svg";
  var LIMITE = 10;
  var precios = L.precios;
  var ahora = Date.now();
  var todas = L.cotizaciones.leer().slice().sort(function (a, b) {
    return new Date(b.emision) - new Date(a.emision);
  });

  /* ---------- Utilidades ---------- */
  function crear(etiqueta, clase, texto) {
    var el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined && texto !== null) el.textContent = texto;
    return el;
  }

  function icono(trazo) {
    var s = document.createElementNS(NS, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("aria-hidden", "true");
    var p = document.createElementNS(NS, "path");
    p.setAttribute("d", trazo);
    p.setAttribute("fill", "none");
    p.setAttribute("stroke", "currentColor");
    p.setAttribute("stroke-width", "1.8");
    p.setAttribute("stroke-linecap", "round");
    p.setAttribute("stroke-linejoin", "round");
    s.appendChild(p);
    return s;
  }

  function plural(n, uno, varios) { return n === 1 ? "1 " + uno : n + " " + varios; }
  function enlaceFolio(folio) { return "folio.html?folio=" + encodeURIComponent(folio); }

  /* Una cotización abierta cuya fecha ya pasó se muestra como vencida. */
  function estadoVisible(c) {
    var abierta = c.estado !== "aceptada" && c.estado !== "cancelada";
    if (abierta && c.vence && new Date(c.vence).getTime() < ahora) return "vencida";
    return c.estado || "nueva";
  }
  function nombreEstado(id) {
    return id === "vencida" ? "Vencida" : L.cotizaciones.nombreEstado(id);
  }

  /* ---------- Sin cotizaciones ---------- */
  if (!todas.length) {
    /* El estado vacío ya invita al catálogo; el botón del encabezado sobra */
    var nueva = document.getElementById("nueva-cotizacion");
    if (nueva) nueva.hidden = true;
    var vacio = crear("section", "sin-folios");
    vacio.setAttribute("aria-labelledby", "sin-folios-titulo");
    var h = crear("h2", "", "Aún no tienes cotizaciones");
    h.id = "sin-folios-titulo";
    vacio.appendChild(h);
    vacio.appendChild(crear("p", "",
      "Cuando generes tu primer folio aparecerá aquí con su estado y la fecha hasta la que es válido."));
    var b = crear("a", "btn", "Explorar catálogo");
    b.href = "index.html";
    vacio.appendChild(b);
    raiz.appendChild(vacio);
    return;
  }

  /* ---------- Indicadores ---------- */
  var enSeguimiento = todas.filter(function (c) {
    var e = estadoVisible(c);
    return e === "nueva" || e === "pendiente" || e === "atendida";
  });
  var aceptadas = todas.filter(function (c) { return c.estado === "aceptada"; }).length;
  var porVencer = enSeguimiento
    .filter(function (c) { return c.vence; })
    .sort(function (a, b) { return new Date(a.vence) - new Date(b.vence); })[0];
  var restantes = porVencer ? Math.max(0, Math.ceil((new Date(porVencer.vence) - ahora) / DIA)) : null;

  function indicador(opc) {
    var el = crear(opc.href ? "a" : "div", "indicador");
    if (opc.href) el.href = opc.href;
    el.appendChild(crear("span", "indicador__etiqueta", opc.etiqueta));
    var ic = crear("span", "indicador__icono");
    ic.appendChild(icono(opc.icono));
    el.appendChild(ic);
    el.appendChild(crear("span", "indicador__valor", opc.valor));
    el.appendChild(crear("span", "indicador__detalle", opc.detalle));
    return el;
  }

  var indicadores = crear("div", "indicadores");
  indicadores.appendChild(indicador({
    icono: "M4 12l16-8-6 16-3-7z",
    etiqueta: "Cotizaciones enviadas",
    valor: String(todas.length),
    detalle: enSeguimiento.length + " en seguimiento, " + plural(aceptadas, "aceptada", "aceptadas")
  }));
  indicadores.appendChild(indicador({
    icono: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
    etiqueta: "Próxima a vencer",
    valor: porVencer ? plural(restantes, "día", "días") : "Ninguna",
    detalle: porVencer ? "Folio " + porVencer.folio : "No tienes cotizaciones vigentes",
    href: porVencer ? enlaceFolio(porVencer.folio) : null
  }));
  raiz.appendChild(indicadores);

  /* ---------- Listado de folios ---------- */
  var tarjeta = crear("section", "tarjeta-panel");
  tarjeta.setAttribute("aria-labelledby", "folios-titulo");
  var cab = crear("div", "tarjeta-panel__titulo");
  var h2 = crear("h2", "", "Folios");
  h2.id = "folios-titulo";
  cab.appendChild(h2);
  cab.appendChild(crear("p", "tarjeta-panel__nota", "Más recientes primero"));
  tarjeta.appendChild(cab);

  var tabla = crear("table", "tabla tabla--tarjetas");
  var thead = crear("thead");
  var trh = crear("tr");
  [["Folio"], ["Fecha"], ["Productos"], ["Válida hasta"], ["Total", "num"], ["Estado"]].forEach(function (c) {
    var th = crear("th", c[1] || "", c[0]);
    th.scope = "col";
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  tabla.appendChild(thead);

  function celda(etiqueta, contenido, clase) {
    var td = crear("td", clase || "");
    td.setAttribute("data-etiqueta", etiqueta);
    if (typeof contenido === "string") td.textContent = contenido; else td.appendChild(contenido);
    return td;
  }

  var tbody = crear("tbody");
  todas.forEach(function (c, i) {
    var e = estadoVisible(c);
    var tr = crear("tr");
    if (i >= LIMITE) tr.hidden = true;
    var a = crear("a", "enlace-folio", c.folio);
    a.href = enlaceFolio(c.folio);
    tr.appendChild(celda("Folio", a));
    tr.appendChild(celda("Fecha", L.cotizaciones.formatoFecha(c.emision), "apagado"));
    tr.appendChild(celda("Productos", plural((c.items || []).length, "producto", "productos"), "apagado"));
    tr.appendChild(celda("Válida hasta", c.vence ? L.cotizaciones.formatoFecha(c.vence) : "—", "apagado"));
    tr.appendChild(celda("Total", precios.formato(c.total || 0), "num"));
    tr.appendChild(celda("Estado", crear("span", "insignia insignia--" + e, nombreEstado(e))));
    tbody.appendChild(tr);
  });
  tabla.appendChild(tbody);
  var envoltura = crear("div", "tabla-envoltura");
  envoltura.appendChild(tabla);
  tarjeta.appendChild(envoltura);

  if (todas.length > LIMITE) {
    var boton = crear("button", "ver-todas", "Ver todos (" + todas.length + ")");
    boton.type = "button";
    boton.setAttribute("aria-expanded", "false");
    boton.addEventListener("click", function () {
      var abierto = boton.getAttribute("aria-expanded") === "true";
      [].slice.call(tbody.rows).forEach(function (r, i) { if (i >= LIMITE) r.hidden = abierto; });
      boton.setAttribute("aria-expanded", String(!abierto));
      boton.textContent = abierto ? "Ver todos (" + todas.length + ")" : "Ver menos";
    });
    tarjeta.appendChild(boton);
  }

  raiz.appendChild(tarjeta);
})();
