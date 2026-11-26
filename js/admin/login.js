/*
 * Acceso al panel con usuario y contraseña.
 * - Primera vez en este navegador (sin usuarios): se crea la cuenta de soporte
 *   técnico (superusuario). Desde su sección "Soporte técnico" se dan de alta
 *   los administradores.
 * - Después: cada persona entra con su usuario; el rol sale de su cuenta.
 */
(function () {
  var admin = window.LooArt.admin;
  var DESTINO = "dashboard.html";

  function $(id) { return document.getElementById(id); }

  if (admin.activa()) {
    window.location.replace(DESTINO);
    return;
  }

  function error(texto, campo) {
    var p = $("error-acceso");
    p.textContent = texto;
    p.hidden = !texto;
    ["usuario", "contrasena", "repetir"].forEach(function (id) {
      $(id).setAttribute("aria-invalid", texto && (!campo || campo === id) ? "true" : "false");
    });
    if (campo) $(campo).focus();
  }

  if (!admin.disponible()) {
    $("formulario").hidden = true;
    $("ayuda").textContent = "Este navegador no permite proteger el acceso en esta ubicación. Abre el sitio desde un servidor local o con https.";
    return;
  }

  var primeraVez = !admin.existe();

  if (primeraVez) {
    $("titulo").textContent = "Configura el acceso";
    $("ayuda").textContent = "Es la primera vez que se abre el panel en este navegador. Crea la cuenta de soporte técnico; desde ella podrás dar de alta a los administradores.";
    $("contrasena").autocomplete = "new-password";
    $("etiqueta-contrasena").textContent = "Contraseña (mínimo 8 caracteres)";
    $("g-repetir").hidden = false;
    $("enviar").textContent = "Crear cuenta y entrar";
  } else {
    $("ayuda").textContent = "Escribe tu usuario y contraseña.";
  }

  var MENSAJES = {
    "usuario-invalido": ["El usuario debe tener de 3 a 30 caracteres: letras sin acentos, números, punto, guion o guion bajo.", "usuario"],
    "contrasena-corta": ["La contraseña debe tener al menos 8 caracteres.", "contrasena"],
    "sin-espacio": ["El navegador no tiene espacio para guardar la cuenta. Libera espacio e inténtalo de nuevo.", null],
    "ya-configurado": ["Ya existe una cuenta en este navegador. Recarga la página para iniciar sesión.", null]
  };

  var ocupado = false;

  $("formulario").addEventListener("submit", function (e) {
    e.preventDefault();
    if (ocupado) return;
    error("");
    var usuario = $("usuario").value.trim().toLowerCase();
    var contrasena = $("contrasena").value;

    if (!usuario) { error("Escribe tu usuario.", "usuario"); return; }
    if (!contrasena) { error("Escribe tu contraseña.", "contrasena"); return; }

    if (primeraVez && contrasena !== $("repetir").value) {
      error("Las contraseñas no coinciden.", "repetir");
      return;
    }

    ocupado = true;
    $("enviar").disabled = true;
    var accion = primeraVez ? admin.configurarInicio(usuario, contrasena) : admin.entrar(usuario, contrasena);

    accion.then(function (rol) {
      if (rol) { window.location.href = DESTINO; return; }
      error("El usuario o la contraseña no son correctos.", "contrasena");
      $("contrasena").select();
    }, function (err) {
      var m = MENSAJES[err && err.codigo] || ["No pudimos completar el acceso. Inténtalo de nuevo.", null];
      error(m[0], m[1]);
    }).then(function () {
      ocupado = false;
      $("enviar").disabled = false;
    });
  });
})();
