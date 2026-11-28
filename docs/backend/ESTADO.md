# Estado del back-end — 27-nov-2026

- **main:** V001, plan + ADR-001 (#2) y fases 1 a 4 (#3–#6), fusionadas con método merge.
- **PR abierto:** #7 `package-lock.json` generado en CI (Node 22) y `backend.yml` con `npm ci` + caché. CI en verde.
- **Pruebas:** 101/101 con `npm ci` · V001 22 errores · V002 8 errores.
- **Ya funciona (local y CI):** salud, catálogo público, alta y consulta de cotizaciones, PDF y mensaje de WhatsApp por token.
- **Siguiente:** bloque B del prompt v4 (hosting sin tarjeta: Render + TiDB Starter + proxy de Pages, driver de almacenamiento `bd`); después las fases 5, 6, 7 y 10.
- **Decisiones:** P1, P2 y P6 respondidas · token mal formado → 404 · número de WhatsApp solo en `WHATSAPP_NEGOCIO` · no se reescribe el historial de git.
- **Abiertas:**
  - Cuentas de TiDB Cloud, Render y monitor (cron-job.org o UptimeRobot): las crea Zoram. Región propuesta: Oregon.
  - Compatibilidad de TiDB (`CHECK` con `tidb_enable_check_constraint`): se comprueba en B2. Dueño: Claude.
  - P3 SUPERUSUARIO: se pregunta al empezar la fase 5. Dueño: Zoram.
- **Sin bloquear:** P4 (RN-023 preparado y apagado) · catálogo real (por ahora, datos de demostración `[Prueba]`).
- **Herramientas:** conector de GitHub para todo, salvo `.github/workflows/` (403): esos cambios se hacen con el editor web en el navegador.
