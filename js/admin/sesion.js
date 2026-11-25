/*
 * Sesión del administrador y menú compartido del panel.
 *
 * IMPORTANTE: sin servidor, esta contraseña solo protege el panel de quien use
 * este mismo navegador. NO es seguridad real: cualquiera con acceso al
 * navegador puede borrar los datos del sitio y crear otra contraseña. Antes de
 * publicar, el acceso debe validarse en un servidor.
 */
window.LooArt = window.LooArt || {};

window.LooArt.admin = (function () {
  var CLAVE_CRED = "looart.admin";
  var CLAVE_SESION = "looart.admin.sesion";
  var ITERACIONES = 150000;

  function aB64(buffer) {
    var bytes = new Uint8Array(buffer);
    var texto = "";
    for (var i = 0; i < bytes.length; i++) texto += String.fromCharCode(bytes[i]);
    return btoa(texto);
  }

  function deB64(texto) {
    var bin = atob(texto);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function disponible() {
    return !!(window.crypto && window.crypto.subtle);
  }

  function derivar(contrasena, sal) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey("raw", enc.encode(contrasena), "PBKDF2", false, ["deriveBits"])
      .then(function (llave) {
        return crypto.subtle.deriveBits(
          { name: "PBKDF2", salt: sal, iterations: ITERACIONES, hash: "SHA-256" }, llave, 256);
      })
      .then(aB64);
  }

  function credenciales() {
    try { return JSON.parse(localStorage.getItem(CLAVE_CRED)); } catch (e) { return null; }
  }

  function abrirSesion() { sessionStorage.setItem(CLAVE_SESION, "1"); }

  function crearContrasena(contrasena) {
    var sal = crypto.getRandomValues(new Uint8Array(16));
    return derivar(contrasena, sal).then(function (hash) {
      localStorage.setItem(CLAVE_CRED, JSON.stringify({ sal: aB64(sal), hash: hash }));
      abrirSesion();
    });
  }

  function entrar(contrasena) {
    var c = credenciales();
    if (!c) return Promise.resolve(false);
    return derivar(contrasena, deB64(c.sal)).then(function (hash) {
      if (hash === c.hash) { abrirSesion(); return true; }
      return false;
    });
  }

  function activa() { return sessionStorage.getItem(CLAVE_SESION) === "1"; }

  /* Devuelve false (y manda al inicio de sesión) si no hay sesión abierta */
  function requerir() {
    if (activa()) return true;
    window.location.replace("index.html");
    return false;
  }

  function salir() {
    sessionStorage.removeItem(CLAVE_SESION);
    window.location.href = "index.html";
  }

  /* Iconos del menú (dibujos propios, sin librerías) */
  var ICONOS = {
    dashboard: '<path d="M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z"/>',
    cotizaciones: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    reportes: '<path d="M4 20V4M4 20h16M8 16v-5M13 16V8M18 16v-3"/>',
    productos: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9"/>'
  };

  function icono(nombre) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = ICONOS[nombre]; /* cadenas fijas de este archivo */
    return svg;
  }

  /* Barra superior en celular, menú lateral en escritorio */
  function pintarCabecera(activo) {
    var cab = document.getElementById("cabecera");
    cab.className = "admin-lateral";
    document.body.classList.add("admin-app");

    var logo = document.createElement("a");
    logo.className = "logo";
    logo.href = "dashboard.html";
    logo.innerHTML = "Loo<span>Art</span> <small>Admin</small>";
    cab.appendChild(logo);

    var nav = document.createElement("nav");
    nav.setAttribute("aria-label", "Secciones del panel");
    var ul = document.createElement("ul");
    ul.className = "admin-nav";
    [
      ["dashboard", "Resumen"],
      ["cotizaciones", "Cotizaciones"],
      ["reportes", "Reportes"],
      ["productos", "Productos"]
    ].forEach(function (s) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.className = "chip" + (s[0] === activo ? " chip--activo" : "");
      a.href = s[0] + ".html";
      a.appendChild(icono(s[0]));
      a.appendChild(document.createTextNode(s[1]));
      if (s[0] === activo) a.setAttribute("aria-current", "page");
      li.appendChild(a);
      ul.appendChild(li);
    });
    nav.appendChild(ul);
    cab.appendChild(nav);

    var acciones = document.createElement("div");
    acciones.className = "admin-acciones";
    var sitio = document.createElement("a");
    sitio.className = "chip";
    sitio.href = "../index.html";
    sitio.textContent = "Ver sitio";
    var boton = document.createElement("button");
    boton.className = "chip";
    boton.type = "button";
    boton.textContent = "Cerrar sesión";
    boton.addEventListener("click", salir);
    acciones.appendChild(sitio);
    acciones.appendChild(boton);
    cab.appendChild(acciones);
  }

  return {
    disponible: disponible,
    existe: function () { return !!credenciales(); },
    crearContrasena: crearContrasena,
    entrar: entrar,
    activa: activa,
    requerir: requerir,
    salir: salir,
    pintarCabecera: pintarCabecera
  };
})();
