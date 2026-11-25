/* Acceso del administrador: crear contraseña la primera vez, después iniciar sesión */
(function () {
  var admin = window.LooArt.admin;
  var DESTINO = "dashboard.html";

  function $(id) { return document.getElementById(id); }

  if (admin.activa()) {
    window.location.replace(DESTINO);
    return;
  }

  function error(texto) {
    var p = $("error-contrasena");
    p.textContent = texto;
    p.hidden = !texto;
    $("contrasena").setAttribute("aria-invalid", texto ? "true" : "false");
  }

  if (!admin.disponible()) {
    $("formulario").hidden = true;
    $("ayuda").textContent = "Este navegador no permite proteger el acceso en esta ubicación. Abre el sitio desde un servidor local o con https.";
    return;
  }

  var primeraVez = !admin.existe();

  if (primeraVez) {
    $("titulo").textContent = "Crea tu contraseña";
    $("ayuda").textContent = "Es la primera vez que entras. Elige una contraseña de al menos 8 caracteres; la necesitarás cada vez que abras el panel.";
    $("etiqueta-contrasena").textContent = "Nueva contraseña";
    $("contrasena").autocomplete = "new-password";
    $("g-repetir").hidden = false;
    $("enviar").textContent = "Crear contraseña y entrar";
  } else {
    $("ayuda").textContent = "Escribe tu contraseña para continuar.";
  }

  $("formulario").addEventListener("submit", function (e) {
    e.preventDefault();
    error("");
    var contrasena = $("contrasena").value;

    if (primeraVez) {
      if (contrasena.length < 8) { error("La contraseña debe tener al menos 8 caracteres."); $("contrasena").focus(); return; }
      if (contrasena !== $("repetir").value) { error("Las contraseñas no coinciden."); $("repetir").focus(); return; }
      admin.crearContrasena(contrasena).then(function () {
        window.location.href = DESTINO;
      });
      return;
    }

    if (!contrasena) { error("Escribe tu contraseña."); $("contrasena").focus(); return; }
    admin.entrar(contrasena).then(function (ok) {
      if (ok) { window.location.href = DESTINO; return; }
      error("La contraseña no es correcta.");
      $("contrasena").select();
    });
  });
})();
