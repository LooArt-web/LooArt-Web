# ADR-002: hosting sin tarjeta para las pruebas del cliente

**Estado:** Aceptada (temporal, para pruebas del cliente) — 27-nov-2026.
**Reemplaza en parte:** A8 de PLAN.md (Oracle Always Free + R2), que queda como ruta a producción definitiva.

## Contexto
Oracle Always Free pide tarjeta de crédito y Cloudflare R2 pide un método de pago para activarse. El cliente necesita probar LooArt ya, sin que nadie ponga una tarjeta.

## Decisión
| Pieza | Servicio | Cuidado |
|---|---|---|
| Front | Cloudflare Pages (`looart-web.pages.dev`) | — |
| Back-end Node 22 | Render, *Web Service* gratuito, `render.yaml`, despliegue automático desde `main` | Se duerme tras 15 min sin tráfico y tarda ~1 min en despertar; disco temporal |
| Mantenerlo despierto | cron-job.org: `GET /api/salud` cada 10 min | También avisa si el sitio se cae |
| MySQL | TiDB Cloud Starter (`looart`, AWS Oregon, TiDB v8.5, límite de gasto $0) | No es MySQL idéntico: los `CHECK` exigen `tidb_enable_check_constraint = ON` (lo comprueba `npm run migrar`); 5 GiB gratis |
| Archivos | `ALMACEN=bd` (tabla `almacen_objeto`, V003, temporal), 5 MB por archivo | Los modelos GLB de más de 5 MB se rechazan con un mensaje claro |
| Mismo origen | `functions/api/[[ruta]].js` en Pages reenvía `/api/*` a Render con `X-Origen-Secreto` | Sin el secreto, la API responde 403 (salvo `/api/salud`) |

Seguridad de la BD: Render gratis no tiene IP fija, así que TiDB acepta conexiones de cualquier IP; la protección es TLS obligatorio (TLS 1.2+, certificado verificado) y una contraseña generada por TiDB. Nunca contraseñas cortas.

## Consecuencias
- Cada fusión a `main` se publica sola en Render; las migraciones se aplican aparte con `npm run migrar`, nunca al arrancar.
- La primera visita después de 15 min sin tráfico puede tardar ~1 min si el monitor falla; el proxy responde 503 con `Retry-After` y el front muestra "despertando el servidor".
- El número de migración V003 lo usa el almacén; la tabla de sesiones de la fase 5 pasa a V004.

## Ruta a producción definitiva
Cuando el cliente pueda pagar o poner una tarjeta: Oracle / un VPS / Render de pago para la API, MySQL 8 real o TiDB de pago y R2 para archivos. **El código no cambia**: solo las variables de entorno (`DB_*`, `ALMACEN=r2`, `R2_*`), copiar los archivos de `almacen_objeto` a R2 y aplicar `V003__revertir.sql`.
