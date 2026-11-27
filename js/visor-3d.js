/*
 * Visor 3D (WebGL, sin librerías) para la vista previa del producto.
 *
 * Modelos: termo (cilindro con tapa), taza (cilindro abierto con asa),
 * caja (prisma) y sticker (lámina). El diseño del cliente —color, temática,
 * imagen y texto— se pinta en un lienzo que se usa como textura:
 * en termos y tazas envuelve el cuerpo; en caja y sticker va al frente.
 * Se gira 360° arrastrando con mouse o dedo, o con las flechas del teclado.
 *
 * Misma interfaz que LooArt.vistaPrevia: crear(producto, contenedor, opciones)
 * devuelve { actualizar(estado) }. Si el navegador no tiene WebGL devuelve null
 * y la vista previa usa la maqueta 2D de siempre.
 *
 * Está separado para poder cambiarlo por Three.js más adelante sin tocar el resto.
 */
window.LooArt = window.LooArt || {};

window.LooArt.visor3d = (function () {
  var TIPOS = { termo: true, taza: true, caja: true, sticker: true };
  var soporte = null;

  function VP() { return window.LooArt.vistaPrevia; }

  function disponible() {
    if (soporte !== null) return soporte;
    try {
      var c = document.createElement("canvas");
      soporte = !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
    } catch (e) { soporte = false; }
    return soporte;
  }
  function admite(producto) { return !!(producto && TIPOS[producto.modelo]) && disponible(); }

  /* ---------- Matrices (4x4, por columnas, como las espera WebGL) ---------- */
  function mult(a, b) {
    var r = new Float32Array(16);
    for (var c = 0; c < 4; c++) for (var f = 0; f < 4; f++) {
      r[c * 4 + f] = a[f] * b[c * 4] + a[4 + f] * b[c * 4 + 1] + a[8 + f] * b[c * 4 + 2] + a[12 + f] * b[c * 4 + 3];
    }
    return r;
  }
  function perspectiva(fov, asp, cerca, lejos) {
    var f = 1 / Math.tan(fov / 2), nf = 1 / (cerca - lejos);
    return new Float32Array([f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, (lejos + cerca) * nf, -1, 0, 0, 2 * lejos * cerca * nf, 0]);
  }
  function traslacion(x, y, z) { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]); }
  function rotY(a) { var c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); }
  function rotX(a) { var c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); }

  /* ---------- Geometría ---------- */
  function malla() { return { p: [], n: [], t: [], i: [] }; }
  function vertice(m, x, y, z, nx, ny, nz, u, v) {
    m.p.push(x, y, z); m.n.push(nx, ny, nz); m.t.push(u, v);
    return m.p.length / 3 - 1;
  }
  /* Costado de un cilindro. u = 0.5 queda al frente (hacia la cámara); la unión, atrás. */
  function cilindro(m, r, y0, y1, seg, adentro) {
    var base = m.p.length / 3;
    for (var j = 0; j <= seg; j++) {
      var u = j / seg, a = (u - 0.5) * Math.PI * 2, s = Math.sin(a), c = Math.cos(a), k = adentro ? -1 : 1;
      vertice(m, r * s, y0, r * c, s * k, 0, c * k, u, 1);
      vertice(m, r * s, y1, r * c, s * k, 0, c * k, u, 0);
    }
    for (var q = 0; q < seg; q++) {
      var a0 = base + q * 2, b0 = a0 + 1, a1 = a0 + 2, b1 = a0 + 3;
      if (adentro) m.i.push(a0, b0, a1, a1, b0, b1); else m.i.push(a0, a1, b0, b0, a1, b1);
    }
  }
  function disco(m, r, y, arriba, seg) {
    var ny = arriba ? 1 : -1, centro = vertice(m, 0, y, 0, 0, ny, 0, 0.5, 0.5), base = m.p.length / 3;
    for (var j = 0; j <= seg; j++) {
      var a = j / seg * Math.PI * 2;
      vertice(m, r * Math.sin(a), y, r * Math.cos(a), 0, ny, 0, 0.5, 0.5);
    }
    for (var q = 0; q < seg; q++) {
      if (arriba) m.i.push(centro, base + q, base + q + 1); else m.i.push(centro, base + q + 1, base + q);
    }
  }
  /* Anillo plano (borde de la taza, ceja de la tapa) */
  function anillo(m, r0, r1, y, seg) {
    var base = m.p.length / 3;
    for (var j = 0; j <= seg; j++) {
      var a = j / seg * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
      vertice(m, r0 * s, y, r0 * c, 0, 1, 0, 0.5, 0.5);
      vertice(m, r1 * s, y, r1 * c, 0, 1, 0, 0.5, 0.5);
    }
    for (var q = 0; q < seg; q++) { var a0 = base + q * 2; m.i.push(a0, a0 + 2, a0 + 1, a0 + 1, a0 + 2, a0 + 3); }
  }
  /* Toroide parcial en el plano XY: el asa de la taza */
  function asa(m, cx, cy, R, rt, a0, a1, segA, segT) {
    var base = m.p.length / 3;
    for (var j = 0; j <= segA; j++) {
      var a = a0 + (a1 - a0) * j / segA, ca = Math.cos(a), sa = Math.sin(a);
      for (var k = 0; k <= segT; k++) {
        var b = k / segT * Math.PI * 2, cb = Math.cos(b), sb = Math.sin(b);
        var nx = ca * cb, ny = sa * cb, nz = sb;
        vertice(m, cx + (R + rt * cb) * ca, cy + (R + rt * cb) * sa, rt * sb, nx, ny, nz, 0.5, 0.5);
      }
    }
    for (var q = 0; q < segA; q++) for (var w = 0; w < segT; w++) {
      var p0 = base + q * (segT + 1) + w, p1 = p0 + segT + 1;
      m.i.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1);
    }
  }
  /* Cara rectangular con normal (nx,ny,nz); `esquinas` en orden antihorario visto de frente */
  function cara(m, e, nx, ny, nz) {
    var base = m.p.length / 3, uv = [[0, 1], [1, 1], [1, 0], [0, 0]];
    e.forEach(function (p, k) { vertice(m, p[0], p[1], p[2], nx, ny, nz, uv[k][0], uv[k][1]); });
    m.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  function prisma(frente, resto, w, h, d, y0) {
    var x = w / 2, z = d / 2, a = y0, b = y0 + h;
    cara(frente, [[-x, a, z], [x, a, z], [x, b, z], [-x, b, z]], 0, 0, 1);
    cara(resto, [[x, a, -z], [-x, a, -z], [-x, b, -z], [x, b, -z]], 0, 0, -1);
    cara(resto, [[x, a, z], [x, a, -z], [x, b, -z], [x, b, z]], 1, 0, 0);
    cara(resto, [[-x, a, -z], [-x, a, z], [-x, b, z], [-x, b, -z]], -1, 0, 0);
    cara(resto, [[-x, b, z], [x, b, z], [x, b, -z], [-x, b, -z]], 0, 1, 0);
    cara(resto, [[-x, a, -z], [x, a, -z], [x, a, z], [-x, a, z]], 0, -1, 0);
  }

  /* ---------- Escenas ----------
   * Cada parte: { m: malla, color: "base" | "oscuro" | "claro" | "#hex", tex: "cuerpo" | "reverso" | null, brillo }
   * lienzo: tamaño de la textura del diseño (proporcional a la superficie real).
   */
  var ESCENAS = {
    termo: function () {
      var r = 0.48, cuerpo = malla(), tapa = malla(), base = malla(), cuello = malla();
      cilindro(cuerpo, r, -1.15, 1.05, 96);
      disco(base, r, -1.15, false, 64);
      cilindro(cuello, r * 0.86, 1.05, 1.15, 64); anillo(cuello, r * 0.86, r, 1.05, 64);
      cilindro(tapa, r * 0.9, 1.15, 1.6, 64); disco(tapa, r * 0.9, 1.6, true, 64);
      return {
        partes: [
          { m: cuerpo, color: "base", tex: "cuerpo", brillo: 0.55 },
          { m: base, color: "oscuro", brillo: 0.2 },
          { m: cuello, color: "#C9CCD1", brillo: 0.9 },
          { m: tapa, color: "oscuro", brillo: 0.35 }
        ],
        lienzo: [2048, Math.round(2048 * 2.2 / (2 * Math.PI * r))],
        envuelve: true, alto: 2.75, ancho: 1.2, centroY: 0.22, piso: -1.15, radioSombra: 0.75
      };
    },
    taza: function () {
      var r = 0.82, cuerpo = malla(), adentro = malla(), borde = malla(), fondo = malla(), oreja = malla();
      cilindro(cuerpo, r, -0.8, 0.8, 96);
      cilindro(adentro, r * 0.92, -0.62, 0.8, 96, true);
      disco(adentro, r * 0.92, -0.62, true, 64);
      anillo(borde, r * 0.92, r, 0.8, 96);
      disco(fondo, r, -0.8, false, 64);
      /* Asa del lado derecho (de frente la taza muestra el diseño) */
      asa(oreja, r - 0.02, 0, 0.42, 0.085, -Math.PI / 2, Math.PI / 2, 32, 16);
      return {
        partes: [
          { m: cuerpo, color: "base", tex: "cuerpo", brillo: 0.7 },
          { m: adentro, color: "claro", brillo: 0.4 },
          { m: borde, color: "claro", brillo: 0.6 },
          { m: fondo, color: "oscuro", brillo: 0.2 },
          { m: oreja, color: "base", brillo: 0.7 }
        ],
        /* Solo se imprime el frente útil: el asa queda a la derecha */
        lienzo: [2048, Math.round(2048 * 1.6 / (2 * Math.PI * r))],
        envuelve: true, alto: 1.7, ancho: 2.25, centroY: 0, piso: -0.8, radioSombra: 1.05
      };
    },
    caja: function () {
      var frente = malla(), resto = malla();
      prisma(frente, resto, 1.7, 1.4, 1.1, -0.7);
      return {
        partes: [
          { m: frente, color: "base", tex: "cuerpo", brillo: 0.3 },
          { m: resto, color: "base", brillo: 0.3 }
        ],
        lienzo: [1024, Math.round(1024 * 1.4 / 1.7)],
        envuelve: false, alto: 1.5, ancho: 2.05, centroY: 0, piso: -0.7, radioSombra: 1.25
      };
    },
    sticker: function () {
      var frente = malla(), atras = malla(), cantos = malla(), g = 0.025, l = 0.9;
      cara(frente, [[-l, -l, g], [l, -l, g], [l, l, g], [-l, l, g]], 0, 0, 1);
      cara(atras, [[l, -l, -g], [-l, -l, -g], [-l, l, -g], [l, l, -g]], 0, 0, -1);
      prisma(malla(), cantos, 2 * l * 0.995, 2 * l * 0.995, 2 * g, -l * 0.995);
      return {
        partes: [
          { m: frente, color: "base", tex: "cuerpo", brillo: 0.5, recorte: true },
          { m: atras, color: "#F1EEE8", tex: "reverso", brillo: 0.15, recorte: true },
          { m: cantos, color: "#E8E3DC", brillo: 0.1, oculto: true }
        ],
        lienzo: [1024, 1024],
        envuelve: false, alto: 1.8, ancho: 1.8, centroY: 0, piso: -0.95, radioSombra: 1.05, redondo: 0.2
      };
    }
  };

  /* ---------- Sombreadores ---------- */
  var VS = [
    "attribute vec3 aPos; attribute vec3 aNor; attribute vec2 aUV;",
    "uniform mat4 uMVP; uniform mat4 uModelo;",
    "varying vec3 vN; varying vec2 vUV;",
    "void main(){ vN = (uModelo * vec4(aNor, 0.0)).xyz; vUV = aUV; gl_Position = uMVP * vec4(aPos, 1.0); }"
  ].join("\n");
  var FS = [
    "precision mediump float;",
    "uniform vec3 uColor; uniform sampler2D uTex; uniform float uConTex; uniform float uSinLuz; uniform float uBrillo; uniform float uAlfa; uniform float uRecorte;",
    "varying vec3 vN; varying vec2 vUV;",
    "void main(){",
    "  vec4 t = texture2D(uTex, vUV);",
    "  vec3 base = mix(uColor, t.rgb, uConTex);",
    "  float a = mix(1.0, t.a, max(uConTex, uRecorte)) * uAlfa;",
    "  if (a < 0.03) discard;",
    "  if (uSinLuz > 0.5) { gl_FragColor = vec4(base, a); return; }",
    "  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;",
    "  vec3 L = normalize(vec3(-0.45, 0.6, 0.8)); vec3 V = vec3(0.0, 0.0, 1.0); vec3 H = normalize(L + V);",
    "  float dif = max(dot(n, L), 0.0);",
    "  float rel = pow(1.0 - max(dot(n, V), 0.0), 2.2);",
    "  float esp = pow(max(dot(n, H), 0.0), 60.0) * uBrillo;",
    "  vec3 c = base * (0.42 + 0.66 * dif) + vec3(esp * 0.9) - rel * 0.12;",
    "  gl_FragColor = vec4(c, a);",
    "}"
  ].join("\n");

  function compilar(gl, tipo, fuente) {
    var s = gl.createShader(tipo);
    gl.shaderSource(s, fuente); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function programa(gl) {
    var p = gl.createProgram();
    gl.attachShader(p, compilar(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compilar(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  function subir(gl, m) {
    function buf(tipo, datos) { var b = gl.createBuffer(); gl.bindBuffer(tipo, b); gl.bufferData(tipo, datos, gl.STATIC_DRAW); return b; }
    return {
      p: buf(gl.ARRAY_BUFFER, new Float32Array(m.p)),
      n: buf(gl.ARRAY_BUFFER, new Float32Array(m.n)),
      t: buf(gl.ARRAY_BUFFER, new Float32Array(m.t)),
      i: buf(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(m.i)),
      cuenta: m.i.length
    };
  }
  function textura(gl, fuente) {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fuente);
    return t;
  }
  function actualizarTextura(gl, t, fuente) {
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fuente);
  }

  /* ---------- Colores ---------- */
  function rgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  function mezclar(hex, f) {
    var c = rgb(hex);
    return f < 0 ? c.map(function (v) { return v * (1 + f); }) : c.map(function (v) { return v + (1 - v) * f; });
  }
  function luminancia(hex) { var c = rgb(hex); return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; }

  /* ---------- Textura del diseño ---------- */
  var cacheImg = {};
  function cargarImagen(src) {
    if (cacheImg[src]) return cacheImg[src];
    cacheImg[src] = new Promise(function (ok) {
      var img = new Image();
      img.onload = function () { ok(img); };
      img.onerror = function () { ok(null); };
      img.src = src;
    });
    return cacheImg[src];
  }

  /*
   * Pinta el diseño en el lienzo: color de fondo, patrón de la temática,
   * imagen del cliente (al centro, repetida o envolvente) y texto.
   * En termos y tazas el ángulo mueve el diseño alrededor del cuerpo.
   */
  function pintarDiseno(lienzo, e, base, envuelve, redondo) {
    var vp = VP();
    var W = lienzo.width, H = lienzo.height, ctx = lienzo.getContext("2d");
    var d = vp.normalizarDiseno(e.diseno);
    var arteUrl = vp.urlImagenSegura(e.arte);
    var def = vp.patronDe(e.tematica);
    /* Posición libre: en termos y tazas lo horizontal es el ángulo alrededor del cuerpo */
    var centroX = envuelve ? W * (0.5 + d.angulo / 360) : W * (0.5 + (d.modo === "centro" ? (d.posX - 0.5) * 0.6 : 0));
    var desY = (d.posY - 0.5) * H * 0.6;

    var esperas = [];
    if (def) esperas.push(cargarImagen("data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(vp._patronSvg(def, W, H, Math.min(W, H) * (envuelve ? 0.28 : 0.2), base))));
    else esperas.push(Promise.resolve(null));
    esperas.push(arteUrl ? cargarImagen(arteUrl) : Promise.resolve(null));

    return Promise.all(esperas).then(function (r) {
      var patron = r[0], arte = r[1];
      ctx.save();
      ctx.clearRect(0, 0, W, H);
      if (redondo) {
        var rr = Math.min(W, H) * redondo;
        ctx.beginPath();
        ctx.moveTo(rr, 0); ctx.arcTo(W, 0, W, H, rr); ctx.arcTo(W, H, 0, H, rr); ctx.arcTo(0, H, 0, 0, rr); ctx.arcTo(0, 0, W, 0, rr);
        ctx.closePath(); ctx.clip();
      }
      ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
      if (patron) ctx.drawImage(patron, 0, 0, W, H);

      /* Dibuja algo en x y, si envuelve, también una vuelta antes y después */
      function envolver(dibujar) {
        dibujar(0);
        if (envuelve) { dibujar(-W); dibujar(W); }
      }
      function medida(img, lado) {
        var p = img.width / img.height;
        return p >= 1 ? [lado, lado / p] : [lado * p, lado];
      }

      var ladoCentro = Math.min(H * 0.5, envuelve ? W * 0.2 : W * 0.55) * d.escala;
      if (arte && d.modo === "envolvente") {
        var esc = Math.max(W / arte.width, H / arte.height);
        var aw = arte.width * esc, ah = arte.height * esc;
        envolver(function (dx) { ctx.drawImage(arte, centroX - aw / 2 + dx, (H - ah) / 2, aw, ah); });
      } else if (arte && d.modo === "repetida") {
        var celda = Math.min(W, H) * (0.2 + d.tamano * 0.45) * (envuelve ? 0.9 : 1);
        var tam = celda * (1 - d.separacion), m = medida(arte, tam);
        var desfase = ((centroX - W / 2) % celda + celda) % celda;
        for (var fila = -1; fila * celda < H + celda; fila++) {
          var corrida = d.intercalado && (fila & 1) ? celda / 2 : 0;
          for (var col = -2; col * celda < W + celda * 2; col++) {
            var x = col * celda + corrida + desfase + (celda - m[0]) / 2, y = fila * celda + (celda - m[1]) / 2;
            ctx.drawImage(arte, x, y, m[0], m[1]);
          }
        }
      } else if (arte) {
        var mc = medida(arte, ladoCentro);
        var yArte = H / 2 + desY - mc[1] / 2 - (e.texto ? H * 0.05 : 0);
        envolver(function (dx) { ctx.drawImage(arte, centroX - mc[0] / 2 + dx, yArte, mc[0], mc[1]); });
      }

      if (e.texto) {
        var oscuroFondo = luminancia(base) < 0.55 && !patron;
        var fs = Math.round(Math.min(H * 0.11, (envuelve ? W * 0.05 : W * 0.1)) * (arte && d.modo === "centro" ? 0.75 : 1) * d.escala);
        ctx.font = "600 " + fs + "px Inter, system-ui, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        var yTexto = arte && d.modo === "centro" ? H / 2 + desY + medida(arte, ladoCentro)[1] / 2 + fs * 0.4
          : H / 2 + (arte ? 0 : desY);
        var ancho = ctx.measureText(e.texto).width;
        envolver(function (dx) {
          /* Sobre patrón o imagen, el texto lleva una pastilla para que se lea */
          if (patron || (arte && d.modo !== "centro")) {
            ctx.fillStyle = "rgba(255,255,255,0.88)";
            var pw = ancho + fs * 1.1, ph = fs * 1.5;
            ctx.fillRect(centroX - pw / 2 + dx, yTexto - ph / 2, pw, ph);
            ctx.fillStyle = "#1E1B2B";
          } else {
            ctx.fillStyle = oscuroFondo ? "#FFFFFF" : "#1E1B2B";
          }
          ctx.fillText(e.texto, centroX + dx, yTexto + fs * 0.04);
        });
      }
      ctx.restore();
      return lienzo;
    });
  }

  /* ---------- Visor ---------- */
  function crear(producto, contenedor, opciones) {
    opciones = opciones || {};
    if (!admite(producto)) return null;
    var canvas = document.createElement("canvas");
    var gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false }) ||
      canvas.getContext("experimental-webgl", { alpha: true, antialias: true, premultipliedAlpha: false });
    if (!gl) return null;

    var escena = ESCENAS[producto.modelo]();
    var prog;
    try { prog = programa(gl); } catch (err) { return null; }

    contenedor.textContent = "";
    contenedor.style.position = contenedor.style.position || "relative";
    canvas.className = "visor-3d";
    canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:pan-y;cursor:grab;outline-offset:-3px";
    canvas.setAttribute("role", "img");
    if (opciones.teclado !== false) canvas.tabIndex = 0;
    contenedor.appendChild(canvas);

    var pista = document.createElement("p");
    pista.className = "vista-previa__pista";
    pista.textContent = "Arrastra para girar 360°";
    pista.setAttribute("aria-hidden", "true");
    contenedor.appendChild(pista);

    gl.useProgram(prog);
    var loc = {
      aPos: gl.getAttribLocation(prog, "aPos"), aNor: gl.getAttribLocation(prog, "aNor"), aUV: gl.getAttribLocation(prog, "aUV"),
      uMVP: gl.getUniformLocation(prog, "uMVP"), uModelo: gl.getUniformLocation(prog, "uModelo"),
      uColor: gl.getUniformLocation(prog, "uColor"), uTex: gl.getUniformLocation(prog, "uTex"),
      uConTex: gl.getUniformLocation(prog, "uConTex"), uSinLuz: gl.getUniformLocation(prog, "uSinLuz"),
      uBrillo: gl.getUniformLocation(prog, "uBrillo"), uAlfa: gl.getUniformLocation(prog, "uAlfa"), uRecorte: gl.getUniformLocation(prog, "uRecorte")
    };
    escena.partes.forEach(function (p) { p.gl = subir(gl, p.m); });

    /* Sombra suave en el piso */
    var piso = malla(), rs = escena.radioSombra;
    cara(piso, [[-rs, escena.piso - 0.005, rs * 0.55], [rs, escena.piso - 0.005, rs * 0.55], [rs, escena.piso - 0.005, -rs * 0.55], [-rs, escena.piso - 0.005, -rs * 0.55]], 0, 1, 0);
    var pisoGl = subir(gl, piso);
    var sombraLienzo = document.createElement("canvas");
    sombraLienzo.width = sombraLienzo.height = 128;
    var sc = sombraLienzo.getContext("2d"), grad = sc.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(0,0,0,0.32)"); grad.addColorStop(0.6, "rgba(0,0,0,0.12)"); grad.addColorStop(1, "rgba(0,0,0,0)");
    sc.fillStyle = grad; sc.fillRect(0, 0, 128, 128);
    var texSombra = textura(gl, sombraLienzo);

    /* Lienzos del diseño (frente) y del reverso del sticker */
    var lienzo = document.createElement("canvas");
    lienzo.width = escena.lienzo[0]; lienzo.height = escena.lienzo[1];
    var texCuerpo = textura(gl, lienzo);
    var lienzoReverso = null, texReverso = null;
    if (escena.redondo) {
      lienzoReverso = document.createElement("canvas");
      lienzoReverso.width = lienzoReverso.height = 256;
      var rc = lienzoReverso.getContext("2d"), r2 = 256 * escena.redondo;
      rc.fillStyle = "#F1EEE8";
      rc.beginPath(); rc.moveTo(r2, 0); rc.arcTo(256, 0, 256, 256, r2); rc.arcTo(256, 256, 0, 256, r2); rc.arcTo(0, 256, 0, 0, r2); rc.arcTo(0, 0, 256, 0, r2); rc.fill();
      rc.strokeStyle = "#B3A99C"; rc.setLineDash([10, 8]); rc.lineWidth = 3;
      rc.beginPath(); rc.moveTo(0, 150); rc.lineTo(150, 0); rc.stroke();
      texReverso = textura(gl, lienzoReverso);
    }

    var estado = { yaw: -0.35, pitch: 0.16 };
    var colorBase = "#F4F1EC";
    var pendiente = false;

    function tamano() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    }

    function dibujarParte(g, mvp, modelo, color, tex, conTex, brillo, sinLuz, alfa, recorte) {
      gl.uniformMatrix4fv(loc.uMVP, false, mvp);
      gl.uniformMatrix4fv(loc.uModelo, false, modelo);
      gl.uniform3fv(loc.uColor, color);
      gl.uniform1f(loc.uConTex, conTex ? 1 : 0);
      gl.uniform1f(loc.uSinLuz, sinLuz ? 1 : 0);
      gl.uniform1f(loc.uBrillo, brillo || 0);
      gl.uniform1f(loc.uAlfa, alfa === undefined ? 1 : alfa);
      gl.uniform1f(loc.uRecorte, recorte ? 1 : 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex || texCuerpo);
      gl.uniform1i(loc.uTex, 0);
      [["p", loc.aPos, 3], ["n", loc.aNor, 3], ["t", loc.aUV, 2]].forEach(function (a) {
        gl.bindBuffer(gl.ARRAY_BUFFER, g[a[0]]);
        gl.enableVertexAttribArray(a[1]);
        gl.vertexAttribPointer(a[1], a[2], gl.FLOAT, false, 0, 0);
      });
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.i);
      gl.drawElements(gl.TRIANGLES, g.cuenta, gl.UNSIGNED_SHORT, 0);
    }

    function colorDe(p) {
      if (p.color === "base") return rgb(colorBase);
      if (p.color === "oscuro") return mezclar(colorBase, -0.3);
      if (p.color === "claro") return mezclar(colorBase, 0.55);
      return rgb(p.color);
    }

    function render() {
      pendiente = false;
      tamano();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      var asp = canvas.width / canvas.height;
      /* Distancia para que quepa completo (alto y ancho, con margen para girarlo) */
      var medida = Math.max(escena.alto, escena.ancho / Math.max(asp, 0.01) * 1.1);
      var dist = medida / (2 * Math.tan(Math.PI / 12)) * 1.32;
      var proy = perspectiva(Math.PI / 6, asp, 0.1, 50);
      var vista = traslacion(0, 0, -dist);
      var modelo = mult(rotX(estado.pitch), mult(rotY(estado.yaw), traslacion(0, -escena.centroY, 0)));
      var mvp = mult(proy, mult(vista, modelo));

      /* Sombra: sin profundidad, con transparencia; no gira con el objeto */
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.DEPTH_TEST);
      var modeloPiso = mult(rotX(estado.pitch), traslacion(0, -escena.centroY, 0));
      dibujarParte(pisoGl, mult(proy, mult(vista, modeloPiso)), modeloPiso, [0, 0, 0], texSombra, true, 0, true, 1, false);

      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      escena.partes.forEach(function (p) {
        if (p.oculto) return;
        var tex = p.tex === "cuerpo" ? texCuerpo : p.tex === "reverso" ? texReverso : null;
        dibujarParte(p.gl, mvp, modelo, colorDe(p), tex, !!tex, p.brillo, false, 1, !!p.recorte);
      });
    }
    function pedirRender() {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(render);
    }

    /* ---------- Girar ---------- */
    var arrastre = null;
    canvas.addEventListener("pointerdown", function (ev) {
      arrastre = { x: ev.clientX, y: ev.clientY };
      canvas.setPointerCapture(ev.pointerId);
      canvas.style.cursor = "grabbing";
      pista.hidden = true;
    });
    canvas.addEventListener("pointermove", function (ev) {
      if (!arrastre) return;
      estado.yaw += (ev.clientX - arrastre.x) * 0.012;
      estado.pitch = Math.max(-0.5, Math.min(0.7, estado.pitch + (ev.clientY - arrastre.y) * 0.006));
      arrastre = { x: ev.clientX, y: ev.clientY };
      pedirRender();
    });
    function soltar() { arrastre = null; canvas.style.cursor = "grab"; }
    canvas.addEventListener("pointerup", soltar);
    canvas.addEventListener("pointercancel", soltar);
    canvas.addEventListener("keydown", function (ev) {
      var paso = { ArrowLeft: [-0.25, 0], ArrowRight: [0.25, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }[ev.key];
      if (!paso) return;
      ev.preventDefault();
      estado.yaw += paso[0];
      estado.pitch = Math.max(-0.5, Math.min(0.7, estado.pitch + paso[1]));
      pedirRender();
    });

    /* Un giro corto al aparecer, para mostrar que se puede mover */
    if (!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
      var inicio = null, desde = estado.yaw;
      requestAnimationFrame(function paso(t) {
        if (arrastre) return;
        if (inicio === null) inicio = t;
        var k = Math.min(1, (t - inicio) / 1400);
        estado.yaw = desde + 0.7 * Math.sin(Math.PI * k) * (1 - k * 0.3);
        if (k === 1) estado.yaw = desde;
        render();
        if (k < 1) requestAnimationFrame(paso);
      });
    }

    if (window.ResizeObserver) new ResizeObserver(pedirRender).observe(canvas);

    var turno = 0;
    function actualizar(e) {
      e = e || {};
      var vp = VP();
      colorBase = vp.hexValido(e.colorHex) ? e.colorHex : (producto.modelo === "sticker" ? "#FFFFFF" : "#F4F1EC");
      var etiqueta = vp._descripcion(producto.nombre, e) + ". Modelo 3D: arrastra o usa las flechas para girarlo";
      canvas.setAttribute("aria-label", etiqueta);
      var mio = ++turno;
      pintarDiseno(lienzo, e, colorBase, escena.envuelve, escena.redondo).then(function () {
        if (mio !== turno) return;
        actualizarTextura(gl, texCuerpo, lienzo);
        pedirRender();
      });
      pedirRender();
    }
    actualizar(opciones.estado);
    return { actualizar: actualizar };
  }

  return { crear: crear, admite: admite, disponible: disponible, TIPOS: Object.keys(TIPOS) };
})();
