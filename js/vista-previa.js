/*
 * Vista previa del producto.
 *
 * - Si el producto tiene foto real (`imagen`), se muestra la foto y, encima, la
 *   imagen que subió el cliente y el color elegido.
 * - Si no tiene foto, se dibuja una maqueta (termo, taza, sticker o caja) que
 *   cambia de color según lo que elija el cliente y muestra su imagen, su
 *   temática y su texto dentro de la zona de impresión.
 *
 * Uso: LooArt.vistaPrevia.crear(producto, contenedor, { miniatura, estado })
 *      devuelve { actualizar(estado) }.
 * `estado`: { colorHex, colorNombre, arte (data URL), tematica, texto, diseno }
 * `diseno`: cómo se coloca la imagen del cliente (ver normalizarDiseno):
 *   { modo: "centro" | "repetida" | "envolvente", tamano 0–1, separacion 0–0.6, intercalado }
 *
 * Funciona con cualquier producto, también con los que se agreguen desde el
 * panel: la forma sale del "Tipo de producto" (modelo) y, si hay foto real,
 * el diseño se dibuja sobre la zona central de la foto.
 * En termos y tazas la vista se puede girar arrastrando o con las flechas.
 */
window.LooArt = window.LooArt || {};

window.LooArt.vistaPrevia = (function () {
  var NS = "http://www.w3.org/2000/svg";
  var NEUTRO = "#CDC4B8";
  var contador = 0;

  function el(etiqueta, atributos, padre) {
    var e = document.createElementNS(NS, etiqueta);
    Object.keys(atributos || {}).forEach(function (k) { e.setAttribute(k, atributos[k]); });
    if (padre) padre.appendChild(e);
    return e;
  }

  function hexValido(h) { return typeof h === "string" && /^#[0-9a-f]{6}$/i.test(h); }

  /* Solo deja pasar direcciones de imagen: data URL de imagen, https o ruta
     relativa del sitio. Bloquea javascript:, vbscript:, data:text/html, etc.
     Protege contra datos manipulados en localStorage o, más adelante, en el servidor. */
  var PATRON_DATA_IMAGEN = /^data:image\/(png|jpe?g|gif|webp|avif|bmp|svg\+xml);base64,[a-z0-9+\/=\s]+$/i;
  function urlImagenSegura(u) {
    if (typeof u !== "string") return null;
    var t = u.trim();
    if (!t) return null;
    if (PATRON_DATA_IMAGEN.test(t)) return t;
    if (/^https:\/\//i.test(t)) return t;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(t) && t.indexOf("//") !== 0 && t.indexOf("\\") === -1) return t;
    return null;
  }

  function oscurecer(hex, f) {
    var n = parseInt(hex.slice(1), 16);
    var canales = [n >> 16, (n >> 8) & 255, n & 255].map(function (v) {
      return Math.round(v * (1 - f)).toString(16).padStart(2, "0");
    });
    return "#" + canales.join("");
  }

  function recorte(texto, max) {
    texto = String(texto || "");
    return texto.length > max ? texto.slice(0, max - 1).trim() + "…" : texto;
  }

  function tamano(letras, ancho, tope) {
    return Math.max(5, Math.min(tope, (ancho * 0.9) / (Math.max(letras, 1) * 0.58)));
  }

  /* ---------- Diseño: cómo se coloca la imagen ---------- */
  var MODOS = ["centro", "repetida", "envolvente"];

  function numero(v, defecto, min, max) {
    var n = Number(v);
    if (!isFinite(n)) n = defecto;
    return Math.min(max, Math.max(min, n));
  }

  function normalizarDiseno(d) {
    d = d || {};
    return {
      modo: MODOS.indexOf(d.modo) !== -1 ? d.modo : "centro",
      tamano: numero(d.tamano, 0.45, 0, 1),
      separacion: numero(d.separacion, 0.2, 0, 0.6),
      intercalado: d.intercalado === undefined ? true : !!d.intercalado
    };
  }

  /* Texto para el carrito, el folio, WhatsApp y el admin */
  function describirDiseno(d) {
    d = normalizarDiseno(d);
    if (d.modo === "envolvente") return "Envolvente: la imagen cubre todo el producto";
    if (d.modo !== "repetida") return "Al centro, en la zona de impresión";
    var tam = d.tamano < 0.34 ? "chicas" : d.tamano < 0.67 ? "medianas" : "grandes";
    var sep = d.separacion < 0.12 ? "mínima" : d.separacion < 0.32 ? "media" : "amplia";
    return "Repetida en todo el producto: miniaturas " + tam + ", separación " + sep +
      (d.intercalado ? ", filas intercaladas" : ", filas alineadas");
  }

  function descripcion(nombre, e) {
    var d = "Vista previa de " + nombre;
    if (e.colorNombre) d += ", color " + e.colorNombre;
    if (e.arte) {
      var modo = normalizarDiseno(e.diseno).modo;
      d += modo === "repetida" ? ", con tu imagen repetida en todo el producto"
        : modo === "envolvente" ? ", con tu imagen cubriendo todo el producto"
        : ", con tu imagen";
    }
    else if (e.tematica) d += ", temática " + e.tematica + (patronDe(e.tematica) ? " con su patrón" : "");
    if (e.texto) d += ", con el texto “" + e.texto + "”";
    return d;
  }

  /* ---------- Zona de impresión: imagen, temática y texto ---------- */
  function zona(svg, x, y, w, h, r, miniatura) {
    var id = "zona-impresion-" + (++contador);
    var recorteZona = el("clipPath", { id: id }, el("defs", {}, svg));
    el("rect", { x: x, y: y, width: w, height: h, rx: r }, recorteZona);

    var fondo = el("rect", { x: x, y: y, width: w, height: h, rx: r, fill: "#FFFFFF", "fill-opacity": "0.9", stroke: "#B3A99C", "stroke-dasharray": "4 3" }, svg);
    var arte = el("image", { x: x, y: y, width: w, height: h, preserveAspectRatio: "xMidYMid slice", "clip-path": "url(#" + id + ")" }, svg);
    var pastilla = el("rect", { fill: "#FFFFFF", "fill-opacity": "0.88", rx: 3 }, svg);
    var tipo = { "text-anchor": "middle", "font-family": "Inter, system-ui, sans-serif", "font-weight": "600", fill: "#1E1B2B" };
    var t1 = el("text", tipo, svg);
    var t2 = el("text", tipo, svg);
    var cx = x + w / 2;

    return function (e) {
      var arteUrl = urlImagenSegura(e.arte);
      var conArte = !!arteUrl;
      /* Con diseño repetido o envolvente la imagen va en todo el producto,
         así que la zona solo conserva el texto */
      var cubre = conArte && normalizarDiseno(e.diseno).modo !== "centro";
      /* Con patrón de temática el producto ya muestra el diseño: sin recuadro */
      var conPatron = !!e.conPatron;
      if (conArte) arte.setAttribute("href", arteUrl);
      /* Sobre un patrón la imagen se ve completa (sin recortar) */
      arte.setAttribute("preserveAspectRatio", conPatron ? "xMidYMid meet" : "xMidYMid slice");
      arte.style.display = conArte && !cubre ? "" : "none";
      fondo.style.display = cubre || conPatron ? "none" : "";
      fondo.setAttribute("stroke-opacity", conArte ? "0" : "1");

      pastilla.style.display = "none";
      t1.style.display = "none";
      t2.style.display = "none";
      if (miniatura) return;

      var tema = e.tematica || "";
      var texto = e.texto || "";

      if (!conArte && !conPatron) {
        var linea1 = tema ? recorte(tema, 18) : "Tu diseño aquí";
        var fs1 = tamano(linea1.length, w, 13);
        var y1 = y + h / 2 + (texto ? -fs1 * 0.15 : fs1 * 0.35);
        t1.textContent = linea1;
        t1.setAttribute("font-size", fs1);
        t1.setAttribute("fill-opacity", tema ? "1" : "0.55");
        t1.setAttribute("x", cx);
        t1.setAttribute("y", y1);
        t1.style.display = "";
        if (texto) {
          var l2 = recorte(texto, 22);
          var fs2 = tamano(l2.length, w, 11);
          t2.textContent = l2;
          t2.setAttribute("font-size", fs2);
          t2.setAttribute("x", cx);
          t2.setAttribute("y", y1 + fs2 * 1.6);
          t2.style.display = "";
        }
      } else if (texto) {
        var l3 = recorte(texto, 22);
        var fs3 = tamano(l3.length, w - 8, 11);
        var alto = fs3 * 1.9;
        pastilla.setAttribute("x", x + 4);
        pastilla.setAttribute("y", y + h - alto - 4);
        pastilla.setAttribute("width", w - 8);
        pastilla.setAttribute("height", alto);
        pastilla.style.display = "";
        t2.textContent = l3;
        t2.setAttribute("font-size", fs3);
        t2.setAttribute("x", cx);
        t2.setAttribute("y", y + h - alto - 4 + fs3 * 1.35);
        t2.style.display = "";
      }
    };
  }

  /*
   * ---------- Temáticas: patrones de fondo ----------
   * Cada temática puede tener un motivo incluido o una imagen de patrón
   * (LooArt.patronesTematica, editable desde el panel). El motivo toma un
   * color que contrasta con el color del producto.
   */
  var MOTIVOS = {
    puntos: { nombre: "Puntos", dibujar: function (g, T, c) {
      el("circle", { cx: T * 0.25, cy: T * 0.25, r: T * 0.11, fill: c }, g);
      el("circle", { cx: T * 0.75, cy: T * 0.75, r: T * 0.11, fill: c }, g);
    } },
    estrellas: { nombre: "Estrellas", dibujar: function (g, T, c) {
      function estrella(cx, cy, r) {
        var d = "";
        for (var i = 0; i < 10; i++) {
          var a = Math.PI / 5 * i - Math.PI / 2;
          var rr = i % 2 ? r * 0.45 : r;
          d += (i ? "L" : "M") + (cx + rr * Math.cos(a)).toFixed(2) + " " + (cy + rr * Math.sin(a)).toFixed(2);
        }
        el("path", { d: d + "Z", fill: c }, g);
      }
      estrella(T * 0.28, T * 0.3, T * 0.17);
      estrella(T * 0.76, T * 0.74, T * 0.11);
      el("circle", { cx: T * 0.8, cy: T * 0.2, r: T * 0.035, fill: c }, g);
    } },
    flores: { nombre: "Flores", dibujar: function (g, T, c) {
      function flor(cx, cy, r) {
        for (var i = 0; i < 5; i++) {
          var a = Math.PI * 2 / 5 * i;
          el("circle", { cx: cx + r * Math.cos(a), cy: cy + r * Math.sin(a), r: r * 0.62, fill: c, "fill-opacity": 0.85 }, g);
        }
        el("circle", { cx: cx, cy: cy, r: r * 0.45, fill: "#FFFFFF", "fill-opacity": 0.85 }, g);
      }
      flor(T * 0.3, T * 0.3, T * 0.11);
      flor(T * 0.78, T * 0.76, T * 0.07);
    } },
    rayas: { nombre: "Rayas", dibujar: function (g, T, c) {
      el("path", { d: "M0 " + T * 0.35 + " L" + T * 0.35 + " 0 H" + T * 0.6 + " L0 " + T * 0.6 + "Z" +
        "M" + T * 0.4 + " " + T + " L" + T + " " + T * 0.4 + " V" + T * 0.65 + " L" + T * 0.65 + " " + T + "Z", fill: c }, g);
    } },
    cuadros: { nombre: "Cuadros", dibujar: function (g, T, c) {
      el("rect", { x: 0, y: 0, width: T / 2, height: T / 2, fill: c, "fill-opacity": 0.7 }, g);
      el("rect", { x: T / 2, y: T / 2, width: T / 2, height: T / 2, fill: c, "fill-opacity": 0.7 }, g);
    } },
    corazones: { nombre: "Corazones", dibujar: function (g, T, c) {
      function corazon(cx, cy, r) {
        el("path", { d: "M" + cx + " " + (cy + r * 0.9) +
          " C" + (cx - r * 1.4) + " " + (cy) + " " + (cx - r * 0.9) + " " + (cy - r * 1.1) + " " + cx + " " + (cy - r * 0.35) +
          " C" + (cx + r * 0.9) + " " + (cy - r * 1.1) + " " + (cx + r * 1.4) + " " + cy + " " + cx + " " + (cy + r * 0.9) + "Z", fill: c }, g);
      }
      corazon(T * 0.28, T * 0.3, T * 0.15);
      corazon(T * 0.76, T * 0.76, T * 0.1);
    } },
    ondas: { nombre: "Ondas", dibujar: function (g, T, c) {
      [0.3, 0.8].forEach(function (f) {
        var y = T * f;
        el("path", { d: "M0 " + y + " Q" + T * 0.25 + " " + (y - T * 0.14) + " " + T * 0.5 + " " + y +
          " T" + T + " " + y, fill: "none", stroke: c, "stroke-width": T * 0.06, "stroke-linecap": "round" }, g);
      });
    } }
  };

  /* Patrón válido de una temática, o null */
  function patronDe(tematica) {
    var lista = (window.LooArt && window.LooArt.patronesTematica) || {};
    var p = tematica && Object.prototype.hasOwnProperty.call(lista, tematica) ? lista[tematica] : null;
    if (!p) return null;
    if (p.imagen && urlImagenSegura(p.imagen)) return { imagen: urlImagenSegura(p.imagen) };
    if (p.motivo && MOTIVOS[p.motivo]) return { motivo: p.motivo };
    return null;
  }

  /* Color del motivo: contrasta con el color del producto */
  function colorMotivo(base) {
    var n = parseInt((hexValido(base) ? base : "#FFFFFF").slice(1), 16);
    var lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    if (lum > 0.85) return { color: "#B8381A", opacidad: 0.7 };
    if (lum > 0.5) return { color: oscurecer(base, 0.38), opacidad: 0.9 };
    return { color: "#FFFFFF", opacidad: 0.5 };
  }

  /* Llena un <pattern> con el motivo o la imagen de una temática */
  function llenarPatron(patron, def, T, base) {
    while (patron.firstChild) patron.removeChild(patron.firstChild);
    patron.setAttribute("width", T);
    patron.setAttribute("height", T);
    if (def.imagen) {
      el("image", { href: def.imagen, x: 0, y: 0, width: T, height: T, preserveAspectRatio: "xMidYMid meet" }, patron);
      return;
    }
    var tono = colorMotivo(base);
    var g = el("g", { opacity: tono.opacidad }, patron);
    MOTIVOS[def.motivo].dibujar(g, T, tono.color);
  }

  function capaTematica(svg, forma, caja, insertarTras) {
    var n = ++contador;
    var defs = el("defs", {}, svg);
    var recorteForma = el("clipPath", { id: "forma-tema-" + n }, defs);
    var silueta = forma.cloneNode(false);
    silueta.removeAttribute("style");
    recorteForma.appendChild(silueta);
    var patron = el("pattern", { id: "tema-" + n, patternUnits: "userSpaceOnUse" }, defs);
    var capa = el("rect", { x: caja[0], y: caja[1], width: caja[2], height: caja[3],
      fill: "url(#tema-" + n + ")", "clip-path": "url(#forma-tema-" + n + ")", "pointer-events": "none" });
    svg.insertBefore(capa, insertarTras ? insertarTras.nextSibling : null);
    var T = Math.min(caja[2], caja[3]) * 0.3;

    function girar(giro) {
      var x = caja[0] + (((giro % T) + T) % T);
      patron.setAttribute("patternTransform", "translate(" + x + " " + caja[1] + ")");
    }
    return {
      capa: capa,
      girar: girar,
      pintar: function (def, base, giro) {
        capa.style.display = def ? "" : "none";
        if (!def) return;
        llenarPatron(patron, def, T, base);
        girar(giro || 0);
      }
    };
  }

  /* Muestra cuadrada de una temática para las opciones (null si no tiene patrón) */
  function muestraTematica(tematica, baseHex) {
    var def = patronDe(tematica);
    if (!def) return null;
    var base = hexValido(baseHex) ? baseHex : "#F4F1EC";
    var m = el("svg", { viewBox: "0 0 64 64", "aria-hidden": "true", focusable: "false" });
    var id = "muestra-" + (++contador);
    var patron = el("pattern", { id: id, patternUnits: "userSpaceOnUse" }, el("defs", {}, m));
    llenarPatron(patron, def, 22, base);
    el("rect", { x: 0, y: 0, width: 64, height: 64, fill: base }, m);
    el("rect", { x: 0, y: 0, width: 64, height: 64, fill: "url(#" + id + ")" }, m);
    return m;
  }

  /*
   * ---------- Capa de diseño ----------
   * Dibuja la imagen del cliente repetida o envolvente, recortada a la forma
   * del producto. `forma` es el elemento cuya silueta se usa de recorte;
   * `caja` = [x, y, ancho, alto] que ocupa esa forma; `cilindro` agrega volumen.
   */
  function capaDiseno(svg, forma, caja, cilindro, insertarTras) {
    var n = ++contador;
    var defs = el("defs", {}, svg);

    var recorteForma = el("clipPath", { id: "forma-" + n }, defs);
    var silueta = forma.cloneNode(false);
    silueta.removeAttribute("style");
    recorteForma.appendChild(silueta);

    var patron = el("pattern", { id: "patron-" + n, patternUnits: "userSpaceOnUse" }, defs);
    var piezas = [0, 1, 2].map(function () { return el("image", {}, patron); });

    var capa = el("rect", { x: caja[0], y: caja[1], width: caja[2], height: caja[3],
      fill: "url(#patron-" + n + ")", "clip-path": "url(#forma-" + n + ")" });
    var siguiente = insertarTras ? insertarTras.nextSibling : null;
    svg.insertBefore(capa, siguiente);

    var volumen = null;
    if (cilindro) {
      /* Sombra a los lados y un brillo: da la sensación de cuerpo redondo */
      var grad = el("linearGradient", { id: "volumen-" + n, x1: 0, x2: 1, y1: 0, y2: 0 }, defs);
      [[0, "#000", 0.32], [0.16, "#000", 0], [0.3, "#FFF", 0.22], [0.42, "#FFF", 0], [0.82, "#000", 0], [1, "#000", 0.36]]
        .forEach(function (s) { el("stop", { offset: s[0], "stop-color": s[1], "stop-opacity": s[2] }, grad); });
      volumen = el("rect", { x: caja[0], y: caja[1], width: caja[2], height: caja[3],
        fill: "url(#volumen-" + n + ")", "clip-path": "url(#forma-" + n + ")", "pointer-events": "none" });
      svg.insertBefore(volumen, capa.nextSibling);
    }

    var anchoPatron = 1;

    function pintar(arteUrl, d, giro, conVolumen) {
      var activo = !!arteUrl && d.modo !== "centro";
      capa.style.display = activo ? "" : "none";
      if (volumen) volumen.style.display = activo || conVolumen ? "" : "none";
      if (!activo) return;

      piezas.forEach(function (img) { img.setAttribute("href", arteUrl); img.style.display = "none"; });

      if (d.modo === "envolvente") {
        anchoPatron = caja[2];
        patron.setAttribute("width", caja[2]);
        patron.setAttribute("height", caja[3]);
        var img = piezas[0];
        img.setAttribute("x", 0);
        img.setAttribute("y", 0);
        img.setAttribute("width", caja[2]);
        img.setAttribute("height", caja[3]);
        img.setAttribute("preserveAspectRatio", "xMidYMid slice");
        img.style.display = "";
      } else {
        /* Repetida: celda cuadrada; la imagen ocupa la celda menos la separación */
        var lado = Math.min(caja[2], caja[3]);
        var celda = lado * (0.2 + d.tamano * 0.45);
        var tam = celda * (1 - d.separacion);
        var margen = (celda - tam) / 2;
        anchoPatron = celda;
        patron.setAttribute("width", celda);
        patron.setAttribute("height", d.intercalado ? celda * 2 : celda);
        var posiciones = d.intercalado
          ? [[margen, margen], [margen + celda / 2, celda + margen], [margen - celda / 2, celda + margen]]
          : [[margen, margen]];
        posiciones.forEach(function (pos, i) {
          var im = piezas[i];
          im.setAttribute("x", pos[0]);
          im.setAttribute("y", pos[1]);
          im.setAttribute("width", tam);
          im.setAttribute("height", tam);
          im.setAttribute("preserveAspectRatio", "xMidYMid meet");
          im.style.display = "";
        });
      }
      girar(giro || 0);
    }

    function girar(giro) {
      var x = caja[0] + (((giro % anchoPatron) + anchoPatron) % anchoPatron);
      patron.setAttribute("patternTransform", "translate(" + x + " " + caja[1] + ")");
    }

    return { pintar: pintar, girar: girar };
  }

  /* ---------- Maquetas ----------
   * Cada una dibuja el producto y devuelve:
   *   tinte  = [[elemento, "fill"|"stroke"], ...] piezas que toman el color elegido
   *   oscuro = piezas que toman el color un poco más oscuro (tapas, bordes)
   *   zona   = [x, y, ancho, alto, radio] de impresión
   */
  var MODELOS = {
    termo: function (svg) {
      el("ellipse", { cx: 160, cy: 300, rx: 60, ry: 7, fill: "#000", "fill-opacity": "0.12" }, svg);
      var cuerpo = el("path", { d: "M112 86 H208 L202 282 Q202 294 190 294 H130 Q118 294 118 282 Z", stroke: "#000", "stroke-opacity": "0.15", "stroke-width": 1.5 }, svg);
      el("rect", { x: 122, y: 96, width: 9, height: 180, rx: 4.5, fill: "#FFF", "fill-opacity": "0.22" }, svg);
      var tapa = el("rect", { x: 106, y: 52, width: 108, height: 36, rx: 10 }, svg);
      var boquilla = el("rect", { x: 138, y: 36, width: 44, height: 20, rx: 7 }, svg);
      return { tinte: [[cuerpo, "fill"]], oscuro: [[tapa, "fill"], [boquilla, "fill"]], zona: [128, 128, 64, 110, 8],
        superficie: cuerpo, caja: [112, 86, 96, 208], cilindro: true };
    },

    taza: function (svg) {
      el("ellipse", { cx: 155, cy: 246, rx: 80, ry: 7, fill: "#000", "fill-opacity": "0.12" }, svg);
      var asa = el("path", { d: "M214 128 C262 128 262 206 214 206", fill: "none", "stroke-width": 16, "stroke-linecap": "round" }, svg);
      var cuerpo = el("rect", { x: 88, y: 96, width: 130, height: 146, rx: 16, stroke: "#000", "stroke-opacity": "0.15", "stroke-width": 1.5 }, svg);
      el("rect", { x: 98, y: 108, width: 9, height: 122, rx: 4.5, fill: "#FFF", "fill-opacity": "0.22" }, svg);
      var borde = el("rect", { x: 88, y: 96, width: 130, height: 12, rx: 6 }, svg);
      return { tinte: [[cuerpo, "fill"], [asa, "stroke"]], oscuro: [[borde, "fill"]], zona: [106, 126, 94, 92, 8],
        superficie: cuerpo, caja: [88, 96, 130, 146], cilindro: true };
    },

    caja: function (svg) {
      el("ellipse", { cx: 160, cy: 264, rx: 98, ry: 7, fill: "#000", "fill-opacity": "0.12" }, svg);
      var cuerpo = el("rect", { x: 64, y: 86, width: 192, height: 174, rx: 18, stroke: "#000", "stroke-opacity": "0.15", "stroke-width": 1.5 }, svg);
      var solapa = el("rect", { x: 64, y: 86, width: 192, height: 26, rx: 12 }, svg);
      return { tinte: [[cuerpo, "fill"]], oscuro: [[solapa, "fill"]], zona: [88, 130, 144, 104, 8],
        superficie: cuerpo, caja: [64, 86, 192, 174], cilindro: false };
    },

    /* Pin (botón): frente redondo con brillo; ver MODELOS.pin.reverso */
    pin: function (svg) {
      var n = ++contador;
      var defs = el("defs", {}, svg);
      var brillo = el("radialGradient", { id: "pin-brillo-" + n, cx: 0.36, cy: 0.3, r: 0.78 }, defs);
      [[0, "#FFF", 0.42], [0.35, "#FFF", 0.06], [0.78, "#000", 0], [1, "#000", 0.22]]
        .forEach(function (s) { el("stop", { offset: s[0], "stop-color": s[1], "stop-opacity": s[2] }, brillo); });
      el("ellipse", { cx: 160, cy: 282, rx: 92, ry: 8, fill: "#000", "fill-opacity": "0.14" }, svg);
      var borde = el("circle", { cx: 160, cy: 160, r: 112 }, svg);
      var cara = el("circle", { cx: 160, cy: 160, r: 104, stroke: "#000", "stroke-opacity": "0.08", "stroke-width": 1 }, svg);
      /* El brillo va encima de todo lo impreso: se agrega al final con `encima` */
      var reflejo = el("circle", { cx: 160, cy: 160, r: 112, fill: "url(#pin-brillo-" + n + ")", "pointer-events": "none" });
      return { base: "#FFFFFF", tinte: [[cara, "fill"]], oscuro: [[borde, "fill"]], zona: [104, 104, 112, 112, 56],
        superficie: cara, caja: [56, 56, 208, 208], cilindro: false, encima: [reflejo] };
    },

    sticker: function (svg) {
      el("ellipse", { cx: 160, cy: 274, rx: 86, ry: 6, fill: "#000", "fill-opacity": "0.12" }, svg);
      el("rect", { x: 64, y: 64, width: 192, height: 192, rx: 40, fill: "#FFFFFF", stroke: "#B3A99C", "stroke-width": 1.5 }, svg);
      var fondo = el("rect", { x: 76, y: 76, width: 168, height: 168, rx: 30 }, svg);
      return { base: "#FFFFFF", tinte: [[fondo, "fill"]], oscuro: [], zona: [76, 76, 168, 168, 30],
        superficie: fondo, caja: [76, 76, 168, 168], cilindro: false };
    }
  };

  /*
   * ---------- Reversos (artículos planos que se pueden voltear) ----------
   * Cada uno dibuja la parte de atrás en el grupo `g`. `base` = color elegido.
   */
  MODELOS.pin.reverso = function (g) {
    var n = ++contador;
    var defs = el("defs", {}, g);
    function degradado(id, x2, y2, paradas) {
      var d = el("linearGradient", { id: id + n, x1: 0, y1: 0, x2: x2, y2: y2 }, defs);
      paradas.forEach(function (p) { el("stop", { offset: p[0], "stop-color": p[1] }, d); });
    }
    degradado("metal-", 1, 1, [[0, "#F7F7F8"], [0.45, "#B9BCC2"], [0.7, "#E4E5E8"], [1, "#8E9198"]]);
    degradado("fondo-", 0, 1, [[0, "#D9DBDF"], [0.5, "#A4A7AE"], [1, "#C8CACF"]]);
    degradado("orificio-", 0, 1, [[0, "#6E7178"], [1, "#C9CBD0"]]);
    degradado("aguja-", 0, 1, [[0, "#F4F5F6"], [0.5, "#9A9DA4"], [1, "#DADCE0"]]);
    el("ellipse", { cx: 160, cy: 282, rx: 92, ry: 8, fill: "#000", "fill-opacity": "0.14" }, g);
    el("circle", { cx: 160, cy: 160, r: 112, fill: "#FFFFFF", stroke: "#000", "stroke-opacity": "0.1" }, g);
    el("circle", { cx: 160, cy: 160, r: 101, fill: "url(#metal-" + n + ")" }, g);
    el("circle", { cx: 160, cy: 166, r: 84, fill: "url(#fondo-" + n + ")", stroke: "#FFF", "stroke-opacity": "0.6", "stroke-width": 2 }, g);
    /* Orificios y broche */
    [118, 202].forEach(function (cx) {
      el("circle", { cx: cx, cy: 150, r: 20, fill: "url(#orificio-" + n + ")" }, g);
    });
    el("rect", { x: 108, y: 140, width: 22, height: 20, rx: 4, fill: "url(#aguja-" + n + ")" }, g);
    el("rect", { x: 192, y: 141, width: 20, height: 18, rx: 6, fill: "url(#aguja-" + n + ")" }, g);
    el("line", { x1: 120, y1: 150, x2: 214, y2: 150, stroke: "url(#aguja-" + n + ")", "stroke-width": 4, "stroke-linecap": "round" }, g);
    el("path", { d: "M214 150 L222 149", stroke: "#8E9198", "stroke-width": 2, "stroke-linecap": "round" }, g);
    /* Reflejo */
    el("ellipse", { cx: 150, cy: 112, rx: 46, ry: 12, fill: "#FFF", "fill-opacity": "0.45" }, g);
  };

  MODELOS.sticker.reverso = function (g) {
    el("ellipse", { cx: 160, cy: 274, rx: 86, ry: 6, fill: "#000", "fill-opacity": "0.12" }, g);
    el("rect", { x: 64, y: 64, width: 192, height: 192, rx: 40, fill: "#F2EEE8", stroke: "#B3A99C", "stroke-width": 1.5 }, g);
    /* Línea de corte del papel protector */
    el("path", { d: "M64 168 L168 64", stroke: "#B3A99C", "stroke-width": 1.5, "stroke-dasharray": "6 5" }, g);
    el("path", { d: "M76 150 L150 76", stroke: "#FFF", "stroke-width": 6, "stroke-opacity": "0.7", "stroke-linecap": "round" }, g);
  };

  MODELOS.caja.reverso = function (g, base) {
    el("ellipse", { cx: 160, cy: 264, rx: 98, ry: 7, fill: "#000", "fill-opacity": "0.12" }, g);
    el("rect", { x: 64, y: 86, width: 192, height: 174, rx: 18, fill: base, stroke: "#000", "stroke-opacity": "0.15", "stroke-width": 1.5 }, g);
    el("rect", { x: 64, y: 86, width: 192, height: 26, rx: 12, fill: oscurecer(base, 0.28) }, g);
    el("rect", { x: 64, y: 230, width: 192, height: 30, rx: 12, fill: "#000", "fill-opacity": "0.06" }, g);
  };

  /*
   * ---------- Voltear (pin, sticker y otros artículos planos) ----------
   * Arrastrar de lado gira el artículo sobre su eje vertical; al soltar se
   * acomoda en el frente o en el reverso. Tocar o hacer clic lo voltea, y el
   * botón "Ver reverso" hace lo mismo con teclado o lector de pantalla.
   */
  function hacerVolteable(svg, contenedor, giroG, frente, reverso, alCambiar, alPintar) {
    var angulo = 0;
    var atras = false;
    var arrastre = null;
    var movido = 0;
    var animacion = null;
    var sinMovimiento = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var pista = document.createElement("p");
    pista.className = "vista-previa__pista";
    pista.textContent = "Arrastra o toca para voltear";
    pista.setAttribute("aria-hidden", "true");
    contenedor.appendChild(pista);

    var boton = document.createElement("button");
    boton.type = "button";
    boton.className = "vista-previa__voltear";
    boton.textContent = "Ver reverso";
    contenedor.appendChild(boton);

    function pintar() {
      var c = Math.cos(angulo * Math.PI / 180);
      var sx = Math.max(Math.abs(c), 0.002);
      giroG.setAttribute("transform", "translate(160 0) scale(" + sx.toFixed(4) + " 1) translate(-160 0)");
      var ahora = c < 0;
      frente.style.display = ahora ? "none" : "";
      reverso.style.display = ahora ? "" : "none";
      if (ahora !== atras) {
        atras = ahora;
        boton.textContent = atras ? "Ver frente" : "Ver reverso";
        alCambiar(atras);
      }
      if (alPintar) alPintar(angulo);
    }

    function animarA(destino, ms, alTerminar) {
      if (animacion) cancelAnimationFrame(animacion);
      if (sinMovimiento) { angulo = destino; pintar(); if (alTerminar) alTerminar(); return; }
      var desde = angulo, inicio = null;
      function paso(t) {
        if (inicio === null) inicio = t;
        var k = Math.min(1, (t - inicio) / ms);
        angulo = desde + (destino - desde) * (1 - Math.pow(1 - k, 3));
        pintar();
        if (k < 1) animacion = requestAnimationFrame(paso);
        else { animacion = null; if (alTerminar) alTerminar(); }
      }
      animacion = requestAnimationFrame(paso);
    }

    function acomodar() { animarA(Math.round(angulo / 180) * 180, 280); }
    function voltear(sentido) { animarA((Math.round(angulo / 180) + (sentido || 1)) * 180, 460); }

    function unidades(px) { return px * (320 / Math.max(svg.clientWidth, 1)); }

    svg.style.cursor = "grab";
    svg.style.touchAction = "pan-y";
    svg.style.userSelect = "none"; /* que arrastrar no seleccione el texto del diseño */
    svg.addEventListener("pointerdown", function (ev) {
      if (animacion) { cancelAnimationFrame(animacion); animacion = null; }
      arrastre = ev.clientX;
      movido = 0;
      svg.setPointerCapture(ev.pointerId);
      svg.style.cursor = "grabbing";
    });
    svg.addEventListener("pointermove", function (ev) {
      if (arrastre === null) return;
      var dx = unidades(ev.clientX - arrastre);
      arrastre = ev.clientX;
      movido += Math.abs(dx);
      angulo += dx * 0.9;
      pintar();
    });
    function soltar(ev) {
      if (arrastre === null) return;
      arrastre = null;
      svg.style.cursor = "grab";
      if (ev.type === "pointerup" && movido < 6) voltear(1); else acomodar();
    }
    svg.addEventListener("pointerup", soltar);
    svg.addEventListener("pointercancel", soltar);
    boton.addEventListener("click", function () { voltear(1); });

    /* Un vistazo corto al cargar, para mostrar que se puede voltear */
    if (!sinMovimiento) {
      setTimeout(function () {
        if (arrastre !== null || angulo !== 0) return;
        animarA(38, 420, function () { animarA(0, 520); });
      }, 500);
    }

    return { atras: function () { return atras; } };
  }

  /*
   * ---------- Giro (termos y tazas) ----------
   * Arrastrar con el mouse o el dedo, o usar las flechas del teclado,
   * desliza el diseño alrededor del cuerpo. Solo cambia la vista: no se guarda.
   */
  function hacerGirable(svg, contenedor, alGirar, conTeclado) {
    var giro = 0;
    var activo = false;
    var arrastre = null;

    var pista = document.createElement("p");
    pista.className = "vista-previa__pista";
    pista.textContent = "Arrastra para girar";
    pista.setAttribute("aria-hidden", "true");
    pista.hidden = true;
    contenedor.appendChild(pista);

    function unidades(px) { return px * (320 / Math.max(svg.clientWidth, 1)); }

    svg.addEventListener("pointerdown", function (ev) {
      if (!activo) return;
      arrastre = ev.clientX;
      svg.setPointerCapture(ev.pointerId);
      svg.style.cursor = "grabbing";
    });
    svg.addEventListener("pointermove", function (ev) {
      if (!activo || arrastre === null) return;
      giro += unidades(ev.clientX - arrastre);
      arrastre = ev.clientX;
      alGirar(giro);
    });
    function soltar() { arrastre = null; svg.style.cursor = activo ? "grab" : ""; }
    svg.addEventListener("pointerup", soltar);
    svg.addEventListener("pointercancel", soltar);
    svg.addEventListener("keydown", function (ev) {
      if (!activo || (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight")) return;
      ev.preventDefault();
      giro += ev.key === "ArrowRight" ? 10 : -10;
      alGirar(giro);
    });

    var mostrado = false;
    function presentar() {
      /* Un solo vaivén corto la primera vez, para mostrar que se puede girar;
         termina donde empezó para no dejar el diseño a medio girar */
      if (mostrado) return;
      mostrado = true;
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      var inicio = null, desde = giro;
      function paso(t) {
        if (inicio === null) inicio = t;
        var k = Math.min(1, (t - inicio) / 1100);
        giro = desde + 34 * Math.sin(Math.PI * k) * (1 - k * 0.15);
        if (k === 1) giro = desde;
        alGirar(giro);
        if (k < 1 && activo) requestAnimationFrame(paso);
      }
      requestAnimationFrame(paso);
    }

    return {
      giro: function () { return giro; },
      activar: function (si) {
        activo = si;
        pista.hidden = !si;
        svg.style.cursor = si ? "grab" : "";
        svg.style.touchAction = si ? "pan-y" : "";
        svg.style.userSelect = si ? "none" : "";
        if (si) presentar();
        if (si && conTeclado) {
          svg.setAttribute("tabindex", "0");
          svg.setAttribute("aria-roledescription", "vista previa que se puede girar");
        } else {
          svg.removeAttribute("tabindex");
          svg.removeAttribute("aria-roledescription");
        }
      }
    };
  }

  /*
   * ---------- Foto recortada (frente y reverso) ----------
   * Para productos cuya foto se procesó en el panel (js/recorte.js):
   *  - el diseño se imprime solo en la cara imprimible (máscara);
   *  - encima se aplican las sombras y los brillos de la propia foto,
   *    así el diseño se ve "puesto" sobre el objeto;
   *  - al voltear, unas copias de la silueta en el color del canto dan grosor.
   */
  function conRecorte(producto, contenedor, opciones) {
    contenedor.textContent = "";
    var svg = el("svg", { viewBox: "0 0 320 320", class: "vista-previa" });
    if (opciones.miniatura) svg.setAttribute("aria-hidden", "true");
    else svg.setAttribute("role", "img");
    svg.style.cssText = "width:100%;height:100%;display:block";

    var n = ++contador;
    var frenteUrl = urlImagenSegura(producto.imagen);
    var reversoUrl = urlImagenSegura(producto.imagenReverso);
    var zonaUrl = urlImagenSegura(producto.imagenZona);

    function encajar(t) {
      t = t && t.w > 0 && t.h > 0 ? t : { w: 1, h: 1 };
      var e = Math.min(236 / t.w, 236 / t.h), w = t.w * e, h = t.h * e;
      return [160 - w / 2, 150 - h / 2, w, h];
    }
    function imagen(url, r, padre, extra) {
      var a = { href: url, x: r[0], y: r[1], width: r[2], height: r[3], preserveAspectRatio: "none" };
      Object.keys(extra || {}).forEach(function (k) { a[k] = extra[k]; });
      return el("image", a, padre);
    }
    var R = encajar(producto.imagenTam);
    var RR = encajar(producto.imagenReversoTam || producto.imagenTam);
    var defs = el("defs", {}, svg);

    /* Sombra en el piso */
    el("ellipse", { cx: 160, cy: Math.min(306, R[1] + R[3] + 7), rx: R[2] * 0.38, ry: 7, fill: "#000", "fill-opacity": "0.16" }, svg);

    /* Grosor: copias de la silueta en el color del canto, detrás de la cara */
    var filtroCanto = el("filter", { id: "canto-" + n, x: "-5%", y: "-5%", width: "110%", height: "110%" }, defs);
    el("feFlood", { "flood-color": hexValido(producto.imagenBorde) ? producto.imagenBorde : "#9A9A9A" }, filtroCanto);
    el("feComposite", { in2: "SourceAlpha", operator: "in" }, filtroCanto);
    var espesorG = el("g", {}, svg);
    espesorG.style.display = "none";
    var COPIAS = 8, copias = [];
    for (var c = 0; c < COPIAS; c++) copias.push(imagen(frenteUrl, R, espesorG, { filter: "url(#canto-" + n + ")" }));

    var giroG = el("g", {}, svg);
    var frente = el("g", {}, giroG);
    imagen(frenteUrl, R, frente);

    /* Lo que se imprime, recortado a la cara */
    var mascara = el("mask", { id: "cara-" + n, maskUnits: "userSpaceOnUse", x: 0, y: 0, width: 320, height: 320 }, defs);
    mascara.setAttribute("mask-type", "alpha");
    mascara.style.maskType = "alpha";
    imagen(zonaUrl || frenteUrl, R, mascara);
    var impreso = el("g", { mask: "url(#cara-" + n + ")" }, frente);
    var zc = Array.isArray(producto.imagenZonaCaja) ? producto.imagenZonaCaja : [0.1, 0.1, 0.8, 0.8];
    var Z = [R[0] + zc[0] * R[2], R[1] + zc[1] * R[3], zc[2] * R[2], zc[3] * R[3]];
    var fondoCara = el("rect", { x: Z[0] - 2, y: Z[1] - 2, width: Z[2] + 4, height: Z[3] + 4 }, impreso);
    var tema = capaTematica(impreso, fondoCara, Z, fondoCara);
    var diseno = capaDiseno(impreso, fondoCara, Z, false, tema.capa);
    var lado = Math.min(Z[2], Z[3]) * 0.62;
    var pintarZona = zona(impreso, Z[0] + Z[2] / 2 - lado / 2, Z[1] + Z[3] / 2 - lado / 2, lado, lado, lado * 0.14, !!opciones.miniatura);

    /* Sombras de la foto: se aclara la cara a blanco y se multiplica */
    var cara = Math.max(60, Math.min(250, Number(producto.imagenCara) || 230));
    var filtroLuz = el("filter", { id: "luz-" + n, "color-interpolation-filters": "sRGB" }, defs);
    var tLuz = el("feComponentTransfer", {}, filtroLuz);
    ["R", "G", "B"].forEach(function (k) { el("feFunc" + k, { type: "linear", slope: (255 / cara).toFixed(3) }, tLuz); });
    var sombreado = imagen(frenteUrl, R, frente, { mask: "url(#cara-" + n + ")", filter: "url(#luz-" + n + ")" });
    sombreado.style.mixBlendMode = "multiply";
    /* Brillos de la foto: solo lo más claro, en modo pantalla */
    var umbral = Math.min(0.95, cara / 255 * 1.03);
    var filtroBrillo = el("filter", { id: "brillo-" + n, "color-interpolation-filters": "sRGB" }, defs);
    var tBrillo = el("feComponentTransfer", {}, filtroBrillo);
    ["R", "G", "B"].forEach(function (k) {
      el("feFunc" + k, { type: "linear", slope: (1 / (1 - umbral)).toFixed(3), intercept: (-umbral / (1 - umbral)).toFixed(3) }, tBrillo);
    });
    var brillo = imagen(frenteUrl, R, frente, { mask: "url(#cara-" + n + ")", filter: "url(#brillo-" + n + ")", opacity: 0.85 });
    brillo.style.mixBlendMode = "screen";

    var reverso = null;
    if (reversoUrl) {
      reverso = el("g", {}, giroG);
      reverso.style.display = "none";
      imagen(reversoUrl, RR, reverso);
    }
    contenedor.appendChild(svg);

    function grosor(angulo) {
      var rad = angulo * Math.PI / 180, s = Math.sin(rad), sx = Math.max(Math.abs(Math.cos(rad)), 0.002);
      if (Math.abs(s) < 0.03) { espesorG.style.display = "none"; return; }
      espesorG.style.display = "";
      var atras = Math.cos(rad) < 0, r = atras ? RR : R, url = atras ? reversoUrl : frenteUrl;
      var T = R[2] * 0.07;
      copias.forEach(function (copia, k) {
        copia.setAttribute("href", url);
        copia.setAttribute("x", r[0]); copia.setAttribute("y", r[1]);
        copia.setAttribute("width", r[2]); copia.setAttribute("height", r[3]);
        var dx = -T * s * (k + 1) / COPIAS;
        copia.setAttribute("transform", "translate(" + dx.toFixed(2) + " 0) translate(160 0) scale(" + sx.toFixed(4) + " 1) translate(-160 0)");
      });
    }

    var volteo = null, ultimoEstado = {};
    if (reverso && !opciones.miniatura && opciones.interactivo !== false) {
      contenedor.style.position = contenedor.style.position || "relative";
      volteo = hacerVolteable(svg, contenedor, giroG, frente, reverso, function () { actualizar(ultimoEstado); }, grosor);
    }

    function actualizar(e) {
      e = e || {};
      ultimoEstado = e;
      var d = normalizarDiseno(e.diseno);
      var arteUrl = urlImagenSegura(e.arte);
      var conColor = hexValido(e.colorHex);
      var def = patronDe(e.tematica);
      var hay = conColor || !!def || !!arteUrl || !!e.texto || !!e.tematica;
      [impreso, sombreado, brillo].forEach(function (x) { x.style.display = hay ? "" : "none"; });
      var base = conColor ? e.colorHex : "#FFFFFF";
      fondoCara.setAttribute("fill", base);
      tema.pintar(def, base, 0);
      diseno.pintar(arteUrl, d, 0, false);
      pintarZona(Object.assign({}, e, { conPatron: !!def }));

      var etiqueta = descripcion(producto.nombre, e);
      if (volteo) {
        if (volteo.atras()) etiqueta = "Reverso de " + producto.nombre;
        etiqueta += ". Arrastra o toca para voltearlo, o usa el botón " + (volteo.atras() ? "Ver frente" : "Ver reverso");
      }
      svg.setAttribute("aria-label", etiqueta);
    }
    actualizar(opciones.estado);
    return { actualizar: actualizar };
  }

  /* ---------- Con foto real ---------- */
  function conFoto(producto, contenedor, opciones) {
    contenedor.textContent = "";
    contenedor.style.position = "relative";

    var foto = document.createElement("img");
    foto.src = urlImagenSegura(producto.imagen);
    foto.alt = producto.nombre;
    foto.style.cssText = "width:100%;height:100%;object-fit:cover;display:block";
    contenedor.appendChild(foto);

    /* Diseño repetido o envolvente sobre la zona central de la foto */
    var capaSvg = el("svg", { viewBox: "0 0 320 320", preserveAspectRatio: "xMidYMid slice", "aria-hidden": "true" });
    capaSvg.style.cssText = "position:absolute;inset:0;width:100%;height:100%;mix-blend-mode:multiply;opacity:0.92;pointer-events:none";
    var zonaFoto = el("rect", { x: 92, y: 70, width: 136, height: 180, rx: 14, fill: "#000" });
    var temaFoto = capaTematica(capaSvg, zonaFoto, [92, 70, 136, 180], null);
    var diseno = capaDiseno(capaSvg, zonaFoto, [92, 70, 136, 180], false, temaFoto.capa);
    contenedor.appendChild(capaSvg);

    var color = document.createElement("span");
    var arte = document.createElement("span");
    var miniaturaArte = document.createElement("img");
    miniaturaArte.alt = "";
    var etiqueta = document.createElement("small");
    etiqueta.textContent = "Tu imagen";
    arte.appendChild(miniaturaArte);
    arte.appendChild(etiqueta);
    color.className = "vista-previa__color";
    arte.className = "vista-previa__arte";
    color.hidden = true;
    arte.hidden = true;
    if (!opciones.miniatura) {
      contenedor.appendChild(color);
      contenedor.appendChild(arte);
    }

    function actualizar(e) {
      e = e || {};
      var d = normalizarDiseno(e.diseno);
      foto.alt = opciones.miniatura ? producto.nombre : descripcion(producto.nombre, e);
      color.hidden = !hexValido(e.colorHex);
      if (hexValido(e.colorHex)) {
        color.style.background = e.colorHex;
        color.title = "Color: " + (e.colorNombre || "");
      }
      var arteUrl = urlImagenSegura(e.arte);
      temaFoto.pintar(patronDe(e.tematica), hexValido(e.colorHex) ? e.colorHex : "#FFFFFF", 0);
      diseno.pintar(arteUrl, d, 0);
      /* Con el diseño ya aplicado sobre la foto, la miniatura de la esquina sobra */
      arte.hidden = !arteUrl || d.modo !== "centro";
      if (arteUrl) miniaturaArte.src = arteUrl;
    }
    actualizar(opciones.estado);
    return { actualizar: actualizar };
  }

  /* ---------- Maqueta dibujada ---------- */
  function crear(producto, contenedor, opciones) {
    opciones = opciones || {};
    if (urlImagenSegura(producto.imagen)) {
      return producto.imagenRecortada ? conRecorte(producto, contenedor, opciones) : conFoto(producto, contenedor, opciones);
    }

    contenedor.textContent = "";
    var svg = el("svg", { viewBox: "0 0 320 320", class: "vista-previa" });
    if (opciones.miniatura) svg.setAttribute("aria-hidden", "true");
    else svg.setAttribute("role", "img");
    svg.style.cssText = "width:100%;height:100%;display:block";

    var fabrica = MODELOS[producto.modelo] || MODELOS.caja;

    /* Artículos planos con reverso: frente y reverso dentro de un grupo que gira */
    var puedeVoltear = !opciones.miniatura && opciones.interactivo !== false && typeof fabrica.reverso === "function";
    var lienzo = svg, giroG = null, reverso = null;
    if (puedeVoltear) {
      giroG = el("g", {}, svg);
      lienzo = el("g", {}, giroG);
      reverso = el("g", {}, giroG);
      reverso.style.display = "none";
    }

    var modelo = fabrica(lienzo);
    var z = modelo.zona;
    /* Orden de capas: cuerpo → patrón de temática → imagen del cliente → volumen → brillo */
    var tema = capaTematica(lienzo, modelo.superficie, modelo.caja, modelo.superficie);
    var diseno = capaDiseno(lienzo, modelo.superficie, modelo.caja, modelo.cilindro, tema.capa);
    var pintarZona = zona(lienzo, z[0], z[1], z[2], z[3], z[4], !!opciones.miniatura);
    (modelo.encima || []).forEach(function (capa) { lienzo.appendChild(capa); });
    contenedor.appendChild(svg);

    var volteo = null, colorReverso = null, ultimoEstado = {};
    if (puedeVoltear) {
      contenedor.style.position = contenedor.style.position || "relative";
      volteo = hacerVolteable(svg, contenedor, giroG, lienzo, reverso, function () { actualizar(ultimoEstado); });
    }

    /* Se puede girar en la página del producto (no en miniaturas ni si se pide fijo) */
    var interactivo = !opciones.miniatura && opciones.interactivo !== false && modelo.cilindro;
    var giratorio = null;
    if (interactivo) {
      contenedor.style.position = contenedor.style.position || "relative";
      giratorio = hacerGirable(svg, contenedor, function (g) { diseno.girar(g); tema.girar(g); }, opciones.teclado !== false);
    }

    function actualizar(e) {
      e = e || {};
      ultimoEstado = e;
      var d = normalizarDiseno(e.diseno);
      var arteUrl = urlImagenSegura(e.arte);
      var base = hexValido(e.colorHex) ? e.colorHex : (modelo.base || NEUTRO);
      /* El reverso se vuelve a dibujar solo si cambió el color */
      if (reverso && colorReverso !== base) {
        while (reverso.firstChild) reverso.removeChild(reverso.firstChild);
        fabrica.reverso(reverso, base);
        colorReverso = base;
      }
      modelo.tinte.forEach(function (t) { t[0].style[t[1]] = base; });
      modelo.oscuro.forEach(function (t) { t[0].style[t[1]] = oscurecer(base, 0.28); });
      var etiqueta = descripcion(producto.nombre, e);
      var def = patronDe(e.tematica);
      var giro = giratorio ? giratorio.giro() : 0;
      tema.pintar(def, base, giro);
      diseno.pintar(arteUrl, d, giro, !!def);
      pintarZona(Object.assign({}, e, { conPatron: !!def }));
      if (giratorio) {
        var gira = (!!arteUrl && d.modo !== "centro") || !!def;
        giratorio.activar(gira);
        if (gira) etiqueta += ". Arrastra o usa las flechas izquierda y derecha para girarlo";
      }
      if (volteo) {
        etiqueta = volteo.atras()
          ? "Reverso de " + producto.nombre + (producto.modelo === "pin" ? ", con broche metálico" : "")
          : etiqueta;
        etiqueta += ". Arrastra o toca para voltearlo, o usa el botón " + (volteo.atras() ? "Ver frente" : "Ver reverso");
      }
      svg.setAttribute("aria-label", etiqueta);
    }

    actualizar(opciones.estado);
    return { actualizar: actualizar };
  }

  return {
    crear: crear,
    hexValido: hexValido,
    urlImagenSegura: urlImagenSegura,
    normalizarDiseno: normalizarDiseno,
    describirDiseno: describirDiseno,
    muestraTematica: muestraTematica,
    patronDe: patronDe,
    MOTIVOS: Object.keys(MOTIVOS).map(function (k) { return { id: k, nombre: MOTIVOS[k].nombre }; })
  };
})();
