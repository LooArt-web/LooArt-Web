/* Panel: lista de cotizaciones, filtros, estados y detalle */
(function () {
  var datos = window.LooArt;
  var admin = datos.admin;
  var cot = datos.cotizaciones;
  var precios = datos.precios;

  if (!admin.requerir()) return;
  admin.pintarCabecera("cotizaciones");

  var LIBRE = "Otra (libre)";
  var filtros = { estado: "todas", texto: "", producto: "", desde: "", hasta: "" };

  function $(id) { return document.getElementById(id); }

  function crear(etiqueta, clase, texto) {
    var el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined && texto !== null && texto !== "") el.textContent = texto;
    return el;
  }

  /* ---------- Saneado de datos del cliente antes de usarlos en enlaces e imágenes ----------
     Los textos ya se pintan con textContent; esto cubre los atributos href/src,
     donde un dato manipulado podría colar un esquema como javascript:. */
  var PATRON_DATA_IMAGEN = /^data:image\/(png|jpe?g|gif|webp|avif|bmp|svg\+xml);base64,[a-z0-9+\/=\s]+$/i;
  function imagenSegura(u) { return typeof u === "string" && PATRON_DATA_IMAGEN.test(u) ? u : null; }
  function celularSeguro(t) { var d = String(t || "").replace(/\D/g, ""); return d.length === 10 ? d : null; }
  function correoSeguro(t) { return typeof t === "string" && /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(t) ? t : null; }

  function dosDigitos(n) { return String(n).padStart(2, "0"); }

  function fechaLocal(iso) {
    var d = new Date(iso);
    return d.getFullYear() + "-" + dosDigitos(d.getMonth() + 1) + "-" + dosDigitos(d.getDate());
  }

  function fechaHora(iso) {
    return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  }

  function normalizar(t) {
    return String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function insignia(estado) {
    return crear("span", "insignia insignia--" + estado, cot.nombreEstado(estado));
  }

  /* ---------- Depuración de 1 año ---------- */
  var depuradas = cot.depurar(365);
  if (depuradas) {
    var aviso = $("aviso");
    aviso.textContent = "Se eliminaron " + depuradas + (depuradas === 1 ? " cotización" : " cotizaciones") + " con más de 1 año de antigüedad.";
    aviso.hidden = false;
  }

  /* ---------- Datos y filtros ---------- */
  function todas() {
    return cot.leer().sort(function (a, b) { return new Date(b.emision) - new Date(a.emision); });
  }

  function coincide(c, ignorarEstado) {
    if (!ignorarEstado && filtros.estado !== "todas" && c.estado !== filtros.estado) return false;

    var dia = fechaLocal(c.emision);
    if (filtros.desde && dia < filtros.desde) return false;
    if (filtros.hasta && dia > filtros.hasta) return false;

    if (filtros.producto && !c.items.some(function (i) { return i.nombre === filtros.producto; })) return false;

    if (filtros.texto) {
      var pajar = normalizar([c.folio, c.cliente.nombre, c.cliente.celular, c.cliente.correo].join(" "));
      if (pajar.indexOf(normalizar(filtros.texto.trim())) === -1) return false;
    }
    return true;
  }

  function llenarProductos() {
    var nombres = [];
    todas().forEach(function (c) {
      c.items.forEach(function (i) { if (nombres.indexOf(i.nombre) === -1) nombres.push(i.nombre); });
    });
    nombres.sort();
    var sel = $("producto");
    sel.textContent = "";
    var todos = crear("option", "", "Todos");
    todos.value = "";
    sel.appendChild(todos);
    nombres.forEach(function (n) {
      var o = crear("option", "", n);
      o.value = n;
      sel.appendChild(o);
    });
    sel.value = nombres.indexOf(filtros.producto) === -1 ? "" : filtros.producto;
    filtros.producto = sel.value;
  }

  /* ---------- Pintar ---------- */
  function pintarChips(lista) {
    var cont = $("chips");
    cont.textContent = "";
    var opciones = [{ id: "todas", nombre: "Todas" }].concat(cot.ESTADOS);
    opciones.forEach(function (op) {
      var n = lista.filter(function (c) { return coincide(c, true) && (op.id === "todas" || c.estado === op.id); }).length;
      var b = crear("button", "chip", op.nombre);
      b.type = "button";
      b.setAttribute("aria-pressed", String(filtros.estado === op.id));
      b.appendChild(crear("span", "", "(" + n + ")"));
      b.addEventListener("click", function () { filtros.estado = op.id; pintar(); });
      cont.appendChild(b);
    });
  }

  function celda(etiqueta, contenido, clase) {
    var td = crear("td", clase || "");
    td.setAttribute("data-etiqueta", etiqueta);
    if (typeof contenido === "string") td.textContent = contenido;
    else td.appendChild(contenido);
    return td;
  }

  function crearFila(c) {
    var tr = document.createElement("tr");

    var ver = crear("button", "enlace-folio", c.folio);
    ver.type = "button";
    ver.setAttribute("aria-label", "Ver detalle de la cotización " + c.folio);
    ver.addEventListener("click", function () { abrirDetalle(c.folio); });
    tr.appendChild(celda("Folio", ver));

    tr.appendChild(celda("Fecha", cot.formatoFecha(c.emision)));
    tr.appendChild(celda("Cliente", c.cliente.nombre));
    tr.appendChild(celda("Productos", c.items.map(function (i) { return i.nombre + " ×" + i.cantidad; }).join(", ")));
    tr.appendChild(celda("Total", precios.formato(c.total), "num"));

    var sel = document.createElement("select");
    sel.setAttribute("aria-label", "Estado de la cotización " + c.folio);
    sel.setAttribute("data-folio", c.folio);
    cot.ESTADOS.forEach(function (e) {
      var o = crear("option", "", e.nombre);
      o.value = e.id;
      sel.appendChild(o);
    });
    sel.value = c.estado;
    sel.addEventListener("change", function () {
      cot.actualizarEstado(c.folio, sel.value);
      pintar();
      var nuevo = document.querySelector('select[data-folio="' + c.folio + '"]');
      if (nuevo) nuevo.focus();
    });
    tr.appendChild(celda("Estado", sel));
    return tr;
  }

  function pintar() {
    var lista = todas();
    var visibles = lista.filter(function (c) { return coincide(c, false); });

    pintarChips(lista);

    var filas = $("filas");
    filas.textContent = "";
    visibles.forEach(function (c) { filas.appendChild(crearFila(c)); });

    var hay = visibles.length > 0;
    $("tabla-envoltura").hidden = !hay;
    $("vacio").hidden = hay;
    $("cuenta").textContent = hay
      ? (visibles.length === 1 ? "1 cotización" : visibles.length + " cotizaciones") + " de " + lista.length
      : "";

    if (!hay) {
      $("vacio-texto").textContent = lista.length
        ? "Ninguna cotización coincide con los filtros. Prueba limpiándolos."
        : "Aún no hay cotizaciones. Aparecerán aquí cuando un cliente genere su folio.";
    }

    var hayEjemplos = lista.some(function (c) { return c.ejemplo; });
    $("cargar-ejemplos").hidden = lista.length > 0;
    $("borrar-ejemplos").hidden = !hayEjemplos;
  }

  /* ---------- Detalle ---------- */
  var ventana = $("detalle");

  function lista(dl, pares) {
    pares.forEach(function (p) {
      if (!p[1]) return;
      dl.appendChild(crear("dt", "", p[0]));
      var dd = document.createElement("dd");
      if (typeof p[1] === "string") dd.textContent = p[1]; else dd.appendChild(p[1]);
      dl.appendChild(dd);
    });
  }

  /* Sin dirección válida se muestra solo el texto */
  function enlace(texto, href) {
    if (!href) return crear("span", "", texto);
    var a = crear("a", "", texto);
    a.href = href;
    return a;
  }

  function pintarDetalle(folio, enfocarEstado) {
    var c = cot.buscar(folio);
    if (!c) { ventana.close(); pintar(); return; }

    var cuerpo = crear("div", "ventana__cuerpo");

    var cab = crear("div", "ventana__cabecera");
    var h = crear("h2", "", c.folio);
    h.id = "detalle-titulo";
    cab.appendChild(h);
    cab.appendChild(insignia(c.estado));
    cuerpo.appendChild(cab);

    if (c.preciosDeEjemplo) cuerpo.appendChild(crear("p", "aviso-admin", "Esta cotización se generó con precios de ejemplo."));

    /* Cotización */
    var b1 = crear("div", "ventana__bloque");
    b1.appendChild(crear("h3", "", "Cotización"));
    var dl1 = crear("dl", "datos-lista");
    lista(dl1, [["Emitida", fechaHora(c.emision)], ["Vence", cot.formatoFecha(c.vence)], ["Total estimado", precios.formato(c.total) + " " + (c.moneda || "MXN")]]);
    b1.appendChild(dl1);

    var campo = crear("div", "campo");
    var et = crear("label", "", "Estado");
    et.setAttribute("for", "detalle-estado");
    var sel = document.createElement("select");
    sel.id = "detalle-estado";
    cot.ESTADOS.forEach(function (e) {
      var o = crear("option", "", e.nombre);
      o.value = e.id;
      sel.appendChild(o);
    });
    sel.value = c.estado;
    sel.addEventListener("change", function () {
      cot.actualizarEstado(c.folio, sel.value);
      pintar();
      pintarDetalle(c.folio, true);
    });
    campo.appendChild(et);
    campo.appendChild(sel);
    b1.appendChild(campo);
    cuerpo.appendChild(b1);

    /* Cliente */
    var b2 = crear("div", "ventana__bloque");
    b2.appendChild(crear("h3", "", "Cliente"));
    var dl2 = crear("dl", "datos-lista");
    var celular = celularSeguro(c.cliente.celular);
    var wa = enlace(String(c.cliente.celular || "") + (celular ? " (abrir WhatsApp)" : ""), celular ? "https://wa.me/52" + celular : null);
    if (celular) {
      wa.target = "_blank";
      wa.rel = "noopener noreferrer";
    }
    var correo = correoSeguro(c.cliente.correo);
    lista(dl2, [
      ["Nombre", c.cliente.nombre],
      ["Celular", wa],
      ["Correo", enlace(String(c.cliente.correo || ""), correo ? "mailto:" + correo : null)],
      ["Código postal", c.cliente.cp]
    ]);
    b2.appendChild(dl2);
    cuerpo.appendChild(b2);

    /* Productos */
    var b3 = crear("div", "ventana__bloque");
    b3.appendChild(crear("h3", "", "Productos"));
    c.items.forEach(function (it) {
      var d = crear("div", "detalle-item");
      var linea = crear("div", "ventana__cabecera");
      linea.appendChild(crear("strong", "", it.nombre + " × " + it.cantidad));
      linea.appendChild(crear("span", "", precios.formato(it.subtotal)));
      d.appendChild(linea);
      d.appendChild(crear("p", "ayuda", precios.formato(it.precioUnitario) + " c/u" + (it.mayoreo ? " · precio de mayoreo" : "")));
      var dl = crear("dl", "datos-lista");
      lista(dl, [
        ["Presentación", it.presentacion],
        ["Color", it.color],
        ["Temática", it.tematica === LIBRE ? "Libre: " + it.tematicaLibre : it.tematica],
        ["Texto", it.texto],
        ["Idea", it.descripcion],
        ["Imagen", it.imagen && it.imagen.nombre ? it.imagen.nombre + (it.imagen.omitida ? " (no se pudo guardar el archivo)" : "") : ""],
        ["Colocación", it.imagen && datos.vistaPrevia ? datos.vistaPrevia.describirDiseno(it.diseno) : ""]
      ]);
      d.appendChild(dl);

      /* Vista previa tal como la vio el cliente (color, imagen, colocación y texto) */
      var productoItem = datos.productos.filter(function (p) { return p.id === it.id; })[0];
      if (productoItem && datos.vistaPrevia) {
        var caja = crear("div", "detalle-item__vista");
        var colorItem = (productoItem.colores || []).filter(function (x) { return x.nombre === it.color; })[0];
        datos.vistaPrevia.crear(productoItem, caja, {
          interactivo: false,
          estado: {
            colorHex: colorItem && colorItem.hex,
            colorNombre: it.color,
            arte: it.imagen && it.imagen.data,
            tematica: it.tematica === LIBRE ? it.tematicaLibre : it.tematica,
            texto: it.texto,
            diseno: it.diseno
          }
        });
        d.appendChild(caja);
      }
      var src = it.imagen ? imagenSegura(it.imagen.data) : null;
      if (src) {
        var img = document.createElement("img");
        img.src = src;
        img.alt = "Imagen de referencia: " + it.imagen.nombre;
        d.appendChild(img);
      }
      b3.appendChild(d);
    });
    var tot = crear("dl", "datos-lista");
    lista(tot, [["Subtotal", precios.formato(c.subtotal)], ["Envío", "Se calcula por WhatsApp"], ["Total estimado", precios.formato(c.total)]]);
    b3.appendChild(tot);
    cuerpo.appendChild(b3);

    /* Historial de estados */
    if (c.historial && c.historial.length) {
      var b4 = crear("div", "ventana__bloque");
      b4.appendChild(crear("h3", "", "Historial de estados"));
      var h4 = crear("ul", "historial");
      c.historial.slice().reverse().forEach(function (e) {
        h4.appendChild(crear("li", "", cot.nombreEstado(e.estado) + " · " + fechaHora(e.fecha)));
      });
      b4.appendChild(h4);
      cuerpo.appendChild(b4);
    }

    /* Pie */
    var pie = crear("div", "ventana__pie");
    var eliminar = crear("button", "btn btn--peligro btn--chico", "Eliminar cotización");
    eliminar.type = "button";
    eliminar.addEventListener("click", function () {
      if (window.confirm("¿Eliminar la cotización " + c.folio + "? Esta acción no se puede deshacer.")) {
        cot.eliminar(c.folio);
        ventana.close();
        llenarProductos();
        pintar();
      }
    });
    var cerrar = crear("button", "btn btn--secundario btn--chico", "Cerrar");
    cerrar.type = "button";
    cerrar.addEventListener("click", function () { ventana.close(); });
    pie.appendChild(eliminar);
    pie.appendChild(cerrar);
    cuerpo.appendChild(pie);

    ventana.textContent = "";
    ventana.appendChild(cuerpo);
    if (enfocarEstado) $("detalle-estado").focus();
  }

  function abrirDetalle(folio) {
    pintarDetalle(folio, false);
    if (!ventana.open) ventana.showModal();
  }

  /* ---------- Filtros ---------- */
  $("filtros").addEventListener("submit", function (e) { e.preventDefault(); });
  $("texto").addEventListener("input", function () { filtros.texto = this.value; pintar(); });
  $("producto").addEventListener("change", function () { filtros.producto = this.value; pintar(); });
  $("desde").addEventListener("change", function () { filtros.desde = this.value; pintar(); });
  $("hasta").addEventListener("change", function () { filtros.hasta = this.value; pintar(); });
  $("limpiar").addEventListener("click", function () {
    filtros = { estado: "todas", texto: "", producto: "", desde: "", hasta: "" };
    $("texto").value = "";
    $("producto").value = "";
    $("desde").value = "";
    $("hasta").value = "";
    pintar();
  });

  /* ---------- Cotizaciones de ejemplo (solo para demostrar el panel) ---------- */
  var CLIENTES = [
    ["Mariana López Ruiz", "5500000001"], ["Carlos Hernández Paz", "5500000002"],
    ["Fernanda Ortiz Vega", "5500000003"], ["Diego Ramírez Soto", "5500000004"],
    ["Paola Sánchez Cruz", "5500000005"], ["Luis Torres Díaz", "5500000006"]
  ];
  var DIAS = [0, 2, 5, 9, 17, 40];
  var ESTADOS_EJ = ["nueva", "pendiente", "atendida", "aceptada", "aceptada", "cancelada"];

  $("cargar-ejemplos").addEventListener("click", function () {
    var productos = datos.productos.filter(function (p) { return p.visible !== false && p.precio; });
    if (!productos.length) return;
    var nuevas = CLIENTES.map(function (cl, i) {
      var fecha = new Date(Date.now() - DIAS[i] * 86400000);
      var items = [0, 1].slice(0, 1 + (i % 2)).map(function (k) {
        var p = productos[(i + k) % productos.length];
        var cantidad = p.minimo * (1 + ((i * 3 + k) % 5)) + (k ? 0 : p.mayoreo ? p.mayoreo.desde : 0);
        return {
          uid: "ej" + i + k, id: p.id, nombre: p.nombre,
          presentacion: p.presentaciones[0] || "", color: (p.colores[0] && p.colores[0].nombre) || "",
          cantidad: cantidad, tematica: datos.tematicas[0] || LIBRE, tematicaLibre: "",
          texto: "", descripcion: "", imagen: null,
          precioUnitario: precios.unitario(p, cantidad),
          mayoreo: precios.aplicaMayoreo(p, cantidad),
          subtotal: precios.subtotal(p, cantidad)
        };
      });
      var total = Math.round(items.reduce(function (s, it) { return s + it.subtotal; }, 0) * 100) / 100;
      return {
        folio: cot.generarFolio(fecha), estado: ESTADOS_EJ[i], emision: fecha.toISOString(),
        vence: cot.sumarMeses(fecha, 1).toISOString(), moneda: "MXN",
        cliente: { nombre: cl[0], celular: cl[1], correo: "ejemplo" + (i + 1) + "@correo.com", cp: "62900" },
        items: items, subtotal: total, total: total, preciosDeEjemplo: true, ejemplo: true
      };
    });
    cot.escribirLista(cot.leer().concat(nuevas));
    llenarProductos();
    pintar();
  });

  $("borrar-ejemplos").addEventListener("click", function () {
    cot.escribirLista(cot.leer().filter(function (c) { return !c.ejemplo; }));
    llenarProductos();
    pintar();
  });

  /* Enlaces desde el resumen: ?estado=nueva filtra, ?folio=... abre el detalle */
  var params = new URLSearchParams(window.location.search);
  var estadoParam = params.get("estado");
  if (cot.ESTADOS.some(function (e) { return e.id === estadoParam; })) filtros.estado = estadoParam;

  llenarProductos();
  pintar();

  var folioParam = params.get("folio");
  if (folioParam && cot.buscar(folioParam)) abrirDetalle(folioParam);
})();
