-- =====================================================================
--  Pruebas de restricciones · looart1 · migración V001
--  Ejecutar DESPUÉS de migrations/V001__esquema_inicial.sql, con --force para que siga tras cada error:
--     mysql -u root -p --force -e "source tests/V001__pruebas_restricciones.sql" looart1
--  En MySQL Workbench: activar Query > "Continue on SQL Script Error".
--  Total esperado: 22 errores
--  Resultado esperado: cada línea marcada "DEBE FALLAR" muestra un ERROR
--  (3819 = CHECK, 1062 = duplicado, 1451/1452 = llave foránea, 1048 = nulo).
--  Las marcadas "DEBE PASAR" no muestran error. Al final todo se revierte.
-- =====================================================================
USE looart1;
START TRANSACTION;

-- Datos válidos de base -------------------------------------------------- DEBE PASAR
INSERT INTO categorias (id_categoria, nombre) VALUES (900, 'Prueba termos');
INSERT INTO productos (id_producto, id_categoria, nombre) VALUES (900, 900, 'Termo prueba');
INSERT INTO variantes (id_variante, id_producto, nombre, material, cantidad_minima) VALUES (900, 900, '500 ml', 'Acero', 1);
INSERT INTO precios (id_variante, precio_unitario, cantidad_desde, cantidad_hasta, vigente_desde) VALUES (900, 150.00, 1, 49, '2026-01-01');
INSERT INTO clientes (id_cliente, nombre, telefono, email, codigo_postal) VALUES (900, 'Cliente Ficticio', '5215500000000', 'ficticio@ejemplo.com', '01000');
INSERT INTO cotizaciones (id_cotizacion, id_cliente, folio, token_publico, fecha_vencimiento, subtotal, total)
  VALUES (900, 900, 'LA-2026-000900', REPEAT('a', 32), CURDATE() + INTERVAL 1 MONTH, 300.00, 300.00);
INSERT INTO detalle_cotizacion (id_detalle, id_cotizacion, id_variante, cantidad, precio_unitario_snapshot, producto_snapshot, variante_snapshot)
  VALUES (900, 900, 900, 2, 150.00, 'Termo prueba', '500 ml · Acero');
SELECT subtotal AS 'DEBE SER 300.00' FROM detalle_cotizacion WHERE id_detalle = 900;

-- Catálogo ---------------------------------------------------------------- DEBE FALLAR
INSERT INTO categorias (nombre) VALUES ('Prueba termos');                                         -- 1062 nombre repetido
INSERT INTO productos (id_categoria, nombre) VALUES (900, 'Termo prueba');                        -- 1062 producto repetido en la categoría
INSERT INTO variantes (id_producto, nombre, material) VALUES (900, '500 ml', 'Acero');            -- 1062 combinación repetida
INSERT INTO variantes (id_producto, nombre, cantidad_minima) VALUES (900, 'Cero', 0);             -- 3819 mínimo < 1
INSERT INTO precios (id_variante, precio_unitario, vigente_desde) VALUES (900, -1, '2026-01-01'); -- 3819 precio negativo
INSERT INTO precios (id_variante, precio_unitario, cantidad_desde, cantidad_hasta, vigente_desde) VALUES (900, 10, 50, 20, '2026-01-01'); -- 3819 rango invertido
INSERT INTO precios (id_variante, precio_unitario, vigente_desde, vigente_hasta) VALUES (900, 10, '2026-06-01', '2026-01-01');            -- 3819 vigencia invertida
DELETE FROM variantes WHERE id_variante = 900;                                                    -- 1451 está en una cotización (RESTRICT)

-- Clientes y cotizaciones ------------------------------------------------- DEBE FALLAR
INSERT INTO clientes (nombre, telefono, email, codigo_postal) VALUES ('X', '1', 'x@x.com', '1234A');                 -- 3819 CP inválido
INSERT INTO cotizaciones (id_cliente, folio, token_publico, fecha_vencimiento, subtotal, total)
  VALUES (900, 'LA-2026-000900', REPEAT('b', 32), CURDATE() + INTERVAL 1 MONTH, 0, 0);                                -- 1062 folio repetido
INSERT INTO cotizaciones (id_cliente, folio, token_publico, fecha_vencimiento, subtotal, total)
  VALUES (900, 'LA-2026-000901', REPEAT('c', 32), CURDATE() - INTERVAL 1 DAY, 0, 0);                                  -- 3819 vence antes de emitirse
INSERT INTO cotizaciones (id_cliente, folio, token_publico, fecha_vencimiento, subtotal, costo_entrega, total)
  VALUES (900, 'LA-2026-000902', REPEAT('d', 32), CURDATE() + INTERVAL 1 MONTH, 100, 50, 120);                         -- 3819 total ≠ subtotal + entrega
INSERT INTO cotizaciones (id_cliente, folio, token_publico, fecha_vencimiento, subtotal, total, moneda)
  VALUES (900, 'LA-2026-000903', REPEAT('e', 32), CURDATE() + INTERVAL 1 MONTH, 0, 0, 'USD');                          -- 3819 moneda distinta de MXN
INSERT INTO cotizaciones (id_cliente, id_estatus, folio, token_publico, fecha_vencimiento)
  VALUES (900, 99, 'LA-2026-000904', REPEAT('f', 32), CURDATE() + INTERVAL 1 MONTH);                                  -- 1452 estatus inexistente
INSERT INTO detalle_cotizacion (id_cotizacion, id_variante, cantidad, precio_unitario_snapshot, producto_snapshot, variante_snapshot)
  VALUES (900, 900, 0, 150, 'x', 'x');                                                                                -- 3819 cantidad 0

-- Personalización y archivos ---------------------------------------------- DEBE FALLAR (salvo la primera)
INSERT INTO personalizaciones (id_personalizacion, id_detalle, tema) VALUES (900, 900, 'Cumpleaños');                -- DEBE PASAR
INSERT INTO personalizaciones (id_detalle, tema) VALUES (900, 'Otra');                                                -- 1062 segunda personalización del mismo renglón
INSERT INTO archivos_referencia (id_personalizacion, nombre_archivo, ruta, tipo_mime, tamano_bytes)
  VALUES (900, 'virus.exe', 'r/1', 'application/x-msdownload', 100);                                                  -- 3819 tipo no permitido
INSERT INTO archivos_referencia (id_personalizacion, nombre_archivo, ruta, tipo_mime, tamano_bytes)
  VALUES (900, 'grande.png', 'r/2', 'image/png', 6000000);                                                            -- 3819 más de 5 MB

-- Archivos de producto (imágenes y modelos 3D) ----------------------------- DEBE FALLAR (salvo la primera)
INSERT INTO producto_archivo (id_producto, tipo, ruta, nombre_original, tipo_mime, tamano_bytes, orden)
  VALUES (900, 'IMAGEN', 'productos/900/a.webp', 'termo.webp', 'image/webp', 200000, 1);                          -- DEBE PASAR
INSERT INTO producto_archivo (id_producto, tipo, ruta, nombre_original, tipo_mime, tamano_bytes, orden)
  VALUES (900, 'IMAGEN', 'productos/900/b.webp', 'otra.webp', 'image/webp', 200000, 1);                           -- 1062 dos imágenes principales
INSERT INTO producto_archivo (id_producto, tipo, ruta, nombre_original, tipo_mime, tamano_bytes, orden)
  VALUES (900, 'IMAGEN', 'productos/900/c.gif', 'anim.gif', 'image/gif', 200000, 2);                              -- 3819 formato no permitido
INSERT INTO producto_archivo (id_producto, tipo, ruta, nombre_original, tipo_mime, tamano_bytes, orden)
  VALUES (900, 'MODELO_3D', 'productos/900/m.glb', 'termo.glb', 'model/gltf-binary', 60000000, 1);                -- 3819 modelo de más de 50 MB
INSERT INTO producto_archivo (id_producto, tipo, ruta, nombre_original, tipo_mime, tamano_bytes, orden)
  VALUES (900, 'MODELO_3D', 'productos/900/n.png', 'foto.png', 'image/png', 1000, 1);                             -- 3819 imagen registrada como modelo 3D

-- Borrado en cascada (depuración anual) ---------------------------------- DEBE PASAR
DELETE FROM cotizaciones WHERE id_cotizacion = 900;
SELECT COUNT(*) AS 'DEBE SER 0' FROM detalle_cotizacion WHERE id_cotizacion = 900;
SELECT COUNT(*) AS 'DEBE SER 0' FROM personalizaciones WHERE id_detalle = 900;

ROLLBACK;   -- no deja rastro de las pruebas
