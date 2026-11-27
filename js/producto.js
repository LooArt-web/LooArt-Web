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
  /* El cliente puede arrastrar su diseño sobre la vista previa (posición libre) */
  var vista = datos.vistaPrevia.crear(producto, $("foto"), { alMover: moverDiseno });
  /* Copia junto a los controles de colocación (solo visible en celular) */
  var vistaColocacion = datos.vistaPrevia.crear(producto, $("vista-colocacion"), { teclado: false, alMover: moverDiseno });

  /* Al arrastrar el diseño en la vista previa se actualizan los controles */
  function moverDiseno(pos) {
    $("posx").value = Math.round(pos.posX * 100);
    $("posy").value = Math.round(pos.posY * 100);
    actualizarVista();
  }

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
      if (window.LooArt.vistaPrevia.hexValido(hex)) {
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

  /*
   * Temáticas como muestras: cada opción enseña su patrón pintado con el color
   * elegido. Solo se activa si al menos una temática tiene patrón; si no,
   * se quedan como opciones de texto.
   */
  var conMuestras = datos.tematicas.some(function (t) { return !!datos.vistaPrevia.patronDe(t); });
  function pintarMuestrasTematica() {
    if (!conMuestras) return;
    var base = hexColor(valorElegido("color"));
    $("op-tematica").classList.add("opciones--tematicas");
    [].slice.call($("op-tematica").querySelectorAll(".opcion")).forEach(function (op) {
      var valor = op.querySelector("input").value;
      var span = op.querySelector("span");
      var previa = span.querySelector(".tematica__muestra");
      if (previa) previa.remove();
      var caja = document.createElement("i");
      caja.className = "tematica__muestra";
      var svg = valor === LIBRE ? null : datos.vistaPrevia.muestraTematica(valor, base);
      if (svg) caja.appendChild(svg);
      else {
        /* Sin patrón (o temática libre): letra inicial o lápiz */
        caja.classList.add("tematica__muestra--vacia");
        caja.textContent = valor === LIBRE ? "✎" : valor.replace(/[^\p{L}\p{N}]/gu, "").charAt(0).toUpperCase();
      }
      span.insertBefore(caja, span.firstChild);
    });
  }
  pintarMuestrasTematica();
  $("op-color").addEventListener("change", pintarMuestrasTematica);

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

  /* ---------- Cómo se coloca la imagen ---------- */
  var VP = datos.vistaPrevia;
  var AYUDA_COLOCACION = {
    centro: "Tu imagen va una vez, en la zona de impresión.",
    repetida: "Tu imagen se repite en miniatura por todo el producto. Funciona mejor con logos o íconos con fondo transparente.",
    envolvente: "Tu imagen cubre todo el producto, como un vinil completo."
  };

  function disenoActual() {
    return VP.normalizarDiseno({
      modo: valorElegido("colocacion") || "centro",
      tamano: Number($("tamano").value) / 100,
      separacion: Number($("separacion").value) / 100,
      intercalado: $("intercalado").checked,
      angulo: Number($("angulo").value),
      escala: Number($("escala").value) / 100,
      posX: Number($("posx").value) / 100,
      posY: Number($("posy").value) / 100,
      cara: conReverso ? valorElegido("lado") || "frente" : "frente"
    });
  }

  /* Playeras, sudaderas, cajas… con frente y reverso: el cliente elige el lado */
  var conReverso = VP.reversoImprimible(producto);

  function textoPos(v, menor, mayor) {
    return v < 0.38 ? menor : v > 0.62 ? mayor : "Centro";
  }

  /* Termos y tazas en 3D: el diseño se puede mover alrededor del cuerpo */
  var gira3d = (producto.modelo === "termo" || producto.modelo === "taza") &&
    !!(window.LooArt.visor3d && window.LooArt.visor3d.disponible());

  function pintarColocacion() {
    var d = disenoActual();
    var hayTexto = !!$("texto").value.trim();
    /* Con imagen se elige cómo colocarla; con solo texto, su posición y tamaño */
    $("g-colocacion").hidden = !imagen && !hayTexto;
    $("op-colocacion").hidden = !imagen;
    $("titulo-colocacion").textContent = imagen ? "Cómo se coloca tu imagen" : "Posición y tamaño del texto";
    $("ayuda-colocacion").hidden = !imagen;
    $("ajustes-repetida").hidden = !imagen || d.modo !== "repetida";
    $("ajustes-centro").hidden = imagen ? d.modo !== "centro" : false;
    $("ajuste-angulo").hidden = !gira3d;
    /* En termos y tazas lo horizontal se mueve con "Posición alrededor del producto" */
    $("ajuste-posx").hidden = gira3d;
    $("g-lado").hidden = !conReverso || (!imagen && !hayTexto);
    $("pista-arrastre").hidden = !vista.arrastrable;
    $("valor-posx").textContent = textoPos(d.posX, "Izquierda", "Derecha") + " · " + Math.round(d.posX * 100) + " %";
    $("valor-posy").textContent = textoPos(d.posY, "Arriba", "Abajo") + " · " + Math.round(d.posY * 100) + " %";
    $("posx").setAttribute("aria-valuetext", $("valor-posx").textContent);
    $("posy").setAttribute("aria-valuetext", $("valor-posy").textContent);
    [].slice.call(document.querySelectorAll(".posicion")).forEach(function (b) {
      var activo = Math.abs(Number(b.dataset.x) / 100 - d.posX) < 0.03 && Math.abs(Number(b.dataset.y) / 100 - d.posY) < 0.03;
      b.setAttribute("aria-pressed", activo ? "true" : "false");
    });
    $("valor-angulo").textContent = Math.abs(d.angulo) < 5 ? "Al frente"
      : Math.round(Math.abs(d.angulo)) + "° a la " + (d.angulo > 0 ? "derecha" : "izquierda");
    $("valor-escala").textContent = Math.round(d.escala * 100) + " %";
    $("angulo").setAttribute("aria-valuetext", $("valor-angulo").textContent);
    $("escala").setAttribute("aria-valuetext", $("valor-escala").textContent);
    $("ayuda-colocacion").textContent = AYUDA_COLOCACION[d.modo];
    $("valor-tamano").textContent = d.tamano < 0.34 ? "Chicas" : d.tamano < 0.67 ? "Medianas" : "Grandes";
    $("valor-separacion").textContent = d.separacion < 0.12 ? "Mínima" : d.separacion < 0.32 ? "Media" : "Amplia";
    $("tamano").setAttribute("aria-valuetext", $("valor-tamano").textContent);
    $("separacion").setAttribute("aria-valuetext", $("valor-separacion").textContent);
  }

  /* Al editar un producto del carrito, se recupera cómo estaba colocada la imagen */
  if (previo && previo.diseno) {
    var dPrevio = VP.normalizarDiseno(previo.diseno);
    var radio = document.querySelector('input[name="colocacion"][value="' + dPrevio.modo + '"]');
    if (radio) radio.checked = true;
    $("tamano").value = Math.round(dPrevio.tamano * 100);
    $("separacion").value = Math.round(dPrevio.separacion * 100);
    $("intercalado").checked = dPrevio.intercalado;
    $("angulo").value = Math.round(dPrevio.angulo);
    $("escala").value = Math.round(dPrevio.escala * 100);
    $("posx").value = Math.round(dPrevio.posX * 100);
    $("posy").value = Math.round(dPrevio.posY * 100);
    var radioLado = document.querySelector('input[name="lado"][value="' + dPrevio.cara + '"]');
    if (radioLado) radioLado.checked = true;
  }

  /* Posiciones rápidas */
  [].slice.call(document.querySelectorAll(".posicion")).forEach(function (b) {
    b.addEventListener("click", function () {
      $("posx").value = b.dataset.x;
      $("posy").value = b.dataset.y;
      actualizarVista();
    });
  });

  /* ---------- Vista previa en vivo ---------- */
  function actualizarVista() {
    pintarColocacion();
    var color = valorElegido("color");
    var tematica = valorElegido("tematica");
    var estadoVista = {
      colorHex: hexColor(color),
      colorNombre: color,
      arte: imagen && imagen.data ? imagen.data : null,
      tematica: tematica === LIBRE ? $("tematica-libre").value.trim() : tematica,
      texto: $("texto").value.trim(),
      diseno: imagen || $("texto").value.trim() ? disenoActual() : null
    };
    vista.actualizar(estadoVista);
    vistaColocacion.actualizar(estadoVista);
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
      imagen: imagen,
      /* Cómo se coloca la imagen; viaja al carrito, al folio y al panel */
      diseno: imagen || $("texto").value.trim() ? disenoActual() : null
    };

    var items = carrito.leer();
    var posicion = -1;
    items.forEach(function (it, i) { if (previo && it.uid === previo.uid) posicion = i; });
    if (posicion >= 0) items[posicion] = item; else items.push(item);

    if (!carrito.guardar(items)) {
      mostrarError("guardar", "No pudimos guardar tu carrito en este navegador. Quita la imagen de referencia e inténtalo de nuevo.");
      return;
    }

    pintarConteo();
    $("vista").hidden = true;
    $("confirmacion-titulo").textContent = previo
      ? "Actualizamos " + producto.nombre + " en tu carrito"
      : "Agregamos " + producto.nombre + " a tu carrito";
    $("confirmacion").hidden = false;
    $("confirmacion-titulo").focus();
    window.scrollTo(0, 0);
  });

  pintarConteo();
})();
