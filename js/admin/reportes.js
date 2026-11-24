/* Panel: reportes por fecha y producto, con descarga en CSV */
(function () {
  var datos = window.LooArt;
  var admin = datos.admin;
  var cot = datos.cotizaciones;
  var precios = datos.precios;

  if (!admin.requerir()) return;
  admin.pintarCabecera("reportes");

  function $(id) { return document.getElementById(id); }
  function dosDigitos(n) { return String(n).padStart(2, "0"); }

  function fechaLocal(fecha) {
    var d = new Date(fecha);
    return d.getFullYear() + "-" + dosDigitos(d.getMonth() + 1) + "-" + dosDigitos(d.getDate());
  }

  function fila(celdas) {
    var tr = document.createElement("tr");
    celdas.forEach(function (c, i) {
      var td = document.createElement("td");
      td.textContent = c;
      if (i > 0) td.className = "num";
      tr.appendChild(td);
    });
    return tr;
  }

  function redondear(n) { return Math.round(n * 100) / 100; }

  /* ---------- Filtros ---------- */
  var cotizaciones = cot.leer();

  var nombres = [];
  cotizaciones.forEach(function (c) {
    c.items.forEach(function (i) { if (nombres.indexOf(i.nombre) === -1) nombres.push(i.nombre); });
  });
  nombres.sort().forEach(function (n) {
    var o = document.createElement("option");
    o.value = n;
    o.textContent = n;
    $("producto").appendChild(o);
  });
  cot.ESTADOS.forEach(function (e) {
    var o = document.createElement("option");
    o.value = e.id;
    o.textContent = e.nombre;
    $("estado").appendChild(o);
  });

  function ultimos30() {
    var hoy = new Date();
    var antes = new Date(hoy.getTime() - 30 * 86400000);
    $("desde").value = fechaLocal(antes);
    $("hasta").value = fechaLocal(hoy);
  }

  /* Una línea por producto de cada cotización que cumple los filtros */
  function lineas() {
    var desde = $("desde").value;
    var hasta = $("hasta").value;
    var producto = $("producto").value;
    var estado = $("estado").value;
    var salida = [];

    cotizaciones.forEach(function (c) {
      var dia = fechaLocal(c.emision);
      if (desde && dia < desde) return;
      if (hasta && dia > hasta) return;
      if (estado && c.estado !== estado) return;

      c.items.forEach(function (it) {
        if (producto && it.nombre !== producto) return;
        salida.push({
          fecha: dia, folio: c.folio, estado: c.estado,
          cliente: c.cliente.nombre, celular: c.cliente.celular,
          producto: it.nombre, cantidad: it.cantidad,
          precioUnitario: it.precioUnitario, subtotal: it.subtotal,
          ejemplo: !!c.preciosDeEjemplo
        });
      });
    });
    return salida;
  }

  /* ---------- Pintar ---------- */
  function pintar() {
    var ls = lineas();

    var folios = {};
    var piezas = 0;
    var total = 0;
    var porProducto = {};
    var porFecha = {};

    ls.forEach(function (l) {
      folios[l.folio] = true;
      piezas += l.cantidad;
      total += l.subtotal;

      var p = porProducto[l.producto] || (porProducto[l.producto] = { folios: {}, piezas: 0, total: 0 });
      p.folios[l.folio] = true;
      p.piezas += l.cantidad;
      p.total += l.subtotal;

      var f = porFecha[l.fecha] || (porFecha[l.fecha] = { folios: {}, total: 0 });
      f.folios[l.folio] = true;
      f.total += l.subtotal;
    });

    $("cifra-cotizaciones").textContent = Object.keys(folios).length;
    $("cifra-piezas").textContent = piezas;
    $("cifra-total").textContent = precios.formato(redondear(total));
    $("aviso-demo").hidden = !ls.some(function (l) { return l.ejemplo; });

    var hay = ls.length > 0;
    $("vacio").hidden = hay;
    $("tablas").hidden = !hay;
    $("exportar").disabled = !hay;

    var cuerpoP = $("por-producto");
    cuerpoP.textContent = "";
    Object.keys(porProducto)
      .sort(function (a, b) { return porProducto[b].total - porProducto[a].total; })
      .forEach(function (n) {
        var p = porProducto[n];
        cuerpoP.appendChild(fila([n, Object.keys(p.folios).length, p.piezas, precios.formato(redondear(p.total))]));
      });

    var cuerpoF = $("por-fecha");
    cuerpoF.textContent = "";
    Object.keys(porFecha).sort().reverse().forEach(function (d) {
      var f = porFecha[d];
      cuerpoF.appendChild(fila([cot.formatoFecha(d + "T12:00:00"), Object.keys(f.folios).length, precios.formato(redondear(f.total))]));
    });
  }

  /* ---------- CSV ---------- */
  function celdaCSV(valor) {
    var t = String(valor);
    /* evita que Excel interprete el texto como fórmula */
    if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
    return '"' + t.replace(/"/g, '""') + '"';
  }

  $("exportar").addEventListener("click", function () {
    var ls = lineas();
    var cabecera = ["Fecha", "Folio", "Estado", "Cliente", "Celular", "Producto", "Cantidad", "Precio unitario", "Subtotal"];
    var filas = ls.map(function (l) {
      return [l.fecha, l.folio, cot.nombreEstado(l.estado), l.cliente, l.celular, l.producto, l.cantidad, l.precioUnitario, l.subtotal];
    });
    var texto = [cabecera].concat(filas).map(function (f) { return f.map(celdaCSV).join(","); }).join("\r\n");

    /* BOM para que Excel respete los acentos */
    var blob = new Blob(["\uFEFF" + texto], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "reporte-looart-" + fechaLocal(new Date()) + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  $("filtros").addEventListener("submit", function (e) { e.preventDefault(); });
  ["desde", "hasta", "producto", "estado"].forEach(function (id) { $(id).addEventListener("change", pintar); });
  $("ultimos30").addEventListener("click", function () { ultimos30(); pintar(); });
  $("todo").addEventListener("click", function () { $("desde").value = ""; $("hasta").value = ""; pintar(); });

  ultimos30();
  pintar();
})();
