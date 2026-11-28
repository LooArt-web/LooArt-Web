# Estado del back-end — 27-nov-2026

- **main:** V001 + plan aprobado y ADR-001 (PR #2 fusionado).
- **PR abiertos (apilados, fusionar en orden, método merge):** #3 fase 1 → #4 fase 2 (V002) → #5 fase 3 → fase 4 (PDF y WhatsApp). CI en verde en #3, #4 y #5.
- **Pruebas (rama fase-04):** 101/101 · V001 22 errores · V002 8 errores.
- **Fase 4:** `GET /api/cotizaciones/:token/pdf` y `/mensaje-whatsapp`; `WHATSAPP_NEGOCIO` y `URL_SITIO` obligatorias; el número ya no está en el front.
- **Faltan:** fases 5 a 11 y el despliegue a staging.
- **Respondidas:** P1 (todo nace en NUEVA) · P2 (cliente nuevo por cotización) · P6 (V002 aprobada, reglas aún PROPUESTO) · token mal formado → 404 · número de WhatsApp confirmado (solo en el servidor).
- **Abiertas:**
  - P3 SUPERUSUARIO: se pregunta al empezar la fase 5. Dueño: Zoram.
  - P5 proxy vs dominio y hosting: se preguntan al empezar el despliegue. Dueño: Zoram.
- **Sin bloquear:** P4 (RN-023 preparado y apagado) · datos reales del catálogo para staging.
- **Herramientas:** `git push` y `gh` sin permiso; se publica con el conector de GitHub (salvo `.github/workflows/`, por el editor web).
