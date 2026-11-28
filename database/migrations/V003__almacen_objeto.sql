-- =====================================================================
--  looart1 · migración V003 · almacén de archivos en la BD (PROPUESTO / TEMPORAL)
--  ADR-002: mientras el hosting no tenga disco persistente ni R2 (sin tarjeta),
--  las imágenes y los PDF se guardan aquí, con ALMACEN=bd. Cuando haya R2, se
--  cambia ALMACEN=r2 y esta tabla se vacía y se borra con su reversión.
--  Límite: 5 MB por archivo (debajo del tamaño máximo por registro de TiDB).
-- =====================================================================
USE looart1;

CREATE TABLE almacen_objeto (
  clave   VARCHAR(255)  NOT NULL,
  mime    VARCHAR(100)  NOT NULL,
  bytes   LONGBLOB      NOT NULL,
  tamano  INT UNSIGNED  NOT NULL,
  creado  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (clave),
  CONSTRAINT chk_almacen_tamano CHECK (tamano BETWEEN 1 AND 5242880),
  CONSTRAINT chk_almacen_tamano_real CHECK (tamano = LENGTH(bytes)),
  CONSTRAINT chk_almacen_clave CHECK (REGEXP_LIKE(clave, '^[a-z0-9][a-z0-9/_.-]*$', 'c')),
  CONSTRAINT chk_almacen_mime CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp',
                                               'application/pdf', 'model/gltf-binary'))
) ENGINE=InnoDB;
