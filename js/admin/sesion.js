/*
 * Sesión, roles y menú compartido del panel.
 *
 * Roles del sistema:
 *   - cliente       Visitante del sitio público. NO inicia sesión: cotiza sin cuenta.
 *   - admin         Administrador del negocio: resumen, cotizaciones, reportes y productos.
 *   - superusuario  Soporte técnico: todo lo anterior más la sección "Soporte técnico"
 *                   (usuarios del panel, almacenamiento y diagnóstico).
 *
 * La sesión siempre tiene la forma { token, rol, usuario }. Hoy la genera el
 * proveedor LOCAL (usuarios guardados en localStorage con PBKDF2). Cuando exista
 * servidor, basta con registrar otro proveedor que devuelva { token, rol } desde
 * la API; el resto del panel no cambia:
 *
 *   LooArt.admin.usarProveedor({
 *     entrar: function (usuario, contrasena) {
 *       return fetch("/api/sesion", {
 *         method: "POST",
 *         headers: { "Content-Type": "application/json" },
 *         body: JSON.stringify({ usuario: usuario, contrasena: contrasena })
 *       }).then(function (r) { return r.ok ? r.json() : null; });   // -> { token, rol }
 *     }
 *   });
 *
 * y enviar LooArt.admin.token() en la cabecera Authorization de cada petición.
 *
 * IMPORTANTE: sin servidor, esto solo protege el panel de quien use este mismo
 * navegador. Ocultar una sección en el navegador NO es seguridad: el servidor
 * deberá validar el token y el rol en cada petición.
 */
window.LooArt = window.LooArt || {};

window.LooArt.admin = (function () {
  var CLAVE_USUARIOS = "looart.usuarios";
  var CLAVE_LEGADO = "looart.admin";          /* contraseña única de la versión anterior */
  var CLAVE_SESION = "looart.admin.sesion";   /* sessionStorage */
  var ITERACIONES = 150000;
  var PATRON_USUARIO = /^[a-z0-9._-]{3,30}$/;

  var ROLES = {
    admin: { nombre: "Administrador" },
    superusuario: { nombre: "Soporte técnico" }
  };

  /* Secciones del panel y qué roles pueden verlas */
  var SECCIONES = [
    { id: "dashboard", nombre: "Resumen", roles: ["admin", "superusuario"] },
    { id: "cotizaciones", nombre: "Cotizaciones", roles: ["admin", "superusuario"] },
    { id: "reportes", nombre: "Reportes", roles: ["admin", "superusuario"] },
    { id: "productos", nombre: "Productos", roles: ["admin", "superusuario"] },
    { id: "soporte", nombre: "Soporte técnico", roles: ["superusuario"], exclusiva: true }
  ];

  /* ---------- Utilidades de cifrado ---------- */
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

  function tokenAleatorio() {
    return aB64(crypto.getRandomValues(new Uint8Array(24))).replace(/[^A-Za-z0-9]/g, "");
  }

  /* Comparación en tiempo constante para no filtrar cuánto coincide el hash */
  function iguales(a, b) {
    if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
    var r = 0;
    for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
  }

  function rolValido(rol) { return Object.prototype.hasOwnProperty.call(ROLES, rol); }

  function normalizarUsuario(texto) { return String(texto || "").trim().toLowerCase(); }

  /* ---------- Usuarios locales (solo mientras no haya servidor) ---------- */
  function leerUsuarios() {
    var lista = null;
    try { lista = JSON.parse(localStorage.getItem(CLAVE_USUARIOS)); } catch (e) { lista = null; }
    if (Array.isArray(lista)) {
      return lista.filter(function (u) {
        return u && PATRON_USUARIO.test(u.usuario) && rolValido(u.rol) &&
          typeof u.sal === "string" && typeof u.hash === "string";
      });
    }

    /* Migración: la versión anterior tenía una sola contraseña sin usuario.
       Se convierte en la cuenta "admin" con rol de soporte técnico para que
       nadie pierda el acceso a la gestión de usuarios. */
    var legado = null;
    try { legado = JSON.parse(localStorage.getItem(CLAVE_LEGADO)); } catch (e) { legado = null; }
    if (legado && legado.sal && legado.hash) {
      var migrados = [{ usuario: "admin", rol: "superusuario", sal: legado.sal, hash: legado.hash, alta: new Date().toISOString(), migrado: true }];
      if (guardarUsuarios(migrados)) localStorage.removeItem(CLAVE_LEGADO);
      return migrados;
    }
    return [];
  }

  function guardarUsuarios(lista) {
    try {
      localStorage.setItem(CLAVE_USUARIOS, JSON.stringify(lista));
      return true;
    } catch (e) {
      return false;
    }
  }

  function buscarUsuario(usuario) {
    usuario = normalizarUsuario(usuario);
    return leerUsuarios().filter(function (u) { return u.usuario === usuario; })[0] || null;
  }

  function contarRol(lista, rol) {
    return lista.filter(function (u) { return u.rol === rol; }).length;
  }

  /* Errores con código para que la vista decida el mensaje */
  function fallo(codigo) {
    var e = new Error(codigo);
    e.codigo = codigo;
    return Promise.reject(e);
  }

  function validarNuevo(usuario, contrasena, rol) {
    if (!PATRON_USUARIO.test(usuario)) return "usuario-invalido";
    if (typeof contrasena !== "string" || contrasena.length < 8) return "contrasena-corta";
    if (!rolValido(rol)) return "rol-invalido";
    return null;
  }

  function registrar(usuario, contrasena, rol) {
    usuario = normalizarUsuario(usuario);
    var problema = validarNuevo(usuario, contrasena, rol);
    if (problema) return fallo(problema);
    if (buscarUsuario(usuario)) return fallo("usuario-existe");
    var sal = crypto.getRandomValues(new Uint8Array(16));
    return derivar(contrasena, sal).then(function (hash) {
      var lista = leerUsuarios();
      lista.push({ usuario: usuario, rol: rol, sal: aB64(sal), hash: hash, alta: new Date().toISOString() });
      if (!guardarUsuarios(lista)) throw Object.assign(new Error("sin-espacio"), { codigo: "sin-espacio" });
      return { usuario: usuario, rol: rol };
    });
  }

  var proveedorLocal = {
    entrar: function (usuario, contrasena) {
      var u = buscarUsuario(usuario);
      if (!u) return Promise.resolve(null);
      return derivar(contrasena, deB64(u.sal)).then(function (hash) {
        return iguales(hash, u.hash) ? { token: "local-" + tokenAleatorio(), rol: u.rol, usuario: u.usuario } : null;
      });
    }
  };

  var proveedor = proveedorLocal;

  /* Permite conectar el backend sin tocar las vistas */
  function usarProveedor(nuevo) {
    if (nuevo && typeof nuevo.entrar === "function") proveedor = nuevo;
  }

  /* ---------- Sesión { token, rol, usuario } ---------- */
  function sesion() {
    var s = null;
    try { s = JSON.parse(sessionStorage.getItem(CLAVE_SESION)); } catch (e) { s = null; }
    if (!s || typeof s.token !== "string" || !s.token || !rolValido(s.rol)) return null;
    return s;
  }

  /* Recibe la respuesta del proveedor (local o servidor) y abre la sesión */
  function establecerSesion(respuesta) {
    if (!respuesta || typeof respuesta.token !== "string" || !respuesta.token || !rolValido(respuesta.rol)) return false;
    var s = {
      token: respuesta.token,
      rol: respuesta.rol,
      usuario: typeof respuesta.usuario === "string" ? respuesta.usuario : "",
      inicio: new Date().toISOString()
    };
    sessionStorage.setItem(CLAVE_SESION, JSON.stringify(s));
    return true;
  }

  function entrar(usuario, contrasena) {
    return Promise.resolve(proveedor.entrar(normalizarUsuario(usuario), contrasena)).then(function (r) {
      if (r && !r.usuario) r.usuario = normalizarUsuario(usuario);
      return establecerSesion(r) ? r.rol : null;
    });
  }

  /* Primera vez en este navegador: se crea la cuenta de soporte técnico */
  function configurarInicio(usuario, contrasena) {
    if (leerUsuarios().length) return fallo("ya-configurado");
    return registrar(usuario, contrasena, "superusuario").then(function (u) {
      establecerSesion({ token: "local-" + tokenAleatorio(), rol: u.rol, usuario: u.usuario });
      return u.rol;
    });
  }

  function activa() { return !!sesion(); }
  function rol() { var s = sesion(); return s ? s.rol : null; }
  function token() { var s = sesion(); return s ? s.token : null; }
  function usuarioActual() { var s = sesion(); return s ? s.usuario : null; }
  function puede(seccion) {
    var r = rol();
    var s = SECCIONES.filter(function (x) { return x.id === seccion; })[0];
    return !!(r && s && s.roles.indexOf(r) !== -1);
  }

  /* Devuelve false y redirige si no hay sesión o si el rol no alcanza.
     `roles` es opcional: requerir() o requerir(["superusuario"]) */
  function requerir(roles) {
    var r = rol();
    if (!r) { window.location.replace("index.html"); return false; }
    if (roles && roles.indexOf(r) === -1) { window.location.replace("dashboard.html"); return false; }
    return true;
  }

  function salir() {
    sessionStorage.removeItem(CLAVE_SESION);
    window.location.href = "index.html";
  }

  /* ---------- Gestión de usuarios (solo soporte técnico) ---------- */
  function soloSoporte() { return rol() === "superusuario"; }

  function listarUsuarios() {
    if (!soloSoporte()) return [];
    return leerUsuarios().map(function (u) {
      return { usuario: u.usuario, rol: u.rol, alta: u.alta || null, migrado: !!u.migrado };
    });
  }

  function crearUsuario(usuario, contrasena, rolNuevo) {
    if (!soloSoporte()) return fallo("sin-permiso");
    return registrar(usuario, contrasena, rolNuevo);
  }

  function cambiarContrasena(usuario, nueva) {
    if (!soloSoporte()) return fallo("sin-permiso");
    if (typeof nueva !== "string" || nueva.length < 8) return fallo("contrasena-corta");
    usuario = normalizarUsuario(usuario);
    var sal = crypto.getRandomValues(new Uint8Array(16));
    return derivar(nueva, sal).then(function (hash) {
      var lista = leerUsuarios();
      var u = lista.filter(function (x) { return x.usuario === usuario; })[0];
      if (!u) throw Object.assign(new Error("no-existe"), { codigo: "no-existe" });
      u.sal = aB64(sal);
      u.hash = hash;
      delete u.migrado;
      if (!guardarUsuarios(lista)) throw Object.assign(new Error("sin-espacio"), { codigo: "sin-espacio" });
      return true;
    });
  }

  function cambiarRol(usuario, rolNuevo) {
    if (!soloSoporte()) return fallo("sin-permiso");
    if (!rolValido(rolNuevo)) return fallo("rol-invalido");
    usuario = normalizarUsuario(usuario);
    var lista = leerUsuarios();
    var u = lista.filter(function (x) { return x.usuario === usuario; })[0];
    if (!u) return fallo("no-existe");
    if (u.usuario === usuarioActual()) return fallo("es-tu-cuenta");
    if (u.rol === "superusuario" && rolNuevo !== "superusuario" && contarRol(lista, "superusuario") <= 1) return fallo("ultimo-soporte");
    u.rol = rolNuevo;
    return guardarUsuarios(lista) ? Promise.resolve(true) : fallo("sin-espacio");
  }

  function eliminarUsuario(usuario) {
    if (!soloSoporte()) return fallo("sin-permiso");
    usuario = normalizarUsuario(usuario);
    var lista = leerUsuarios();
    var u = lista.filter(function (x) { return x.usuario === usuario; })[0];
    if (!u) return fallo("no-existe");
    if (u.usuario === usuarioActual()) return fallo("es-tu-cuenta");
    if (u.rol === "superusuario" && contarRol(lista, "superusuario") <= 1) return fallo("ultimo-soporte");
    return guardarUsuarios(lista.filter(function (x) { return x !== u; })) ? Promise.resolve(true) : fallo("sin-espacio");
  }

  /* ---------- Menú (barra superior en celular, lateral en escritorio) ---------- */
  var SVG = "http://www.w3.org/2000/svg";

  /* Iconos como datos (sin HTML): [etiqueta, atributos] */
  var ICONOS = {
    dashboard: [["path", { d: "M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z" }]],
    cotizaciones: [["path", { d: "M6 3h9l4 4v14H6z" }], ["path", { d: "M14 3v5h5M9 13h6M9 17h6" }]],
    reportes: [["path", { d: "M4 20V4M4 20h16M8 16v-5M13 16V8M18 16v-3" }]],
    productos: [["path", { d: "M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9" }]],
    soporte: [
      ["circle", { cx: "12", cy: "12", r: "9" }],
      ["circle", { cx: "12", cy: "12", r: "4" }],
      ["path", { d: "M5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6" }]
    ]
  };

  function icono(nombre) {
    var svg = document.createElementNS(SVG, "svg");
    var base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.8",
      "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" };
    Object.keys(base).forEach(function (k) { svg.setAttribute(k, base[k]); });
    (ICONOS[nombre] || []).forEach(function (parte) {
      var e = document.createElementNS(SVG, parte[0]);
      Object.keys(parte[1]).forEach(function (k) { e.setAttribute(k, parte[1][k]); });
      svg.appendChild(e);
    });
    return svg;
  }

  function pintarCabecera(activo) {
    var cab = document.getElementById("cabecera");
    var r = rol();
    cab.className = "admin-lateral";
    cab.textContent = "";
    document.body.classList.add("admin-app");

    /* Logo construido con nodos, sin innerHTML */
    var logo = document.createElement("a");
    logo.className = "logo";
    logo.href = "dashboard.html";
    var acento = document.createElement("span");
    acento.textContent = "Art";
    var sufijo = document.createElement("small");
    sufijo.textContent = "Admin";
    logo.appendChild(document.createTextNode("Loo"));
    logo.appendChild(acento);
    logo.appendChild(document.createTextNode(" "));
    logo.appendChild(sufijo);
    cab.appendChild(logo);

    var nav = document.createElement("nav");
    nav.setAttribute("aria-label", "Secciones del panel");
    var ul = document.createElement("ul");
    ul.className = "admin-nav";
    SECCIONES.forEach(function (s) {
      if (!r || s.roles.indexOf(r) === -1) return;
      var li = document.createElement("li");
      if (s.exclusiva) li.className = "admin-nav__exclusiva";
      var a = document.createElement("a");
      a.className = "chip" + (s.id === activo ? " chip--activo" : "");
      a.href = s.id + ".html";
      a.appendChild(icono(s.id));
      a.appendChild(document.createTextNode(s.nombre));
      if (s.id === activo) a.setAttribute("aria-current", "page");
      li.appendChild(a);
      ul.appendChild(li);
    });
    nav.appendChild(ul);
    cab.appendChild(nav);

    var acciones = document.createElement("div");
    acciones.className = "admin-acciones";

    var quien = document.createElement("p");
    quien.className = "admin-usuario";
    var nombre = document.createElement("strong");
    nombre.textContent = usuarioActual() || "";
    var etiquetaRol = document.createElement("span");
    etiquetaRol.textContent = r ? ROLES[r].nombre : "";
    quien.appendChild(nombre);
    quien.appendChild(etiquetaRol);

    var sitio = document.createElement("a");
    sitio.className = "chip";
    sitio.href = "../index.html";
    sitio.textContent = "Ver sitio";
    var boton = document.createElement("button");
    boton.className = "chip";
    boton.type = "button";
    boton.textContent = "Cerrar sesión";
    boton.addEventListener("click", salir);
    acciones.appendChild(quien);
    acciones.appendChild(sitio);
    acciones.appendChild(boton);
    cab.appendChild(acciones);
  }

  return {
    ROLES: ROLES,
    disponible: disponible,
    existe: function () { return leerUsuarios().length > 0; },
    configurarInicio: configurarInicio,
    entrar: entrar,
    usarProveedor: usarProveedor,
    establecerSesion: establecerSesion,
    activa: activa,
    rol: rol,
    token: token,
    usuario: usuarioActual,
    puede: puede,
    requerir: requerir,
    salir: salir,
    listarUsuarios: listarUsuarios,
    crearUsuario: crearUsuario,
    cambiarContrasena: cambiarContrasena,
    cambiarRol: cambiarRol,
    eliminarUsuario: eliminarUsuario,
    pintarCabecera: pintarCabecera
  };
})();
