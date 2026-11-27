# Plan del back-end de LooArt

> **Para quien ejecute el plan:** cada fase se trabaja con `superpowers:test-driven-development` (prueba primero, verla fallar, código mínimo) y se cierra con `superpowers:verification-before-completion` (salida real de `npm test` y de las pruebas de la BD). Las casillas `- [ ]` sirven para dar seguimiento.

**Objetivo:** una API en Node.js que reemplace el `localStorage` del sitio por la base `looart1`: catálogo público, cotizaciones guardadas en una sola transacción, PDF y WhatsApp, panel con sesión segura, reportes y depuración anual.

**Arquitectura:** monolito Express en `backend/`, en capas **rutas → servicios → repositorios**, con la lógica de negocio pura en `dominio/` (sin BD ni HTTP, para probarla con TDD). El front sigue en Cloudflare Pages, y una Pages Function reenvía `/api/*` al back-end para que la cookie de sesión sea del mismo origen.

**Stack:** Node.js 22 LTS, Express 5, mysql2/promise, Zod, argon2, pdfkit, @aws-sdk/client-s3 (R2), multer (en memoria), helmet, express-rate-limit, node:test + Supertest, ESLint + Prettier. Ver [ADR-001](ADR-001-stack.md).

**Especificación:** `PROMPT_BACKEND_LooArt.md` (prompt de Zoram), `database/docs/documentacion_datos.md` (RN-001 a RN-033, T1–T8) y `database/migrations/V001__esquema_inicial.sql`.

**Estado:** BORRADOR, esperando la aprobación de Zoram. No se escribe código hasta que se apruebe.

---

## 1. Restricciones globales

Aplican a todas las tareas:

- MySQL 8.0.16 o superior, InnoDB, utf8mb4. **V001 no se edita.** Cada cambio va en `database/migrations/V00N__*.sql`, con `database/tests/V00N__pruebas_*.sql` y la actualización de `documentacion_datos.md` en el mismo PR.
- Las pruebas de restricciones de V001 deben seguir dando **22 errores esperados**. Verificado el 27-nov-2026 en MySQL 8.0.46: 22.
- Sin carrito: no se crean tablas, rutas, servicios ni nombres con `carrito`, `cart`, `checkout`, `pago` ni `orden de compra`.
- Dinero:
  - En el código, **centavos enteros** (`number` entero seguro).
  - mysql2 devuelve los `DECIMAL` como texto. Se convierten con `aCentavos("123.45") → 12345` sin pasar por `float`.
  - Hacia MySQL se manda texto `"123.45"`.
- Zona horaria de negocio: `America/Mexico_City`. Las fechas de negocio (emisión, vencimiento, año del folio, "vigente hoy") se calculan en esa zona, en el código, y se envían explícitas a MySQL.
- Errores: `{ "error": { "codigo", "mensaje", "idSolicitud" } }`, sin trazas ni SQL. Éxitos: el JSON del recurso o `{ "datos": [...], "siguiente": cursor|null }` en listas.
- Prefijos: `/api` público y `/api/admin` panel.
- Secretos solo en variables de entorno, con `backend/.env.example` sin valores reales. `.env` va en `.gitignore`.
- Logs sin tokens, contraseñas, celulares ni correos completos (enmascarados: `55******90`, `z***@gmail.com`).
- Las reglas PROPUESTAS o PENDIENTES nunca se marcan como confirmadas. No se inventan productos, precios ni temáticas: las pruebas usan datos con prefijo `[Prueba]`.

## 2. Decisiones de diseño (las apruebas con el plan)

| # | Decisión | Por qué | Alternativa descartada |
|---|---|---|---|
| A1 | Repositorio único: `backend/` junto al front. El comando de Pages ya copia solo `*.html css js admin`, así que `backend/` no se publica. | Un solo PR puede cambiar API y front a la vez (fase 10). | Repositorio aparte: duplica la revisión y el versionado. |
| A2 | Mismo origen con una **Pages Function** `functions/api/[[ruta]].js` que reenvía `/api/*` al back-end y agrega `X-Origen-Secreto` y la IP real del visitante. | La cookie del panel queda en `looart-web.pages.dev` y no es de terceros, sin comprar dominio. El back-end solo confía en la IP reenviada si el secreto coincide. | Subdominio `api.` propio: requiere dominio (~200 MXN/año). Se puede migrar después sin cambiar la API. |
| A3 | Sesión del panel con **cookie opaca** `__Host-looart_sesion` (`HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`). En la BD solo se guarda el SHA-256 del token, en la tabla nueva `sesiones` (V003). Duración: 8 h sin actividad. CSRF: token por sesión enviado en `X-CSRF-Token` en todo `POST/PUT/PATCH/DELETE` de `/api/admin`. | Un JWT en `localStorage` lo puede robar cualquier XSS y no se puede revocar. Con la sesión en la BD, el logout y la baja de usuario la cortan al momento. | JWT: no se revoca. express-session con tienda propia: crea tablas fuera de las migraciones. |
| A4 | Almacenamiento detrás de una interfaz `almacen` con dos implementaciones: **R2** en producción y **disco local** en desarrollo y pruebas. | Las pruebas no dependen de internet ni de las llaves de R2. | Simular el SDK de S3 en cada prueba: frágil. |
| A5 | Archivos en `POST /api/cotizaciones`: se validan en memoria (bytes mágicos y tamaño), **se suben primero** y después se abre la transacción. Si la transacción falla, se borran los archivos subidos (compensación). Si también falla ese borrado, la tarea de depuración barre archivos huérfanos de más de 24 h. | Nunca queda un registro que apunte a un archivo inexistente, que es el error grave. Un archivo huérfano solo cuesta espacio y se limpia solo. | Transacción primero y subir después: si la subida falla tras el `COMMIT`, la cotización queda con rutas rotas. |
| A6 | Folio: dentro de la transacción, `INSERT INTO folio_secuencia (anio, ultimo) VALUES (?, LAST_INSERT_ID(1)) ON DUPLICATE KEY UPDATE ultimo = LAST_INSERT_ID(ultimo + 1)` y luego `SELECT LAST_INSERT_ID()`. | El bloqueo de fila serializa a dos altas simultáneas, y el `ROLLBACK` deshace el incremento. | `MAX()+1`: repite folios en carreras. |
| A7 | Precios con mayoreo: el front recibe **variantes con sus rangos** y `precios.js` busca el rango, igual que el servidor (D1). El total del front es solo de referencia. | El servidor recalcula todo (RN-014). | — |
| A8 | Despliegue (fase 11): VM Ampere de Oracle Always Free con Node + pm2/systemd, MySQL HeatWave Always Free y R2. Es **PROPUESTO** y depende de que crees la cuenta. | Gratis y siempre encendido (RNF-004). | Render gratis: se apaga y no tiene MySQL. |
| A9 | Pruebas de integración contra **MySQL 8 real**: en local con la base de pruebas y en GitHub Actions con el servicio `mysql:8.0`. Antes de conectarse, la prueba verifica que `NODE_ENV=test` y que `DB_NOMBRE` sea `looart1` en un host de la lista de pruebas; si no, aborta. | V001 fija el nombre `looart1`, así que el resguardo evita borrar una base real por error. | Mocks de la BD: no prueban CHECK, FK ni concurrencia. |

## 3. Discrepancias D1–D11

| # | Resolución propuesta | Estado | Fase |
|---|---|---|---|
| D1 | `GET /api/catalogo/productos/:id` devuelve `variantes: [{ id, nombre, presentacion, material, cantidadMinima, precios: [{ desde, hasta, precioUnitario }] }]`, solo con los rangos vigentes hoy. En `js/precios.js`, `unitario(producto, cantidad)` pasa a ser `unitario(variante, cantidad)`, que busca el rango con `desde ≤ cantidad ≤ (hasta ?? ∞)`. El mínimo se lee de la variante. Hoy la "presentación" del front se vuelve la variante elegida. | PROPUESTO | 2 y 10 |
| D2 | **V002**: tabla `producto_color (id_color, id_producto, nombre VARCHAR(40), hex CHAR(7) CHECK REGEXP '^#[0-9A-Fa-f]{6}$', orden, activo, UNIQUE (id_producto, nombre))`. El renglón sigue guardando el nombre del color como texto en `personalizaciones.color` (snapshot). | PROPUESTO | 2 |
| D3 | **V002**: `personalizaciones.diseno JSON NULL` con `CHECK (diseno IS NULL OR JSON_VALID(diseno))`. El servidor lo valida con Zod según `normalizarDiseno` de `vista-previa.js`: `modo` centro/repetida/envolvente, `tamano` 0–1, `separacion` 0–0.6, `intercalado` booleano, `angulo` −180 a 180, `escala` 0.4–1.8, `posX` y `posY` 0–1, `cara`. Se rechazan propiedades extra. | PROPUESTO | 3 |
| D4 | **V002**: `tematicas.motivo VARCHAR(20) NULL` con `CHECK` en (puntos, estrellas, flores, rayas, cuadros, corazones, ondas). La imagen subida sigue en `tematicas.imagen`. Si hay imagen, tiene prioridad sobre el motivo. | PROPUESTO | 2 |
| D5 | El folio lo genera solo el servidor (A6). Se borra `generarFolio` del front. | Por RN-020 | 3 y 10 |
| D6 | La API devuelve `estatus: { clave, nombre, esFinal }` y el catálogo de estatus sale de `GET /api/admin/estatus`. El front deja de tener la lista `ESTADOS`. | Por V001 | 7 y 10 |
| D7 | "Mis cotizaciones" guarda en `localStorage` solo `[{ folio, token }]` y consulta `GET /api/cotizaciones/:token`. | Por RN-021 | 3 y 10 |
| D8 | `npm run usuario:crear -- --usuario x --rol ADMINISTRADOR` pide la contraseña sin mostrarla en pantalla. No hay endpoint de registro abierto. | Por RN-031 | 5 |
| D9 | `es_precio_estimado` queda siempre en 0 y toda cotización nace en NUEVA (T1) **hasta que respondas la pregunta P1**. El código ya acepta el caso T2, pero no lo activa. | **PENDIENTE** | 3 |
| D10 | Variable `WHATSAPP_NEGOCIO`. El número se borra de `js/data/productos.js`, y el front recibe el enlace armado por `GET …/mensaje-whatsapp`. | Por expediente | 4 y 10 |
| **D11 (nueva)** | El front usa `producto.modelo` (termo, taza, sticker, caja) para la maqueta de la vista previa y la BD no lo tiene. **V002**: `productos.maqueta VARCHAR(10) NOT NULL DEFAULT 'caja'` con `CHECK` en esos 4 valores. | PROPUESTO | 2 |

Otra diferencia sin cambio de esquema: el borrador guarda la imagen de referencia como *data URL*. En la fase 10, `cotizaciones.js` la convierte en `Blob` para el `multipart`.

## 4. Preguntas para Zoram (bloquean solo su parte)

- **P1 (D9, RN-018):** ¿cómo se decide que un precio es "estimado"? Por ejemplo, con un campo `es_estimado` en `precios` o cuando no hay rango para esa cantidad. Mientras no respondas, todas las cotizaciones nacen en NUEVA.
- **P2 (pendiente del expediente):** si un comprador vuelve a cotizar con el mismo celular o correo, ¿se reutiliza su registro de `clientes`? Mientras no se decida, **se crea uno nuevo cada vez**. Es lo más seguro, porque nadie puede alterar los datos de otro escribiendo su correo.
- **P3 (RN-032):** el rol SUPERUSUARIO sigue PROPUESTO, aunque el front ya tiene la sección "Soporte técnico". ¿Se implementa en la fase 5 marcado como PROPUESTO, o la gestión de usuarios se hace solo con el script de D8 hasta que lo confirme el cliente?
- **P4 (RN-023):** se deja preparada `id_cotizacion_sustituida`, pero **no** se activa la transición T8. ¿De acuerdo?
- **P5 (A2):** ¿aceptas el proxy de Pages Function, o prefieren comprar un dominio desde ya?
- **P6:** ¿apruebas el contenido de V002 (D2, D3, D4, D11)?

## 5. Estructura de archivos

```
backend/
  package.json                 scripts: start, test, test:unit, test:int, lint, format, db:migrar, db:pruebas, usuario:crear, depurar
  .env.example                 PUERTO, DB_HOST, DB_PUERTO, DB_USUARIO, DB_CLAVE, DB_NOMBRE, ORIGENES_PERMITIDOS,
                               SECRETO_ORIGEN, ALMACEN (disco|r2), R2_CUENTA, R2_LLAVE, R2_SECRETO, R2_BUCKET,
                               R2_URL_PUBLICA, WHATSAPP_NEGOCIO, SESION_HORAS=8, BLOQUEO_MINUTOS=15
  eslint.config.js  .prettierrc
  src/
    servidor.js                arranca app y escucha
    app.js                     crearApp({ config, db, almacen }) → Express app (inyectable en pruebas)
    config.js                  leerConfig(env) con Zod; falla al arrancar si falta algo
    db.js                      crearPool(config); conTransaccion(pool, fn)
    errores.js                 class ErrorApi(status, codigo, mensaje); manejadorErrores
    middleware/                idSolicitud, seguridad (helmet, cors, límites), sesion, csrf, rol, limites-peticion
    dominio/                   ¡sin BD ni HTTP!
      dinero.js                aCentavos(texto), aTextoDecimal(centavos)
      precios.js               precioAplicable(rangos, cantidad, hoy), validarMinimo(variante, cantidad)
      fechas.js                hoyMx(ahora), sumarUnMes(fechaIso), anioMx(ahora)
      folio.js                 formatearFolio(anio, consecutivo) → "LA-2026-000001"
      cliente.js               normalizarCelular(texto) → "5512345678" | null
      estatus.js               transicionPermitida(claveDe, claveA) → boolean   (T3–T7; T8 apagada)
      archivos.js              detectarTipo(buffer) → mime | null   (bytes mágicos)
    almacen/                   disco.js, r2.js — ambos: guardar(clave, buffer, mime), borrar(clave), listar(prefijo), urlPublica(clave)
    modulos/
      salud/                   rutas
      catalogo/                rutas, servicio, repositorio, esquemas
      cotizaciones/            rutas, servicio, repositorio, esquemas, pdf.js, whatsapp.js
      sesion/                  rutas, servicio, repositorio
      admin-catalogo/          rutas, servicio, repositorio, esquemas   (categorías, productos, variantes, precios, temáticas, archivos, colores)
      admin-cotizaciones/      rutas, servicio, repositorio, esquemas
      reportes/                rutas, repositorio
      usuarios/                rutas, servicio, repositorio             (según P3)
  scripts/  migrar.js  crear-usuario.js  depurar.js
  test/
    unit/                      un archivo por módulo de dominio
    integracion/               ayudantes.js (base limpia: V001+V00N y datos [Prueba]), un archivo por módulo
    seguridad/                 401/403/400/404, archivo disfrazado, bloqueo de login
functions/api/[[ruta]].js      proxy de Cloudflare Pages (A2)
.github/workflows/backend.yml  lint + pruebas con mysql:8.0 + 22 errores de V001 en cada PR
database/migrations/V002__catalogo_y_personalizacion.sql   D2, D3, D4, D11
database/migrations/V003__sesiones.sql                     A3
```

## 6. Enfoque de revisión

Casos que el prompt da a entender pero ninguna prueba obvia cubre. Cada uno tiene su prueba en la fase indicada:

1. **Cambio de día o de año en CDMX contra UTC:** una cotización emitida el 31-dic a las 23:30 en CDMX (05:30 del 1-ene en UTC) lleva folio `LA-2026-…` y vence el 31-ene-2027. Va en la fase 3: `fechas.test.js` y `folio.test.js`.
2. **Centavos con texto de MySQL:** `"0.10" + "0.20"` suma exactamente 30 centavos, y `"1234567890.99"` no pierde precisión. Va en la fase 1: `dinero.test.js`.
3. **Rangos de precio en el borde:** cantidad igual a `cantidad_hasta` de un rango y a `cantidad_desde` del siguiente; rango vigente que termina hoy (`vigente_hasta = hoy` sí aplica). Va en la fase 2: `precios.test.js`.
4. **Misma variante en dos renglones con personalización distinta:** se permite, cada renglón cumple el mínimo por separado y los subtotales se suman bien. Va en la fase 3: integración.
5. **Producto o variante dados de baja entre que el visitante armó su borrador y lo envió:** responde 422 con el nombre del renglón afectado, sin guardar nada ni dejar archivos subidos. Va en la fase 3: integración.

## 7. Fases

Cada fase tiene su propia rama `backend/fase-NN-nombre` y su PR hacia `main`, con requisitos cubiertos, cómo probar y la salida de `npm test` y de las pruebas de la BD. Al cerrar cada fase te doy un resumen de 5 líneas: qué aprendiste y qué riesgos quedan.

La fase 1 está detallada al nivel de tareas, abajo. Las demás tienen su alcance y su criterio de aceptación; sus tareas detalladas se escriben al empezar cada fase, con la misma plantilla, y las apruebas en el PR.

| Fase | Alcance | Requisitos | Criterio de aceptación (con evidencia ejecutada) |
|---|---|---|---|
| 1 | Estructura, configuración, conexión a BD, errores, seguridad base, `GET /api/salud`, `dinero.js`, CI | RNF-005 | `npm test` y `npm run lint` en verde en local y en Actions; `/api/salud` responde `{ estado: "ok", bd: "ok" }` y 503 si la BD está caída; la config inválida impide arrancar; las 22 pruebas de V001 siguen dando 22 errores |
| 2 | V002 + catálogo público (categorías, productos, detalle con variantes y rangos vigentes, temáticas, colores) | RF-007, RF-008; RN-001, RN-002, RN-008, RN-010, RN-033; D1, D2, D4, D11 | Solo aparece lo activo; los rangos son solo los vigentes hoy; `:id = 12abc` da 400; un id inexistente da 404; V002 trae sus pruebas de restricciones y su reversión |
| 3 | `POST /api/cotizaciones` y `GET /api/cotizaciones/:token` | RF-009 a RF-014; RN-011 a RN-022, RN-024 a RN-026; D3, D5, D7, D9 | Alta completa en una transacción; precios del navegador ignorados; rollback si falla un renglón (sin archivos huérfanos); **20 altas concurrentes dan 20 folios distintos y consecutivos**; `.exe` renombrado a `.png` rechazado; consulta por folio imposible; límite de peticiones por IP (el exceso da 429); 201 con `{ folio, token, fechaEmision, fechaVencimiento, subtotal, total, estatus }` |
| 4 | PDF y mensaje de WhatsApp | RF-015, RF-016; RN-017, RN-022; D10 | El PDF abre, muestra folio, fechas, renglones, total y "envío aparte", y se guarda `pdf_ruta`; el mensaje no contiene el token y el número sale de `WHATSAPP_NEGOCIO` |
| 5 | V003 + login, logout y sesión, CSRF, bloqueo, script de alta de usuario, roles | RF-001; RNF-002; RN-031, RN-032; D8 | El 6.º intento queda bloqueado 15 min (configurable); sin sesión → 401; sin CSRF → 403; cookie con `HttpOnly`, `Secure`, `SameSite=Strict`; la contraseña nunca aparece en logs ni en la BD en claro |
| 6 | CRUD del panel: categorías, productos, variantes, temáticas, colores, archivos y precios | RF-002 a RF-006; RN-003, RN-007, RN-009, RN-033 | "Eliminar" con cotizaciones = baja lógica; duplicado → 409 con mensaje claro; traslape de rangos → 422 sin cambios (prueba con dos peticiones simultáneas); rol incorrecto → 403 en cada ruta |
| 7 | Gestión de cotizaciones: lista con filtros y cursor, detalle con historial, cambio de estatus, `costo_entrega` | RF-017, RF-018; RN-017, RN-028, RN-029 | Solo T3–T7; estatus e historial en la misma transacción; el total se recalcula al capturar el envío; el cursor no repite ni salta registros |
| 8 | Reportes por fechas y producto | RF-019 | Los totales coinciden con una suma hecha a mano sobre datos `[Prueba]` |
| 9 | Depuración programada | RN-030 | Borra por lotes las cotizaciones de más de un año, sus archivos y los clientes sin cotizaciones; si se corre dos veces, la segunda borra 0; deja un registro con los conteos |
| 10 | Integración del front y eliminación del carrito | RF-007 a RF-018; D1, D5–D7, D10 | `grep -rni "carrito\|cart\b\|checkout"` sin resultados (salvo el CHANGELOG); la clave `looart.cotizacion` se conserva; prueba manual de punta a punta en `looart-web.pages.dev`, documentada con capturas |
| 11 | OpenAPI, README, guía de despliegue (Oracle + HeatWave + R2 + proxy) y respaldos | RNF-004, RNF-006 | `openapi.yaml` válido y cubre todas las rutas; la guía lleva de cero a la API en línea; un respaldo se restaura en una base vacía; el usuario MySQL de la app solo tiene `SELECT, INSERT, UPDATE, DELETE` sobre `looart1` (sin `DROP` ni `ALTER`), y se comprueba con `SHOW GRANTS` |

---

## 8. Fase 1 detallada — estructura, configuración, BD y salud

### Tarea 1.1: Proyecto, lint y dinero en centavos

**Archivos:**
- Crear: `backend/package.json`, `backend/eslint.config.js`, `backend/.prettierrc`, `backend/.env.example`, `backend/src/dominio/dinero.js`, `backend/test/unit/dinero.test.js`.
- Modificar: `.gitignore`, para agregar `backend/.env`, `backend/node_modules/` y `backend/almacen-local/`.

**Interfaces:**
- Produce `aCentavos(texto: string) → number`, que lanza `TypeError` si el texto no es un decimal con hasta 2 decimales.
- Produce `aTextoDecimal(centavos: number) → string`, por ejemplo `12345 → "123.45"` y `5 → "0.05"`.

- [ ] **Paso 1: prueba que falla.** `aCentavos("123.45") === 12345`; `aCentavos("0.10") + aCentavos("0.20") === 30`; `aCentavos("1234567890.99") === 123456789099`; `aCentavos("12") === 1200`; `aCentavos("1.234")`, `aCentavos("abc")`, `aCentavos("1e3")` y `aCentavos("-1.00")` lanzan error; `aTextoDecimal(5) === "0.05"`.
- [ ] **Paso 2:** `npm run test:unit` → FALLA porque no encuentra `dinero.js`.
- [ ] **Paso 3:** implementar con una expresión regular `^\d+(\.\d{1,2})?$` y aritmética entera. Nunca `parseFloat`.
- [ ] **Paso 4:** `npm run test:unit` y `npm run lint` → PASAN.
- [ ] **Paso 5:** commit `feat(backend): proyecto base y dinero en centavos`.

### Tarea 1.2: Configuración validada

**Archivos:** crear `backend/src/config.js` y `backend/test/unit/config.test.js`.

**Interfaces:** produce `leerConfig(env: object) → Config` (objeto congelado), que lanza un `Error` cuyo mensaje lista las variables faltantes **sin mostrar valores**.

- [ ] **Paso 1: prueba que falla.**
  - Con un `env` completo de ejemplo, devuelve `db.puerto === 3306` como número.
  - Sin `DB_CLAVE`, lanza un error que menciona `DB_CLAVE` y no contiene ningún valor.
  - `ORIGENES_PERMITIDOS="*"` se rechaza.
  - `ALMACEN="r2"` sin `R2_BUCKET` se rechaza.
- [ ] **Paso 2:** ver que la prueba falla.
- [ ] **Paso 3:** implementar con un esquema Zod `.strict()` sobre las variables de `.env.example`.
- [ ] **Paso 4:** ver que la prueba pasa.
- [ ] **Paso 5:** commit.

### Tarea 1.3: App, errores, seguridad base y `GET /api/salud`

**Archivos:**
- Crear: `src/app.js`, `src/servidor.js`, `src/db.js`, `src/errores.js`, `src/middleware/idSolicitud.js`, `src/middleware/seguridad.js` y `src/modulos/salud/rutas.js`.
- Pruebas: `test/integracion/ayudantes.js`, `test/integracion/salud.test.js` y `test/seguridad/base.test.js`.

**Interfaces:**
- Produce `crearApp({ config, db, almacen }) → express.Application`.
- Produce `conTransaccion(pool, async (conexion) => T) → Promise<T>`, que hace `COMMIT` o `ROLLBACK` y siempre libera la conexión.
- Produce `class ErrorApi extends Error { constructor(status, codigo, mensaje) }`.
- Produce `ayudantes.baseLimpia() → Promise<Pool>`, que aplica V001 y las V00N existentes y aborta si no se cumple A9.

- [ ] **Paso 1: pruebas que fallan.**
  - `GET /api/salud` → 200 `{ estado: "ok", bd: "ok" }`. Con un pool cuyo `query` falla → 503 `{ estado: "degradado", bd: "error" }`.
  - Una ruta que lanza `new Error("SELECT secreto")` → 500 con `error.codigo === "ERROR_INTERNO"`, `idSolicitud` en formato UUID, y el cuerpo **no** contiene `"SELECT"`.
  - Ruta inexistente → 404 `NO_ENCONTRADO`.
  - Cuerpo JSON de más de 100 KB → 413.
  - Hay cabeceras `X-Content-Type-Options: nosniff` y `Content-Security-Policy`.
  - CORS: un origen no listado no recibe `Access-Control-Allow-Origin`.
  - `conTransaccion`: si `fn` lanza un error, la fila insertada no existe después.
- [ ] **Paso 2:** ver que las pruebas fallan.
- [ ] **Paso 3:** implementar.
  - Usar `helmet()`, `cors({ origin: lista, credentials: true })` y `express.json({ limit: "100kb" })`.
  - El pool de mysql2 lleva `dateStrings: true`, `decimalNumbers: false` y `supportBigNumbers: true`, para que nada pase por `float` ni por `Date` en UTC.
- [ ] **Paso 4:** `npm test` → PASA. Además, `mysql --force looart1 < database/tests/V001__pruebas_restricciones.sql` da 22 errores.
- [ ] **Paso 5:** commit.

### Tarea 1.4: CI en GitHub Actions

**Archivos:** crear `.github/workflows/backend.yml`.

- [ ] **Paso 1:** el flujo corre en `pull_request` y en `push` a `main`:
  - Usa el servicio `mysql:8.0` con *healthcheck*.
  - Ejecuta `npm ci`, `npm run lint` y `npm test`.
  - Ejecuta un paso que aplica V001 y cuenta los `ERROR` de las pruebas, y falla si no son exactamente 22.
- [ ] **Paso 2:** abrir el PR y comprobar que el check se pone en verde. La evidencia es el enlace a la ejecución.
- [ ] **Paso 3:** commit `ci(backend): lint, pruebas y restricciones de V001`.

**Cierre de la fase 1:** PR `backend/fase-01-base` → `main` con la salida de `npm test`, el conteo de 22 y el resumen de 5 líneas.
