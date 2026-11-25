/* Vista 2: Producto y personalización */
(function () {
  var datos = window.LooArt;
  var carrito = datos.carrito;

  var LIBRE = "Otra (libre)";
  var MAX_IMAGEN = 800 * 1024; /* 800 KB */

  var params = new URLSearchParams(window.location.search);
  var producto = datos.productos.filter(function (p) { return p.id === params.get("id") && p.visible !== false; })[0];
  var uidEditar = params.get("editar");
  var previo = uidEditar
    ? carrito.leer().filter(function (i) { return i.uid === uidEditar; })[0]
    : null;

  var imagen = previo && previo.imagen ? previo.imagen : null; /* { nombre, data } */

  function $(id) { return document.getElementById(id); }

  function piezas(n) { return n === 1 ? "1 pieza" : n + " piezas"; }

  function pintarConteo() { $("conteo").textContent = carrito.contar(); }

  /* ---------- Producto no encontrado ---------- */
  if (!producto) {
    $("no-encontrado").hidden = false;
    pintarConteo();
    return;
  }

  $("vista").hidden = false;
  document.title = producto.nombre + " | LooArt";
  $("nombre").textContent = producto.nombre;
  $("minimo").textContent = "Mínimo " + piezas(producto.minimo);
  $("ayuda-cantidad").textContent = "Mínimo " + piezas(producto.minimo);

  /* Vista previa: foto real o maqueta que cambia con lo que elige el cliente */
  var vista = datos.vistaPrevia.crear(producto, $("foto"));

  /* ---------- Opciones tipo chip ---------- */
  function pintarOpciones(contenedorId, nombre, valores, seleccionado, hexDe) {
    var cont = $(contenedorId);
    cont.textContent = "";
    valores.forEach(function (valor) {
      var etiqueta = document.createElement("label");
      etiqueta.className = "opcion";
      var radio = document.createElement("input");
      radio.type = "radio";
      radio.name = nombre;
      radio.value = valor;
      radio.checked = valor === seleccionado;
      var texto = document.createElement("span");
      var hex = hexDe ? hexDe(valor) : null;
      if (hex) {
        var muestra = document.createElement("i");
        muestra.className = "muestra";
        muestra.style.background = hex;
        texto.appendChild(muestra);
      }
      texto.appendChild(document.createTextNode(valor));
      etiqueta.appendChild(radio);
      etiqueta.appendChild(texto);
      cont.appendChild(etiqueta);
    });
  }

  function hexColor(nombre) {
    var c = producto.colores.filter(function (x) { return x.nombre === nombre; })[0];
    return c && c.hex ? c.hex : null;
  }

  function valorElegido(nombre) {
    var r = document.querySelector('input[name="' + nombre + '"]:checked');
    return r ? r.value : "";
  }

  var tematicaPrevia = previo ? previo.tematica : "";

  pintarOpciones("op-presentacion", "presentacion", producto.presentaciones, previo && previo.presentacion);
  pintarOpciones("op-color", "color", producto.colores.map(function (c) { return c.nombre; }), previo && previo.color, hexColor);
  pintarOpciones("op-tematica", "tematica", datos.tematicas.concat([LIBRE]), tematicaPrevia);

  $("g-presentacion").hidden = producto.presentaciones.length === 0;
  $("g-color").hidden = producto.colores.length === 0;

  function actualizarTematicaLibre() {
    var libre = valorElegido("tematica") === LIBRE;
    $("g-tematica-libre").hidden = !libre;
  }
  $("op-tematica").addEventListener("change", actualizarTematicaLibre);

  /* ---------- Cantidad ---------- */
  var campoCantidad = $("cantidad");
  campoCantidad.min = producto.minimo;
  campoCantidad.value = previo ? previo.cantidad : producto.minimo;

  function cantidadActual() {
    var n = parseInt(campoCantidad.value, 10);
    return isNaN(n) ? 0 : n;
  }

  function actualizarBotones() {
    $("menos").disabled = cantidadActual() <= producto.minimo;
  }

  $("menos").addEventListener("click", function () {
    campoCantidad.value = Math.max(producto.minimo, cantidadActual() - 1);
    actualizarBotones();
  });
  $("mas").addEventListener("click", function () {
    campoCantidad.value = Math.max(producto.minimo, cantidadActual()) + 1;
    actualizarBotones();
  });
  campoCantidad.addEventListener("input", actualizarBotones);

  /* ---------- Campos de texto ---------- */
  if (previo) {
    $("tematica-libre").value = previo.tematicaLibre || "";
    $("texto").value = previo.texto || "";
    $("descripcion").value = previo.descripcion || "";
  }
  actualizarTematicaLibre();
  actualizarBotones();

  /* ---------- Vista previa en vivo ---------- */
  function actualizarVista() {
    var color = valorElegido("color");
    var tematica = valorElegido("tematica");
    vista.actualizar({
      colorHex: hexColor(color),
      colorNombre: color,
      arte: imagen && imagen.data ? imagen.data : null,
      tematica: tematica === LIBRE ? $("tematica-libre").value.trim() : tematica,
      texto: $("texto").value.trim()
    });
  }
  $("formulario").addEventListener("input", actualizarVista);
  $("formulario").addEventListener("change", actualizarVista);

  /* ---------- Imagen de referencia ---------- */
  function pintarImagen() {
    $("imagen-estado").textContent = imagen
      ? "Imagen seleccionada: " + imagen.nombre
      : "Ningún archivo seleccionado. Máximo 800 KB.";
    $("quitar-imagen").hidden = !imagen;
    actualizarVista();
  }

  $("imagen").addEventListener("change", function () {
    var archivo = this.files[0];
    mostrarError("imagen", "");
    if (!archivo) return;

    if (archivo.type.indexOf("image/") !== 0) {
      mostrarError("imagen", "El archivo debe ser una imagen (JPG, PNG, etc.).");
      this.value = "";
      return;
    }
    if (archivo.size > MAX_IMAGEN) {
      mostrarError("imagen", "La imagen pesa más de 800 KB. Elige una más ligera.");
      this.value = "";
      return;
    }
    var lector = new FileReader();
    lector.onload = function () {
      imagen = { nombre: archivo.name, data: lector.result };
      pintarImagen();
    };
    lector.readAsDataURL(archivo);
  });

  $("quitar-imagen").addEventListener("click", function () {
    imagen = null;
    $("imagen").value = "";
    pintarImagen();
    $("imagen").focus();
  });

  pintarImagen();

  /* ---------- Errores ---------- */
  function mostrarError(campo, mensaje) {
    var p = $("error-" + campo);
    if (!p) return;
    p.textContent = mensaje;
    p.hidden = !mensaje;
  }

  function limpiarErrores() {
    ["presentacion", "color", "cantidad", "tematica", "tematica-libre", "imagen", "guardar"]
      .forEach(function (c) { mostrarError(c, ""); });
    ["cantidad", "tematica-libre"].forEach(function (id) { $(id).removeAttribute("aria-invalid"); });
  }

  function validar() {
    var fallos = [];
    var cant = cantidadActual();

    if (producto.presentaciones.length && !valorElegido("presentacion")) {
      fallos.push({ campo: "presentacion", mensaje: "Elige una presentación.",
        foco: document.querySelector('input[name="presentacion"]') });
    }
    if (producto.colores.length && !valorElegido("color")) {
      fallos.push({ campo: "color", mensaje: "Elige un color.",
        foco: document.querySelector('input[name="color"]') });
    }
    if (cant < producto.minimo) {
      fallos.push({ campo: "cantidad", mensaje: "El mínimo para este producto es " + piezas(producto.minimo) + ".",
        foco: campoCantidad, invalido: campoCantidad });
    }
    var tematica = valorElegido("tematica");
    if (!tematica) {
      fallos.push({ campo: "tematica", mensaje: "Elige una temática o selecciona “" + LIBRE + "”.",
        foco: document.querySelector('input[name="tematica"]') });
    } else if (tematica === LIBRE && !$("tematica-libre").value.trim()) {
      fallos.push({ campo: "tematica-libre", mensaje: "Escribe la temática que quieres.",
        foco: $("tematica-libre"), invalido: $("tematica-libre") });
    }
    return fallos;
  }

  /* ---------- Guardar ---------- */
  function nuevoUid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  $("formulario").addEventListener("submit", function (e) {
    e.preventDefault();
    limpiarErrores();

    var fallos = validar();
    if (fallos.length) {
      fallos.forEach(function (f) {
        mostrarError(f.campo, f.mensaje);
        if (f.invalido) f.invalido.setAttribute("aria-invalid", "true");
      });
      if (fallos[0].foco) fallos[0].foco.focus();
      return;
    }

    var tematica = valorElegido("tematica");
    var item = {
      uid: previo ? previo.uid : nuevoUid(),
      id: producto.id,
      nombre: producto.nombre,
      presentacion: valorElegido("presentacion"),
      color: valorElegido("color"),
      cantidad: cantidadActual(),
      tematica: tematica,
      tematicaLibre: tematica === LIBRE ? $("tematica-libre").value.trim() : "",
      texto: $("texto").value.trim(),
      descripcion: $("descripcion").value.trim(),
      imagen: imagen
    };

    var items = carrito.leer();
    var posicion = -1;
    items.forEach(function (it, i) { if (previo && it.uid === previo.uid) posicion = i; });
    if (posicion >= 0) items[posicion] = item; else items.push(item);

    if (!carrito.guardar(items)) {
      mostrarError("guardar", "No pudimos guardar tu cotización en este navegador. Quita la imagen de referencia e inténtalo de nuevo.");
      return;
    }

    pintarConteo();
    $("vista").hidden = true;
    $("confirmacion-titulo").textContent = previo
      ? "Actualizamos " + producto.nombre + " en tu cotización"
      : "Agregamos " + producto.nombre + " a tu cotización";
    $("confirmacion").hidden = false;
    $("confirmacion-titulo").focus();
    window.scrollTo(0, 0);
  });

  pintarConteo();
})();
