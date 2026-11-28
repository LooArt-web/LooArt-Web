# Documentación de datos — LooArt (looart1)

Nov 26, 2026 · @LooArt

## Propósito y convenciones

Este documento define las reglas, los estados, el significado de cada columna y la trazabilidad de la base de datos **looart1** (MySQL 8.0.16+, InnoDB, utf8mb4). Es la referencia común para Back end (Zoram), Base de datos (David), Front end (Luis) y Documentación (Jafet), y corresponde a `database/migrations/V001__esquema_inicial.sql` más `V002__catalogo_y_personalizacion.sql` (**PROPUESTO**, ver la sección “Cambios de V002”).

Cada regla y decisión lleva uno de tres estados, como pide el expediente del proyecto:

- **CONFIRMADO**: lo expresó el cliente o lo indicó el profesor.
- **PROPUESTO**: recomendación técnica del equipo; requiere validación.
- **PENDIENTE**: falta respuesta, evidencia o decisión.

En la columna “Se aplica en”, **BD** significa que MySQL la hace cumplir con una restricción; **Backend** significa que la valida el código del servidor. Varias reglas necesitan ambas: la base de datos es la última barrera, no la única.

## Reglas de negocio

Hay 33 reglas: 13 confirmadas por el cliente o el profesor, 12 propuestas por el equipo, 6 mixtas (el cliente confirmó qué se necesita y el equipo propone cómo) y 2 pendientes. Las propuestas pueden cambiar sin afectar el esquema; las confirmadas no.

### Catálogo y precios

| ID | Regla | Estado | Se aplica en |
| --- | --- | --- | --- |
| RN-001 | Cada variante tiene una cantidad mínima de piezas. Valores del cliente: mayoría de productos 5, termos 1, stickers 10. | CONFIRMADO | BD: `CHECK cantidad_minima >= 1`. Backend: `cantidad >= cantidad_minima` |
| RN-002 | El precio unitario es el del rango de mayoreo activo y vigente que contiene la cantidad pedida. | CONFIRMADO (mayoreo) / PROPUESTO (mecánica) | Backend: consulta de precio aplicable; índice `idx_precio_busqueda` |
| RN-003 | Los rangos de precio de una misma variante no se traslapan en el mismo periodo de vigencia. | PROPUESTO | Backend, dentro de una transacción (MySQL no puede validarlo con CHECK) |
| RN-004 | Un rango empieza en 1 pieza o más; su límite superior es mayor o igual al inferior, o vacío si no tiene tope. | PROPUESTO | BD: `chk_precio_rango` |
| RN-005 | Los importes nunca son negativos y se expresan en pesos mexicanos (MXN). | CONFIRMADO | BD: `chk_precio_valor`, `chk_cotizacion_importes`, `moneda` = 'MXN' |
| RN-006 | El administrador captura los precios de venta a mano; el sistema no calcula costos internos, márgenes ni ganancias. | CONFIRMADO | Fuera del alcance de la BD: no hay columnas de costo |
| RN-007 | Categorías, productos, variantes, temáticas y precios que aparecen en cotizaciones no se borran: se desactivan (`activo = 0`). | PROPUESTO | BD: FK `ON DELETE RESTRICT`. Backend: botón Eliminar hace baja lógica |
| RN-008 | Solo se pueden cotizar productos y variantes activos con un precio vigente. | PROPUESTO | Backend: filtros `activo = 1` y vigencia |
| RN-009 | No se repiten: nombre de categoría, nombre de temática, nombre de producto dentro de su categoría y combinación nombre + presentación + material de una variante. | PROPUESTO | BD: llaves únicas |
| RN-010 | Las temáticas están disponibles para todos los productos. | CONFIRMADO | BD: sin tabla intermedia producto–temática |
| RN-033 | Cada producto puede tener varias imágenes y modelos 3D. Los archivos se guardan en el almacenamiento de objetos y la base solo guarda su ruta. La imagen principal es la de orden 1. Límites: 5 MB por imagen (JPG, PNG, WebP) y 50 MB por modelo (glTF, GLB). | PROPUESTO | BD: tabla producto\_archivo, uk\_producto\_archivo\_orden, chk\_producto\_archivo\_tipo. Backend: sube el archivo y genera la ruta |

### Cotización

| ID | Regla | Estado | Se aplica en |
| --- | --- | --- | --- |
| RN-011 | Para cotizar no se necesita cuenta ni contraseña. | CONFIRMADO | Diseño: `cliente`s no guarda credenciales |
| RN-012 | Son obligatorios nombre, teléfono móvil, correo y código postal de 5 dígitos. | CONFIRMADO | BD: `NOT NULL` y `chk_cliente_cp`. Backend: formato de correo y teléfono |
| RN-013 | Una cotización tiene uno o más productos. | CONFIRMADO | Backend (la BD no puede exigir al menos un hijo) |
| RN-014 | El backend recalcula precios y totales con datos de la BD; nunca usa los precios que envía el navegador. | CONFIRMADO (RNF-005) | Backend |
| RN-015 | Al emitir, cada renglón guarda una copia (snapshot) del nombre del producto, la variante y el precio. Un cambio posterior de precio no altera cotizaciones emitidas. | PROPUESTO | BD: columnas `producto_snapshot`, `variante_snapshot`, `precio_unitario`\_snapshot |
| RN-016 | Subtotal del renglón = cantidad × precio unitario. | CONFIRMADO | BD: columna generada `subtotal` |
| RN-017 | Total = suma de subtotales + costo de entrega. El costo de entrega queda vacío hasta acordarse por WhatsApp, y el sitio avisa que el envío es un costo extra. | CONFIRMADO | BD: `chk_cotizacion_total`. Backend: suma de renglones |
| RN-018 | Si un precio requiere revisión, se muestra como estimado y la cotización queda en Pendiente de revisión. | CONFIRMADO (precio estimado) / PROPUESTO (estatus) | BD: `es_precio_estimado`. Backend: estatus inicial |
| RN-019 | La cotización vence un mes después de su emisión; ambas fechas se muestran. | CONFIRMADO | BD: `chk_cotizacion_fechas`. Backend: emisión + 1 mes |
| RN-020 | Cada cotización tiene un folio único con formato `LA-AAAA-NNNNNN`, consecutivo por año. | PROPUESTO (el cliente autorizó que el equipo lo proponga) | BD: `uk_cotizaciones_folio` y tabla `folio_secuencia` |
| RN-021 | La cotización se consulta públicamente solo con un enlace que lleva un token aleatorio de 32 caracteres, nunca solo con el folio. | PROPUESTO | BD: `uk_cotizaciones_token`. Backend: genera el token |
| RN-022 | La cotización se guarda antes de abrir WhatsApp y permanece aunque el comprador no envíe el mensaje. | CONFIRMADO | Backend: orden de la operación |
| RN-023 | Al modificar una cotización se emite un folio nuevo; el anterior pasa a Sustituida y queda enlazado al nuevo. | PENDIENTE (el cliente acepta las dos opciones) | BD: `id_cotizacion_sustituida` |

### Personalización y archivos

| ID | Regla | Estado | Se aplica en |
| --- | --- | --- | --- |
| RN-024 | La personalización no tiene costo adicional. | CONFIRMADO | Backend: no altera el precio |
| RN-025 | Cada producto de la cotización tiene como máximo una personalización, con temática prediseñada o escrita por el comprador. | PROPUESTO | BD: `uk_personalizaciones_detalle` |
| RN-026 | La imagen de referencia es opcional: solo JPG, PNG o WebP, de 5 MB como máximo, guardada con un nombre generado por el sistema. | CONFIRMADO (opcional) / PROPUESTO (límites) | BD: `chk_archivo_mime`, `chk_archivo_tamano`. Backend: validar contenido real del archivo |
| RN-027 | Qué significa “presentación” (acabado, empaque, formato u otro). | PENDIENTE | Columnas `variantes.presentacion` y `personalizaciones.presentacion_personalizada` |

### Estatus, retención y seguridad

| ID | Regla | Estado | Se aplica en |
| --- | --- | --- | --- |
| RN-028 | Solo se permiten los cambios de estatus del diagrama de estados; los estados finales ya no cambian. | PROPUESTO | Backend |
| RN-029 | Cada cambio de estatus actualiza la cotización y registra el historial en la misma transacción. | PROPUESTO | Backend; BD: `historial_estatus` |
| RN-030 | Las cotizaciones se conservan un año; después se depuran con sus renglones, personalizaciones, archivos e historial. | CONFIRMADO (1 año) / PROPUESTO (mecánica) | BD: FK `ON DELETE CASCADE`. Backend: tarea de depuración en lotes |
| RN-031 | Solo usuarios activos y autenticados entran al panel; la cuenta se bloquea tras 5 intentos fallidos. Las contraseñas se guardan solo como hash. | CONFIRMADO (panel privado) / PROPUESTO (bloqueo) | BD: `activo`, `intentos_fallidos`, `bloqueado_hasta`, `password_hash`. Backend |
| RN-032 | El Administrador gestiona catálogo, precios, cotizaciones y reportes; el Superusuario además administra cuentas. | CONFIRMADO (Administrador) / PROPUESTO (Superusuario) | BD: `rol`es. Backend: autorización por rol |

## Diagrama de estados de la cotización

Una cotización pasa por 3 estados activos y termina en uno de 3 finales: Aceptada, Cancelada o Sustituida. Es PROPUESTO: el cliente dio los nombres de los estados como ejemplos, pero no las transiciones.

&#91;embedded content: Estados de la cotización · 6 estados, 3 finales\]

El sistema crea la cotización en Nueva, o directamente en Pendiente de revisión si algún precio es estimado. Desde cualquier estado activo se puede cancelar o sustituir.

| # | De | A | Quién | Condición | Efecto en la base de datos |
| --- | --- | --- | --- | --- | --- |
| T1 | (inicio) | Nueva | Sistema | Se guarda la cotización y ningún precio es estimado | INSERT cotizacion (`id_estatus` = 1) + historial con anterior NULL |
| T2 | (inicio) | Pendiente de revisión | Sistema | Algún renglón tiene `es_precio_estimado` = 1 (RN-018) | INSERT cotizacion (`id_estatus` = 2) + historial |
| T3 | Nueva | Pendiente de revisión | Administrador | Detecta que un precio debe revisarse | UPDATE `id_estatus` + INSERT historial |
| T4 | Nueva | Atendida | Administrador | Contactó al comprador por WhatsApp | UPDATE + INSERT historial |
| T5 | Pendiente de revisión | Atendida | Administrador | Confirmó el precio con el comprador | UPDATE + INSERT historial |
| T6 | Atendida | Aceptada | Administrador | El comprador acepta y la cotización no ha vencido | UPDATE + INSERT historial |
| T7 | Nueva, Pendiente o Atendida | Cancelada | Administrador | El comprador desiste o la cotización venció | UPDATE + INSERT historial con motivo en `observacion` |
| T8 | Nueva, Pendiente o Atendida | Sustituida | Sistema | Se emite un folio nuevo con cambios (RN-023, PENDIENTE) | INSERT cotización nueva con `id_cotizacion_sustituida` + UPDATE de la anterior + historial |

Cualquier otro cambio se rechaza en el backend (RN-028). Cada transición se hace en una sola transacción (RN-029). Los estados finales tienen `es_final` = 1.

## Diccionario de datos

La base tiene 16 tablas y 2 vistas, con los nombres reales del esquema de David. Corresponde a la migración congelada `database/migrations/V001__esquema_inicial.sql`, que es la V2 probada por David en MySQL 8.0.46 más la tabla producto\_archivo; David la validó el 27-nov-2026 con los 22 errores esperados. Convenciones comunes:

- Llaves primarias `BIGINT UNSIGNED AUTO_INCREMENT`; los catálogos pequeños usan `TINYINT`.
- Los booleanos son `TINYINT(1)` (1 = sí, 0 = no).
- `creado_en` y `actualizado_en` son `DATETIME NOT NULL` y los llena MySQL solo.
- **Nulo = Sí** significa que el dato es opcional.

### Seguridad

**roles** — Perfiles con acceso al panel privado. El comprador no tiene rol porque no tiene cuenta.

| Columna | Tipo | Nulo | Default | Llave / restricción | Descripción |
| --- | --- | --- | --- | --- | --- |
| id\_rol | TINYINT UNSIGNED | No | auto | PK | 1 ADMINISTRADOR, 2 SUPERUSUARIO |
| nombre | VARCHAR(30) | No | — | UK | Nombre del rol |
| descripcion | VARCHAR(255) | Sí | NULL | — | Qué puede hacer el rol |

**usuarios** — Cuentas del panel administrativo.

| Columna | Tipo | Nulo | Default | Llave / restricción | Descripción |
| --- | --- | --- | --- | --- | --- |
| id\_usuario | BIGINT UNSIGNED | No | auto | PK | Identificador de la cuenta |
| id\_rol | TINYINT UNSIGNED | No | — | FK → roles (RESTRICT) | Perfil de la cuenta (RN-032) |
| nombre\_usuario | VARCHAR(60) | No | — | UK | Nombre para iniciar sesión |
| correo | VARCHAR(150) | No | — | UK | Correo de la cuenta |
| password\_hash | VARCHAR(255) | No | — | — | Hash bcrypt o argon2; nunca la contraseña (RN-031) |
| nombre\_completo | VARCHAR(120) | No | — | — | Nombre de la persona |
| activo | TINYINT(1) | No | 1 | — | 0 = cuenta desactivada |
| intentos\_fallidos | TINYINT UNSIGNED | No | 0 | — | Intentos fallidos seguidos; vuelve a 0 al entrar |
| bloqueado\_hasta | DATETIME | Sí | NULL | — | Fin del bloqueo tras 5 intentos fallidos |
| ultimo\_acceso | DATETIME | Sí | NULL | — | Último inicio de sesión |
| creado\_en / actualizado\_en | DATETIME | No | ahora | — | Auditoría |

### Catálogo

**categorias** — Agrupan productos por tipo.

| Columna | Tipo | Nulo | Default | Llave / restricción | Descripción |
| --- | --- | --- | --- | --- | --- |
| id\_categoria | BIGINT UNSIGNED | No | auto | PK | Identificador |
| nombre | VARCHAR(100) | No | — | UK | Nombre visible, por ejemplo “Termos” |
| descripcion | TEXT | Sí | NULL | — | Texto descriptivo |
| activa | TINYINT(1) | No | 1 | — | 0 = oculta del catálogo (RN-007) |
| creado\_en / actualizado\_en | DATETIME | No | ahora | — | Auditoría |

**productos** — Artículos del catálogo; se cotizan a través de sus variantes. Sus fotos y modelos 3D están en `producto_archivo`.

| Columna | Tipo | Nulo | Default | Llave / restricción | Descripción |
| --- | --- | --- | --- | --- | --- |
| id\_producto | BIGINT UNSIGNED | No | auto | PK | Identificador |
| id\_categoria | BIGINT UNSIGNED | No | — | FK → categorias (RESTRICT) | Categoría a la que pertenece |
| nombre | VARCHAR(150) | No | — | UK (id\_categoria, nombre) | Nombre comercial (RN-009) |
| descripcion | TEXT | Sí | NULL | — | Descripción del detalle del producto |
| maqueta | VARCHAR(10) | No | caja | `CHECK` termo, taza, pin, caja, sticker o foto | **V002, PROPUESTO.** Escena de la vista previa y del visor 3D (D11) |
| recorte | JSON | Sí | NULL | `CHECK` objeto JSON | **V002, PROPUESTO.** Datos de la foto recortada: zona, borde, cara y tamaño del frente y del reverso. Lo valida el backend |
| activo | TINYINT(1) | No | 1 | índice (id\_categoria, activo) | 0 = no aparece en el catálogo |
| creado\_en / actualizado\_en | DATETIME | No | ahora | — | Auditoría |

**producto\_color** — **V002, PROPUESTO (D2).** Colores en que se ofrece un producto; el `hex` tiñe la vista previa. El color elegido se guarda como texto en `personalizaciones.color`.

| Columna | Tipo | Nulo | Default | Llave / restricción | Descripción |
| --- | --- | --- | --- | --- | --- |
| id\_color | BIGINT UNSIGNED | No | auto | PK | Identificador |
| id\_producto | BIGINT UNSIGNED | No | — | FK → productos (CASCADE); UK (id\_producto, nombre) | Producto al que pertenece |
| nombre | VARCHAR(40) | No | — | `CHECK` no vacío | Nombre visible, por ejemplo “Negro” |
| hex | CHAR(7) | No | — | `CHECK` `#RRGGBB` | Color de la vista previa |
| orden | SMALLINT UNSIGNED | No | 1 | `CHECK` ≥ 1 | Orden en la lista |
| activo | TINYINT(1) | No | 1 | — | 0 = ya no se ofrece |
| creado\_en / actualizado\_en | DATETIME | No | ahora | — | Auditoría |

**producto\_archivo** — Fotos y modelos 3D de cada producto. Los archivos viven en el almacenamiento de objetos; aquí solo se guarda su ruta (RN-033).

| Columna | Tipo | Nulo | Default | Llave / restricción | Descripción |
| --- | --- | --- | --- | --- | --- |
| id\_archivo\_producto | BIGINT UNSIGNED | No | auto | PK | Identificador |
| id\_producto | BIGINT UNSIGNED | No | — | FK → productos (CASCADE) | Producto al que pertenece |
| tipo | VARCHAR(10) | No | — | `CHECK` IMAGEN o MODELO\_3D | Clase de archivo |
| cara | VARCHAR(7) | No | frente | `CHECK` frente o reverso; reverso solo en IMAGEN | **V002, PROPUESTO.** Foto del frente o del reverso (pines, cajas, foto libre) |
| ruta | VARCHAR(500) | No | — | UK | Clave generada por el backend en el almacenamiento |
| nombre\_original | VARCHAR(255) | No | — | — | Nombre con el que se subió; solo para mostrar |
| tipo\_mime | VARCHAR(50) | No | — | `CHECK` según el tipo | Imágenes: jpeg, png, webp. Modelos: glTF o GLB |
| tamano\_bytes | INT UNSIGNED | No | — | `CHECK` según el tipo | Máximo 5 MB por imagen y 50 MB por modelo (PROPUESTO) |
| orden | SMALLINT UNSIGNED | No | 1 | UK (id\_producto, tipo, orden) | Posición en la galería; 1 = principal de su tipo |
| texto\_alternativo | VARCHAR(255) | Sí | NULL | — | Descripción de la imagen para accesibilidad |
| activo | TINYINT(1) | No | 1 | — | 0 = oculto del catálogo |
| creado\_en / actualizado\_en | DATETIME | No | ahora | — | Auditoría |

**variantes** — Combinación vendible de un producto (presentación + material). Es lo que el comprador elige.

| Columna | Tipo | Nulo | Default | Llave / restricción | Descripción |
| --- | --- | --- | --- | --- | --- |
| id\_variante | BIGINT UNSIGNED | No | auto | PK | Identificador |
| id\_producto | BIGINT UNSIGNED | No | — | FK → productos (RESTRICT) | Producto al que pertenece |
| nombre | VARCHAR(120) | No | — | UK (id\_producto, nombre, presentacion, material) | Nombre de la variante, por ejemplo “500 ml” |
| presentacion | VARCHAR(120) | No | '' | parte del UK | PENDIENTE de definir (RN-027); vacío si no aplica |
| material | VARCHAR(120) | No | '' | parte del UK | Material; vacío si no aplica |
| cantidad\_minima | INT UNSIGNED | No | 1 | `CHECK >= 1` | Piezas mínimas por pedido (RN-001) |
| activa | TINYINT(1) | No | 1 | índice (id\_producto, activa) | 0 = no se puede cotizar |
| creado\_en / actualizado\_en | DATETIME | No | ahora | — | Auditoría |

**precios** — Precio de venta por rango de cantidad (mayoreo) y vigencia.

| Columna | Tipo | Nulo | Default | Llave / restricción | Descripción |
| --- | --- | --- | --- | --- | --- |
| id\_precio | BIGINT UNSIGNED | No | auto | PK | Identificador |
| id\_variante | BIGINT UNSIGNED | No | — | FK → variantes (RESTRICT); índice (id\_variante, activo, cantidad\_desde) | Variante a la que aplica |
| precio\_unitario | DECIMAL(12,2) | No | — | `CHECK >= 0` | Precio por pieza en MXN (RN-005) |
| cantidad\_desde | INT UNSIGNED | No | 1 | `CHECK >= 1` | Inicio del rango (RN-004) |
| cantidad\_hasta | INT UNSIGNED | Sí | NULL | `CHECK >= cantidad_desde` | Fin del rango; NULL = sin tope |
| vigente\_desde | DATE | No | — | — | Primer día en que aplica |
| vigente\_hasta | DATE | Sí | NULL | `CHECK >= vigente_desde` | Último día; NULL = indefinido |
| activo | TINYINT(1) | No | 1 | — | 0 = precio retirado |
| creado\_en / actualizado\_en | DATETIME | No | ahora | — | Auditoría |

**tematicas** — Temáticas prediseñadas que gestiona el administrador (RN-010).

| Columna | Tipo | Nulo | Default | Llave / restricción | Descripción |
| --- | --- | --- | --- | --- | --- |
| id\_tematica | BIGINT UNSIGNED | No | auto | PK | Identificador |
| nombre | VARCHAR(100) | No | — | UK | Nombre visible |
| descripcion | TEXT | Sí | NULL | — | Descripción |
| imagen | VARCHAR(500) | Sí | NULL | — | Ruta de la imagen de muestra |
| activa | TINYINT(1) | No | 1 | — | 0 = no se ofrece al comprador |
| creado\_en / actualizado\_en | DATETIME | No | ahora | — | Auditoría |

### Cotizaciones

**clientes** — Datos de contacto del comprador. Son datos personales: se depuran con la retención de un año (RN-030).

| Columna | Tipo | Nulo | Default | Llave / restricción | Descripción |
| --- | --- | --- | --- | --- | --- |
| id\_cliente | BIGINT UNSIGNED | No | auto | PK | Identificador |
| nombre | VARCHAR(120) | No | — | — | Nombre del comprador (RN-012) |
| telefono | VARCHAR(25) | No | — | índice | Teléfono móvil normalizado, solo dígitos |
| email | VARCHAR(150) | No | — | índice | Correo de contacto |
| codigo\_postal | CHAR(5) | No | — | `CHECK` 5 dígitos | Código postal mexicano |
| creado\_en / actualizado\_en | DATETIME | No | ahora | — | Auditoría |

**folio\_secuencia** — Contador de folios por año. Evita folios duplicados cuando dos personas cotizan al mismo tiempo (RN-020).

| Columna | Tipo | Nulo | Default | Llave / restricción | Descripción |
| --- | --- | --- | --- | --- | --- |
| anio | SMALLINT UNSIGNED | No | — | PK | Año del folio, por ejemplo 2026 |
| ultimo | INT UNSIGNED | No | 0 | — | Último consecutivo emitido en ese año |

**estatus\_cotizacion** — Catálogo fijo de estados (ver diagrama de estados). Se carga con la migración; no se edita desde el panel.

| Columna | Tipo | Nulo | Default | Llave / restricción | Descripción |
| --- | --- | --- | --- | --- | --- |
| id\_estatus | TINYINT UNSIGNED | No | — | PK | 1 Nueva, 2 Pendiente de revisión, 3 Atendida, 4 Aceptada, 5 Cancelada, 6 Sustituida |
| clave | VARCHAR(30) | No | — | UK | Clave que usa el código, por ejemplo NUEVA |
| nombre | VARCHAR(60) | No | — | — | Texto que ve el administrador |
| es\_final | TINYINT(1) | No | 0 | — | 1 = ya no admite cambios (RN-028) |

**cotizaciones** — Encabezado de la solicitud: folio, fechas, totales y estatus actual.

| Columna | Tipo | Nulo | Default | Llave / restricción | Descripción |
| --- | --- | --- | --- | --- | --- |
| id\_cotizacion | BIGINT UNSIGNED | No | auto | PK | Identificador interno |
| id\_cliente | BIGINT UNSIGNED | No | — | FK → clientes (RESTRICT) | Quién solicitó |
| id\_estatus | TINYINT UNSIGNED | No | 1 | FK → estatus\_cotizacion (RESTRICT); índice (id\_estatus, fecha\_emision) | Estatus actual (RN-028) |
| id\_cotizacion\_sustituida | BIGINT UNSIGNED | Sí | NULL | FK → cotizaciones (SET NULL) | Folio anterior que esta cotización reemplaza (RN-023) |
| folio | VARCHAR(40) | No | — | UK | Folio visible `LA-AAAA-NNNNNN` (RN-020) |
| token\_publico | CHAR(32) | No | — | UK | Token aleatorio del enlace público (RN-021) |
| fecha\_emision | DATETIME | No | ahora | índice | Fecha y hora de emisión |
| fecha\_vencimiento | DATE | No | — | `CHECK` posterior a la emisión | Día de vencimiento: emisión + 1 mes (RN-019) |
| subtotal | DECIMAL(12,2) | No | 0.00 | `CHECK >= 0` | Suma de los subtotales de los renglones |
| costo\_entrega | DECIMAL(12,2) | Sí | NULL | `CHECK >= 0` | Envío acordado por WhatsApp; NULL = aún sin acordar (RN-017) |
| total | DECIMAL(12,2) | No | 0.00 | `CHECK = subtotal + costo_entrega` | Importe total |
| moneda | CHAR(3) | No | 'MXN' | `CHECK = 'MXN'` | Moneda (RN-005) |
| observaciones | TEXT | Sí | NULL | — | Notas del administrador |
| pdf\_ruta | VARCHAR(500) | Sí | NULL | — | Ruta del PDF; se llena después de guardar |
| creado\_en / actualizado\_en | DATETIME | No | ahora | — | Auditoría |

**detalle\_cotizacion** — Un renglón por producto cotizado, con copia de los datos al emitir (RN-015).

| Columna | Tipo | Nulo | Default | Llave / restricción | Descripción |
| --- | --- | --- | --- | --- | --- |
| id\_detalle | BIGINT UNSIGNED | No | auto | PK | Identificador |
| id\_cotizacion | BIGINT UNSIGNED | No | — | FK → cotizaciones (CASCADE) | Cotización a la que pertenece |
| id\_variante | BIGINT UNSIGNED | No | — | FK → variantes (RESTRICT) | Variante cotizada; base de los reportes |
| cantidad | INT UNSIGNED | No | — | `CHECK >= 1` | Piezas solicitadas (RN-001) |
| precio\_unitario\_snapshot | DECIMAL(12,2) | No | — | `CHECK >= 0` | Precio aplicado al emitir |
| es\_precio\_estimado | TINYINT(1) | No | 0 | — | 1 = precio estimado sujeto a revisión (RN-018) |
| subtotal | DECIMAL(14,2) | — | generado | columna generada `STORED` | cantidad × precio\_unitario\_snapshot (RN-016); no se escribe |
| producto\_snapshot | VARCHAR(150) | No | — | — | Nombre del producto al emitir |
| variante\_snapshot | VARCHAR(400) | No | — | — | Nombre + presentación + material al emitir |
| creado\_en | DATETIME | No | ahora | — | Auditoría |

**personalizaciones** — Personalización opcional de un renglón; como máximo una por renglón (RN-025).

| Columna | Tipo | Nulo | Default | Llave / restricción | Descripción |
| --- | --- | --- | --- | --- | --- |
| id\_personalizacion | BIGINT UNSIGNED | No | auto | PK | Identificador |
| id\_detalle | BIGINT UNSIGNED | No | — | FK → detalle\_cotizacion (CASCADE); UK | Renglón personalizado (relación 1 : 0..1) |
| id\_tematica | BIGINT UNSIGNED | Sí | NULL | FK → tematicas (RESTRICT) | Temática prediseñada elegida |
| tema | VARCHAR(150) | Sí | NULL | — | Temática escrita por el comprador |
| descripcion | TEXT | Sí | NULL | — | Descripción breve de lo que necesita |
| texto\_personalizado | VARCHAR(500) | Sí | NULL | — | Texto que llevará el producto |
| color | VARCHAR(80) | Sí | NULL | — | Color solicitado |
| presentacion\_personalizada | VARCHAR(150) | Sí | NULL | — | PENDIENTE de definir (RN-027) |
| creado\_en / actualizado\_en | DATETIME | No | ahora | — | Auditoría |

**archivos\_referencia** — Imágenes de referencia que sube el comprador (RN-026).

| Columna | Tipo | Nulo | Default | Llave / restricción | Descripción |
| --- | --- | --- | --- | --- | --- |
| id\_archivo | BIGINT UNSIGNED | No | auto | PK | Identificador |
| id\_personalizacion | BIGINT UNSIGNED | No | — | FK → personalizaciones (CASCADE) | Personalización a la que acompaña |
| nombre\_archivo | VARCHAR(255) | No | — | — | Nombre original del archivo; solo para mostrar |
| ruta | VARCHAR(500) | No | — | UK | Nombre generado por el sistema |
| tipo\_mime | VARCHAR(50) | No | — | `CHECK` jpeg, png o webp | Tipo de archivo |
| tamano\_bytes | INT UNSIGNED | No | — | `CHECK` 1 a 5 242 880 | Tamaño; máximo 5 MB |
| creado\_en | DATETIME | No | ahora | — | Fecha de carga |

**historial\_estatus** — Bitácora de cada cambio de estatus (RN-029).

| Columna | Tipo | Nulo | Default | Llave / restricción | Descripción |
| --- | --- | --- | --- | --- | --- |
| id\_historial | BIGINT UNSIGNED | No | auto | PK | Identificador |
| id\_cotizacion | BIGINT UNSIGNED | No | — | FK → cotizaciones (CASCADE); índice (id\_cotizacion, fecha\_cambio) | Cotización que cambió |
| id\_usuario | BIGINT UNSIGNED | Sí | NULL | FK → usuarios (SET NULL) | Quién hizo el cambio; NULL = el sistema |
| id\_estatus\_anterior | TINYINT UNSIGNED | Sí | NULL | FK → estatus\_cotizacion (RESTRICT) | Estatus previo; NULL al crearse |
| id\_estatus\_nuevo | TINYINT UNSIGNED | No | — | FK → estatus\_cotizacion (RESTRICT) | Estatus resultante |
| fecha\_cambio | DATETIME | No | ahora | — | Momento del cambio |
| observacion | TEXT | Sí | NULL | — | Motivo o comentario del cambio |

### Vistas

| Vista | Qué devuelve | Uso |
| --- | --- | --- |
| vw\_detalle\_cotizaciones | Un renglón por producto cotizado, con folio, estatus, datos del cliente e importes | Detalle de una cotización en el panel y en el PDF |
| vw\_reporte\_producto\_dia | Cotizaciones, unidades e importe por producto y por día | Reportes por rango de fechas y producto (RF-019) |

Ambas vistas usan `SQL SECURITY INVOKER`: se ejecutan con los permisos de quien consulta, así funcionan en cualquier hosting.

## Cambios de V002 (PROPUESTO)

`V002__catalogo_y_personalizacion.sql` guarda en la base lo que el front ya usa para la vista previa y el visor 3D, para que ninguna función se pierda al dejar `localStorage`. Todo es **PROPUESTO** hasta que el equipo lo apruebe en su Pull Request.

| Cambio | Discrepancia | Para qué |
| --- | --- | --- |
| `productos.maqueta` | D11 | Escena 3D: termo, taza, pin, caja, sticker o foto libre |
| `productos.recorte` | D11 | Foto recortada del frente y del reverso |
| `producto_archivo.cara` | D11 | Distinguir la foto del reverso |
| `producto_color` | D2 | Colores del producto con su hex |
| `tematicas.motivo` | D4 | Patrón incluido (puntos, estrellas, flores, rayas, cuadros, corazones, ondas); la `imagen`, si existe, tiene prioridad |
| `personalizaciones.diseno` | D3 | Colocación del diseño (modo, tamaño, ángulo, escala, posición y cara). El backend lo valida |

Pruebas: `tests/V002__pruebas_restricciones.sql` (8 errores esperados). Reversión: `migrations/reversion/V002__revertir.sql`.

## Matriz de trazabilidad

Los 19 requisitos funcionales tienen caso de uso y soporte en datos; 3 dependen de decisiones abiertas. De los 7 no funcionales, 4 tienen soporte en la base de datos, 1 no la toca y 2 están pendientes. Los números de diagrama corresponden a los PNG 01–08.

### Requisitos funcionales

| Requisito | Qué pide | Caso de uso (01) | Reglas | Tablas y columnas | Diagramas | Cobertura |
| --- | --- | --- | --- | --- | --- | --- |
| RF-001 | Iniciar sesión en el panel | Iniciar sesión | RN-031 | usuarios, roles | 04 | Completa |
| RF-002 | CRUD de productos | Gestionar productos y variantes | RN-007, RN-009, RN-033 | productos, producto\_archivo | 04 | Completa |
| RF-003 | CRUD de categorías | Gestionar categorías | RN-007, RN-009 | categorias | 04 | Completa |
| RF-004 | CRUD de temáticas | Gestionar temáticas | RN-007, RN-010 | tematicas | 04 | Completa |
| RF-005 | CRUD de variantes | Gestionar productos y variantes | RN-001, RN-007, RN-009 | variantes | 04 | Depende de RN-027 (presentación) |
| RF-006 | Gestionar precios, mínimos y mayoreo | Gestionar precios y mayoreo | RN-001 a RN-006 | precios, variantes.cantidad\_minima | 04 | Completa |
| RF-007 | Consultar productos activos | Consultar catálogo | RN-008, RN-033 | categorias, productos, producto\_archivo, variantes (activo = 1) | 02, 03 | Completa |
| RF-008 | Elegir variantes y personalizar | Seleccionar productos y variantes; Personalizar producto | RN-024, RN-025 | variantes, personalizaciones, tematicas | 02, 03 | Depende de RN-027 |
| RF-009 | Adjuntar imagen opcional | Adjuntar imagen de referencia | RN-026 | archivos\_referencia | 02, 08 | Completa (límites propuestos) |
| RF-010 | Varios productos por cotización | Solicitar cotización | RN-013 | detalle\_cotizacion | 02, 03 | Completa |
| RF-011 | Validar mínimos por producto | Validar mínimo y precio vigente | RN-001, RN-014 | variantes.cantidad\_minima, detalle\_cotizacion.cantidad | 02, 03, 08 | Completa |
| RF-012 | Pedir nombre, teléfono, correo y CP | Solicitar cotización | RN-011, RN-012 | clientes | 02, 03 | Completa |
| RF-013 | Generar folio único y guardar | Generar folio y PDF | RN-020, RN-022 | cotizaciones.folio, folio\_secuencia | 03, 08 | Completa |
| RF-014 | Mostrar precios, subtotales, total y fechas | Generar folio y PDF | RN-015 a RN-019 | detalle\_cotizacion, cotizaciones, vw\_detalle\_cotizaciones | 08 | Completa |
| RF-015 | Generar PDF | Generar folio y PDF | RN-022 | cotizaciones.pdf\_ruta | 03, 08 | Completa |
| RF-016 | Mensaje de WhatsApp con folio | Abrir WhatsApp con mensaje precargado | RN-022 | cotizaciones, detalle\_cotizacion (lectura) | 02, 03, 08 | Completa |
| RF-017 | Consultar cotizaciones e historial | Consultar cotizaciones; Consultar cotización (token) | RN-021, RN-030 | cotizaciones, historial\_estatus | 04 | Completa |
| RF-018 | Actualizar estatus | Actualizar estatus | RN-023, RN-028, RN-029 | estatus\_cotizacion, historial\_estatus | 04, 09 | Depende de RN-023 (folio sustituido) |
| RF-019 | Reportes por fecha y producto | Generar reportes | RN-015 | vw\_reporte\_producto\_dia (cotizaciones, detalle\_cotizacion, variantes, productos) | 04 | Completa |

### Requisitos no funcionales

| Requisito | Qué pide | Soporte en la base de datos | Reglas | Cobertura |
| --- | --- | --- | --- | --- |
| RNF-001 | Interfaz usable en móviles | Sin impacto en la BD (Front end) | — | Fuera del alcance de datos |
| RNF-002 | Panel protegido con autenticación | usuarios.password\_hash, intentos\_fallidos, bloqueado\_hasta; roles | RN-031, RN-032 | Completa |
| RNF-003 | Cotizaciones persistidas | Transacción de alta; InnoDB | RN-022 | Completa |
| RNF-004 | Servidor disponible siempre | Depende del hosting elegido | — | PENDIENTE: hosting sin contratar |
| RNF-005 | Validación en servidor | CHECK, NOT NULL, UK y FK como última barrera; 22 pruebas en tests/V001\_\_pruebas\_restricciones.sql | RN-014 | Completa (V001 probada el 27-nov-2026: 22 errores esperados) |
| RNF-006 | Respaldos y recuperación | Sin definir | — | PENDIENTE: política de respaldos |
| RNF-007 | Límites y seguridad de archivos | archivos\_referencia y producto\_archivo: tipo\_mime, tamano\_bytes, ruta generada | RN-026, RN-033 | Completa (límites propuestos) |

## Pendientes abiertos

Siete decisiones abiertas bloquean que este documento pase de preliminar a aprobado:

- [ ] Cliente: definir qué significa “presentación” (RN-027).
- [ ] Cliente: elegir entre conservar el folio anterior como Sustituida o eliminarlo (RN-023).
- [ ] Cliente: enviar uno o dos productos reales con variantes, mínimos y rangos de mayoreo para probar RN-001 a RN-004.
- [ ] Cliente o profesor: validar el rol Superusuario (RN-032).
- [ ] Equipo: decidir si un comprador que vuelve a cotizar reutiliza su registro de `cliente` o se crea uno nuevo.
- [ ] Equipo: confirmar los límites de imagen de 5 MB por imagen (JPG, PNG o WebP) y 50 MB por modelo 3D (RN-026, RN-033, RNF-007).
- [ ] Equipo: definir hosting y política de respaldos (RNF-004, RNF-006).
- [x] David: ejecutar el script en MySQL 8.0.16 o superior y probar que cada CHECK rechaza datos inválidos. Hecho: la V2 y la V001 pasaron las pruebas el 27-nov-2026 (22 errores esperados en la V001).
