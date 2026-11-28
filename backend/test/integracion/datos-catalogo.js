/**
 * Datos [Prueba] para el catálogo. No son productos reales del cliente:
 * solo cubren cada caso (activo, inactivo, vencido, futuro...).
 */
export const HOY = "2026-11-27";
export const RELOJ = () => new Date("2026-11-27T18:00:00Z"); // 12:00 en CDMX

export async function sembrarCatalogo(pool) {
  const q = (sql, p) => pool.query(sql, p);
  await q(`INSERT INTO categorias (id_categoria, nombre, activa) VALUES
    (1, '[Prueba] Termos', 1), (2, '[Prueba] Stickers', 1), (3, '[Prueba] Oculta', 0)`);
  await q(`INSERT INTO productos (id_producto, id_categoria, nombre, descripcion, maqueta, recorte, activo) VALUES
    (10, 1, '[Prueba] Termo', 'Termo de prueba', 'termo', NULL, 1),
    (11, 1, '[Prueba] Termo retirado', NULL, 'termo', NULL, 0),
    (20, 2, '[Prueba] Pin', NULL, 'pin', JSON_OBJECT('borde', 6, 'cara', 'frente'), 1),
    (30, 3, '[Prueba] En categoría oculta', NULL, 'caja', NULL, 1)`);
  await q(`INSERT INTO variantes (id_variante, id_producto, nombre, presentacion, material, cantidad_minima, activa) VALUES
    (100, 10, '500 ml', '', 'Acero', 1, 1),
    (101, 10, '750 ml', '', 'Acero', 1, 0),
    (200, 20, 'Redondo', '', '', 10, 1)`);
  await q(
    `INSERT INTO precios (id_variante, precio_unitario, cantidad_desde, cantidad_hasta, vigente_desde, vigente_hasta, activo) VALUES
    (100, 180.00, 1, 11, '2026-01-01', NULL, 1),
    (100, 160.50, 12, NULL, '2026-01-01', ?, 1),
    (100, 999.00, 1, NULL, '2025-01-01', '2025-12-31', 1),
    (100, 888.00, 1, NULL, '2027-01-01', NULL, 1),
    (100, 777.00, 1, NULL, '2026-01-01', NULL, 0)`,
    [HOY]
  );
  await q(`INSERT INTO producto_color (id_producto, nombre, hex, orden, activo) VALUES
    (10, 'Negro', '#2A2733', 1, 1), (10, 'Blanco', '#F4F1EC', 2, 1), (10, 'Rojo', '#C0392B', 3, 0)`);
  await q(`INSERT INTO producto_archivo (id_producto, tipo, cara, ruta, nombre_original, tipo_mime, tamano_bytes, orden, texto_alternativo, activo) VALUES
    (10, 'IMAGEN', 'frente', 'productos/10/principal.webp', 'termo.webp', 'image/webp', 1000, 1, 'Termo negro', 1),
    (10, 'IMAGEN', 'frente', 'productos/10/lado.webp', 'lado.webp', 'image/webp', 1000, 2, NULL, 1),
    (10, 'IMAGEN', 'frente', 'productos/10/vieja.webp', 'vieja.webp', 'image/webp', 1000, 3, NULL, 0),
    (10, 'MODELO_3D', 'frente', 'productos/10/termo.glb', 'termo.glb', 'model/gltf-binary', 5000, 1, NULL, 1),
    (20, 'IMAGEN', 'reverso', 'productos/20/reverso.png', 'r.png', 'image/png', 1000, 2, NULL, 1)`);
  await q(`INSERT INTO tematicas (id_tematica, nombre, descripcion, imagen, motivo, activa) VALUES
    (1, '[Prueba] Estrellas', NULL, NULL, 'estrellas', 1),
    (2, '[Prueba] Con imagen', 'Patrón propio', 'tematicas/2/patron.png', NULL, 1),
    (3, '[Prueba] Retirada', NULL, NULL, 'puntos', 0)`);
}
