/*
 * Soporte técnico (solo rol superusuario):
 * usuarios del panel, almacenamiento del navegador y diagnóstico.
 * Todo el contenido se arma con nodos DOM y textContent (sin innerHTML).
 */
(function () {
  var L = window.LooArt;
  var admin = L.admin;

  if (!admin.requerir(["superusuario"])) return;
  admin.pintarCabecera("soporte");

  function $(id) { return document.getElementById(id); }

  function crear(etiqueta, clase, texto) {
    var el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined && texto !== null && texto !== "") el.textContent = texto;
    return el;
  }

  $("principal").hidden = false;

  var temporizadorAviso = null;
  function avisar(texto) {
    var a = $("aviso");
    a.textContent = texto;
    a.hidden = !texto;
    clearTimeout(temporizadorAviso);
    if (texto) temporizadorAviso = setTimeout(function () { a.hidden = true; }, 8000);
  }

  function fecha(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d)) return "—";
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  }

  var MENSAJES = {
    "usuario-invalido": "El usuario debe tener de 3 a 30 caracteres: letras sin acentos, números, punto, guion o guion bajo.",
    "usuario-existe": "Ya existe un usuario con ese nombre.",
    "contrasena-corta": "La contraseña debe tener al menos 8 caracteres.",
    "rol-invalido": "Elige un rol válido.",
    "es-tu-cuenta": "No puedes cambiar el rol ni eliminar la cuenta con la que iniciaste sesión.",
    "ultimo-soporte": "Debe quedar al menos una cuenta de soporte técnico.",
    "no-existe": "Ese usuario ya no existe. Actualiza la página.",
    "sin-espacio": "El navegador no tiene espacio para guardar el cambio. Libera espacio abajo e inténtalo de nuevo.",
    "sin-permiso": "Tu sesión no tiene permiso para esta acción. Vuelve a iniciar sesión."
  };
  function mensaje(err) { return MENSAJES[err && err.codigo] || "No pudimos completar la acción. Inténtalo de nuevo."; }

  /* =========================================================
   * Usuarios
   * ======================================================= */
  var editando = null;

  function celda(etiqueta, contenido) {
    var td = document.createElement("td");
    td.setAttribute("data-etiqueta", etiqueta);
    if (typeof contenido === "string") td.textContent = contenido; else td.appendChild(contenido);
    return td;
  }

  function pintarUsuarios() {
    var cuerpo = $("usuarios");
    cuerpo.textContent = "";
    var yo = admin.usuario();

    admin.listarUsuarios().forEach(function (u) {
      var tr = document.createElement("tr");

      var nombre = crear("span", "", u.usuario);
      if (u.usuario === yo) nombre.appendChild(crear("span", "etiqueta-chica", "Tu cuenta"));
      if (u.migrado) nombre.appendChild(crear("span", "etiqueta-chica", "Cambia su contraseña"));
      tr.appendChild(celda("Usuario", nombre));

      var selRol = document.createElement("select");
      selRol.setAttribute("aria-label", "Rol de " + u.usuario);
      Object.keys(admin.ROLES).forEach(function (id) {
        var op = crear("option", "", admin.ROLES[id].nombre);
        op.value = id;
        op.selected = id === u.rol;
        selRol.appendChild(op);
      });
      selRol.disabled = u.usuario === yo;
      selRol.addEventListener("change", function () {
        var nuevo = selRol.value;
        admin.cambiarRol(u.usuario, nuevo).then(function () {
          avisar("“" + u.usuario + "” ahora es " + admin.ROLES[nuevo].nombre + ".");
          pintarUsuarios();
          revisar();
        }, function (err) {
          avisar(mensaje(err));
          pintarUsuarios();
        });
      });
      tr.appendChild(celda("Rol", selRol));

      tr.appendChild(celda("Alta", fecha(u.alta)));

      var acciones = crear("div", "acciones acciones--fila");
      var cambiar = crear("button", "btn btn--secundario btn--chico", "Cambiar contraseña");
      cambiar.type = "button";
      cambiar.addEventListener("click", function () { abrirCambio(u.usuario); });
      acciones.appendChild(cambiar);

      if (u.usuario !== yo) {
        var eliminar = crear("button", "btn btn--peligro btn--chico", "Eliminar");
        eliminar.type = "button";
        eliminar.addEventListener("click", function () {
          if (!window.confirm("¿Eliminar al usuario “" + u.usuario + "”? Ya no podrá entrar al panel.")) return;
          admin.eliminarUsuario(u.usuario).then(function () {
            avisar("Se eliminó al usuario “" + u.usuario + "”.");
            pintarUsuarios();
            revisar();
          }, function (err) { avisar(mensaje(err)); });
        });
        acciones.appendChild(eliminar);
      }
      tr.appendChild(celda("Acciones", acciones));
      cuerpo.appendChild(tr);
    });
  }

  function errorEn(idError, texto, idCampo) {
    var p = $(idError);
    p.textContent = texto;
    p.hidden = !texto;
    if (idCampo) { $(idCampo).setAttribute("aria-invalid", "true"); $(idCampo).focus(); }
  }

  function limpiarInvalidos(ids) {
    ids.forEach(function (id) { $(id).removeAttribute("aria-invalid"); });
  }

  var CAMPO_DE_ERROR = {
    "usuario-invalido": "nuevo-usuario",
    "usuario-existe": "nuevo-usuario",
    "contrasena-corta": "nueva-contrasena",
    "rol-invalido": "nuevo-rol"
  };

  $("alta").addEventListener("submit", function (e) {
    e.preventDefault();
    limpiarInvalidos(["nuevo-usuario", "nueva-contrasena", "nueva-repetir", "nuevo-rol"]);
    errorEn("error-alta", "");
    var usuario = $("nuevo-usuario").value.trim().toLowerCase();
    var contrasena = $("nueva-contrasena").value;
    var rol = $("nuevo-rol").value;

    if (!usuario) { errorEn("error-alta", "Escribe el nombre de usuario.", "nuevo-usuario"); return; }
    if (contrasena.length < 8) { errorEn("error-alta", MENSAJES["contrasena-corta"], "nueva-contrasena"); return; }
    if (contrasena !== $("nueva-repetir").value) { errorEn("error-alta", "Las contraseñas no coinciden.", "nueva-repetir"); return; }

    $("agregar").disabled = true;
    admin.crearUsuario(usuario, contrasena, rol).then(function (u) {
      $("alta").reset();
      avisar("Se agregó a “" + u.usuario + "” como " + admin.ROLES[u.rol].nombre + ".");
      pintarUsuarios();
      revisar();
    }, function (err) {
      errorEn("error-alta", mensaje(err), CAMPO_DE_ERROR[err && err.codigo]);
    }).then(function () { $("agregar").disabled = false; });
  });

  var ventana = $("ventana-contrasena");

  function abrirCambio(usuario) {
    editando = usuario;
    $("form-contrasena").reset();
    errorEn("error-contrasena", "");
    limpiarInvalidos(["cambio-contrasena", "cambio-repetir"]);
    $("titulo-contrasena").textContent = "Cambiar contraseña de " + usuario;
    ventana.showModal();
    $("cambio-contrasena").focus();
  }

  $("cancelar-contrasena").addEventListener("click", function () { ventana.close(); });

  $("form-contrasena").addEventListener("submit", function (e) {
    e.preventDefault();
    limpiarInvalidos(["cambio-contrasena", "cambio-repetir"]);
    var nueva = $("cambio-contrasena").value;
    if (nueva.length < 8) { errorEn("error-contrasena", MENSAJES["contrasena-corta"], "cambio-contrasena"); return; }
    if (nueva !== $("cambio-repetir").value) { errorEn("error-contrasena", "Las contraseñas no coinciden.", "cambio-repetir"); return; }
    admin.cambiarContrasena(editando, nueva).then(function () {
      ventana.close();
      avisar("Se cambió la contraseña de “" + editando + "”.");
      pintarUsuarios();
    }, function (err) { errorEn("error-contrasena", mensaje(err)); });
  });

  /* =========================================================
   * Almacenamiento
   * ======================================================= */
  var LIMITE = 5 * 1024 * 1024; /* aproximado: la mayoría de navegadores da ~5 MB por sitio */
  var SESION = "looart.admin.sesion";

  /* Qué es cada dato y qué se puede hacer con él */
  var DATOS = {
    "looart.cotizacion": { nombre: "Cotización en curso (carrito)", accion: "Vaciar", confirmar: "¿Vaciar la cotización en curso de este navegador?" },
    "looart.cotizaciones": { nombre: "Cotizaciones generadas", accion: "Borrar", confirmar: "¿Borrar TODAS las cotizaciones guardadas en este navegador? No se puede deshacer." },
    "looart.cliente": { nombre: "Datos del cliente recordados", accion: "Borrar", confirmar: "¿Borrar los datos de contacto recordados del cliente?" },
    "looart.catalogo": { nombre: "Cambios al catálogo y temáticas", accion: "Restaurar ejemplo", confirmar: "¿Descartar los cambios al catálogo y volver a los productos de ejemplo?" },
    "looart.usuarios": { nombre: "Usuarios del panel", protegido: true }
  };

  function tamano(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1024 / 1024).toFixed(2) + " MB";
  }

  function clavesSitio() {
    var lista = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf("looart.") === 0) {
          var v = localStorage.getItem(k) || "";
          lista.push({ clave: k, bytes: (k.length + v.length) * 2 }); /* UTF-16 */
        }
      }
    } catch (e) { /* sin acceso a localStorage */ }
    return lista.sort(function (a, b) { return b.bytes - a.bytes; });
  }

  function usoTotal() {
    var total = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i) || "";
        total += (k.length + (localStorage.getItem(k) || "").length) * 2;
      }
    } catch (e) { /* sin acceso */ }
    return total;
  }

  function pintarAlmacen() {
    var total = usoTotal();
    var proporcion = Math.min(1, total / LIMITE);
    $("almacen-nota").textContent = "Usado: " + tamano(total) + " de unos 5 MB (" + Math.round(proporcion * 100) + "%).";

    var medidor = $("almacen-medidor");
    medidor.textContent = "";
    var pista = crear("div", "barra-h__pista");
    pista.setAttribute("role", "meter");
    pista.setAttribute("aria-label", "Espacio usado");
    pista.setAttribute("aria-valuemin", "0");
    pista.setAttribute("aria-valuemax", "100");
    pista.setAttribute("aria-valuenow", String(Math.round(proporcion * 100)));
    var relleno = crear("div", "barra-h__relleno" + (proporcion >= 0.9 ? " barra-h__relleno--alerta" : ""));
    relleno.style.width = Math.max(proporcion * 100, total ? 2 : 0) + "%";
    pista.appendChild(relleno);
    medidor.appendChild(pista);

    var lista = $("almacen");
    lista.textContent = "";
    var claves = clavesSitio();
    if (!claves.length) lista.appendChild(crear("li", "almacen__vacio", "No hay datos de LooArt guardados en este navegador."));

    claves.forEach(function (c) {
      var info = DATOS[c.clave] || { nombre: "Otro dato", accion: "Borrar", confirmar: "¿Borrar el dato “" + c.clave + "”?" };
      var li = crear("li", "almacen__fila");
      var texto = crear("div", "almacen__texto");
      texto.appendChild(crear("strong", "", info.nombre));
      texto.appendChild(crear("span", "", c.clave + " · " + tamano(c.bytes)));
      li.appendChild(texto);

      if (!info.protegido) {
        var b = crear("button", "btn btn--secundario btn--chico", info.accion);
        b.type = "button";
        b.setAttribute("aria-label", info.accion + ": " + info.nombre);
        b.addEventListener("click", function () {
          if (!window.confirm(info.confirmar)) return;
          try { localStorage.removeItem(c.clave); } catch (e) { /* sin acceso */ }
          avisar("Listo: " + info.nombre.toLowerCase() + " (" + info.accion.toLowerCase() + ").");
          pintarAlmacen();
          revisar();
        });
        li.appendChild(b);
      } else {
        li.appendChild(crear("span", "ayuda", "Se gestiona arriba"));
      }
      lista.appendChild(li);
    });
  }

  $("limpiar-cache").addEventListener("click", function () {
    var tareas = [];
    if (window.caches && caches.keys) {
      tareas.push(caches.keys().then(function (nombres) {
        return Promise.all(nombres.map(function (n) { return caches.delete(n); })).then(function () { return nombres.length; });
      }));
    } else {
      tareas.push(Promise.resolve(0));
    }
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      tareas.push(navigator.serviceWorker.getRegistrations().then(function (regs) {
        return Promise.all(regs.map(function (r) { return r.unregister(); })).then(function () { return regs.length; });
      }));
    } else {
      tareas.push(Promise.resolve(0));
    }
    /* Datos temporales de la pestaña, excepto la sesión abierta */
    try {
      Object.keys(sessionStorage).forEach(function (k) { if (k !== SESION) sessionStorage.removeItem(k); });
    } catch (e) { /* sin acceso */ }

    Promise.all(tareas).then(function (r) {
      avisar("Caché limpia: " + r[0] + " almacenes de caché y " + r[1] + " service workers eliminados. Recarga las páginas abiertas del sitio para ver los archivos más recientes.");
      revisar();
    }, function () {
      avisar("El navegador no permitió limpiar la caché desde aquí. Usa “Borrar datos de navegación” en la configuración del navegador.");
    });
  });

  $("borrar-todo").addEventListener("click", function () {
    if (!window.confirm("¿Borrar todos los datos del sitio en este navegador? Se eliminan carrito, cotizaciones, datos de cliente y cambios al catálogo. Los usuarios del panel se conservan. No se puede deshacer.")) return;
    clavesSitio().forEach(function (c) {
      if (DATOS[c.clave] && DATOS[c.clave].protegido) return;
      try { localStorage.removeItem(c.clave); } catch (e) { /* sin acceso */ }
    });
    avisar("Se borraron los datos del sitio. Los usuarios del panel se conservaron.");
    pintarAlmacen();
    revisar();
  });

  /* =========================================================
   * Diagnóstico
   * ======================================================= */
  var ESTADOS = {
    ok: { texto: "Correcto", clase: "insignia--aceptada" },
    revisar: { texto: "Revisar", clase: "insignia--pendiente" },
    error: { texto: "Error", clase: "insignia--cancelada" },
    info: { texto: "Información", clase: "insignia--atendida" }
  };
  var ultimo = [];

  function leerJSON(clave) {
    var crudo = localStorage.getItem(clave);
    if (crudo === null) return { existe: false };
    try { return { existe: true, valor: JSON.parse(crudo) }; } catch (e) { return { existe: true, danado: true }; }
  }

  function comprobaciones() {
    var r = [];
    var protocolo = window.location.protocol;
    r.push(protocolo === "file:"
      ? ["revisar", "Forma de abrir el sitio", "Abierto como archivo. Usa un servidor local (Live Server o python -m http.server) para que el carrito pase entre páginas."]
      : ["ok", "Forma de abrir el sitio", "Servido por " + protocolo.replace(":", "") + " desde " + window.location.host + "."]);

    r.push(window.crypto && window.crypto.subtle
      ? ["ok", "Cifrado de contraseñas", "Disponible (PBKDF2 con SHA-256)."]
      : ["error", "Cifrado de contraseñas", "No disponible. Abre el sitio con https o desde localhost."]);

    var escribe = false;
    try { localStorage.setItem("looart.diagnostico", "1"); localStorage.removeItem("looart.diagnostico"); escribe = true; } catch (e) { escribe = false; }
    r.push(escribe
      ? ["ok", "Almacenamiento local", "Se puede leer y escribir."]
      : ["error", "Almacenamiento local", "No se puede escribir. Puede estar lleno o bloqueado (modo privado)."]);

    var proporcion = usoTotal() / LIMITE;
    r.push([proporcion >= 0.9 ? "error" : proporcion >= 0.7 ? "revisar" : "ok", "Espacio usado",
      Math.round(proporcion * 100) + "% de unos 5 MB." + (proporcion >= 0.7 ? " Borra cotizaciones antiguas o fotos pesadas." : "")]);

    var danados = clavesSitio().filter(function (c) { return c.clave !== SESION && leerJSON(c.clave).danado; });
    r.push(danados.length
      ? ["error", "Datos dañados", danados.map(function (c) { return c.clave; }).join(", ") + ". Bórralos en Almacenamiento."]
      : ["ok", "Datos guardados", "Todos los datos del sitio se leen correctamente."]);

    var productos = Array.isArray(L.productos) ? L.productos : [];
    var visibles = productos.filter(function (p) { return p.visible !== false; }).length;
    r.push([visibles ? "ok" : "error", "Catálogo",
      productos.length + " productos (" + visibles + " visibles, " + (productos.length - visibles) + " ocultos)" +
      (L.catalogo && L.catalogo.personalizado ? ", con cambios del administrador." : ", datos de ejemplo.")]);

    r.push(L.config && L.config.preciosDeEjemplo
      ? ["revisar", "Precios", "Se están usando precios de ejemplo (config.preciosDeEjemplo = true)."]
      : ["ok", "Precios", "Precios reales activos."]);

    var cot = leerJSON("looart.cotizaciones");
    var lista = Array.isArray(cot.valor) ? cot.valor : [];
    var masAntigua = lista.reduce(function (min, c) { return c && c.emision && (!min || c.emision < min) ? c.emision : min; }, null);
    r.push(["info", "Cotizaciones", lista.length + " guardadas en este navegador" + (masAntigua ? "; la más antigua es del " + fecha(masAntigua) + "." : ".")]);

    var usuarios = admin.listarUsuarios();
    var soporte = usuarios.filter(function (u) { return u.rol === "superusuario"; }).length;
    var migrados = usuarios.filter(function (u) { return u.migrado; }).length;
    r.push([migrados ? "revisar" : "ok", "Usuarios del panel",
      plural(usuarios.length - soporte, "administrador", "administradores") + " y " + soporte + " de soporte técnico." +
      (migrados ? " Hay una cuenta migrada de la versión anterior: cámbiale la contraseña." : "")]);

    r.push(["info", "Servidor", "Sin servidor: sesión y datos viven solo en este navegador."]);
    r.push([navigator.onLine ? "ok" : "revisar", "Conexión", navigator.onLine ? "En línea." : "Sin conexión: WhatsApp y las fuentes no cargarán."]);
    r.push(["info", "Navegador", navigator.userAgent]);
    return r;
  }

  function plural(n, uno, varios) { return n + " " + (n === 1 ? uno : varios); }

  function revisar() {
    ultimo = comprobaciones();
    var ul = $("diagnostico");
    ul.textContent = "";
    ultimo.forEach(function (c) {
      var est = ESTADOS[c[0]];
      var li = crear("li", "diagnostico__fila");
      li.appendChild(crear("span", "insignia " + est.clase, est.texto));
      var t = crear("div", "diagnostico__texto");
      t.appendChild(crear("strong", "", c[1]));
      t.appendChild(crear("span", "", c[2]));
      li.appendChild(t);
      ul.appendChild(li);
    });
    var problemas = ultimo.filter(function (c) { return c[0] === "error" || c[0] === "revisar"; }).length;
    $("diagnostico-nota").textContent = (problemas ? problemas + (problemas === 1 ? " punto por revisar" : " puntos por revisar") : "Todo en orden") +
      ". Revisado a las " + new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  }

  $("revisar").addEventListener("click", function () { pintarAlmacen(); revisar(); avisar("Diagnóstico actualizado."); });

  $("copiar").addEventListener("click", function () {
    var texto = "Diagnóstico LooArt-Web · " + new Date().toLocaleString("es-MX") + "\n" +
      ultimo.map(function (c) { return "[" + ESTADOS[c[0]].texto + "] " + c[1] + ": " + c[2]; }).join("\n");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(function () { avisar("Diagnóstico copiado."); },
        function () { avisar("No se pudo copiar automáticamente. Selecciona el texto y cópialo a mano."); });
    } else {
      avisar("Este navegador no permite copiar automáticamente.");
    }
  });

  pintarUsuarios();
  pintarAlmacen();
  revisar();
})();
