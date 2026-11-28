-- =====================================================================
--  Pruebas de restricciones · looart1 · migración V002 (PROPUESTO)
--  Ejecutar DESPUÉS de V001 y V002, con --force para que siga tras cada error:
--     mysql -u root -p --force looart1 < tests/V002__pruebas_restricciones.sql
--  Total esperado: 8 errores
--  (3819 = CHECK, 1062 = duplicado, 1452 = llave foránea).
--  Las marcadas "DEBE PASAR" no muestran error. Al final todo se revierte.
-- =====================================================================
USE looart1;
START TRANSACTION;

-- Datos válidos de base -------------------------------------------------- DEBE PASAR
INSERT INTO categorias (id_categoria, nombre) VALUES (920, 'Prueba V002');
INSERT INTO productos (id_producto, id_categoria, nombre, maqueta, recorte)
  VALUES (920, 920, 'Pin prueba', 'pin', JSON_OBJECT('borde', 6, 'cara', 'frente'));
INSERT INTO producto_color (id_producto, nombre, hex) VALUES (920, 'Negro', '#2A2733');
INSERT INTO producto_archivo (id_producto, tipo, cara, ruta, nombre_original, tipo_mime, tamano_bytes, orden)
  VALUES (920, 'IMAGEN', 'reverso', 'productos/920/r.webp', 'reverso.webp', 'image/webp', 1000, 2);
INSERT INTO tematicas (id_tematica, nombre, motivo) VALUES (920, 'Prueba motivo', 'estrellas');
INSERT INTO productos (id_producto, id_categoria, nombre) VALUES (921, 920, 'Sin maqueta');
SELECT maqueta AS 'DEBE SER caja (valor por omisión)' FROM productos WHERE id_producto = 921;
INSERT INTO variantes (id_variante, id_producto, nombre) VALUES (920, 921, 'Única');
INSERT INTO clientes (id_cliente, nombre, telefono, email, codigo_postal) VALUES (920, 'Cliente Ficticio', '5500000000', 'ficticio@ejemplo.com', '01000');
INSERT INTO cotizaciones (id_cotizacion, id_cliente, folio, token_publico, fecha_vencimiento, subtotal, total)
  VALUES (920, 920, 'LA-2026-000920', REPEAT('c', 32), CURDATE() + INTERVAL 1 MONTH, 10.00, 10.00);
INSERT INTO detalle_cotizacion (id_detalle, id_cotizacion, id_variante, cantidad, precio_unitario_snapshot, producto_snapshot, variante_snapshot)
  VALUES (920, 920, 920, 1, 10.00, 'Sin maqueta', 'Única');
INSERT INTO personalizaciones (id_detalle, color, diseno)
  VALUES (920, 'Negro', JSON_OBJECT('modo', 'centro', 'tamano', 0.5, 'cara', 'frente'));

-- Catálogo visual ---------------------------------------------------------- DEBE FALLAR
UPDATE productos SET maqueta = 'playera' WHERE id_producto = 920;                         -- 3819 maqueta desconocida
UPDATE productos SET recorte = JSON_ARRAY(1, 2) WHERE id_producto = 920;                  -- 3819 recorte no es objeto
INSERT INTO producto_color (id_producto, nombre, hex) VALUES (920, 'Rojo', 'C0392B');     -- 3819 hex sin #
INSERT INTO producto_color (id_producto, nombre, hex) VALUES (920, 'Negro', '#000000');   -- 1062 color repetido en el producto
INSERT INTO producto_color (id_producto, nombre, hex) VALUES (99999, 'Azul', '#2F5DA8');  -- 1452 producto inexistente
INSERT INTO producto_archivo (id_producto, tipo, cara, ruta, nombre_original, tipo_mime, tamano_bytes, orden)
  VALUES (920, 'MODELO_3D', 'reverso', 'productos/920/m.glb', 'm.glb', 'model/gltf-binary', 1000, 1); -- 3819 un modelo 3D no tiene reverso
UPDATE tematicas SET motivo = 'calaveras' WHERE id_tematica = 920;                        -- 3819 motivo desconocido

-- Personalización ---------------------------------------------------------- DEBE FALLAR
UPDATE personalizaciones SET diseno = JSON_ARRAY('centro') WHERE id_detalle = 920;        -- 3819 diseño no es objeto

-- Borrado en cascada de los colores --------------------------------------- DEBE PASAR
DELETE FROM productos WHERE id_producto = 920;
SELECT COUNT(*) AS 'DEBE SER 0' FROM producto_color WHERE id_producto = 920;

ROLLBACK;   -- no deja rastro de las pruebas
