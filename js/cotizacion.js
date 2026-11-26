/* Vista 3: Mi cotización y datos del cliente */
(function () {
  var datos = window.LooArt;
  var carrito = datos.carrito;
  var precios = datos.precios;
  var cotizaciones = datos.cotizaciones;
  var config = datos.config;

  var LIBRE = "Otra (libre)";

  var items = carrito.leer();
  var quitado = null; /* { item, indice } para poder deshacer */

  function $(id) { return document.getElementById(id); }

  function crear(etiqueta, clase, texto) {
    var el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto) el.textContent = texto;
    return el;
  }

  function piezas(n) { return n === 1 ? "1 pieza" : n + " piezas"; }

  function productoDe(id) {
    return datos.productos.filter(function (p) { return p.id === id; })[0];
  }

  function guardarCarrito() { carrito.guardar(items); }

  /* ---------- Mensaje de estado (quitar / deshacer) ---------- */
  function mostrarEstado(texto, alDeshacer) {
    var caja = $("estado");
    caja.textContent = "";
    caja.hidden = !texto;
    if (!texto) return;
    caja.appendChild(crear("span", "", texto));
    if (alDeshacer) {
      var boton = crear("button", "", "Deshacer");
      boton.type = "button";
      boton.addEventListener("click", alDeshacer);
      caja.appendChild(boton);
    }
  }

  /* Productos que ya no existen en el catálogo se quitan con aviso */
  var noDisponibles = items.filter(function (i) { return !productoDe(i.id); });
  if (noDisponibles.length) {
    items = items.filter(function (i) { return productoDe(i.id); });
    guardarCarrito();
  }

  /* ---------- Totales ---------- */
  function actualizarTotales() {
    var suma = 0;
    items.forEach(function (it) { suma += precios.subtotal(productoDe(it.id), it.cantidad); });
    suma = Math.round(suma * 100) / 100;
    $("subtotal").textContent = precios.formato(suma);
    $("total").textContent = precios.formato(suma);
    $("conteo").textContent = items.length;
    return suma;
  }

  /* ---------- Una línea de la lista ---------- */
  function crearItem(item) {
    var producto = productoDe(item.id);
    var li = crear("li", "item");

    /* Miniatura con el color, la imagen y cómo se colocó */
    if (datos.vistaPrevia) {
      var miniatura = crear("div", "item__vista");
      var colorElegido = (producto.colores || []).filter(function (c) { return c.nombre === item.color; })[0];
      datos.vistaPrevia.crear(producto, miniatura, {
        miniatura: true,
        estado: {
          colorHex: colorElegido && colorElegido.hex,
          arte: item.imagen && item.imagen.data,
          tematica: item.tematica === LIBRE ? "" : item.tematica,
          diseno: item.diseno
        }
      });
      li.appendChild(miniatura);
      li.classList.add("item--con-vista");
    }

    var cabecera = crear("div", "item__cabecera");
    cabecera.appendChild(crear("h3", "item__nombre", producto.nombre));
    var subtotal = crear("span", "item__subtotal");
    cabecera.appendChild(subtotal);
    li.appendChild(cabecera);

    var detalles = crear("dl", "item__detalles");
    function fila(nombre, valor) {
      if (!valor) return;
      detalles.appendChild(crear("dt", "", nombre));
      detalles.appendChild(crear("dd", "", valor));
    }
    fila("Presentación", item.presentacion);
    fila("Color", item.color);
    fila("Temática", item.tematica === LIBRE ? "Libre: " + item.tematicaLibre : item.tematica);
    fila("Texto", item.texto);
    fila("Idea", item.descripcion);
    fila("Imagen", item.imagen && item.imagen.nombre);
    if (item.imagen && datos.vistaPrevia) fila("Colocación", datos.vistaPrevia.describirDiseno(item.diseno));
    li.appendChild(detalles);

    var precio = crear("p", "item__precio");
    li.appendChild(precio);
    var sugerencia = crear("p", "item__sugerencia");
    li.appendChild(sugerencia);

    /* Cantidad */
    var pie = crear("div", "item__pie");
    var cantidad = crear("div", "cantidad");
    var menos = crear("button", "chip", "−");
    menos.type = "button";
    menos.setAttribute("aria-label", "Quitar una pieza de " + producto.nombre);
    var campo = crear("input");
    campo.type = "number";
    campo.inputMode = "numeric";
    campo.min = producto.minimo;
    campo.step = 1;
    campo.value = item.cantidad;
    campo.setAttribute("aria-label", "Cantidad de " + producto.nombre);
    var mas = crear("button", "chip", "+");
    mas.type = "button";
    mas.setAttribute("aria-label", "Agregar una pieza de " + producto.nombre);
    cantidad.appendChild(menos);
    cantidad.appendChild(campo);
    cantidad.appendChild(mas);
    pie.appendChild(cantidad);

    var acciones = crear("div", "item__acciones");
    var editar = crear("a", "chip", "Editar");
    editar.href = "producto.html?id=" + encodeURIComponent(item.id) + "&editar=" + encodeURIComponent(item.uid);
    editar.setAttribute("aria-label", "Editar " + producto.nombre);
    var quitar = crear("button", "chip", "Quitar");
    quitar.type = "button";
    quitar.setAttribute("aria-label", "Quitar " + producto.nombre + " de la cotización");
    acciones.appendChild(editar);
    acciones.appendChild(quitar);
    pie.appendChild(acciones);
    li.appendChild(pie);

    var error = crear("p", "error");
    error.hidden = true;
    error.id = "error-cant-" + item.uid;
    campo.setAttribute("aria-describedby", error.id);
    li.appendChild(error);

    /* Precio y subtotal según la cantidad actual */
    function refrescar(sinGuardar) {
      var n = item.cantidad;
      menos.disabled = n <= producto.minimo;
      subtotal.textContent = precios.formato(precios.subtotal(producto, n));

      precio.textContent = precios.formato(precios.unitario(producto, n)) + " c/u";
      if (precios.aplicaMayoreo(producto, n)) {
        precio.appendChild(crear("span", "etiqueta-mayoreo", "Precio de mayoreo"));
      }

      if (producto.mayoreo && !precios.aplicaMayoreo(producto, n)) {
        sugerencia.textContent = "Desde " + piezas(producto.mayoreo.desde) + ": " +
          precios.formato(producto.mayoreo.precio) + " c/u.";
        sugerencia.hidden = false;
      } else {
        sugerencia.hidden = true;
      }
      actualizarTotales();
      if (!sinGuardar) guardarCarrito();
    }

    function limpiarError() {
      error.hidden = true;
      error.textContent = "";
      campo.removeAttribute("aria-invalid");
    }

    function fijar(n) {
      item.cantidad = Math.max(producto.minimo, n);
      campo.value = item.cantidad;
      limpiarError();
      refrescar();
    }

    menos.addEventListener("click", function () { fijar(item.cantidad - 1); });
    mas.addEventListener("click", function () { fijar(item.cantidad + 1); });

    campo.addEventListener("input", function () {
      var n = parseInt(campo.value, 10);
      if (n >= producto.minimo) {
        limpiarError();
        item.cantidad = n;
        refrescar();
      } else {
        error.textContent = "El mínimo para este producto es " + piezas(producto.minimo) + ".";
        error.hidden = false;
        campo.setAttribute("aria-invalid", "true");
      }
    });
    campo.addEventListener("change", function () {
      var n = parseInt(campo.value, 10);
      fijar(isNaN(n) ? producto.minimo : n);
    });

    quitar.addEventListener("click", function () {
      var indice = items.indexOf(item);
      quitado = { item: item, indice: indice };
      items.splice(indice, 1);
      guardarCarrito();
      pintar();
      mostrarEstado("Quitamos " + producto.nombre + " de tu carrito.", deshacer);
      $("estado").focus();
    });

    refrescar(true);
    return li;
  }

  function deshacer() {
    if (!quitado) return;
    items.splice(quitado.indice, 0, quitado.item);
    var indice = quitado.indice;
    quitado = null;
    guardarCarrito();
    mostrarEstado("");
    pintar();
    var restaurado = $("items").children[indice];
    if (restaurado) restaurado.querySelector("a, button").focus();
  }

  /* ---------- Pintar la vista ---------- */
  function pintar() {
    var hay = items.length > 0;
    $("vacia").hidden = hay;
    $("vista").hidden = !hay && !quitado;

    ["#vista > .navegacion", "#vista > .progreso", "#vista > h1"].forEach(function (sel) {
      document.querySelector(sel).hidden = !hay;
    });
    document.querySelector(".disposicion").hidden = !hay;

    var lista = $("items");
    lista.textContent = "";
    items.forEach(function (it) { lista.appendChild(crearItem(it)); });
    $("conteo").textContent = items.length;
    if (hay) actualizarTotales();
  }

  $("aviso-demo").hidden = !config.preciosDeEjemplo;
  pintar();
  if (noDisponibles.length) {
    mostrarEstado("Quitamos de tu carrito " +
      noDisponibles.map(function (i) { return i.nombre; }).join(", ") +
      " porque ya no está disponible.");
    $("vista").hidden = false;
  }

  /* ---------- Datos del cliente ---------- */
  var previo = cotizaciones.leerCliente();
  $("nombre").value = previo.nombre || "";
  $("celular").value = previo.celular || "";
  $("correo").value = previo.correo || "";
  $("cp").value = previo.cp || "";

  function mostrarError(campo, mensaje) {
    var p = $("error-" + campo);
    p.textContent = mensaje;
    p.hidden = !mensaje;
    var entrada = $(campo);
    if (entrada) {
      if (mensaje) entrada.setAttribute("aria-invalid", "true");
      else entrada.removeAttribute("aria-invalid");
    }
  }

  /* ---------- Restricciones de escritura ----------
   * Cada campo elimina en el momento los caracteres que no le corresponden,
   * también al pegar texto. Se espera a que termine la composición de acentos
   * para no romper letras como á o ñ al escribirlas.
   */
  function restringir(id, limpiar) {
    var entrada = $(id);

    function aplicar() {
      var valor = entrada.value;
      var limpio = limpiar(valor);
      if (limpio !== valor) {
        var pos = entrada.selectionStart;
        entrada.value = limpio;
        var nueva = Math.max(0, Math.min(limpio.length, pos - (valor.length - limpio.length)));
        entrada.setSelectionRange(nueva, nueva);
      }
      if (!$("error-" + id).hidden) mostrarError(id, "");
    }

    entrada.addEventListener("input", function (e) { if (!e.isComposing) aplicar(); });
    entrada.addEventListener("compositionend", aplicar);
  }

  /* Nombre: letras (con acentos y ñ), espacios, apóstrofo, punto y guion */
  restringir("nombre", function (v) {
    return v.replace(/[^\p{L}\p{M} '’.\-]/gu, "").replace(/ {2,}/g, " ").replace(/^ /, "");
  });
  $("nombre").addEventListener("blur", function () {
    this.value = this.value.trim().replace(/ {2,}/g, " ");
  });

  /* Celular: solo dígitos, máximo 10 (quita el +52 si se pega con lada) */
  restringir("celular", function (v) {
    var d = v.replace(/\D/g, "");
    if (d.length === 12 && d.indexOf("52") === 0) d = d.slice(2);
    return d.slice(0, 10);
  });

  /* Correo: minúsculas, números y . _ % + - @ (una sola arroba), sin espacios */
  restringir("correo", function (v) {
    var l = v.toLowerCase().replace(/[^a-z0-9._%+\-@]/g, "");
    var i = l.indexOf("@");
    return i === -1 ? l : l.slice(0, i + 1) + l.slice(i + 1).replace(/@/g, "");
  });

  /* Código postal: solo dígitos, máximo 5 */
  restringir("cp", function (v) {
    return v.replace(/\D/g, "").slice(0, 5);
  });

  function soloDigitosCelular(texto) {
    var d = texto.replace(/\D/g, "");
    if (d.length === 12 && d.indexOf("52") === 0) d = d.slice(2);
    return d;
  }

  function validar() {
    var fallos = [];
    var nombre = $("nombre").value.trim();
    var celular = soloDigitosCelular($("celular").value);
    var correo = $("correo").value.trim();
    var cp = $("cp").value.trim();

    if (nombre.length < 3 || !/\p{L}.*\p{L}/u.test(nombre)) fallos.push(["nombre", "Escribe tu nombre completo."]);
    if (celular.length !== 10) fallos.push(["celular", "Escribe tu celular a 10 dígitos."]);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) fallos.push(["correo", "Escribe un correo válido, por ejemplo nombre@correo.com."]);
    if (!/^\d{5}$/.test(cp)) fallos.push(["cp", "El código postal tiene 5 dígitos."]);

    return { fallos: fallos, cliente: { nombre: nombre, celular: celular, correo: correo, cp: cp } };
  }

  $("formulario").addEventListener("submit", function (e) {
    e.preventDefault();
    ["nombre", "celular", "correo", "cp", "guardar"].forEach(function (c) { mostrarError(c, ""); });

    /* Si alguna cantidad quedó por debajo del mínimo, se corrige primero */
    var cantidadInvalida = document.querySelector('.cantidad input[aria-invalid="true"]');
    if (cantidadInvalida) { cantidadInvalida.focus(); return; }

    if (!items.length) return;

    var resultado = validar();
    if (resultado.fallos.length) {
      resultado.fallos.forEach(function (f) { mostrarError(f[0], f[1]); });
      $(resultado.fallos[0][0]).focus();
      return;
    }

    var ahora = new Date();
    var total = 0;
    var lineas = items.map(function (it) {
      var p = productoDe(it.id);
      var sub = precios.subtotal(p, it.cantidad);
      total += sub;
      return Object.assign({}, it, {
        precioUnitario: precios.unitario(p, it.cantidad),
        mayoreo: precios.aplicaMayoreo(p, it.cantidad),
        subtotal: sub
      });
    });
    total = Math.round(total * 100) / 100;

    var cotizacion = {
      folio: cotizaciones.generarFolio(ahora),
      estado: "nueva",
      emision: ahora.toISOString(),
      vence: cotizaciones.sumarMeses(ahora, config.vigenciaMeses).toISOString(),
      moneda: "MXN",
      cliente: resultado.cliente,
      items: lineas,
      subtotal: total,
      total: total,
      preciosDeEjemplo: !!config.preciosDeEjemplo
    };

    var guardado = cotizaciones.guardar(cotizacion);
    if (!guardado.ok) {
      mostrarError("guardar", "No pudimos guardar tu cotización en este navegador. Quita las imágenes de referencia e inténtalo de nuevo.");
      return;
    }

    cotizaciones.guardarCliente(resultado.cliente);
    carrito.guardar([]);
    window.location.href = "folio.html?folio=" + encodeURIComponent(cotizacion.folio);
  });
})();
