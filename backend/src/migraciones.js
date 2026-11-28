/**
 * Aplica las migraciones `database/migrations/V00N__*.sql` pendientes, en orden.
 *
 * - Lleva un registro en `looart1.migraciones_aplicadas` (versión y SHA-256 del
 *   archivo), como el historial de Flyway: V001 borra y recrea tablas, así que
 *   nunca debe volver a correr sobre una base con datos.
 * - Se niega si una migración ya aplicada cambió, si `looart1` tiene tablas pero
 *   no tiene registro (estado desconocido) o si el servidor ignoraría los CHECK.
 * - El DDL de MySQL no es transaccional: si una migración falla a la mitad, no
 *   queda registrada y hay que revisar la base a mano antes de reintentar.
 * Nunca se llama al arrancar la app: solo con `npm run migrar`.
 */
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import { opcionesConexion } from "./db.js";
import { problemasServidor } from "./servidor-bd.js";

const ARCHIVO = /^(V\d{3})__.+\.sql$/;

async function leerMigraciones(dir) {
  const archivos = (await readdir(dir)).filter((f) => ARCHIVO.test(f)).sort();
  return Promise.all(
    archivos.map(async (archivo) => {
      const sql = await readFile(path.join(dir, archivo), "utf8");
      return {
        version: ARCHIVO.exec(archivo)[1],
        archivo,
        sql,
        sha: createHash("sha256").update(sql).digest("hex")
      };
    })
  );
}

async function revisarServidor(cx) {
  const [[{ v }]] = await cx.query("SELECT VERSION() AS v");
  let checkConstraint = null;
  if (/tidb/i.test(v)) {
    [[{ c: checkConstraint }]] = await cx.query(
      "SELECT @@global.tidb_enable_check_constraint AS c"
    );
  }
  const problemas = problemasServidor({ version: v, checkConstraint });
  if (problemas.length) throw new Error(problemas.join(" "));
}

async function registroActual(cx) {
  const [[{ n: tablas }]] = await cx.query(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = 'looart1'"
  );
  const [[{ n: hayRegistro }]] = await cx.query(
    `SELECT COUNT(*) AS n FROM information_schema.tables
      WHERE table_schema = 'looart1' AND table_name = 'migraciones_aplicadas'`
  );
  if (!hayRegistro) {
    if (tablas > 0) {
      throw new Error(
        "looart1 ya tiene tablas pero está sin registro de migraciones: revísala antes de migrar."
      );
    }
    return new Map();
  }
  const [filas] = await cx.query("SELECT version, sha256 FROM looart1.migraciones_aplicadas");
  return new Map(filas.map((f) => [f.version, f.sha256]));
}

/**
 * @param {{ config: object, dir: string, registro?: { info: Function } }} o
 * @returns {Promise<string[]>} Versiones aplicadas en esta corrida.
 */
export async function migrar({ config, dir, registro = { info: () => {} } }) {
  const cx = await mysql.createConnection({
    ...opcionesConexion(config),
    multipleStatements: true
  });
  try {
    await revisarServidor(cx);
    const migraciones = await leerMigraciones(dir);
    const hechas = await registroActual(cx);
    for (const m of migraciones) {
      if (hechas.has(m.version) && hechas.get(m.version) !== m.sha) {
        throw new Error(`${m.version} cambió después de aplicarse: crea una V00N nueva.`);
      }
    }
    const aplicadas = [];
    for (const m of migraciones.filter((x) => !hechas.has(x.version))) {
      await cx.query(m.sql);
      await cx.query(
        `CREATE TABLE IF NOT EXISTS looart1.migraciones_aplicadas (
           version     CHAR(4)      NOT NULL PRIMARY KEY,
           archivo     VARCHAR(200) NOT NULL,
           sha256      CHAR(64)     NOT NULL,
           aplicada_en DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
         ) ENGINE=InnoDB`
      );
      await cx.query(
        "INSERT INTO looart1.migraciones_aplicadas (version, archivo, sha256) VALUES (?, ?, ?)",
        [m.version, m.archivo, m.sha]
      );
      registro.info({ evento: "migracion_aplicada", version: m.version });
      aplicadas.push(m.version);
    }
    return aplicadas;
  } finally {
    await cx.end();
  }
}
