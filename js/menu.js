/*
 * Menú compartido de las vistas del cliente.
 * Solo completa datos: contador de "Mi carrito" y nombre del cliente.
 * Cada vista sigue actualizando el contador con su propia lógica.
 */
(function () {
  var L = window.LooArt || {};
  var conteo = document.getElementById("conteo");
  if (conteo && L.carrito) conteo.textContent = L.carrito.contar();

  var usuario = document.getElementById("menu-usuario");
  if (!usuario || !L.cotizaciones) return;
  var cliente = L.cotizaciones.leerCliente() || {};
  var nombre = (cliente.nombre || "").trim();
  if (!nombre) return;
  var n = L.cotizaciones.leer().length;
  var fuerte = document.createElement("strong");
  fuerte.textContent = nombre;
  var detalle = document.createElement("span");
  detalle.textContent = n === 1 ? "1 cotización enviada" : n + " cotizaciones enviadas";
  usuario.appendChild(fuerte);
  usuario.appendChild(detalle);
})();
