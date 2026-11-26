/*
 * Recorte automático de fotos de producto (se usa en el panel, al subir una foto).
 *
 * 1. Quita el fondo:
 *    - si la imagen ya trae transparencia, la respeta;
 *    - si el fondo es liso (blanco, gris…), lo quita desde las orillas;
 *    - si es el "cuadriculado" de transparencia falsa de muchos mockups,
 *      reconoce el patrón de cuadros y lo quita sin comerse el objeto.
 * 2. Separa las piezas (por ejemplo, frente y reverso de un pin lado a lado).
 *    Toma las dos más grandes; la más lisa se propone como frente.
 * 3. Calcula la zona imprimible del frente (la cara lisa donde va el diseño)
 *    y el color del canto, para dar grosor al voltear.
 *
 * Todo ocurre en el navegador; no se envía la imagen a ningún servicio.
 *
 * Uso: LooArt.recorte.procesar(archivo).then(function (r) { ... })
 *   r = { frente: Pieza, reverso: Pieza | null, piezas: n }
 *   Pieza = { imagen, ancho, alto, zona (máscara), zonaCaja [x,y,w,h] en 0–1, borde "#rrggbb" }
 */
window.LooArt = window.LooArt || {};

window.LooArt.recorte = (function () {
  var MAX_PROCESO = 1400;   /* lado máximo al analizar */
  var MAX_SALIDA = 640;     /* lado máximo de cada pieza guardada */
  var AREA_MINIMA = 0.02;   /* una pieza debe ocupar al menos 2 % de la imagen */

  function cargar(archivo) {
    return new Promise(function (resolver, rechazar) {
      var lector = new FileReader();
      lector.onerror = function () { rechazar(new Error("lectura")); };
      lector.onload = function () {
        var img = new Image();
        img.onerror = function () { rechazar(new Error("imagen")); };
        img.onload = function () { resolver(img); };
        img.src = lector.result;
      };
      lector.readAsDataURL(archivo);
    });
  }

  function dist(px, i, c) {
    var dr = px[i] - c[0], dg = px[i + 1] - c[1], db = px[i + 2] - c[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }
  function distColores(a, b) {
    var dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }
  /* Distancia de un pixel al segmento entre dos colores (mezclas por suavizado) */
  function distMezcla(px, i, a, b) {
    var ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    var ap = [px[i] - a[0], px[i + 1] - a[1], px[i + 2] - a[2]];
    var l = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2] || 1;
    var t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / l));
    var dr = ap[0] - ab[0] * t, dg = ap[1] - ab[1] * t, db = ap[2] - ab[2] * t;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }
  function lum(c) { return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; }

  /* ---------- 1. Fondo ---------- */
  function muestrasOrilla(px, W, H) {
    var m = [];
    function tomar(x, y) { var i = (y * W + x) * 4; m.push({ x: x, y: y, c: [px[i], px[i + 1], px[i + 2]] }); }
    for (var x = 0; x < W; x++) { tomar(x, 0); tomar(x, H - 1); }
    for (var y = 1; y < H - 1; y++) { tomar(0, y); tomar(W - 1, y); }
    return m;
  }

  /* Dos colores dominantes de la orilla (k-medias con k = 2) */
  function dosColores(muestras) {
    var a = muestras[0].c.slice(), b = muestras[0].c.slice();
    muestras.forEach(function (s) { if (lum(s.c) > lum(a)) a = s.c.slice(); if (lum(s.c) < lum(b)) b = s.c.slice(); });
    for (var it = 0; it < 6; it++) {
      var sa = [0, 0, 0, 0], sb = [0, 0, 0, 0];
      muestras.forEach(function (s) {
        var t = distColores(s.c, a) <= distColores(s.c, b) ? sa : sb;
        t[0] += s.c[0]; t[1] += s.c[1]; t[2] += s.c[2]; t[3]++;
      });
      if (sa[3]) a = [sa[0] / sa[3], sa[1] / sa[3], sa[2] / sa[3]];
      if (sb[3]) b = [sb[0] / sb[3], sb[1] / sb[3], sb[2] / sb[3]];
    }
    return [a, b];
  }

  /*
   * Tamaño de cuadro y desfase a partir de una fila o columna de la orilla.
   * El tamaño puede tener decimales (los mockups suelen venir reescalados):
   * se mide entre la primera y la última transición para no acumular error.
   */
  function periodo(etiquetas) {
    var cambios = [];
    for (var i = 1; i < etiquetas.length; i++) if (etiquetas[i] !== etiquetas[i - 1]) cambios.push(i);
    if (cambios.length < 4) return null;
    var c = (cambios[cambios.length - 1] - cambios[0]) / (cambios.length - 1);
    /* Comprueba que las transiciones sean regulares */
    var malas = 0;
    for (var k = 1; k < cambios.length; k++) if (Math.abs(cambios[k] - cambios[k - 1] - c) > 2) malas++;
    if (c < 3 || malas > cambios.length * 0.2) return null;
    var desfase = cambios[0] - Math.floor(cambios[0] / c) * c;
    return { c: c, desfase: desfase };
  }

  function quitarFondo(px, W, H, fondo) {
    var muestras = muestrasOrilla(px, W, H);
    var colores = dosColores(muestras);
    var A = colores[0], B = colores[1];
    var TOL = 26;

    var esCuadricula = distColores(A, B) > 10;
    var info = null;
    if (esCuadricula) {
      /* Etiqueta de cada pixel de la fila 1 y la columna 1: ¿más cerca de A o de B? */
      var fila = [], col = [];
      for (var x = 0; x < W; x++) fila.push(dist(px, (1 * W + x) * 4, A) <= dist(px, (1 * W + x) * 4, B) ? 0 : 1);
      for (var y = 0; y < H; y++) col.push(dist(px, (y * W + 1) * 4, A) <= dist(px, (y * W + 1) * 4, B) ? 0 : 1);
      var px1 = periodo(fila), py1 = periodo(col);
      if (px1 && py1 && Math.abs(px1.c - py1.c) <= 1.5) {
        var c = (px1.c + py1.c) / 2;
        info = { c: c, ox: px1.desfase, oy: py1.desfase };
        /* ¿Qué color va en los cuadros "pares"? Se decide por mayoría en la orilla */
        var votos = 0;
        muestras.forEach(function (s) {
          var par = ((Math.floor((s.x - info.ox) / c + 1) + Math.floor((s.y - info.oy) / c + 1)) & 1) === 0;
          var esA = distColores(s.c, A) <= distColores(s.c, B);
          votos += par === esA ? 1 : -1;
        });
        info.par = votos >= 0 ? A : B;
        info.impar = votos >= 0 ? B : A;
        /* Si el patrón no explica bien la orilla, se trata como fondo liso de dos tonos */
        if (Math.abs(votos) < muestras.length * 0.6) info = null;
      }
    }

    if (info) { cuadricula(px, W, H, fondo, info, A, B, TOL); return info.c; }
    liso(px, W, H, fondo, esCuadricula ? [A, B] : [[(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2]], TOL + 4);
    return 0;
  }

  /*
   * Suaviza el contorno quitando salientes más delgados que `r` pixeles
   * (restos de cuadros pegados a la orilla). Erosión y dilatación con
   * distancias aproximadas (chaflán 3-4).
   */
  function distancias(lleno, W, H, dentro) {
    var d = new Float32Array(W * H), INF = 1e9;
    for (var i = 0; i < W * H; i++) d[i] = (lleno[i] === dentro) ? INF : 0;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var k = y * W + x; if (!d[k]) continue;
      var m = d[k];
      if (x > 0) m = Math.min(m, d[k - 1] + 3);
      if (y > 0) {
        m = Math.min(m, d[k - W] + 3);
        if (x > 0) m = Math.min(m, d[k - W - 1] + 4);
        if (x < W - 1) m = Math.min(m, d[k - W + 1] + 4);
      }
      d[k] = m;
    }
    for (var y2 = H - 1; y2 >= 0; y2--) for (var x2 = W - 1; x2 >= 0; x2--) {
      var k2 = y2 * W + x2; if (!d[k2]) continue;
      var m2 = d[k2];
      if (x2 < W - 1) m2 = Math.min(m2, d[k2 + 1] + 3);
      if (y2 < H - 1) {
        m2 = Math.min(m2, d[k2 + W] + 3);
        if (x2 < W - 1) m2 = Math.min(m2, d[k2 + W + 1] + 4);
        if (x2 > 0) m2 = Math.min(m2, d[k2 + W - 1] + 4);
      }
      d[k2] = m2;
    }
    return d; /* en tercios de pixel */
  }
  /* Rellena muescas más angostas que 2r (pedazos de orilla que se confundieron con fondo) */
  function cerrar(fondo, W, H, r) {
    var objeto = new Uint8Array(W * H);
    for (var i = 0; i < W * H; i++) objeto[i] = fondo[i] ? 0 : 1;
    var aObjeto = distancias(objeto, W, H, 0);
    var crecido = new Uint8Array(W * H);
    for (var j = 0; j < W * H; j++) crecido[j] = aObjeto[j] <= r * 3 ? 1 : 0;
    var aFuera = distancias(crecido, W, H, 1);
    for (var t = 0; t < W * H; t++) if (!objeto[t] && aFuera[t] > r * 3) fondo[t] = 0;
  }

  function abrir(fondo, W, H, r) {
    var objeto = new Uint8Array(W * H);
    for (var i = 0; i < W * H; i++) objeto[i] = fondo[i] ? 0 : 1;
    /* Erosión: queda lo que está a más de r del fondo */
    var aFondo = distancias(objeto, W, H, 1);
    var nucleo = new Uint8Array(W * H);
    for (var j = 0; j < W * H; j++) nucleo[j] = aFondo[j] > r * 3 ? 1 : 0;
    /* Dilatación: vuelve a crecer r, pero solo dentro de lo que era objeto */
    var aNucleo = distancias(nucleo, W, H, 0);
    for (var t = 0; t < W * H; t++) if (objeto[t] && aNucleo[t] > r * 3 + 1) fondo[t] = 1;
  }

  /* Fondo liso: relleno desde las orillas con los pixeles parecidos */
  function liso(px, W, H, fondo, colores, tol) {
    var cola = new Int32Array(W * H), ini = 0, fin = 0;
    function parecido(i) {
      for (var k = 0; k < colores.length; k++) if (dist(px, i * 4, colores[k]) < tol) return true;
      return false;
    }
    function sembrar(i) { if (!fondo[i] && parecido(i)) { fondo[i] = 1; cola[fin++] = i; } }
    for (var x = 0; x < W; x++) { sembrar(x); sembrar((H - 1) * W + x); }
    for (var y = 0; y < H; y++) { sembrar(y * W); sembrar(y * W + W - 1); }
    while (ini < fin) {
      var i = cola[ini++], xx = i % W;
      if (xx > 0) sembrar(i - 1);
      if (xx < W - 1) sembrar(i + 1);
      if (i >= W) sembrar(i - W);
      if (i < W * (H - 1)) sembrar(i + W);
    }
  }

  /*
   * Fondo cuadriculado: primero se marcan los cuadros completos que son fondo
   * y están conectados con la orilla (de cuadro en cuadro, sin diagonales: así
   * no se cuela hacia un objeto blanco). Luego, en los cuadros de la orilla del
   * objeto, se quitan solo los pixeles que coinciden con el color esperado.
   */
  function cuadricula(px, W, H, fondo, info, A, B, tol) {
    var c = info.c;
    function celdaX(x) { return Math.floor((x - info.ox) / c + 1); }
    function celdaY(y) { return Math.floor((y - info.oy) / c + 1); }
    /* Distancia (en pixeles) del punto al borde de su cuadro */
    function resto(v, o) { var f = (v - o) / c + 1; return (f - Math.floor(f)) * c; }
    var NX = celdaX(W - 1) + 1, NY = celdaY(H - 1) + 1;
    function esperado(cx, cy) { return ((cx + cy) & 1) === 0 ? info.par : info.impar; }

    var coinciden = new Float32Array(NX * NY), total = new Float32Array(NX * NY);
    var margen = c >= 6 ? 1.5 : 0;
    for (var y = 0; y < H; y++) {
      var cy = celdaY(y);
      var ry0 = resto(y, info.oy);
      var dentroY = ry0 >= margen && ry0 < c - margen;
      for (var x = 0; x < W; x++) {
        var cx = celdaX(x);
        var rx0 = resto(x, info.ox);
        var dentroX = rx0 >= margen && rx0 < c - margen;
        if (!dentroX || !dentroY) continue;
        var k = cy * NX + cx;
        total[k]++;
        if (dist(px, (y * W + x) * 4, esperado(cx, cy)) < tol) coinciden[k]++;
      }
    }

    /* Cuadros de fondo conectados con la orilla */
    var celdaFondo = new Uint8Array(NX * NY);
    var candidata = new Uint8Array(NX * NY);
    for (var k2 = 0; k2 < NX * NY; k2++) candidata[k2] = total[k2] > 0 && coinciden[k2] / total[k2] >= 0.9 ? 1 : 0;
    var cola = [];
    function sembrarCelda(cx, cy) {
      var k = cy * NX + cx;
      if (cx < 0 || cy < 0 || cx >= NX || cy >= NY || celdaFondo[k] || !candidata[k]) return;
      celdaFondo[k] = 1; cola.push(k);
    }
    for (var cx0 = 0; cx0 < NX; cx0++) { sembrarCelda(cx0, 0); sembrarCelda(cx0, NY - 1); }
    for (var cy0 = 0; cy0 < NY; cy0++) { sembrarCelda(0, cy0); sembrarCelda(NX - 1, cy0); }
    while (cola.length) {
      var kk = cola.pop(), ccx = kk % NX, ccy = (kk - ccx) / NX;
      sembrarCelda(ccx - 1, ccy); sembrarCelda(ccx + 1, ccy); sembrarCelda(ccx, ccy - 1); sembrarCelda(ccx, ccy + 1);
    }

    /* Pixeles: cuadros de fondo completos y, junto a ellos, lo que coincide con el patrón */
    var orilla = new Uint8Array(W * H);
    for (var y2 = 0; y2 < H; y2++) {
      var cy2 = celdaY(y2);
      for (var x2 = 0; x2 < W; x2++) {
        var cx2 = celdaX(x2), i = y2 * W + x2;
        if (celdaFondo[cy2 * NX + cx2]) { fondo[i] = 1; continue; }
        var vecino = (cx2 > 0 && celdaFondo[cy2 * NX + cx2 - 1]) || (cx2 < NX - 1 && celdaFondo[cy2 * NX + cx2 + 1]) ||
          (cy2 > 0 && celdaFondo[(cy2 - 1) * NX + cx2]) || (cy2 < NY - 1 && celdaFondo[(cy2 + 1) * NX + cx2]);
        if (!vecino) continue;
        var rx = resto(x2, info.ox), ry = resto(y2, info.oy);
        var enLinea = rx < 1.5 || ry < 1.5 || rx > c - 1.5 || ry > c - 1.5;
        /* En las líneas entre cuadros se aceptan mezclas reales de los dos tonos,
           no colores casi iguales a uno de ellos (así no se cuela a un borde blanco) */
        var mezcla = enLinea && distMezcla(px, i * 4, A, B) < tol * 0.6 &&
          dist(px, i * 4, A) > 10 && dist(px, i * 4, B) > 10;
        if (dist(px, i * 4, esperado(cx2, cy2)) < tol || mezcla) orilla[i] = 1;
      }
    }
    /* Se quitan solo los pixeles de orilla conectados con el fondo */
    var q = new Int32Array(W * H), ini = 0, fin = 0;
    for (var j = 0; j < W * H; j++) if (fondo[j]) q[fin++] = j;
    while (ini < fin) {
      var p = q[ini++], xx = p % W;
      var vecinos = [xx > 0 ? p - 1 : -1, xx < W - 1 ? p + 1 : -1, p - W, p + W];
      for (var v = 0; v < 4; v++) {
        var n = vecinos[v];
        if (n < 0 || n >= W * H || fondo[n] || !orilla[n]) continue;
        fondo[n] = 1; q[fin++] = n;
      }
    }

    /*
     * Sombras sobre la cuadrícula: una sombra oscurece por igual el cuadro claro
     * y el oscuro, así que la proporción (pixel / color esperado) casi no cambia
     * al pasar al cuadro vecino. En el objeto, en cambio, esa proporción salta.
     * Esos pixeles de sombra también se quitan; la vista previa dibuja su propia sombra.
     */
    function luz(i) { return 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]; }
    function gris(i) {
      var r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
      return Math.max(r, g, b) - Math.min(r, g, b) < 16;
    }
    function proporcion(i, x, y) { return luz(i) / Math.max(1, lum(esperado(celdaX(x), celdaY(y)))); }
    function esSombra(i, x, y) {
      if (!gris(i)) return false;
      var k = proporcion(i, x, y);
      if (k > 0.985 || k < 0.12) return false;
      var rx = resto(x, info.ox), ry = resto(y, info.oy);
      /* Un punto equivalente en cada cuadro vecino */
      var otros = [[x + Math.ceil(c - rx) + 1, y], [x - Math.ceil(rx) - 2, y], [x, y + Math.ceil(c - ry) + 1], [x, y - Math.ceil(ry) - 2]];
      for (var t = 0; t < 4; t++) {
        var ox2 = otros[t][0], oy2 = otros[t][1];
        if (ox2 < 0 || oy2 < 0 || ox2 >= W || oy2 >= H) continue;
        var o = oy2 * W + ox2;
        if (!gris(o)) continue;
        if (Math.abs(proporcion(o, ox2, oy2) - k) < 0.07) return true;
      }
      return false;
    }
    ini = 0; fin = 0;
    for (var j2 = 0; j2 < W * H; j2++) if (fondo[j2]) q[fin++] = j2;
    while (ini < fin) {
      var p2 = q[ini++], x3 = p2 % W, y3 = (p2 - x3) / W;
      var vec = [[x3 - 1, y3], [x3 + 1, y3], [x3, y3 - 1], [x3, y3 + 1]];
      for (var v2 = 0; v2 < 4; v2++) {
        var vx = vec[v2][0], vy = vec[v2][1];
        if (vx < 0 || vy < 0 || vx >= W || vy >= H) continue;
        var n2 = vy * W + vx;
        if (fondo[n2] || !esSombra(n2, vx, vy)) continue;
        fondo[n2] = 1; q[fin++] = n2;
      }
    }
  }

  /* ---------- 2. Piezas ---------- */
  function etiquetar(fondo, W, H) {
    var etiqueta = new Int32Array(W * H), piezas = [], cola = new Int32Array(W * H);
    for (var s = 0; s < W * H; s++) {
      if (fondo[s] || etiqueta[s]) continue;
      var id = piezas.length + 1, ini = 0, fin = 0;
      var pz = { id: id, area: 0, x0: W, y0: H, x1: 0, y1: 0, sx: 0, sy: 0 };
      etiqueta[s] = id; cola[fin++] = s;
      while (ini < fin) {
        var i = cola[ini++], x = i % W, y = (i - x) / W;
        pz.area++; pz.sx += x; pz.sy += y;
        if (x < pz.x0) pz.x0 = x; if (x > pz.x1) pz.x1 = x;
        if (y < pz.y0) pz.y0 = y; if (y > pz.y1) pz.y1 = y;
        if (x > 0 && !fondo[i - 1] && !etiqueta[i - 1]) { etiqueta[i - 1] = id; cola[fin++] = i - 1; }
        if (x < W - 1 && !fondo[i + 1] && !etiqueta[i + 1]) { etiqueta[i + 1] = id; cola[fin++] = i + 1; }
        if (y > 0 && !fondo[i - W] && !etiqueta[i - W]) { etiqueta[i - W] = id; cola[fin++] = i - W; }
        if (y < H - 1 && !fondo[i + W] && !etiqueta[i + W]) { etiqueta[i + W] = id; cola[fin++] = i + W; }
      }
      piezas.push(pz);
    }
    return { etiqueta: etiqueta, piezas: piezas };
  }

  /* Zona imprimible: la cara lisa que rodea el centro de la pieza */
  function zonaImprimible(px, W, etiqueta, pz) {
    var w = pz.x1 - pz.x0 + 1, h = pz.y1 - pz.y0 + 1;
    var zona = new Uint8Array(w * h);
    var cx = Math.round(pz.sx / pz.area), cy = Math.round(pz.sy / pz.area);
    /* Color de referencia: promedio alrededor del centro */
    var ref = [0, 0, 0], n = 0;
    for (var dy = -3; dy <= 3; dy++) for (var dx = -3; dx <= 3; dx++) {
      var gi = (cy + dy) * W + (cx + dx);
      if (etiqueta[gi] !== pz.id) continue;
      ref[0] += px[gi * 4]; ref[1] += px[gi * 4 + 1]; ref[2] += px[gi * 4 + 2]; n++;
    }
    if (!n) return null;
    ref = [ref[0] / n, ref[1] / n, ref[2] / n];
    var TOL = 46, cola = [], s0 = (cy - pz.y0) * w + (cx - pz.x0);
    zona[s0] = 1; cola.push(s0);
    var area = 0;
    while (cola.length) {
      var i = cola.pop(), x = i % w, y = (i - x) / w;
      area++;
      [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].forEach(function (v) {
        if (v[0] < 0 || v[1] < 0 || v[0] >= w || v[1] >= h) return;
        var li = v[1] * w + v[0];
        if (zona[li]) return;
        var g = (v[1] + pz.y0) * W + (v[0] + pz.x0);
        if (etiqueta[g] !== pz.id || dist(px, g * 4, ref) > TOL) return;
        zona[li] = 1; cola.push(li);
      });
    }
    if (area < pz.area * 0.12) return null;
    /* Rellena huecos interiores (un logo o detalle dentro de la cara) */
    var fuera = new Uint8Array(w * h), q = [];
    function marcar(x, y) { var k = y * w + x; if (!zona[k] && !fuera[k]) { fuera[k] = 1; q.push(k); } }
    for (var x0 = 0; x0 < w; x0++) { marcar(x0, 0); marcar(x0, h - 1); }
    for (var y0 = 0; y0 < h; y0++) { marcar(0, y0); marcar(w - 1, y0); }
    while (q.length) {
      var k = q.pop(), xk = k % w, yk = (k - xk) / w;
      if (xk > 0) marcar(xk - 1, yk); if (xk < w - 1) marcar(xk + 1, yk);
      if (yk > 0) marcar(xk, yk - 1); if (yk < h - 1) marcar(xk, yk + 1);
    }
    for (var t = 0; t < w * h; t++) if (!fuera[t]) zona[t] = 1;
    /* Recorta 2 px de la orilla para no pintar sobre el canto */
    for (var pasada = 0; pasada < 2; pasada++) {
      var copia = zona.slice();
      for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) {
        var kk = yy * w + xx;
        if (!copia[kk]) continue;
        if (xx === 0 || yy === 0 || xx === w - 1 || yy === h - 1 ||
          !copia[kk - 1] || !copia[kk + 1] || !copia[kk - w] || !copia[kk + w]) zona[kk] = 0;
      }
    }
    return zona;
  }

  /*
   * Si la pieza es (casi) un círculo u óvalo, devuelve ese óvalo para usarlo
   * como contorno limpio: centro, semiejes y giro calculados con momentos.
   * Si la forma no se parece lo suficiente (un termo, una taza), devuelve null.
   */
  function ovalo(etiqueta, W, H, pz) {
    var mx = pz.sx / pz.area, my = pz.sy / pz.area, sxx = 0, syy = 0, sxy = 0;
    for (var y = pz.y0; y <= pz.y1; y++) for (var x = pz.x0; x <= pz.x1; x++) {
      if (etiqueta[y * W + x] !== pz.id) continue;
      var dx = x - mx, dy = y - my;
      sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
    }
    sxx /= pz.area; syy /= pz.area; sxy /= pz.area;
    var tr = sxx + syy, det = sxx * syy - sxy * sxy;
    var raiz = Math.sqrt(Math.max(0, tr * tr / 4 - det));
    var l1 = tr / 2 + raiz, l2 = tr / 2 - raiz;
    var ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    var o = { cx: mx, cy: my, a: 2 * Math.sqrt(l1), b: 2 * Math.sqrt(Math.max(l2, 0.0001)), cos: Math.cos(ang), sin: Math.sin(ang) };
    o.rho = function (x, y) {
      var dx = x - o.cx, dy = y - o.cy;
      var u = (dx * o.cos + dy * o.sin) / o.a, v = (-dx * o.sin + dy * o.cos) / o.b;
      return Math.sqrt(u * u + v * v);
    };
    /* Qué tanto coincide: intersección / unión */
    var r = Math.ceil(Math.max(o.a, o.b)) + 2, inter = 0, union = 0;
    for (var yy = Math.max(0, Math.floor(my - r)); yy <= Math.min(H - 1, Math.ceil(my + r)); yy++) {
      for (var xx = Math.max(0, Math.floor(mx - r)); xx <= Math.min(W - 1, Math.ceil(mx + r)); xx++) {
        var dentroO = o.rho(xx, yy) < 1, dentroP = etiqueta[yy * W + xx] === pz.id;
        if (dentroO && dentroP) inter++;
        if (dentroO || dentroP) union++;
      }
    }
    return union && inter / union >= 0.92 ? o : null;
  }

  function hex(c) {
    return "#" + c.map(function (v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"); }).join("");
  }

  function aDataUrl(lienzo) {
    var webp = lienzo.toDataURL("image/webp", 0.88);
    return webp.indexOf("data:image/webp") === 0 ? webp : lienzo.toDataURL("image/png");
  }

  /* Recorta una pieza a su tamaño, con orillas suavizadas */
  function exportar(px, W, H, alfaOriginal, etiqueta, pz, conZona) {
    var ov = ovalo(etiqueta, W, H, pz);
    if (ov) {
      /* La caja crece hasta cubrir el óvalo completo */
      var ext = Math.ceil(Math.max(ov.a, ov.b)) + 2;
      pz = Object.assign({}, pz, {
        x0: Math.max(0, Math.floor(ov.cx - ext)), x1: Math.min(W - 1, Math.ceil(ov.cx + ext)),
        y0: Math.max(0, Math.floor(ov.cy - ext)), y1: Math.min(H - 1, Math.ceil(ov.cy + ext))
      });
    }
    var w = pz.x1 - pz.x0 + 1, h = pz.y1 - pz.y0 + 1;
    var menor = ov ? Math.min(ov.a, ov.b) : 1;
    var lienzo = document.createElement("canvas");
    lienzo.width = w; lienzo.height = h;
    var ctx = lienzo.getContext("2d");
    var datos = ctx.createImageData(w, h), d = datos.data;
    var sumaLum = 0, sumaLum2 = 0, cuenta = 0;
    var canto = [0, 0, 0], nCanto = 0;
    var zona = conZona ? zonaImprimible(px, W, etiqueta, pz) : null;
    if (zona && ov) {
      /*
       * Pieza ovalada: la zona imprimible también es un óvalo, un poco más chico.
       * Su tamaño sale de la orilla típica de la cara detectada (percentil 70),
       * así un brillo o un canto irregular no la deforman.
       */
      var radios = [];
      for (var zy = 1; zy < h - 1; zy++) for (var zx = 1; zx < w - 1; zx++) {
        var zk = zy * w + zx;
        if (zona[zk] && (!zona[zk - 1] || !zona[zk + 1] || !zona[zk - w] || !zona[zk + w])) radios.push(ov.rho(zx + pz.x0, zy + pz.y0));
      }
      radios.sort(function (a, b) { return a - b; });
      var escalaZona = radios.length ? radios[Math.floor(radios.length * 0.7)] : 0.9;
      escalaZona = Math.max(0.72, Math.min(1 - 3 / menor, escalaZona));
      for (var zy2 = 0; zy2 < h; zy2++) for (var zx2 = 0; zx2 < w; zx2++) {
        zona[zy2 * w + zx2] = ov.rho(zx2 + pz.x0, zy2 + pz.y0) < escalaZona ? 1 : 0;
      }
    }

    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var g = (y + pz.y0) * W + (x + pz.x0), o = (y * w + x) * 4;
      var alfa, borde;
      if (ov) {
        /* Orilla suave de 1 pixel sobre el óvalo ajustado */
        var rho = ov.rho(x + pz.x0, y + pz.y0);
        alfa = Math.max(0, Math.min(1, (1 - rho) * menor + 0.5));
        if (alfa <= 0) continue;
        alfa = Math.round(alfa * 255);
        borde = alfa < 255;
      } else {
        if (etiqueta[g] !== pz.id) continue;
        borde = etiqueta[g - 1] !== pz.id || etiqueta[g + 1] !== pz.id || etiqueta[g - W] !== pz.id || etiqueta[g + W] !== pz.id;
        alfa = borde ? 150 : 255;
      }
      d[o] = px[g * 4]; d[o + 1] = px[g * 4 + 1]; d[o + 2] = px[g * 4 + 2];
      d[o + 3] = Math.min(alfaOriginal ? px[g * 4 + 3] : 255, alfa);
      if ((x + y) % 3 === 0) {
        var l = lum([d[o], d[o + 1], d[o + 2]]);
        sumaLum += l; sumaLum2 += l * l; cuenta++;
      }
      /* Color del canto: lo que no es cara imprimible */
      if (zona && !zona[y * w + x] && !borde && (x + y) % 2 === 0) {
        canto[0] += d[o]; canto[1] += d[o + 1]; canto[2] += d[o + 2]; nCanto++;
      }
    }
    ctx.putImageData(datos, 0, 0);

    var escala = Math.min(1, MAX_SALIDA / Math.max(w, h));
    var salida = document.createElement("canvas");
    salida.width = Math.max(1, Math.round(w * escala));
    salida.height = Math.max(1, Math.round(h * escala));
    var sctx = salida.getContext("2d");
    sctx.imageSmoothingQuality = "high";
    sctx.drawImage(lienzo, 0, 0, salida.width, salida.height);

    var media = cuenta ? sumaLum / cuenta : 0;
    var resultado = {
      imagen: aDataUrl(salida),
      ancho: salida.width,
      alto: salida.height,
      variacion: cuenta ? Math.sqrt(Math.max(0, sumaLum2 / cuenta - media * media)) : 0,
      borde: nCanto ? hex([canto[0] / nCanto * 0.82, canto[1] / nCanto * 0.82, canto[2] / nCanto * 0.82]) : "#9A9A9A",
      zona: null,
      zonaCaja: null
    };

    if (zona) {
      /* Luz media de la cara: sirve para que el diseño conserve sus colores */
      var sumaCara = 0, nCara = 0;
      for (var zt = 0; zt < w * h; zt += 2) {
        if (!zona[zt]) continue;
        var zg = ((Math.floor(zt / w)) + pz.y0) * W + (zt % w + pz.x0);
        sumaCara += 0.299 * px[zg * 4] + 0.587 * px[zg * 4 + 1] + 0.114 * px[zg * 4 + 2]; nCara++;
      }
      resultado.cara = nCara ? Math.round(sumaCara / nCara) : 230;
      var mascara = document.createElement("canvas");
      mascara.width = w; mascara.height = h;
      var mctx = mascara.getContext("2d");
      var md = mctx.createImageData(w, h);
      var zx0 = w, zy0 = h, zx1 = 0, zy1 = 0;
      for (var t = 0; t < w * h; t++) {
        if (!zona[t]) continue;
        md.data[t * 4] = md.data[t * 4 + 1] = md.data[t * 4 + 2] = 255;
        md.data[t * 4 + 3] = 255;
        var zx = t % w, zy = (t - zx) / w;
        if (zx < zx0) zx0 = zx; if (zx > zx1) zx1 = zx; if (zy < zy0) zy0 = zy; if (zy > zy1) zy1 = zy;
      }
      mctx.putImageData(md, 0, 0);
      var msal = document.createElement("canvas");
      msal.width = salida.width; msal.height = salida.height;
      msal.getContext("2d").drawImage(mascara, 0, 0, msal.width, msal.height);
      resultado.zona = msal.toDataURL("image/png");
      resultado.zonaCaja = [zx0 / w, zy0 / h, (zx1 - zx0 + 1) / w, (zy1 - zy0 + 1) / h];
    }
    return resultado;
  }

  function procesar(archivo) {
    return cargar(archivo).then(function (img) {
      var escala = Math.min(1, MAX_PROCESO / Math.max(img.width, img.height));
      var W = Math.max(1, Math.round(img.width * escala)), H = Math.max(1, Math.round(img.height * escala));
      var lienzo = document.createElement("canvas");
      lienzo.width = W; lienzo.height = H;
      var ctx = lienzo.getContext("2d");
      ctx.drawImage(img, 0, 0, W, H);
      var px = ctx.getImageData(0, 0, W, H).data;

      var fondo = new Uint8Array(W * H);
      /* ¿La imagen ya trae transparencia real? */
      var transparentes = 0;
      for (var i = 3; i < px.length; i += 16) if (px[i] < 20) transparentes++;
      var alfaOriginal = transparentes > (px.length / 16) * 0.03;
      if (alfaOriginal) {
        for (var j = 0; j < W * H; j++) if (px[j * 4 + 3] < 20) fondo[j] = 1;
      } else {
        var cuadro = quitarFondo(px, W, H, fondo);
        if (cuadro) {
          abrir(fondo, W, H, Math.ceil(cuadro * 0.6));
          cerrar(fondo, W, H, Math.ceil(cuadro * 0.8));
        }
      }

      var r = etiquetar(fondo, W, H);
      var grandes = r.piezas
        .filter(function (p) { return p.area >= W * H * AREA_MINIMA; })
        .sort(function (a, b) { return b.area - a.area; })
        .slice(0, 2);
      if (!grandes.length) throw new Error("sin-piezas");

      /* Orden de lectura: lado a lado o una arriba de otra */
      if (grandes.length === 2) {
        var lado = Math.abs(grandes[0].sx / grandes[0].area - grandes[1].sx / grandes[1].area) >=
          Math.abs(grandes[0].sy / grandes[0].area - grandes[1].sy / grandes[1].area);
        grandes.sort(function (a, b) { return lado ? a.x0 - b.x0 : a.y0 - b.y0; });
      }

      var piezas = grandes.map(function (p) { return exportar(px, W, H, alfaOriginal, r.etiqueta, p, true); });
      /* La cara más lisa suele ser el frente en blanco donde va el diseño */
      var frente = piezas[0], reverso = piezas[1] || null;
      if (reverso && reverso.variacion < frente.variacion) { var t = frente; frente = reverso; reverso = t; }
      return { frente: frente, reverso: reverso, piezas: piezas.length };
    });
  }

  return { procesar: procesar };
})();
