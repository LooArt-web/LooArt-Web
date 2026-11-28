/**
 * Comprueba que el servidor de BD respeta las reglas del esquema antes de migrar.
 *
 * MySQL anterior a 8.0.16 y TiDB con `tidb_enable_check_constraint = OFF` aceptan
 * los CHECK de las migraciones pero NO los aplican, sin avisar. Migrar ahí dejaría
 * entrar datos que el esquema prohíbe, así que se detiene antes.
 *
 * @param {{ version: string, checkConstraint?: string | null }} s
 *   `version` = SELECT VERSION(); `checkConstraint` = @@global.tidb_enable_check_constraint (solo TiDB).
 * @returns {string[]} Problemas encontrados; vacío si se puede migrar.
 */
export function problemasServidor({ version, checkConstraint = null }) {
  if (/tidb/i.test(version)) {
    const encendido = ["ON", "1"].includes(String(checkConstraint).toUpperCase());
    return encendido
      ? []
      : [
          "TiDB tiene tidb_enable_check_constraint apagado: los CHECK se ignorarían. " +
            "Ejecuta SET GLOBAL tidb_enable_check_constraint = ON y vuelve a intentar."
        ];
  }
  const [mayor, menor, parche] = version.split(/[.-]/).map(Number);
  const ok = mayor > 8 || (mayor === 8 && (menor > 0 || parche >= 16));
  return ok ? [] : [`Se requiere MySQL 8.0.16 o superior (aplica los CHECK); hay ${version}.`];
}
