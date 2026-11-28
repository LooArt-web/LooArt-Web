import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, writeFile, appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import mysql from "mysql2/promise";
import { configDePrueba, MIGRACIONES } from "./ayudantes.js";
import { opcionesConexion } from "../../src/db.js";
import { migrar } from "../../src/migraciones.js";

let config, cx;

async function copiaDeMigraciones() {
  const dir = await mkdtemp(path.join(tmpdir(), "looart-migraciones-"));
  await cp(MIGRACIONES, dir, { recursive: true });
  return dir;
}
const aplicadas = async () =>
  (await cx.query("SELECT version FROM looart1.migraciones_aplicadas ORDER BY version"))[0].map(
    (f) => f.version
  );

before(async () => {
  config = configDePrueba();
  cx = await mysql.createConnection({ ...opcionesConexion(config), multipleStatements: true });
});
after(async () => {
  await cx.query("DROP DATABASE IF EXISTS looart1");
  await cx.end();
});

test("en un servidor vacío aplica todas las migraciones en orden; la segunda vez, ninguna", async () => {
  await cx.query("DROP DATABASE IF EXISTS looart1");
  const dir = await copiaDeMigraciones();
  assert.deepEqual(await migrar({ config, dir }), ["V001", "V002"]);
  assert.deepEqual(await aplicadas(), ["V001", "V002"]);
  const [[f]] = await cx.query("SELECT COUNT(*) AS n FROM looart1.estatus_cotizacion");
  assert.ok(f.n > 0, "V001 cargó el catálogo de estatus");
  assert.deepEqual(await migrar({ config, dir }), []);
});

test("solo aplica las migraciones nuevas y no vuelve a correr V001 (que borra tablas)", async () => {
  await cx.query("DROP DATABASE IF EXISTS looart1");
  const dir = await copiaDeMigraciones();
  await migrar({ config, dir });
  await cx.query(
    "INSERT INTO looart1.clientes (nombre, telefono, email, codigo_postal) VALUES ('[Prueba] A', '5512345678', 'a@b.mx', '01000')"
  );
  await writeFile(
    path.join(dir, "V900__prueba.sql"),
    "CREATE TABLE looart1.tabla_prueba_migrar (id INT PRIMARY KEY);\n"
  );
  assert.deepEqual(await migrar({ config, dir }), ["V900"]);
  const [[f]] = await cx.query("SELECT COUNT(*) AS n FROM looart1.clientes");
  assert.equal(f.n, 1, "los datos siguen ahí");
});

test("se niega si una migración ya aplicada cambió de contenido", async () => {
  await cx.query("DROP DATABASE IF EXISTS looart1");
  const dir = await copiaDeMigraciones();
  await migrar({ config, dir });
  await appendFile(path.join(dir, "V002__catalogo_y_personalizacion.sql"), "\n-- cambio\n");
  await assert.rejects(migrar({ config, dir }), /V002.*cambió/);
});

test("se niega si looart1 ya tiene tablas pero no tiene registro de migraciones", async () => {
  await cx.query("DROP DATABASE IF EXISTS looart1");
  await cx.query("CREATE DATABASE looart1");
  await cx.query("CREATE TABLE looart1.algo (id INT PRIMARY KEY)");
  await assert.rejects(migrar({ config, dir: await copiaDeMigraciones() }), /sin registro/);
});
