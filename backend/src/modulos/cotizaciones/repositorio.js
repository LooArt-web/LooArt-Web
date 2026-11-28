/**
 * Consultas del alta y la consulta pública de cotizaciones.
 * Todas reciben la conexión de la transacción (`cx`) cuando escriben.
 */

/** Variantes cotizables: activas, de producto activo y categoría activa (RN-007, RN-008). */
export async function variantesCotizables(cx, ids) {
  const [filas] = await cx.query(
    `SELECT v.id_variante AS id, v.nombre, v.presentacion, v.material,
            v.cantidad_minima AS cantidadMinima, p.nombre AS producto
       FROM variantes v
       JOIN productos p ON p.id_producto = v.id_producto AND p.activo = 1
       JOIN categorias c ON c.id_categoria = p.id_categoria AND c.activa = 1
      WHERE v.id_variante IN (?) AND v.activa = 1`,
    [ids]
  );
  return filas;
}

export async function preciosActivos(cx, ids) {
  const [filas] = await cx.query(
    `SELECT id_variante AS idVariante, precio_unitario AS precio, cantidad_desde AS desde,
            cantidad_hasta AS hasta, DATE_FORMAT(vigente_desde, '%Y-%m-%d') AS vigenteDesde,
            DATE_FORMAT(vigente_hasta, '%Y-%m-%d') AS vigenteHasta
       FROM precios WHERE id_variante IN (?) AND activo = 1`,
    [ids]
  );
  return filas;
}

export async function tematicasActivas(cx, ids) {
  if (ids.length === 0) return [];
  const [filas] = await cx.query(
    "SELECT id_tematica AS id FROM tematicas WHERE id_tematica IN (?) AND activa = 1",
    [ids]
  );
  return filas.map((f) => f.id);
}

export async function insertarCliente(cx, c) {
  const [r] = await cx.query(
    "INSERT INTO clientes (nombre, telefono, email, codigo_postal) VALUES (?, ?, ?, ?)",
    [c.nombre, c.celular, c.correo, c.cp]
  );
  return r.insertId;
}

/**
 * Siguiente consecutivo del año sin carreras: el UPDATE bloquea la fila del año
 * hasta el COMMIT, y un ROLLBACK deshace el incremento (RN-020, A6).
 */
export async function siguienteConsecutivo(cx, anio) {
  await cx.query(
    `INSERT INTO folio_secuencia (anio, ultimo) VALUES (?, LAST_INSERT_ID(1))
     ON DUPLICATE KEY UPDATE ultimo = LAST_INSERT_ID(ultimo + 1)`,
    [anio]
  );
  const [[f]] = await cx.query("SELECT LAST_INSERT_ID() AS n");
  return Number(f.n);
}

export async function insertarCotizacion(cx, c) {
  const [r] = await cx.query(
    `INSERT INTO cotizaciones (id_cliente, id_estatus, folio, token_publico, fecha_emision,
                               fecha_vencimiento, subtotal, total)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      c.idCliente,
      c.idEstatus,
      c.folio,
      c.token,
      c.fechaEmision,
      c.fechaVencimiento,
      c.subtotal,
      c.total
    ]
  );
  return r.insertId;
}

export async function insertarDetalle(cx, d) {
  const [r] = await cx.query(
    `INSERT INTO detalle_cotizacion (id_cotizacion, id_variante, cantidad, precio_unitario_snapshot,
                                     es_precio_estimado, producto_snapshot, variante_snapshot)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
    [d.idCotizacion, d.idVariante, d.cantidad, d.precio, d.producto, d.variante]
  );
  return r.insertId;
}

export async function insertarPersonalizacion(cx, p) {
  const [r] = await cx.query(
    `INSERT INTO personalizaciones (id_detalle, id_tematica, tema, descripcion,
                                    texto_personalizado, color, diseno)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      p.idDetalle,
      p.idTematica ?? null,
      p.tema ?? null,
      p.descripcion ?? null,
      p.texto ?? null,
      p.color ?? null,
      p.diseno ? JSON.stringify(p.diseno) : null
    ]
  );
  return r.insertId;
}

export async function insertarArchivoReferencia(cx, a) {
  await cx.query(
    `INSERT INTO archivos_referencia (id_personalizacion, nombre_archivo, ruta, tipo_mime, tamano_bytes)
     VALUES (?, ?, ?, ?, ?)`,
    [a.idPersonalizacion, a.nombre, a.ruta, a.mime, a.tamano]
  );
}

export async function insertarHistorialInicial(cx, idCotizacion, idEstatus) {
  await cx.query(
    `INSERT INTO historial_estatus (id_cotizacion, id_usuario, id_estatus_anterior, id_estatus_nuevo,
                                    fecha_cambio, observacion)
     VALUES (?, NULL, NULL, ?, (SELECT fecha_emision FROM cotizaciones WHERE id_cotizacion = ?),
             'Creada por el comprador')`,
    [idCotizacion, idEstatus, idCotizacion]
  );
}

export async function estatusPorClave(cx, clave) {
  const [[f]] = await cx.query(
    "SELECT id_estatus AS id, clave, nombre FROM estatus_cotizacion WHERE clave = ?",
    [clave]
  );
  return f;
}

/** Consulta pública: solo por token (RN-021). */
export async function cotizacionPorToken(db, token) {
  const [[c]] = await db.query(
    `SELECT c.id_cotizacion AS id, c.folio, DATE_FORMAT(c.fecha_emision, '%Y-%m-%d %H:%i:%s') AS fechaEmision,
            DATE_FORMAT(c.fecha_vencimiento, '%Y-%m-%d') AS fechaVencimiento,
            c.subtotal, c.costo_entrega AS costoEntrega, c.total, c.moneda,
            e.clave AS estatusClave, e.nombre AS estatusNombre, cl.nombre AS nombreCliente,
            cl.telefono AS celularCliente, cl.email AS correoCliente, cl.codigo_postal AS cpCliente
       FROM cotizaciones c
       JOIN estatus_cotizacion e ON e.id_estatus = c.id_estatus
       JOIN clientes cl ON cl.id_cliente = c.id_cliente
      WHERE c.token_publico = ?`,
    [token]
  );
  if (!c) return null;
  const [renglones] = await db.query(
    `SELECT d.producto_snapshot AS producto, d.variante_snapshot AS variante, d.cantidad,
            d.precio_unitario_snapshot AS precioUnitario, d.subtotal,
            p.id_personalizacion AS idPers, p.color, t.nombre AS tematica, p.tema,
            p.texto_personalizado AS texto, p.descripcion, p.diseno,
            EXISTS (SELECT 1 FROM archivos_referencia a WHERE a.id_personalizacion = p.id_personalizacion) AS tieneImagen
       FROM detalle_cotizacion d
       LEFT JOIN personalizaciones p ON p.id_detalle = d.id_detalle
       LEFT JOIN tematicas t ON t.id_tematica = p.id_tematica
      WHERE d.id_cotizacion = ?
      ORDER BY d.id_detalle`,
    [c.id]
  );
  return { ...c, renglones };
}

/**
 * Datos mínimos para decidir si el PDF guardado sigue vigente. La huella cambia
 * con cualquier cosa que el PDF muestre y pueda cambiar (estatus, envío, total).
 */
export async function huellaPdf(db, token) {
  const [[f]] = await db.query(
    `SELECT id_cotizacion AS id, folio, YEAR(fecha_emision) AS anio, pdf_ruta AS pdfRuta,
            LEFT(SHA2(CONCAT_WS('|', actualizado_en, id_estatus, IFNULL(costo_entrega, ''), total), 256), 16) AS huella
       FROM cotizaciones
      WHERE token_publico = ?`,
    [token]
  );
  return f ?? null;
}

/**
 * Guarda la ruta del PDF sin tocar `actualizado_en`, para que la huella no cambie.
 * Solo si `pdf_ruta` sigue siendo la que se leyó: una petición lenta no puede
 * regresarla a una clave anterior. Devuelve si hubo cambio.
 */
export async function guardarPdfRuta(db, id, ruta, anterior) {
  const [r] = await db.query(
    `UPDATE cotizaciones SET pdf_ruta = ?, actualizado_en = actualizado_en
      WHERE id_cotizacion = ? AND pdf_ruta <=> ?`,
    [ruta, id, anterior]
  );
  return r.affectedRows === 1;
}
