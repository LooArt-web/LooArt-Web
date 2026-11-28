/**
 * npm run migrar — aplica las migraciones pendientes a la BD de DB_HOST.
 * Usa un usuario con permisos de esquema (no el de la app, que solo tiene
 * SELECT, INSERT, UPDATE y DELETE). No borra nada que ya esté registrado.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { leerConfig } from "../src/config.js";
import { migrar } from "../src/migraciones.js";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../database/migrations");

try {
  const config = leerConfig(process.env);
  const aplicadas = await migrar({
    config,
    dir: DIR,
    registro: { info: (o) => console.log(JSON.stringify(o)) }
  });
  console.log(aplicadas.length ? `Aplicadas: ${aplicadas.join(", ")}` : "Nada pendiente.");
} catch (e) {
  console.error(`No se migró: ${e.message}`);
  process.exitCode = 1;
}
