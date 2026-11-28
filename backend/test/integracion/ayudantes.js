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
import { crearPool, opcionesConexion } from "../../src/db.js";
import { validarResguardo } from "./resguardo.js";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const MIGRACIONES = path.join(RAIZ, "database", "migrations");

export function configDePrueba() {
  const config = leerConfig({
    ORIGENES_PERMITIDOS: "https://looart-web.pages.dev",
    WHATSAPP_NEGOCIO: "520000000000",
    URL_SITIO: "https://looart-web.pages.dev",
    ...process.env
  });
  validarResguardo(config, process.env);
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
    ...opcionesConexion(config),
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
