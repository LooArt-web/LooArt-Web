-- =====================================================================
--  LooArt · base de datos looart1
--  Migración V001 · esquema inicial (versión congelada 27-nov-2026)
--  MySQL 8.0.16+ (V2 probada por David en 8.0.46) · InnoDB · utf8mb4
--
--  Origen: dump de David (25-nov) + mejoras V2 (marcadas  -- [V2])
--          + tabla producto_archivo (marcada  -- [V001]).
--
--  ¡ATENCIÓN! Esta migración BORRA y crea todas las tablas.
--  Se ejecuta UNA sola vez, en una base vacía. Cualquier cambio posterior
--  va en una migración nueva (V002__descripcion.sql) con ALTER TABLE;
--  este archivo ya no se modifica.
-- =====================================================================

SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS looart1 CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE looart1;

SET FOREIGN_KEY_CHECKS = 0;
DROP VIEW  IF EXISTS vw_detalle_cotizaciones, vw_resumen_cotizaciones, vw_reporte_producto_dia;
DROP TABLE IF EXISTS producto_archivo, archivos_referencia, personalizaciones, historial_estatus, detalle_cotizacion,
                     cotizaciones, folio_secuencia, estatus_cotizacion, clientes, tematicas,
                     precios, variantes, productos, categorias, usuarios, roles;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- 1. Seguridad
-- ---------------------------------------------------------------------
CREATE TABLE roles (
  id_rol       TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre       VARCHAR(30)  NOT NULL,
  descripcion  VARCHAR(255) NULL,
  PRIMARY KEY (id_rol),
  UNIQUE KEY uk_roles_nombre (nombre)
) ENGINE=InnoDB;

CREATE TABLE usuarios (
  id_usuario        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_rol            TINYINT UNSIGNED NOT NULL,
  nombre_usuario    VARCHAR(60)  NOT NULL,
  correo            VARCHAR(150) NOT NULL,
  password_hash     VARCHAR(255) NOT NULL,
  nombre_completo   VARCHAR(120) NOT NULL,
  activo            TINYINT(1) NOT NULL DEFAULT 1,
  intentos_fallidos TINYINT UNSIGNED NOT NULL DEFAULT 0,          -- [V2] RN-031 bloqueo
  bloqueado_hasta   DATETIME NULL,                                 -- [V2] RN-031
  ultimo_acceso     DATETIME NULL,
  creado_en         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,   -- [V2] TIMESTAMP NULL -> DATETIME NOT NULL
  actualizado_en    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario),
  UNIQUE KEY uk_usuarios_nombre (nombre_usuario),
  UNIQUE KEY uk_usuarios_correo (correo),
  KEY idx_usuarios_rol (id_rol),
  CONSTRAINT fk_usuarios_roles FOREIGN KEY (id_rol)
    REFERENCES roles (id_rol) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. Catálogo
-- ---------------------------------------------------------------------
CREATE TABLE categorias (
  id_categoria   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre         VARCHAR(100) NOT NULL,
  descripcion    TEXT NULL,
  activa         TINYINT(1) NOT NULL DEFAULT 1,
  creado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_categoria),
  UNIQUE KEY uk_categorias_nombre (nombre)
) ENGINE=InnoDB;

CREATE TABLE productos (
  id_producto      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_categoria     BIGINT UNSIGNED NOT NULL,
  nombre           VARCHAR(150) NOT NULL,
  descripcion      TEXT NULL,
  activo           TINYINT(1) NOT NULL DEFAULT 1,
  creado_en        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_producto),
  UNIQUE KEY uk_productos_categoria_nombre (id_categoria, nombre), -- [V2] RN-009
  KEY idx_producto_categoria_activo (id_categoria, activo),
  CONSTRAINT fk_productos_categorias FOREIGN KEY (id_categoria)
    REFERENCES categorias (id_categoria) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE variantes (
  id_variante     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_producto     BIGINT UNSIGNED NOT NULL,
  nombre          VARCHAR(120) NOT NULL,
  presentacion    VARCHAR(120) NOT NULL DEFAULT '',  -- [V2] NULL -> '' para que el UNIQUE funcione (RN-027 pendiente)
  material        VARCHAR(120) NOT NULL DEFAULT '',  -- [V2] idem
  cantidad_minima INT UNSIGNED NOT NULL DEFAULT 1,
  activa          TINYINT(1) NOT NULL DEFAULT 1,
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_variante),
  UNIQUE KEY uk_variantes_combinacion (id_producto, nombre, presentacion, material), -- [V2] RN-009
  KEY idx_variante_producto_activa (id_producto, activa),
  CONSTRAINT chk_variante_minimo CHECK (cantidad_minima >= 1),
  CONSTRAINT fk_variantes_productos FOREIGN KEY (id_producto)
    REFERENCES productos (id_producto) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE precios (
  id_precio       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_variante     BIGINT UNSIGNED NOT NULL,
  precio_unitario DECIMAL(12,2) NOT NULL,
  cantidad_desde  INT UNSIGNED NOT NULL DEFAULT 1,
  cantidad_hasta  INT UNSIGNED NULL,
  vigente_desde   DATE NOT NULL,
  vigente_hasta   DATE NULL,
  activo          TINYINT(1) NOT NULL DEFAULT 1,
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- [V2]
  PRIMARY KEY (id_precio),
  -- [V2] el índice de 6 columnas se reduce: después de la primera columna de rango
  -- MySQL deja de usar las siguientes, así que solo ocupaban espacio.
  KEY idx_precio_busqueda (id_variante, activo, cantidad_desde),
  CONSTRAINT chk_precio_rango    CHECK (cantidad_desde >= 1 AND (cantidad_hasta IS NULL OR cantidad_hasta >= cantidad_desde)),
  CONSTRAINT chk_precio_valor    CHECK (precio_unitario >= 0),
  CONSTRAINT chk_precio_vigencia CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde),
  CONSTRAINT fk_precios_variantes FOREIGN KEY (id_variante)
    REFERENCES variantes (id_variante) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- [V001] NUEVA: imágenes y modelos 3D de cada producto (reemplaza la columna imagen_principal).
-- Los archivos viven en el almacenamiento de objetos (Cloudflare R2 / Object Storage);
-- aquí solo se guarda su ruta. La imagen principal es la IMAGEN con orden = 1.
CREATE TABLE producto_archivo (
  id_archivo_producto BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_producto         BIGINT UNSIGNED NOT NULL,
  tipo                VARCHAR(10)  NOT NULL,                     -- IMAGEN | MODELO_3D
  ruta                VARCHAR(500) NOT NULL,                     -- clave generada por el backend
  nombre_original     VARCHAR(255) NOT NULL,
  tipo_mime           VARCHAR(50)  NOT NULL,
  tamano_bytes        INT UNSIGNED NOT NULL,
  orden               SMALLINT UNSIGNED NOT NULL DEFAULT 1,       -- 1 = principal de su tipo
  texto_alternativo   VARCHAR(255) NULL,                         -- descripción para accesibilidad
  activo              TINYINT(1) NOT NULL DEFAULT 1,
  creado_en           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_archivo_producto),
  UNIQUE KEY uk_producto_archivo_ruta (ruta),
  UNIQUE KEY uk_producto_archivo_orden (id_producto, tipo, orden),  -- una sola principal por tipo
  CONSTRAINT chk_producto_archivo_orden CHECK (orden >= 1),
  -- PROPUESTO (RNF-007): imágenes jpg/png/webp hasta 5 MB; modelos 3D glTF/GLB hasta 50 MB
  CONSTRAINT chk_producto_archivo_tipo CHECK (
       (tipo = 'IMAGEN'    AND tipo_mime IN ('image/jpeg','image/png','image/webp')
                           AND tamano_bytes BETWEEN 1 AND 5242880)
    OR (tipo = 'MODELO_3D' AND tipo_mime IN ('model/gltf-binary','model/gltf+json')
                           AND tamano_bytes BETWEEN 1 AND 52428800)),
  CONSTRAINT fk_producto_archivo_producto FOREIGN KEY (id_producto)
    REFERENCES productos (id_producto) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- [V2] NUEVA: CRUD de temáticas pedido por el profesor (RF-004, RN-010)
CREATE TABLE tematicas (
  id_tematica    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre         VARCHAR(100) NOT NULL,
  descripcion    TEXT NULL,
  imagen         VARCHAR(500) NULL,
  activa         TINYINT(1) NOT NULL DEFAULT 1,
  creado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_tematica),
  UNIQUE KEY uk_tematicas_nombre (nombre)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. Cotizaciones
-- ---------------------------------------------------------------------
CREATE TABLE clientes (
  id_cliente     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre         VARCHAR(120) NOT NULL,
  telefono       VARCHAR(25)  NOT NULL,
  email          VARCHAR(150) NOT NULL,
  codigo_postal  CHAR(5)      NOT NULL,
  creado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_cliente),
  KEY idx_cliente_email (email),
  KEY idx_cliente_telefono (telefono),
  CONSTRAINT chk_cliente_cp CHECK (codigo_postal REGEXP '^[0-9]{5}$')   -- [V2] RN-012
) ENGINE=InnoDB;

-- [V2] NUEVA: reemplaza los dos ENUM de estatus (cotizaciones e historial_estatus)
CREATE TABLE estatus_cotizacion (
  id_estatus TINYINT UNSIGNED NOT NULL,
  clave      VARCHAR(30) NOT NULL,
  nombre     VARCHAR(60) NOT NULL,
  es_final   TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id_estatus),
  UNIQUE KEY uk_estatus_clave (clave)
) ENGINE=InnoDB;

-- [V2] NUEVA: folio consecutivo por año sin duplicados en concurrencia (RN-020)
CREATE TABLE folio_secuencia (
  anio   SMALLINT UNSIGNED NOT NULL,
  ultimo INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (anio)
) ENGINE=InnoDB;

CREATE TABLE cotizaciones (
  id_cotizacion     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_cliente        BIGINT UNSIGNED NOT NULL,
  id_estatus        TINYINT UNSIGNED NOT NULL DEFAULT 1,       -- [V2] antes ENUM `estatus`
  id_cotizacion_sustituida BIGINT UNSIGNED NULL,               -- [V2] RN-023 (pendiente con cliente)
  folio             VARCHAR(40) NOT NULL,
  token_publico     CHAR(32) NOT NULL,                         -- [V2] RN-021 enlace público seguro
  fecha_emision     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_vencimiento DATE NOT NULL,                             -- se conserva DATE: vence en un día, no a una hora
  subtotal          DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  costo_entrega     DECIMAL(12,2) NULL,
  total             DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  moneda            CHAR(3) NOT NULL DEFAULT 'MXN',
  observaciones     TEXT NULL,
  pdf_ruta          VARCHAR(500) NULL,
  creado_en         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_cotizacion),
  UNIQUE KEY uk_cotizaciones_folio (folio),
  UNIQUE KEY uk_cotizaciones_token (token_publico),
  KEY idx_cotizacion_fecha (fecha_emision),
  KEY idx_cotizacion_estatus_fecha (id_estatus, fecha_emision),  -- [V2] listado del panel por estatus
  KEY idx_cotizacion_cliente (id_cliente),
  KEY idx_cotizacion_sustituida (id_cotizacion_sustituida),
  CONSTRAINT chk_cotizacion_fechas   CHECK (CAST(fecha_emision AS DATE) < fecha_vencimiento),
  CONSTRAINT chk_cotizacion_importes CHECK (subtotal >= 0 AND total >= 0 AND (costo_entrega IS NULL OR costo_entrega >= 0)),
  CONSTRAINT chk_cotizacion_total    CHECK (total = subtotal + COALESCE(costo_entrega, 0)),   -- [V2] RN-017
  CONSTRAINT chk_cotizacion_moneda   CHECK (moneda = 'MXN'),                                  -- [V2] RN-005
  CONSTRAINT fk_cotizaciones_clientes FOREIGN KEY (id_cliente)
    REFERENCES clientes (id_cliente) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_cotizaciones_estatus FOREIGN KEY (id_estatus)
    REFERENCES estatus_cotizacion (id_estatus) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_cotizaciones_sustituida FOREIGN KEY (id_cotizacion_sustituida)
    REFERENCES cotizaciones (id_cotizacion) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE detalle_cotizacion (
  id_detalle               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_cotizacion            BIGINT UNSIGNED NOT NULL,
  id_variante              BIGINT UNSIGNED NOT NULL,
  cantidad                 INT UNSIGNED NOT NULL,
  precio_unitario_snapshot DECIMAL(12,2) NOT NULL,
  es_precio_estimado       TINYINT(1) NOT NULL DEFAULT 0,       -- [V2] RN-018
  subtotal                 DECIMAL(14,2) AS (cantidad * precio_unitario_snapshot) STORED,
  producto_snapshot        VARCHAR(150) NOT NULL,
  variante_snapshot        VARCHAR(400) NOT NULL,               -- [V2] 150 -> 400: nombre + presentación + material
  creado_en                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_detalle),
  KEY idx_detalle_cotizacion (id_cotizacion),
  KEY idx_detalle_variante (id_variante),
  CONSTRAINT chk_detalle_cantidad CHECK (cantidad >= 1),
  CONSTRAINT chk_detalle_precio   CHECK (precio_unitario_snapshot >= 0),
  CONSTRAINT fk_detalle_cotizacion FOREIGN KEY (id_cotizacion)
    REFERENCES cotizaciones (id_cotizacion) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_detalle_variante FOREIGN KEY (id_variante)
    REFERENCES variantes (id_variante) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE personalizaciones (
  id_personalizacion BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_detalle         BIGINT UNSIGNED NOT NULL,
  id_tematica        BIGINT UNSIGNED NULL,                       -- [V2] temática prediseñada
  tema               VARCHAR(150) NULL,                          -- temática escrita por el comprador
  descripcion        TEXT NULL,
  texto_personalizado VARCHAR(500) NULL,
  color              VARCHAR(80) NULL,
  presentacion_personalizada VARCHAR(150) NULL,                  -- RN-027 pendiente
  creado_en          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_personalizacion),
  UNIQUE KEY uk_personalizaciones_detalle (id_detalle),          -- 1 : 0..1 (RN-025)
  KEY idx_personalizaciones_tematica (id_tematica),
  CONSTRAINT fk_personalizaciones_detalle FOREIGN KEY (id_detalle)
    REFERENCES detalle_cotizacion (id_detalle) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_personalizaciones_tematica FOREIGN KEY (id_tematica)
    REFERENCES tematicas (id_tematica) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE archivos_referencia (
  id_archivo         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_personalizacion BIGINT UNSIGNED NOT NULL,
  nombre_archivo     VARCHAR(255) NOT NULL,                      -- nombre original, solo para mostrar
  ruta               VARCHAR(500) NOT NULL,                      -- nombre generado por el backend
  tipo_mime          VARCHAR(50)  NOT NULL,
  tamano_bytes       INT UNSIGNED NOT NULL,                      -- [V2] era BIGINT NULL
  creado_en          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_archivo),
  UNIQUE KEY uk_archivos_ruta (ruta),                            -- [V2]
  KEY idx_archivo_personalizacion (id_personalizacion),
  CONSTRAINT chk_archivo_mime   CHECK (tipo_mime IN ('image/jpeg','image/png','image/webp')), -- [V2] RN-026
  CONSTRAINT chk_archivo_tamano CHECK (tamano_bytes BETWEEN 1 AND 5242880),                  -- [V2] 5 MB, PROPUESTO
  CONSTRAINT fk_archivos_personalizacion FOREIGN KEY (id_personalizacion)
    REFERENCES personalizaciones (id_personalizacion) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE historial_estatus (
  id_historial        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_cotizacion       BIGINT UNSIGNED NOT NULL,
  id_usuario          BIGINT UNSIGNED NULL,                      -- NULL = cambio hecho por el sistema
  id_estatus_anterior TINYINT UNSIGNED NULL,                     -- [V2] NULL al crearse
  id_estatus_nuevo    TINYINT UNSIGNED NOT NULL,                 -- [V2] antes ENUM `estatus`
  fecha_cambio        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  observacion         TEXT NULL,
  PRIMARY KEY (id_historial),
  KEY idx_historial_cotizacion_fecha (id_cotizacion, fecha_cambio),
  KEY idx_historial_usuario (id_usuario),
  KEY idx_historial_estatus_anterior (id_estatus_anterior),
  KEY idx_historial_estatus_nuevo (id_estatus_nuevo),
  CONSTRAINT fk_historial_cotizacion FOREIGN KEY (id_cotizacion)
    REFERENCES cotizaciones (id_cotizacion) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_historial_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuarios (id_usuario) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_historial_estatus_anterior FOREIGN KEY (id_estatus_anterior)
    REFERENCES estatus_cotizacion (id_estatus) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_historial_estatus_nuevo FOREIGN KEY (id_estatus_nuevo)
    REFERENCES estatus_cotizacion (id_estatus) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. Vistas
--    [V2] Sin DEFINER=`root`@`localhost`: en el hosting ese usuario puede no
--    existir y la vista fallaría. SQL SECURITY INVOKER = usa los permisos de
--    quien consulta.
-- ---------------------------------------------------------------------
CREATE SQL SECURITY INVOKER VIEW vw_detalle_cotizaciones AS
SELECT c.id_cotizacion, c.folio, c.fecha_emision, c.fecha_vencimiento,
       e.clave AS estatus, e.nombre AS estatus_nombre,
       cl.nombre AS cliente, cl.telefono, cl.email, cl.codigo_postal,
       d.id_detalle, d.producto_snapshot, d.variante_snapshot, d.cantidad,
       d.precio_unitario_snapshot AS precio_unitario, d.es_precio_estimado,
       d.subtotal AS subtotal_detalle,
       c.subtotal AS subtotal_cotizacion, c.costo_entrega, c.total, c.moneda
FROM cotizaciones c
JOIN estatus_cotizacion e ON e.id_estatus = c.id_estatus
JOIN clientes cl          ON cl.id_cliente = c.id_cliente
JOIN detalle_cotizacion d ON d.id_cotizacion = c.id_cotizacion;

-- [V2] Reemplaza vw_resumen_cotizaciones: agrupa por id de producto (no por texto,
-- que cambia si se renombra el producto) y por día, para filtrar por rango de fechas (RF-019).
-- Uso: SELECT id_producto, producto, SUM(unidades), SUM(importe)
--        FROM vw_reporte_producto_dia WHERE dia BETWEEN ? AND ? GROUP BY id_producto, producto;
CREATE SQL SECURITY INVOKER VIEW vw_reporte_producto_dia AS
SELECT DATE(c.fecha_emision)            AS dia,
       p.id_producto,
       p.nombre                         AS producto,
       COUNT(DISTINCT c.id_cotizacion)  AS numero_cotizaciones,
       SUM(d.cantidad)                  AS unidades,
       SUM(d.subtotal)                  AS importe
FROM cotizaciones c
JOIN detalle_cotizacion d ON d.id_cotizacion = c.id_cotizacion
JOIN variantes v          ON v.id_variante   = d.id_variante
JOIN productos p          ON p.id_producto   = v.id_producto
GROUP BY DATE(c.fecha_emision), p.id_producto, p.nombre;

-- ---------------------------------------------------------------------
-- 5. Datos iniciales
-- ---------------------------------------------------------------------
-- [V2] Se quita el rol COMPRADOR: el comprador no tiene cuenta (RN-011).
INSERT INTO roles (id_rol, nombre, descripcion) VALUES
  (1, 'ADMINISTRADOR', 'Gestiona catálogo, precios, cotizaciones y reportes.'),
  (2, 'SUPERUSUARIO',  'PROPUESTO: además administra usuarios.');

-- Nombres del cliente (expediente: nueva, pendiente de revisión, atendida,
-- aceptada, cancelada) + SUSTITUIDA (PROPUESTO). Agregar un estado = un INSERT.
INSERT INTO estatus_cotizacion (id_estatus, clave, nombre, es_final) VALUES
  (1, 'NUEVA',              'Nueva',                     0),
  (2, 'PENDIENTE_REVISION', 'Pendiente de revisión',     0),
  (3, 'ATENDIDA',           'Atendida',                  0),
  (4, 'ACEPTADA',           'Aceptada',                  1),
  (5, 'CANCELADA',          'Cancelada',                 1),
  (6, 'SUSTITUIDA',         'Sustituida por otro folio', 1);
