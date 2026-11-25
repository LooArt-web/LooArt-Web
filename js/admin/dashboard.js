/* Panel: resumen con indicadores y gráficas */
(function () {
  var datos = window.LooArt;
  var admin = datos.admin;
  var cot = datos.cotizaciones;
  var precios = datos.precios;

  if (!admin.requerir()) return;
  admin.pintarCabecera("dashboard");

  var NS = "http://www.w3.org/2000/svg";
  var DIA = 86400000;
  var COLORES_ESTADO = { nueva: "#1B4F8F", pendiente: "#B07A00", atendida: "#5B47A8", aceptada: "#1F6A36", cancelada: "#8A2E22" };

  function $(id) { return document.getElementById(id); }

  function crear(etiqueta, clase, texto) {
    var el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined && texto !== null && texto !== "") el.textContent = texto;
    return el;
  }

  function svg(etiqueta, atributos, padre) {
    var e = document.createElementNS(NS, etiqueta);
    Object.keys(atributos || {}).forEach(function (k) { e.setAttribute(k, atributos[k]); });
    if (padre) padre.appendChild(e);
    return e;
  }

  function dosDigitos(n) { return String(n).padStart(2, "0"); }
  function fechaLocal(d) { return d.getFullYear() + "-" + dosDigitos(d.getMonth() + 1) + "-" + dosDigitos(d.getDate()); }
  function redondear(n) { return Math.round(n * 100) / 100; }
  function piezas(n) { return n === 1 ? "1 pieza" : n + " piezas"; }

  var ahora = Date.now();
  var todas = cot.leer();

  function entre(c, desde, hasta) {
    var t = new Date(c.emision).getTime();
    return t >= desde && t < hasta;
  }

  var actuales = todas.filter(function (c) { return entre(c, ahora - 30 * DIA, ahora + DIA); });
  var previas = todas.filter(function (c) { return entre(c, ahora - 60 * DIA, ahora - 30 * DIA); });

  function suma(lista) {
    return redondear(lista.filter(function (c) { return c.estado !== "cancelada"; })
      .reduce(function (s, c) { return s + c.total; }, 0));
  }

  /* "▲ 25% frente a los 30 días anteriores" (con texto, no solo color) */
  function cambio(el, actual, previo, esDinero) {
    el.className = "kpi__nota";
    if (!previo) {
      el.textContent = actual ? "Sin datos del periodo anterior" : "";
      return;
    }
    var pct = Math.round(((actual - previo) / previo) * 100);
    if (pct === 0) { el.textContent = "Igual que los 30 días anteriores"; return; }
    el.classList.add(pct > 0 ? "kpi__nota--sube" : "kpi__nota--baja");
    el.textContent = (pct > 0 ? "▲ " : "▼ ") + Math.abs(pct) + "% frente a los 30 días anteriores";
  }

  /* ---------- Indicadores ---------- */
  var porAtender = todas.filter(function (c) { return c.estado === "nueva" || c.estado === "pendiente"; }).length;
  var aceptadas = actuales.filter(function (c) { return c.estado === "aceptada"; }).length;

  $("kpi-cotizaciones").textContent = actuales.length;
  cambio($("kpi-cotizaciones-nota"), actuales.length, previas.length);

  $("kpi-total").textContent = precios.formato(suma(actuales));
  cambio($("kpi-total-nota"), suma(actuales), suma(previas));

  $("kpi-atender").textContent = porAtender;

  $("kpi-aceptacion").textContent = actuales.length ? Math.round((aceptadas / actuales.length) * 100) + "%" : "0%";
  $("kpi-aceptacion-nota").textContent = aceptadas + " de " + actuales.length + " aceptadas";

  var nuevas = todas.filter(function (c) { return c.estado === "nueva"; }).length;
  if (nuevas) {
    $("alerta-texto").textContent = nuevas === 1
      ? "Tienes 1 cotización nueva sin atender."
      : "Tienes " + nuevas + " cotizaciones nuevas sin atender.";
    $("alerta").hidden = false;
  }

  $("sin-datos").hidden = todas.length > 0;
  $("subtitulo").textContent = "Últimos 30 días · " + new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(new Date());

  /* ---------- Gráfica: cotizaciones por día (14 días) ---------- */
  function graficaDias() {
    var dias = [];
    for (var i = 13; i >= 0; i--) {
      var d = new Date(ahora - i * DIA);
      dias.push({ fecha: d, clave: fechaLocal(d), valor: 0 });
    }
    todas.forEach(function (c) {
      var clave = fechaLocal(new Date(c.emision));
      dias.forEach(function (d) { if (d.clave === clave) d.valor++; });
    });

    var total = dias.reduce(function (s, d) { return s + d.valor; }, 0);
    var W = 640, H = 240, mi = 34, md = 8, ms = 12, mb = 34;
    var max = Math.max.apply(null, dias.map(function (d) { return d.valor; }));
    var tope = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
    var altoUtil = H - ms - mb;

    var g = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": "Gráfica de barras: " + total + (total === 1 ? " cotización" : " cotizaciones") + " en los últimos 14 días" });

    for (var k = 0; k <= 4; k++) {
      var y = ms + altoUtil * (1 - k / 4);
      svg("line", { x1: mi, x2: W - md, y1: y, y2: y, stroke: "#E3DCD3", "stroke-width": 1 }, g);
      var etiqueta = svg("text", { x: mi - 8, y: y + 4, "text-anchor": "end", "font-size": 11, fill: "#5E5A6B" }, g);
      etiqueta.textContent = String(Math.round((tope * k) / 4));
    }

    var paso = (W - mi - md) / dias.length;
    var ancho = paso * 0.6;
    var mesCorto = new Intl.DateTimeFormat("es-MX", { month: "short" });
    var largo = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long" });

    dias.forEach(function (d, i) {
      var x = mi + i * paso + (paso - ancho) / 2;
      var alto = altoUtil * (d.valor / tope);
      if (d.valor > 0) {
        var barra = svg("rect", { x: x, y: ms + altoUtil - alto, width: ancho, height: alto, rx: 4, fill: "#B8381A" }, g);
        svg("title", {}, barra).textContent = largo.format(d.fecha) + ": " + d.valor + (d.valor === 1 ? " cotización" : " cotizaciones");
      }
      var rotulo = svg("text", { x: x + ancho / 2, y: H - 14, "text-anchor": "middle", "font-size": 11, fill: "#5E5A6B" }, g);
      var dia = d.fecha.getDate();
      rotulo.textContent = dia;
      if (i === 0 || dia === 1) {
        var mes = svg("text", { x: x + ancho / 2, y: H - 2, "text-anchor": "middle", "font-size": 10, fill: "#5E5A6B" }, g);
        mes.textContent = mesCorto.format(d.fecha).replace(".", "");
      }
    });

    $("grafica-dias").appendChild(g);
  }

  /* ---------- Barras horizontales ---------- */
  function barra(contenedor, etiqueta, valorTexto, proporcion, color) {
    var b = crear("div", "barra-h");
    var fila = crear("div", "barra-h__fila");
    fila.appendChild(crear("span", "", etiqueta));
    fila.appendChild(crear("span", "", valorTexto));
    var pista = crear("div", "barra-h__pista");
    var relleno = crear("div", "barra-h__relleno");
    relleno.style.width = Math.max(proporcion * 100, proporcion > 0 ? 3 : 0) + "%";
    if (color) relleno.style.background = color;
    pista.appendChild(relleno);
    b.appendChild(fila);
    b.appendChild(pista);
    contenedor.appendChild(b);
  }

  function porEstado() {
    var cont = $("estados");
    var max = Math.max(1, todas.length);
    cot.ESTADOS.forEach(function (e) {
      var n = todas.filter(function (c) { return c.estado === e.id; }).length;
      var pct = todas.length ? Math.round((n / todas.length) * 100) : 0;
      barra(cont, e.nombre, n + " (" + pct + "%)", n / max, COLORES_ESTADO[e.id]);
    });
  }

  function topProductos() {
    var cont = $("top");
    var acumulado = {};
    actuales.forEach(function (c) {
      if (c.estado === "cancelada") return;
      c.items.forEach(function (it) { acumulado[it.nombre] = (acumulado[it.nombre] || 0) + it.cantidad; });
    });
    var nombres = Object.keys(acumulado).sort(function (a, b) { return acumulado[b] - acumulado[a]; }).slice(0, 5);
    if (!nombres.length) {
      cont.appendChild(crear("p", "ayuda", "Todavía no hay productos cotizados en este periodo."));
      return;
    }
    var max = acumulado[nombres[0]];
    nombres.forEach(function (n) { barra(cont, n, piezas(acumulado[n]), acumulado[n] / max); });
  }

  /* ---------- Cotizaciones recientes ---------- */
  function recientes() {
    var cuerpo = $("recientes");
    var ultimas = todas.slice().sort(function (a, b) { return new Date(b.emision) - new Date(a.emision); }).slice(0, 6);

    if (!ultimas.length) {
      var tr = document.createElement("tr");
      var td = crear("td", "", "Sin cotizaciones todavía.");
      td.colSpan = 5;
      tr.appendChild(td);
      cuerpo.appendChild(tr);
      return;
    }

    function celda(etiqueta, contenido, clase) {
      var td = crear("td", clase || "");
      td.setAttribute("data-etiqueta", etiqueta);
      if (typeof contenido === "string") td.textContent = contenido; else td.appendChild(contenido);
      return td;
    }

    ultimas.forEach(function (c) {
      var tr = document.createElement("tr");
      var enlace = crear("a", "enlace-folio", c.folio);
      enlace.href = "cotizaciones.html?folio=" + encodeURIComponent(c.folio);
      tr.appendChild(celda("Folio", enlace));
      tr.appendChild(celda("Fecha", cot.formatoFecha(c.emision)));
      tr.appendChild(celda("Cliente", c.cliente.nombre));
      tr.appendChild(celda("Total", precios.formato(c.total), "num"));
      tr.appendChild(celda("Estado", crear("span", "insignia insignia--" + c.estado, cot.nombreEstado(c.estado))));
      cuerpo.appendChild(tr);
    });
  }

  graficaDias();
  porEstado();
  topProductos();
  recientes();
})();
