# ADR-001 — Stack del back-end

- **Estado:** Aceptada
- **Fecha:** 27-nov-2026
- **Decidió:** Zoram (back-end), con recomendación de Claude
- **Requisitos relacionados:** RNF-002, RNF-003, RNF-005, RNF-006, RNF-007; RF-015 (PDF); RN-014, RN-021, RN-031

## Contexto

El expediente deja abiertos el lenguaje, el framework y el hosting del back-end. Ya están fijos:

- **Base de datos:** MySQL 8.0 (`looart1`, migración V001 congelada).
- **Front-end:** HTML + JavaScript sin framework, publicado en Cloudflare Pages (`looart-web.pages.dev`).
- **Archivos:** Cloudflare R2, compatible con la API de S3.

El equipo es de estudiantes, el presupuesto de hosting es cero o casi cero, y hay que generar PDF, subir archivos y probar contra un MySQL real.

## Opciones evaluadas

| Criterio | A. Node.js + Express | B. PHP + Laravel | C. Python + FastAPI |
|---|---|---|---|
| Mismo lenguaje que el front | Sí | No | No |
| Validación estricta | Zod | Form Requests | Pydantic |
| Contraseñas | argon2 (Argon2id) | Argon2id nativo | argon2-cffi |
| PDF | pdfkit (ligero) | dompdf | WeasyPrint (dependencias pesadas) |
| R2 / S3 | AWS SDK v3 | Flysystem S3 | boto3 |
| Pruebas con MySQL real | node:test + Supertest + MySQL 8 | PHPUnit | pytest + httpx |
| Hosting | Oracle VM, Render y casi cualquiera | Hosting compartido con MySQL | Oracle VM, Render |
| Curva para el equipo | Baja | Media | Media |

**Descartada además:** Cloudflare Workers. No ejecuta Argon2 nativo, el PDF se complica y exige una base de datos accesible desde internet.

## Decisión

**Node.js 22 LTS + Express**, con:

- **mysql2/promise:** consultas siempre parametrizadas y transacciones explícitas.
- **Zod:** esquemas estrictos, `.strict()` para rechazar propiedades desconocidas.
- **argon2:** Argon2id para contraseñas.
- **pdfkit:** PDF de la cotización.
- **@aws-sdk/client-s3:** acceso a R2.
- **Pruebas:** `node:test` para la lógica pura y Supertest con MySQL 8 real para la integración (en local y en GitHub Actions en cada PR).
- **Lenguaje:** JavaScript con JSDoc, sin TypeScript, para parecerse al front y evitar un paso de compilación.
- **Dinero:** centavos enteros en el código, nunca `float`. En MySQL sigue siendo `DECIMAL(12,2)`.

## Consecuencias

- **Positivas:**
  - Un solo lenguaje en todo el proyecto.
  - La lógica de `js/precios.js` se replica en el servidor de forma directa.
  - Coincide con los ejemplos de la skill `api-security-best-practices`.
- **Negativas:**
  - `argon2` es un módulo nativo y necesita compilarse en el servidor; en Linux x64/ARM64 hay binarios precompilados.
  - Express no impone una estructura, así que el proyecto debe definir capas (rutas → servicios → repositorios) desde el inicio.
- **Abierto (se resuelve en el plan):**
  - Hosting del back-end.
  - Cómo comparte origen con el front para que la cookie de sesión no sea de terceros: un dominio propio con subdominio `api.`, o que Cloudflare Pages reenvíe `/api/*` al back-end.
