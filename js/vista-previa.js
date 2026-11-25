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
 * `estado`: { colorHex, colorNombre, arte (data URL), tematica, texto }
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

  function descripcion(nombre, e) {
    var d = "Vista previa de " + nombre;
    if (e.colorNombre) d += ", color " + e.colorNombre;
    if (e.arte) d += ", con tu imagen";
    else if (e.tematica) d += ", temática " + e.tematica;
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
      var conArte = !!e.arte;
      if (conArte) arte.setAttribute("href", e.arte);
      arte.style.display = conArte ? "" : "none";
      fondo.setAttribute("stroke-opacity", conArte ? "0" : "1");

      pastilla.style.display = "none";
      t1.style.display = "none";
      t2.style.display = "none";
      if (miniatura) return;

      var tema = e.tematica || "";
      var texto = e.texto || "";

      if (!conArte) {
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
      return { tinte: [[cuerpo, "fill"]], oscuro: [[tapa, "fill"], [boquilla, "fill"]], zona: [128, 128, 64, 110, 8] };
    },

    taza: function (svg) {
      el("ellipse", { cx: 155, cy: 246, rx: 80, ry: 7, fill: "#000", "fill-opacity": "0.12" }, svg);
      var asa = el("path", { d: "M214 128 C262 128 262 206 214 206", fill: "none", "stroke-width": 16, "stroke-linecap": "round" }, svg);
      var cuerpo = el("rect", { x: 88, y: 96, width: 130, height: 146, rx: 16, stroke: "#000", "stroke-opacity": "0.15", "stroke-width": 1.5 }, svg);
      el("rect", { x: 98, y: 108, width: 9, height: 122, rx: 4.5, fill: "#FFF", "fill-opacity": "0.22" }, svg);
      var borde = el("rect", { x: 88, y: 96, width: 130, height: 12, rx: 6 }, svg);
      return { tinte: [[cuerpo, "fill"], [asa, "stroke"]], oscuro: [[borde, "fill"]], zona: [106, 126, 94, 92, 8] };
    },

    caja: function (svg) {
      el("ellipse", { cx: 160, cy: 264, rx: 98, ry: 7, fill: "#000", "fill-opacity": "0.12" }, svg);
      var cuerpo = el("rect", { x: 64, y: 86, width: 192, height: 174, rx: 18, stroke: "#000", "stroke-opacity": "0.15", "stroke-width": 1.5 }, svg);
      var solapa = el("rect", { x: 64, y: 86, width: 192, height: 26, rx: 12 }, svg);
      return { tinte: [[cuerpo, "fill"]], oscuro: [[solapa, "fill"]], zona: [88, 130, 144, 104, 8] };
    },

    sticker: function (svg) {
      el("ellipse", { cx: 160, cy: 274, rx: 86, ry: 6, fill: "#000", "fill-opacity": "0.12" }, svg);
      el("rect", { x: 64, y: 64, width: 192, height: 192, rx: 40, fill: "#FFFFFF", stroke: "#B3A99C", "stroke-width": 1.5 }, svg);
      var fondo = el("rect", { x: 76, y: 76, width: 168, height: 168, rx: 30 }, svg);
      return { base: "#FFFFFF", tinte: [[fondo, "fill"]], oscuro: [], zona: [76, 76, 168, 168, 30] };
    }
  };

  /* ---------- Con foto real ---------- */
  function conFoto(producto, contenedor, opciones) {
    contenedor.textContent = "";
    contenedor.style.position = "relative";

    var foto = document.createElement("img");
    foto.src = producto.imagen;
    foto.alt = producto.nombre;
    foto.style.cssText = "width:100%;height:100%;object-fit:cover;display:block";
    contenedor.appendChild(foto);

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
      foto.alt = opciones.miniatura ? producto.nombre : descripcion(producto.nombre, e);
      color.hidden = !hexValido(e.colorHex);
      if (hexValido(e.colorHex)) {
        color.style.background = e.colorHex;
        color.title = "Color: " + (e.colorNombre || "");
      }
      arte.hidden = !e.arte;
      if (e.arte) miniaturaArte.src = e.arte;
    }
    actualizar(opciones.estado);
    return { actualizar: actualizar };
  }

  /* ---------- Maqueta dibujada ---------- */
  function crear(producto, contenedor, opciones) {
    opciones = opciones || {};
    if (producto.imagen) return conFoto(producto, contenedor, opciones);

    contenedor.textContent = "";
    var svg = el("svg", { viewBox: "0 0 320 320", class: "vista-previa" });
    if (opciones.miniatura) svg.setAttribute("aria-hidden", "true");
    else svg.setAttribute("role", "img");
    svg.style.cssText = "width:100%;height:100%;display:block";

    var modelo = (MODELOS[producto.modelo] || MODELOS.caja)(svg);
    var z = modelo.zona;
    var pintarZona = zona(svg, z[0], z[1], z[2], z[3], z[4], !!opciones.miniatura);
    contenedor.appendChild(svg);

    function actualizar(e) {
      e = e || {};
      var base = hexValido(e.colorHex) ? e.colorHex : (modelo.base || NEUTRO);
      modelo.tinte.forEach(function (t) { t[0].style[t[1]] = base; });
      modelo.oscuro.forEach(function (t) { t[0].style[t[1]] = oscurecer(base, 0.28); });
      svg.setAttribute("aria-label", descripcion(producto.nombre, e));
      pintarZona(e);
    }

    actualizar(opciones.estado);
    return { actualizar: actualizar };
  }

  return { crear: crear };
})();
