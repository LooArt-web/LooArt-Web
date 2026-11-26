/* Panel: alta, edición, ocultar y eliminación de productos; temáticas */
(function () {
  var datos = window.LooArt;
  var admin = datos.admin;
  var precios = datos.precios;

  if (!admin.requerir()) return;
  admin.pintarCabecera("productos");

  var LIBRE = "Otra (libre)";
  var MAX_LADO_FOTO = 800;

  /* Copia de trabajo: nada cambia en el sitio hasta que se guarda */
  var productos = JSON.parse(JSON.stringify(datos.productos));
  var tematicas = datos.tematicas.slice();
  var patrones = JSON.parse(JSON.stringify(datos.patronesTematica || {}));
  var MAX_LADO_PATRON = 240;
  var editando = -1; /* posición del producto en edición, -1 = nuevo */
  var foto = null;   /* imagen en formato data URL */
  /* Foto recortada: { frente: Pieza, reverso: Pieza | null } (ver js/recorte.js) */
  var recorte = null;

  function $(id) { return document.getElementById(id); }

  function crear(etiqueta, clase, texto) {
    var el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto) el.textContent = texto;
    return el;
  }

  function piezas(n) { return n === 1 ? "1 pieza" : n + " piezas"; }

  /* ---------- Guardar ---------- */
  function persistir() {
    var ok = datos.catalogo.guardar(productos, tematicas, patrones);
    var e = $("error-general");
    e.textContent = ok ? "" : "No se pudo guardar. Es probable que el navegador se haya quedado sin espacio: prueba con fotos más ligeras o quita alguna.";
    e.hidden = ok;
    return ok;
  }

  function estado(texto) { $("estado").textContent = texto; }

  /* ---------- Lista ---------- */
  function resumen(p) {
    var t = p.categoria + " · Mínimo " + piezas(p.minimo) + " · " + precios.formato(p.precio);
    if (p.mayoreo) t += " · Mayoreo desde " + piezas(p.mayoreo.desde) + ": " + precios.formato(p.mayoreo.precio);
    return t;
  }

  function pintarLista() {
    var ul = $("lista");
    ul.textContent = "";

    if (!productos.length) {
      ul.appendChild(crear("li", "aviso-admin", "No hay productos. Agrega el primero con el botón “Agregar producto”."));
    }

    productos.forEach(function (p, i) {
      var li = crear("li", "producto-fila" + (p.visible === false ? " producto-fila--oculto" : ""));

      var cajaFoto = crear("div", "producto-fila__foto");
      datos.vistaPrevia.crear(p, cajaFoto, {
        miniatura: true,
        estado: { colorHex: p.colores[0] && p.colores[0].hex }
      });
      li.appendChild(cajaFoto);

      var info = crear("div", "producto-fila__info");
      var h = crear("h3", "", p.nombre);
      if (p.pendiente) h.appendChild(crear("span", "etiqueta-chica", "Ejemplo"));
      if (p.visible === false) h.appendChild(crear("span", "etiqueta-chica", "Oculto"));
      info.appendChild(h);
      info.appendChild(crear("p", "", resumen(p)));
      li.appendChild(info);

      var acc = crear("div", "producto-fila__acciones");

      var editar = crear("button", "chip", "Editar");
      editar.type = "button";
      editar.setAttribute("aria-label", "Editar " + p.nombre);
      editar.addEventListener("click", function () { abrirFormulario(i); });

      var visible = crear("button", "chip", p.visible === false ? "Mostrar" : "Ocultar");
      visible.type = "button";
      visible.setAttribute("aria-label", (p.visible === false ? "Mostrar " : "Ocultar ") + p.nombre + " en el catálogo");
      visible.addEventListener("click", function () {
        p.visible = p.visible === false;
        if (persistir()) {
          estado(p.nombre + (p.visible ? " ahora es visible en el catálogo." : " ahora está oculto del catálogo."));
        }
        pintarLista();
      });

      var borrar = crear("button", "chip", "Eliminar");
      borrar.type = "button";
      borrar.setAttribute("aria-label", "Eliminar " + p.nombre);
      borrar.addEventListener("click", function () {
        if (!window.confirm("¿Eliminar “" + p.nombre + "” del catálogo? Si solo es de temporada, mejor usa “Ocultar”.")) return;
        productos.splice(i, 1);
        if (persistir()) estado("Eliminamos " + p.nombre + ".");
        pintarLista();
        llenarCategorias();
      });

      acc.appendChild(editar);
      acc.appendChild(visible);
      acc.appendChild(borrar);
      li.appendChild(acc);
      ul.appendChild(li);
    });
  }

  function llenarCategorias() {
    var lista = $("categorias");
    lista.textContent = "";
    var vistas = [];
    productos.forEach(function (p) {
      if (vistas.indexOf(p.categoria) === -1) {
        vistas.push(p.categoria);
        var o = document.createElement("option");
        o.value = p.categoria;
        lista.appendChild(o);
      }
    });
  }

  /* ---------- Formulario de producto ---------- */
  var ventana = $("ventana-producto");

  function mostrarError(campo, mensaje) {
    var p = $("error-" + campo);
    p.textContent = mensaje;
    p.hidden = !mensaje;
  }

  function limpiarErrores() {
    ["nombre", "categoria", "minimo", "precio", "mayoreo", "colores", "foto", "guardar"].forEach(function (c) { mostrarError(c, ""); });
    ["nombre", "categoria", "minimo", "precio", "mayoreo-desde", "mayoreo-precio", "colores"].forEach(function (id) {
      $(id).removeAttribute("aria-invalid");
    });
  }

  function pintarFoto() {
    var segura = recorte ? null : datos.vistaPrevia.urlImagenSegura(foto);
    $("foto-vista").hidden = !segura;
    if (segura) $("foto-vista").src = segura;
    $("quitar-foto").hidden = !foto && !recorte;

    $("piezas-foto").hidden = !recorte;
    $("intercambiar-foto").hidden = !(recorte && recorte.reverso);
    $("subir-reverso").hidden = !recorte;
    $("subir-reverso").textContent = recorte && recorte.reverso ? "Cambiar reverso" : "Subir reverso aparte";
    $("quitar-reverso").hidden = !(recorte && recorte.reverso);
    ["frente", "reverso"].forEach(function (lado) {
      var caja = $("pieza-" + lado);
      caja.textContent = "";
      var pieza = recorte && recorte[lado];
      if (pieza) {
        var img = document.createElement("img");
        img.src = datos.vistaPrevia.urlImagenSegura(pieza.imagen);
        img.alt = lado === "frente" ? "Frente recortado" : "Reverso recortado";
        caja.appendChild(img);
      } else {
        caja.appendChild(crear("span", "", lado === "frente" ? "Sin foto" : "Sin reverso: el producto no se voltea"));
      }
    });
  }

  /* Pieza guardada en el producto → formato de js/recorte.js (para editar) */
  function recorteDeProducto(p) {
    if (!p || !p.imagenRecortada || !p.imagen) return null;
    var t = p.imagenTam || {}, tr = p.imagenReversoTam || {};
    return {
      frente: { imagen: p.imagen, ancho: t.w, alto: t.h, zona: p.imagenZona || null, zonaCaja: p.imagenZonaCaja || null,
        borde: p.imagenBorde, cara: p.imagenCara },
      reverso: p.imagenReverso ? { imagen: p.imagenReverso, ancho: tr.w, alto: tr.h, zona: null, zonaCaja: null,
        borde: p.imagenBorde, cara: p.imagenCara } : null
    };
  }

  /* Campos del producto a partir de la foto (recortada o normal) */
  function camposFoto() {
    if (!recorte) {
      return { imagen: foto, imagenRecortada: false, imagenReverso: null, imagenZona: null, imagenZonaCaja: null,
        imagenBorde: null, imagenCara: null, imagenTam: null, imagenReversoTam: null };
    }
    var f = recorte.frente, r = recorte.reverso;
    return {
      imagen: f.imagen,
      imagenRecortada: true,
      imagenReverso: r ? r.imagen : null,
      imagenZona: f.zona || null,
      imagenZonaCaja: f.zonaCaja || null,
      imagenBorde: f.borde || null,
      imagenCara: f.cara || null,
      imagenTam: { w: f.ancho, h: f.alto },
      imagenReversoTam: r ? { w: r.ancho, h: r.alto } : null
    };
  }

  function lineas(texto) {
    var vistos = [];
    texto.split(/\r?\n/).forEach(function (l) {
      var t = l.trim().replace(/\s{2,}/g, " ");
      if (t && vistos.indexOf(t) === -1) vistos.push(t.slice(0, 40));
    });
    return vistos;
  }

  /* Colores: cada línea es "Nombre" o "Nombre #RRGGBB" */
  var PATRON_COLOR = /^(.*?)\s*(#[0-9a-fA-F]{6})$/;

  function colores(texto) {
    return lineas(texto).map(function (l) {
      var m = l.match(PATRON_COLOR);
      return m && m[1] ? { nombre: m[1], hex: m[2].toUpperCase() } : { nombre: l, hex: null };
    });
  }

  function coloresATexto(lista) {
    return lista.map(function (c) { return c.nombre + (c.hex ? " " + c.hex : ""); }).join("\n");
  }

  function abrirFormulario(indice) {
    editando = indice;
    limpiarErrores();
    var p = indice >= 0 ? productos[indice] : null;

    $("titulo-ventana").textContent = p ? "Editar producto" : "Agregar producto";
    $("nombre").value = p ? p.nombre : "";
    $("categoria").value = p ? p.categoria : "";
    $("modelo").value = p ? p.modelo : "caja";
    $("minimo").value = p ? p.minimo : 5;
    $("precio").value = p ? p.precio : "";
    $("mayoreo-desde").value = p && p.mayoreo ? p.mayoreo.desde : "";
    $("mayoreo-precio").value = p && p.mayoreo ? p.mayoreo.precio : "";
    $("presentaciones").value = p ? p.presentaciones.join("\n") : "";
    $("colores").value = p ? coloresATexto(p.colores) : "";
    $("visible").checked = p ? p.visible !== false : true;
    foto = p && p.imagen ? datos.vistaPrevia.urlImagenSegura(p.imagen) : null;
    recorte = recorteDeProducto(p);
    $("foto").value = "";
    $("foto-reverso").value = "";
    $("estado-foto").textContent = "";
    pintarFoto();

    ventana.showModal();
    $("nombre").focus();
  }

  function reducirImagen(archivo) {
    return new Promise(function (resolver, rechazar) {
      var lector = new FileReader();
      lector.onerror = function () { rechazar(new Error("lectura")); };
      lector.onload = function () {
        var img = new Image();
        img.onerror = function () { rechazar(new Error("imagen")); };
        img.onload = function () {
          var escala = Math.min(1, MAX_LADO_FOTO / Math.max(img.width, img.height));
          var lienzo = document.createElement("canvas");
          lienzo.width = Math.max(1, Math.round(img.width * escala));
          lienzo.height = Math.max(1, Math.round(img.height * escala));
          var ctx = lienzo.getContext("2d");
          ctx.fillStyle = "#fff"; /* evita fondo negro en PNG con transparencia */
          ctx.fillRect(0, 0, lienzo.width, lienzo.height);
          ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
          resolver(lienzo.toDataURL("image/jpeg", 0.8));
        };
        img.src = lector.result;
      };
      lector.readAsDataURL(archivo);
    });
  }

  $("foto").addEventListener("change", function () {
    var archivo = this.files[0];
    mostrarError("foto", "");
    if (!archivo) return;
    if (archivo.type.indexOf("image/") !== 0) {
      mostrarError("foto", "El archivo debe ser una imagen (JPG, PNG, etc.).");
      this.value = "";
      return;
    }
    if ($("quitar-fondo").checked && datos.recorte) {
      $("estado-foto").textContent = "Quitando el fondo…";
      datos.recorte.procesar(archivo).then(function (r) {
        recorte = { frente: r.frente, reverso: r.reverso };
        foto = r.frente.imagen;
        $("estado-foto").textContent = r.reverso
          ? "Listo: encontramos frente y reverso. Revisa que el frente sea la cara donde va el diseño."
          : "Listo: encontramos una sola pieza. Si tienes la foto del reverso, súbela aparte.";
        pintarFoto();
      }, function () {
        $("estado-foto").textContent = "";
        mostrarError("foto", "No encontramos el producto en la foto. Prueba con otra o desmarca “Quitar el fondo”.");
      });
      return;
    }
    reducirImagen(archivo).then(function (data) {
      foto = data;
      recorte = null;
      $("estado-foto").textContent = "";
      pintarFoto();
    }, function () {
      mostrarError("foto", "No pudimos leer esa imagen. Prueba con otra.");
    });
  });

  /* Reverso en una foto aparte: se recorta y se usa su pieza principal */
  $("foto-reverso").addEventListener("change", function () {
    var archivo = this.files[0];
    mostrarError("foto", "");
    if (!archivo || !recorte) return;
    if (archivo.type.indexOf("image/") !== 0) {
      mostrarError("foto", "El archivo debe ser una imagen (JPG, PNG, etc.).");
      return;
    }
    $("estado-foto").textContent = "Quitando el fondo del reverso…";
    datos.recorte.procesar(archivo).then(function (r) {
      recorte.reverso = r.frente;
      $("estado-foto").textContent = "Listo: agregamos el reverso.";
      pintarFoto();
    }, function () {
      $("estado-foto").textContent = "";
      mostrarError("foto", "No encontramos el producto en la foto del reverso. Prueba con otra.");
    });
    this.value = "";
  });

  $("intercambiar-foto").addEventListener("click", function () {
    if (!recorte || !recorte.reverso) return;
    var t = recorte.frente; recorte.frente = recorte.reverso; recorte.reverso = t;
    foto = recorte.frente.imagen;
    $("estado-foto").textContent = "Intercambiamos frente y reverso.";
    pintarFoto();
  });

  $("quitar-reverso").addEventListener("click", function () {
    if (!recorte) return;
    recorte.reverso = null;
    $("estado-foto").textContent = "Quitamos el reverso: el producto se mostrará sin voltear.";
    pintarFoto();
  });

  $("quitar-foto").addEventListener("click", function () {
    foto = null;
    recorte = null;
    $("foto").value = "";
    $("estado-foto").textContent = "";
    pintarFoto();
  });

  $("agregar").addEventListener("click", function () { abrirFormulario(-1); });
  $("cancelar").addEventListener("click", function () { ventana.close(); });

  function identificador(nombre) {
    var base = nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "producto";
    var id = base;
    var n = 2;
    while (productos.some(function (p) { return p.id === id; })) { id = base + "-" + n; n++; }
    return id;
  }

  function validar() {
    var fallos = [];
    function falla(campo, mensaje, foco) { fallos.push({ campo: campo, mensaje: mensaje, foco: $(foco || campo) }); }

    var nombre = $("nombre").value.trim();
    var categoria = $("categoria").value.trim();
    var minimo = Number($("minimo").value);
    var precio = Number($("precio").value);
    var desdeTxt = $("mayoreo-desde").value;
    var precioMTxt = $("mayoreo-precio").value;

    if (nombre.length < 2) falla("nombre", "Escribe el nombre del producto.");
    else if (productos.some(function (p, i) { return i !== editando && p.nombre.toLowerCase() === nombre.toLowerCase(); })) {
      falla("nombre", "Ya existe un producto con ese nombre.");
    }
    if (categoria.length < 2) falla("categoria", "Escribe la categoría.");
    if (!Number.isInteger(minimo) || minimo < 1) falla("minimo", "El mínimo debe ser un número entero de 1 o más.");
    if (!(precio > 0)) falla("precio", "Escribe un precio mayor a 0.");

    var colorMal = lineas($("colores").value).filter(function (l) {
      return l.indexOf("#") !== -1 && !PATRON_COLOR.test(l);
    })[0];
    if (colorMal) falla("colores", "Revisa \u201c" + colorMal + "\u201d: el tono va como #RRGGBB, por ejemplo Rojo #C0392B.");

    if (desdeTxt || precioMTxt) {
      var desde = Number(desdeTxt);
      var precioM = Number(precioMTxt);
      if (!desdeTxt || !precioMTxt) falla("mayoreo", "Para el mayoreo llena las piezas y el precio, o deja ambos vacíos.", "mayoreo-desde");
      else if (!Number.isInteger(desde) || desde <= minimo) falla("mayoreo", "El mayoreo debe empezar en más piezas que el mínimo (" + minimo + ").", "mayoreo-desde");
      else if (!(precioM > 0) || precioM >= precio) falla("mayoreo", "El precio de mayoreo debe ser mayor a 0 y menor al precio unitario.", "mayoreo-precio");
    }
    return fallos;
  }

  $("formulario").addEventListener("submit", function (e) {
    e.preventDefault();
    limpiarErrores();

    var fallos = validar();
    if (fallos.length) {
      fallos.forEach(function (f) {
        mostrarError(f.campo, f.mensaje);
        f.foco.setAttribute("aria-invalid", "true");
      });
      fallos[0].foco.focus();
      return;
    }

    var nombre = $("nombre").value.trim();
    var existente = editando >= 0 ? productos[editando] : {};
    var p = Object.assign({}, existente, {
      id: existente.id || identificador(nombre),
      nombre: nombre,
      categoria: $("categoria").value.trim(),
      minimo: Number($("minimo").value),
      precio: Math.round(Number($("precio").value) * 100) / 100,
      mayoreo: $("mayoreo-desde").value
        ? { desde: Number($("mayoreo-desde").value), precio: Math.round(Number($("mayoreo-precio").value) * 100) / 100 }
        : null,
      presentaciones: lineas($("presentaciones").value),
      colores: colores($("colores").value),
      modelo: $("modelo").value,
      visible: $("visible").checked
    }, camposFoto());
    delete p.pendiente; /* ya no es un marcador de ejemplo */

    if (editando >= 0) productos[editando] = p; else productos.push(p);

    if (!persistir()) {
      mostrarError("guardar", "No se pudo guardar. Prueba con una foto más ligera o quítala.");
      return;
    }

    ventana.close();
    estado("Guardamos " + p.nombre + ".");
    pintarLista();
    llenarCategorias();
  });

  /* ---------- Temáticas ---------- */
  $("tematicas").value = tematicas.join("\n");

  $("guardar-tematicas").addEventListener("click", function () {
    mostrarError("tematicas", "");
    var lista = lineas($("tematicas").value);
    if (lista.some(function (t) { return t.toLowerCase() === LIBRE.toLowerCase(); })) {
      mostrarError("tematicas", "“" + LIBRE + "” se agrega sola; quítala de la lista.");
      return;
    }
    tematicas = lista;
    $("tematicas").value = tematicas.join("\n");
    if (persistir()) estado("Guardamos " + (tematicas.length === 1 ? "1 temática." : tematicas.length + " temáticas."));
    pintarPatrones();
  });

  /* ---------- Patrón de cada temática ---------- */
  /* Reduce la imagen conservando la transparencia (PNG) */
  function reducirPatron(archivo) {
    return new Promise(function (resolver, rechazar) {
      var lector = new FileReader();
      lector.onerror = function () { rechazar(new Error("lectura")); };
      lector.onload = function () {
        var img = new Image();
        img.onerror = function () { rechazar(new Error("imagen")); };
        img.onload = function () {
          var escala = Math.min(1, MAX_LADO_PATRON / Math.max(img.width, img.height));
          var lienzo = document.createElement("canvas");
          lienzo.width = Math.max(1, Math.round(img.width * escala));
          lienzo.height = Math.max(1, Math.round(img.height * escala));
          lienzo.getContext("2d").drawImage(img, 0, 0, lienzo.width, lienzo.height);
          resolver(lienzo.toDataURL("image/png"));
        };
        img.src = lector.result;
      };
      lector.readAsDataURL(archivo);
    });
  }

  function guardarPatron(tematica, valor, mensaje) {
    var anterior = patrones[tematica];
    if (valor) patrones[tematica] = valor; else delete patrones[tematica];
    if (!persistir()) {
      if (anterior) patrones[tematica] = anterior; else delete patrones[tematica];
      return;
    }
    $("estado-patrones").textContent = mensaje;
    pintarPatrones();
  }

  function pintarPatrones() {
    var lista = $("patrones");
    lista.textContent = "";
    /* Solo se conservan los patrones de temáticas que siguen existiendo */
    Object.keys(patrones).forEach(function (t) { if (tematicas.indexOf(t) === -1) delete patrones[t]; });
    if (!tematicas.length) {
      lista.appendChild(crear("li", "ayuda", "Agrega temáticas en la lista de arriba para asignarles un patrón."));
      return;
    }
    tematicas.forEach(function (t, i) {
      var actual = patrones[t] || null;
      var li = crear("li", "patron-fila");

      var muestra = crear("div", "patron-fila__muestra");
      var svg = datos.vistaPrevia.muestraTematica(t, "#F4F1EC");
      if (svg) muestra.appendChild(svg); else muestra.textContent = "Sin patrón";
      li.appendChild(muestra);

      var info = crear("div", "patron-fila__info");
      var idSel = "patron-" + i;
      var etiqueta = crear("label", "", t);
      etiqueta.htmlFor = idSel;
      info.appendChild(etiqueta);

      var sel = document.createElement("select");
      sel.id = idSel;
      sel.appendChild(new Option("Sin patrón", ""));
      datos.vistaPrevia.MOTIVOS.forEach(function (m) { sel.appendChild(new Option(m.nombre, m.id)); });
      if (actual && actual.imagen) sel.appendChild(new Option("Imagen propia", "__imagen"));
      sel.value = actual ? (actual.imagen ? "__imagen" : actual.motivo) : "";
      sel.addEventListener("change", function () {
        if (sel.value === "__imagen") return;
        guardarPatron(t, sel.value ? { motivo: sel.value } : null,
          sel.value ? "Guardamos el patrón de " + t + "." : "Quitamos el patrón de " + t + ".");
      });
      info.appendChild(sel);
      li.appendChild(info);

      var acciones = crear("div", "patron-fila__acciones");
      var idArchivo = "patron-archivo-" + i;
      var archivo = document.createElement("input");
      archivo.type = "file";
      archivo.accept = "image/*";
      archivo.id = idArchivo;
      archivo.className = "solo-lectores";
      var subir = crear("label", "chip", actual && actual.imagen ? "Cambiar imagen" : "Subir imagen");
      subir.htmlFor = idArchivo;
      archivo.addEventListener("change", function () {
        var f = archivo.files[0];
        if (!f) return;
        if (f.type.indexOf("image/") !== 0) {
          $("estado-patrones").textContent = "El archivo debe ser una imagen (PNG, JPG, etc.).";
          return;
        }
        reducirPatron(f).then(function (data) {
          guardarPatron(t, { imagen: data }, "Guardamos la imagen de patrón de " + t + ".");
        }, function () {
          $("estado-patrones").textContent = "No pudimos leer esa imagen. Prueba con otra.";
        });
      });
      acciones.appendChild(archivo);
      acciones.appendChild(subir);
      li.appendChild(acciones);

      lista.appendChild(li);
    });
  }
  pintarPatrones();

  /* ---------- Restaurar ---------- */
  $("restaurar").addEventListener("click", function () {
    if (!window.confirm("¿Restaurar el catálogo de ejemplo? Se perderán los productos, fotos y temáticas que agregaste.")) return;
    datos.catalogo.restaurar();
    window.location.reload();
  });

  llenarCategorias();
  pintarLista();
})();
