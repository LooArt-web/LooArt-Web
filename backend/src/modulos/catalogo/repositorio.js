/**
 * Consultas del catálogo público. Siempre parametrizadas; solo lo activo.
 * Devuelven filas tal como salen de MySQL (DECIMAL y DATE como texto).
 */

export async function categoriasActivas(db) {
  const [filas] = await db.query(
    `SELECT id_categoria AS id, nombre, descripcion
       FROM categorias WHERE activa = 1 ORDER BY nombre`
  );
  return filas;
}

const SELECT_PRODUCTO = `
  SELECT p.id_producto AS id, p.nombre, p.descripcion, p.maqueta, p.recorte,
         c.id_categoria AS idCategoria, c.nombre AS nombreCategoria,
         a.ruta AS rutaPrincipal, a.texto_alternativo AS altPrincipal
    FROM productos p
    JOIN categorias c ON c.id_categoria = p.id_categoria AND c.activa = 1
    LEFT JOIN producto_archivo a
           ON a.id_producto = p.id_producto AND a.tipo = 'IMAGEN' AND a.cara = 'frente'
          AND a.orden = 1 AND a.activo = 1
   WHERE p.activo = 1`;

export async function productosActivos(db, { categoria } = {}) {
  const [filas] = categoria
    ? await db.query(`${SELECT_PRODUCTO} AND p.id_categoria = ? ORDER BY p.nombre`, [categoria])
    : await db.query(`${SELECT_PRODUCTO} ORDER BY p.nombre`);
  return filas;
}

export async function productoActivo(db, idProducto) {
  const [[fila]] = await db.query(`${SELECT_PRODUCTO} AND p.id_producto = ?`, [idProducto]);
  return fila ?? null;
}

export async function variantesActivas(db, idProducto) {
  const [filas] = await db.query(
    `SELECT id_variante AS id, nombre, presentacion, material, cantidad_minima AS cantidadMinima
       FROM variantes WHERE id_producto = ? AND activa = 1
      ORDER BY nombre, presentacion, material`,
    [idProducto]
  );
  return filas;
}

export async function preciosDeVariantes(db, idsVariantes) {
  if (idsVariantes.length === 0) return [];
  const [filas] = await db.query(
    `SELECT id_variante AS idVariante, precio_unitario AS precio, cantidad_desde AS desde,
            cantidad_hasta AS hasta, DATE_FORMAT(vigente_desde, '%Y-%m-%d') AS vigenteDesde,
            DATE_FORMAT(vigente_hasta, '%Y-%m-%d') AS vigenteHasta, activo
       FROM precios WHERE id_variante IN (?) AND activo = 1`,
    [idsVariantes]
  );
  return filas;
}

export async function coloresActivos(db, idProducto) {
  const [filas] = await db.query(
    `SELECT nombre, hex FROM producto_color
      WHERE id_producto = ? AND activo = 1 ORDER BY orden, nombre`,
    [idProducto]
  );
  return filas;
}

export async function galeriaActiva(db, idProducto) {
  const [filas] = await db.query(
    `SELECT tipo, cara, orden, ruta, tipo_mime AS tipoMime, texto_alternativo AS textoAlternativo
       FROM producto_archivo WHERE id_producto = ? AND activo = 1
      ORDER BY tipo, cara, orden`,
    [idProducto]
  );
  return filas;
}

export async function tematicasActivas(db) {
  const [filas] = await db.query(
    `SELECT id_tematica AS id, nombre, descripcion, imagen, motivo
       FROM tematicas WHERE activa = 1 ORDER BY nombre`
  );
  return filas;
}
