/**
 * Resguardo A9 (PLAN.md): las pruebas de integración borran y recrean `looart1`,
 * así que solo corren con NODE_ENV=test, contra `looart1` y en un host de pruebas.
 * Un host remoto (p. ej. TiDB para la prueba de compatibilidad) solo se acepta si se
 * nombra explícitamente en PRUEBAS_HOST_REMOTO y la conexión usa TLS.
 */
const HOSTS_DE_PRUEBA = new Set(["127.0.0.1", "localhost", "mysql"]);

export function validarResguardo(config, env) {
  if (config.entorno !== "test") throw new Error("Resguardo A9: se requiere NODE_ENV=test");
  if (config.db.nombre !== "looart1") throw new Error("Resguardo A9: la base debe ser looart1");
  if (HOSTS_DE_PRUEBA.has(config.db.host)) return;
  if (!env.PRUEBAS_HOST_REMOTO || env.PRUEBAS_HOST_REMOTO !== config.db.host) {
    throw new Error("Resguardo A9: DB_HOST no está en la lista de hosts de prueba");
  }
  if (!config.db.tls) throw new Error("Resguardo A9: un host remoto de pruebas exige DB_TLS=true");
}
