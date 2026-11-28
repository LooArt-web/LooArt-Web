/*
 * Catálogo de productos.
 *
 * El cliente enviará la lista real de productos, categorías, variantes, fotos
 * y precios. Mientras tanto:
 *   - Solo Termo y Stickers son reales (mínimos confirmados en el cuestionario:
 *     termos 1 pza, stickers 10 pzas, resto 5 pzas).
 *   - Las presentaciones, los colores, las entradas con `pendiente: true` y
 *     TODOS LOS PRECIOS son de ejemplo (ver `config.preciosDeEjemplo`).
 *
 * Campos de cada producto:
 *   modelo  = maqueta de la vista previa si aún no hay foto: "termo", "taza",
 *             "sticker" o "caja".
 *   colores = [{ nombre, hex }]. El `hex` tiñe la vista previa.
 *   precio  = precio unitario normal (MXN).
 *   mayoreo = { desde, precio }: a partir de `desde` piezas aplica `precio`.
 *   imagen  = ruta o data URL de la foto real (si existe, reemplaza la maqueta).
 */
window.LooArt = window.LooArt || {};

window.LooArt.config = {
  preciosDeEjemplo: true,   /* pon false cuando el cliente entregue precios reales */
  vigenciaMeses: 1          /* vigencia de la cotización */
  /* El número de WhatsApp del negocio ya no vive aquí: lo pone el servidor
     (variable WHATSAPP_NEGOCIO) en el enlace de /api/cotizaciones/:token/mensaje-whatsapp. */
};

window.LooArt.productos = [
  {
    id: "termo", nombre: "Termo", categoria: "Termos", minimo: 1, imagen: null, modelo: "termo",
    precio: 180, mayoreo: { desde: 12, precio: 160 },
    presentaciones: ["[Presentación A]", "[Presentación B]"],
    colores: [
      { nombre: "Negro", hex: "#2A2733" },
      { nombre: "Blanco", hex: "#F4F1EC" },
      { nombre: "Rojo", hex: "#C0392B" },
      { nombre: "Azul", hex: "#2F5DA8" }
    ]
  },
  {
    id: "stickers", nombre: "Stickers", categoria: "Stickers", minimo: 10, imagen: null, modelo: "sticker",
    precio: 6, mayoreo: { desde: 50, precio: 4.5 },
    presentaciones: ["[Presentación A]", "[Presentación B]"],
    colores: []
  },
  {
    id: "producto-3", nombre: "Producto 3", categoria: "Tazas", minimo: 5, imagen: null, modelo: "taza", pendiente: true,
    precio: 120, mayoreo: { desde: 10, precio: 100 },
    presentaciones: ["[Presentación A]", "[Presentación B]"],
    colores: [
      { nombre: "Blanco", hex: "#F4F1EC" },
      { nombre: "Negro", hex: "#2A2733" },
      { nombre: "Verde", hex: "#2E7D5B" }
    ]
  },
  {
    id: "producto-4", nombre: "Producto 4", categoria: "Cajas", minimo: 5, imagen: null, modelo: "caja", pendiente: true,
    precio: 90, mayoreo: { desde: 10, precio: 75 },
    presentaciones: ["[Presentación A]", "[Presentación B]"],
    colores: [
      { nombre: "Blanco", hex: "#F4F1EC" },
      { nombre: "Amarillo", hex: "#E3B23C" }
    ]
  }
];

/*
 * Temáticas prediseñadas. Según el cliente, para este proyecto están
 * disponibles en todos los productos. "Otra (libre)" se agrega al final
 * desde la vista y permite escribir una temática propia.
 */
window.LooArt.tematicas = ["[Temática 1]", "[Temática 2]", "[Temática 3]"];

/*
 * Patrón de cada temática para la vista previa (se edita desde el panel,
 * sección Temáticas). Cada entrada es { motivo } con uno de los motivos
 * incluidos (puntos, estrellas, flores, rayas, cuadros, corazones, ondas)
 * o { imagen } con un patrón subido por el administrador.
 * Las temáticas sin entrada no pintan patrón: se muestran solo por su nombre.
 * Estos tres son de ejemplo, igual que las temáticas.
 */
window.LooArt.patronesTematica = {
  "[Temática 1]": { motivo: "puntos" },
  "[Temática 2]": { motivo: "estrellas" },
  "[Temática 3]": { motivo: "flores" }
};
