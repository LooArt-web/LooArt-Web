/* Vista 1: Catálogo — búsqueda, filtro por categoría y contador de cotización */
(function () {
  var productos = window.LooArt.productos.filter(function (p) { return p.visible !== false; });
  var carrito = window.LooArt.carrito;

  var estado = { categoria: "Todos", texto: "" };

  var listaCategorias = document.getElementById("categorias");
  var listaProductos = document.getElementById("productos");
  var campoBusqueda = document.getElementById("buscar");
  var avisoResultado = document.getElementById("resultado");
  var bloqueVacio = document.getElementById("vacio");
  var textoVacio = document.getElementById("vacio-texto");
  var botonLimpiar = document.getElementById("limpiar");

  function normalizar(texto) {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }

  function piezas(n) {
    return n === 1 ? "1 pieza" : n + " piezas";
  }

  function crear(etiqueta, clase, texto) {
    var el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto) el.textContent = texto;
    return el;
  }

  /* Categorías */
  function pintarCategorias() {
    var nombres = ["Todos"];
    productos.forEach(function (p) {
      if (nombres.indexOf(p.categoria) === -1) nombres.push(p.categoria);
    });

    listaCategorias.textContent = "";
    nombres.forEach(function (nombre) {
      var li = document.createElement("li");
      var boton = crear("button", "chip", nombre);
      boton.type = "button";
      boton.setAttribute("aria-pressed", String(nombre === estado.categoria));
      boton.addEventListener("click", function () {
        estado.categoria = nombre;
        pintarCategorias();
        pintarProductos();
      });
      li.appendChild(boton);
      listaCategorias.appendChild(li);
    });
  }

  /* Productos */
  function filtrar() {
    var buscado = normalizar(estado.texto);
    return productos.filter(function (p) {
      var coincideCategoria = estado.categoria === "Todos" || p.categoria === estado.categoria;
      var coincideTexto = !buscado ||
        normalizar(p.nombre).indexOf(buscado) !== -1 ||
        normalizar(p.categoria).indexOf(buscado) !== -1;
      return coincideCategoria && coincideTexto;
    });
  }

  function crearTarjeta(p) {
    var li = document.createElement("li");
    var enlace = crear("a", "tarjeta");
    enlace.href = "producto.html?id=" + encodeURIComponent(p.id);

    var foto = crear("div", "tarjeta__foto");
    if (p.imagen) {
      var img = document.createElement("img");
      img.src = p.imagen;
      img.alt = p.nombre;
      img.loading = "lazy";
      foto.appendChild(img);
    } else {
      foto.textContent = "Foto próximamente";
    }

    enlace.appendChild(foto);
    enlace.appendChild(crear("h2", "tarjeta__nombre", p.nombre));
    enlace.appendChild(crear("p", "tarjeta__minimo", "Mínimo " + piezas(p.minimo)));
    enlace.appendChild(crear("span", "tarjeta__accion", "Personalizar"));
    li.appendChild(enlace);
    return li;
  }

  function pintarProductos() {
    var visibles = filtrar();

    listaProductos.textContent = "";
    visibles.forEach(function (p) { listaProductos.appendChild(crearTarjeta(p)); });

    var hayResultados = visibles.length > 0;
    listaProductos.hidden = !hayResultados;
    bloqueVacio.hidden = hayResultados;

    if (hayResultados) {
      avisoResultado.textContent = visibles.length === 1
        ? "1 producto encontrado"
        : visibles.length + " productos encontrados";
    } else {
      var texto = estado.texto.trim();
      textoVacio.textContent = texto
        ? "No encontramos productos para “" + texto + "”. Prueba con otra palabra o quita el filtro."
        : "No hay productos en esta categoría por ahora.";
      avisoResultado.textContent = "Sin resultados";
    }
  }

  /* Contador de cotización */
  function pintarCarrito() {
    var n = carrito.contar();
    document.getElementById("conteo").textContent = n;
    document.getElementById("barra-conteo").textContent = n === 1 ? "1 producto" : n + " productos";
    document.getElementById("barra").hidden = n === 0;
  }

  campoBusqueda.addEventListener("input", function () {
    estado.texto = campoBusqueda.value;
    pintarProductos();
  });

  botonLimpiar.addEventListener("click", function () {
    estado.texto = "";
    estado.categoria = "Todos";
    campoBusqueda.value = "";
    pintarCategorias();
    pintarProductos();
    campoBusqueda.focus();
  });

  pintarCategorias();
  pintarProductos();
  pintarCarrito();
})();
