/**
 * Ayudantes para pruebas contra MySQL 8 real.
 *
 * Resguardo A9 (PLAN.md): V001 borra y recrea `looart1`, así que estas pruebas
 * solo corren con NODE_ENV=test, contra la base `looart1` y en un host de la
 * lista de pruebas. Cualquier otra cosa aborta antes de conectarse.
 */
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import mysql from "mysql2/promise";
import { leerConfig } from "../../src/config.js";
import { crearPool } from "../../src/db.js";

const HOSTS_DE_PRUEBA = new Set(["127.0.0.1", "localhost", "mysql"]);
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const MIGRACIONES = path.join(RAIZ, "database", "migrations");

export function configDePrueba() {
  const config = leerConfig({
    ORIGENES_PERMITIDOS: "https://looart-web.pages.dev",
    ...process.env
  });
  if (config.entorno !== "test") throw new Error("Resguardo A9: se requiere NODE_ENV=test");
  if (config.db.nombre !== "looart1") throw new Error("Resguardo A9: la base debe ser looart1");
  if (!HOSTS_DE_PRUEBA.has(config.db.host)) {
    throw new Error("Resguardo A9: DB_HOST no está en la lista de hosts de prueba");
  }
  return config;
}

/**
 * Borra `looart1` y aplica V001 y las V00N siguientes, en orden.
 * Se borra la base completa porque V001 solo elimina sus propias tablas:
 * las que agregan migraciones posteriores quedarían de una corrida anterior.
 */
export async function aplicarMigraciones(config) {
  const archivos = (await readdir(MIGRACIONES)).filter((f) => /^V\d{3}__.+\.sql$/.test(f)).sort();
  const conexion = await mysql.createConnection({
    host: config.db.host,
    port: config.db.puerto,
    user: config.db.usuario,
    password: config.db.clave,
    multipleStatements: true
  });
  try {
    await conexion.query("DROP DATABASE IF EXISTS looart1");
    for (const archivo of archivos) {
      await conexion.query(await readFile(path.join(MIGRACIONES, archivo), "utf8"));
    }
  } finally {
    await conexion.end();
  }
  return archivos;
}

/** Deja `looart1` recién migrada y devuelve un pool listo para la app. */
export async function baseLimpia() {
  const config = configDePrueba();
  await aplicarMigraciones(config);
  return { config, pool: crearPool(config) };
}

/** Registro que guarda las líneas en memoria, para revisar qué se escribiría en los logs. */
export function registroEnMemoria() {
  const lineas = [];
  return {
    lineas,
    error: (obj) => lineas.push(JSON.stringify(obj)),
    info: (obj) => lineas.push(JSON.stringify(obj))
  };
}
