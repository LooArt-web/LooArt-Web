-- =====================================================================
--  Pruebas de restricciones · looart1 · migración V003 (PROPUESTO / TEMPORAL)
--  Ejecutar DESPUÉS de V001, V002 y V003, con --force:
--     mysql -u root -p --force looart1 < tests/V003__pruebas_restricciones.sql
--  Total esperado: 6 errores (3819 = CHECK, 1062 = duplicado).
--  Las marcadas "DEBE PASAR" no muestran error. Al final todo se revierte.
-- =====================================================================
USE looart1;
START TRANSACTION;

-- DEBE PASAR: imagen pequeña con clave válida
INSERT INTO almacen_objeto (clave, mime, bytes, tamano) VALUES ('productos/10/a.png', 'image/png', 'abc', 3);

-- ERROR 1: clave duplicada (1062)
INSERT INTO almacen_objeto (clave, mime, bytes, tamano) VALUES ('productos/10/a.png', 'image/png', 'xyz', 3);

-- ERROR 2: tamaño 0 (3819)
INSERT INTO almacen_objeto (clave, mime, bytes, tamano) VALUES ('productos/10/b.png', 'image/png', '', 0);

-- ERROR 3: tamaño declarado distinto al real (3819)
INSERT INTO almacen_objeto (clave, mime, bytes, tamano) VALUES ('productos/10/c.png', 'image/png', 'abc', 10);

-- ERROR 4: clave con mayúsculas o que sale de la carpeta (3819)
INSERT INTO almacen_objeto (clave, mime, bytes, tamano) VALUES ('../Secreto.png', 'image/png', 'abc', 3);

-- ERROR 5: tipo de archivo no permitido (3819)
INSERT INTO almacen_objeto (clave, mime, bytes, tamano) VALUES ('productos/10/d.exe', 'application/x-msdownload', 'abc', 3);

-- ERROR 6: más de 5 MB (3819)
INSERT INTO almacen_objeto (clave, mime, bytes, tamano)
VALUES ('productos/10/e.png', 'image/png', REPEAT('a', 5242881), 5242881);

ROLLBACK;
