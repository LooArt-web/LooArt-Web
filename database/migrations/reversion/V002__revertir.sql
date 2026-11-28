-- =====================================================================
--  looart1 · reversión de V002 · deja la base exactamente como en V001
--  ¡Borra datos! Colores, maquetas, recortes, motivos y diseños guardados.
--  Úsala solo si V002 se descarta. Haz un respaldo antes.
-- =====================================================================
USE looart1;

ALTER TABLE personalizaciones
  DROP CHECK chk_personalizaciones_diseno,
  DROP COLUMN diseno;

ALTER TABLE tematicas
  DROP CHECK chk_tematicas_motivo,
  DROP COLUMN motivo;

DROP TABLE producto_color;

ALTER TABLE producto_archivo
  DROP CHECK chk_producto_archivo_cara,
  DROP COLUMN cara;

ALTER TABLE productos
  DROP CHECK chk_productos_recorte,
  DROP CHECK chk_productos_maqueta,
  DROP COLUMN recorte,
  DROP COLUMN maqueta;
