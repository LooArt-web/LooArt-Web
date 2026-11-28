-- =====================================================================
--  looart1 · migración V002 · catálogo visual y personalización
--  Estado: PROPUESTO (PLAN.md, discrepancias D2, D3, D4 y D11).
--  Requiere V001. Reversión: migrations/reversion/V002__revertir.sql
--  Pruebas: tests/V002__pruebas_restricciones.sql (8 errores esperados)
--
--  Objetivo: que la base guarde lo que el front de Luis ya usa para la
--  vista previa y el visor 3D, sin perder ninguna función:
--    D11  productos.maqueta  → escena 3D: termo, taza, pin, caja, sticker o foto libre
--         productos.recorte  → foto recortada (zona, borde, cara, tamaño) para pin/caja/foto
--         producto_archivo.cara → la foto del reverso (frente | reverso)
--    D2   producto_color     → colores del producto (nombre + hex que tiñe la vista previa)
--    D4   tematicas.motivo   → patrón incluido de la temática (si no hay imagen)
--    D3   personalizaciones.diseno → colocación del diseño elegida por el comprador
-- =====================================================================
USE looart1;

-- D11 · maqueta y recorte de la foto ----------------------------------------
ALTER TABLE productos
  ADD COLUMN maqueta VARCHAR(10) NOT NULL DEFAULT 'caja' AFTER descripcion,
  ADD COLUMN recorte JSON NULL AFTER maqueta,          -- se valida con Zod en el back-end
  ADD CONSTRAINT chk_productos_maqueta
    CHECK (maqueta IN ('termo', 'taza', 'pin', 'caja', 'sticker', 'foto')),
  ADD CONSTRAINT chk_productos_recorte
    CHECK (recorte IS NULL OR JSON_TYPE(recorte) = 'OBJECT');

-- Foto del reverso: solo las imágenes pueden ser de reverso; los modelos 3D siempre "frente".
ALTER TABLE producto_archivo
  ADD COLUMN cara VARCHAR(7) NOT NULL DEFAULT 'frente' AFTER tipo,
  ADD CONSTRAINT chk_producto_archivo_cara
    CHECK (cara IN ('frente', 'reverso') AND (cara = 'frente' OR tipo = 'IMAGEN'));

-- D2 · colores por producto ---------------------------------------------------
CREATE TABLE producto_color (
  id_color       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_producto    BIGINT UNSIGNED NOT NULL,
  nombre         VARCHAR(40) NOT NULL,
  hex            CHAR(7) NOT NULL,                     -- #RRGGBB, tiñe la vista previa
  orden          SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  activo         TINYINT(1) NOT NULL DEFAULT 1,
  creado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_color),
  UNIQUE KEY uk_producto_color_nombre (id_producto, nombre),
  KEY idx_producto_color_lista (id_producto, activo, orden),
  CONSTRAINT chk_producto_color_hex CHECK (hex REGEXP '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT chk_producto_color_nombre CHECK (TRIM(nombre) <> ''),
  CONSTRAINT chk_producto_color_orden CHECK (orden >= 1),
  -- El color de un renglón ya cotizado vive como texto en personalizaciones.color
  -- (snapshot), así que borrar el producto puede llevarse sus colores.
  CONSTRAINT fk_producto_color_producto FOREIGN KEY (id_producto)
    REFERENCES productos (id_producto) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- D4 · motivo incluido de la temática (la imagen, si existe, tiene prioridad) --
ALTER TABLE tematicas
  ADD COLUMN motivo VARCHAR(20) NULL AFTER imagen,
  ADD CONSTRAINT chk_tematicas_motivo CHECK (
    motivo IS NULL
    OR motivo IN ('puntos', 'estrellas', 'flores', 'rayas', 'cuadros', 'corazones', 'ondas'));

-- D3 · colocación del diseño del renglón (vista-previa.js → normalizarDiseno) --
ALTER TABLE personalizaciones
  ADD COLUMN diseno JSON NULL AFTER color,             -- se valida con Zod en el back-end
  ADD CONSTRAINT chk_personalizaciones_diseno
    CHECK (diseno IS NULL OR JSON_TYPE(diseno) = 'OBJECT');
