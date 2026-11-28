# Base de datos · LooArt (looart1)

MySQL 8.0.16 o superior · InnoDB · utf8mb4. La V2 se probó en MySQL 8.0.46.

## Contenido

| Ruta | Qué es |
| --- | --- |
| `migrations/V001__esquema_inicial.sql` | Esquema inicial **congelado** (27-nov-2026): 16 tablas, 2 vistas y datos iniciales |
| `tests/V001__pruebas_restricciones.sql` | 22 pruebas que comprueban que cada restricción rechaza datos inválidos |
| `migrations/V002__catalogo_y_personalizacion.sql` | **PROPUESTO.** Maqueta 3D, recorte, colores, motivo de temática y diseño del renglón |
| `tests/V002__pruebas_restricciones.sql` | 8 pruebas de las restricciones de V002 |
| `migrations/reversion/V002__revertir.sql` | Deshace V002 y deja la base como en V001 (borra esos datos) |
| `migrations/V003__almacen_objeto.sql` | **PROPUESTO / TEMPORAL.** Archivos guardados en la BD mientras no haya R2 (ADR-002) |
| `tests/V003__pruebas_restricciones.sql` | 6 pruebas de las restricciones de V003 |
| `migrations/reversion/V003__revertir.sql` | Borra el almacén de archivos (después de copiarlos a R2) |
| `docs/documentacion_datos.md` | Reglas de negocio, estados, diccionario de datos y trazabilidad |
| `docs/diagramas/` | Diagramas 01–09 en PNG (se suben aparte) |
| `historico/LooartBaseDeDatos_dump_2026-11-25.sql` | Dump original de David (25-nov). Solo es referencia; **no ejecutar** |

## Estado

La V001 es la V2 que probó David **más** la tabla `producto_archivo` y **sin** la columna `productos.imagen_principal`.
**Validada:** David ejecutó la migración y las pruebas el 27-nov-2026 y obtuvo los 22 errores esperados.

## Instalación

En una base vacía (la migración **borra y crea** todas las tablas):

```bash
mysql -u root -p < migrations/V001__esquema_inicial.sql
mysql -u root -p < migrations/V002__catalogo_y_personalizacion.sql
mysql -u root -p < migrations/V003__almacen_objeto.sql
```

En un servidor que ya tiene datos (Render + TiDB) **no** se corren a mano: se usa `cd backend && npm run migrar`, que aplica solo las pendientes y nunca vuelve a correr V001.

## Pruebas

```bash
mysql -u root -p --force -e "source tests/V001__pruebas_restricciones.sql" looart1   # 22 errores
mysql -u root -p --force -e "source tests/V002__pruebas_restricciones.sql" looart1   # 8 errores
mysql -u root -p --force -e "source tests/V003__pruebas_restricciones.sql" looart1   # 6 errores
```

En MySQL Workbench activa *Query > Continue on SQL Script Error*.

Resultado esperado: **22 errores**, uno por cada línea marcada "DEBE FALLAR"
(3819 = CHECK, 1062 = duplicado, 1451/1452 = llave foránea).
Las líneas "DEBE PASAR" no deben mostrar error. El script termina con `ROLLBACK`, así que no deja datos.

## Reglas para cambiar el esquema

1. **Nunca se edita `V001`.** Ya está congelada.
2. Cada cambio va en una migración nueva con el siguiente número: `V002__descripcion.sql`, `V003__...`, con `ALTER TABLE`.
3. Cada migración nueva trae sus pruebas en `tests/V00N__pruebas_*.sql`.
4. Si el cambio afecta tablas o columnas, se actualiza `docs/documentacion_datos.md` en el mismo Pull Request.
5. Los cambios entran a `main` solo por Pull Request revisado por el equipo.
