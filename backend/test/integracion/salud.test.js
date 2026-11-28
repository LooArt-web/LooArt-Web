import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { crearApp } from "../../src/app.js";
import { conTransaccion } from "../../src/db.js";
import { baseLimpia, registroEnMemoria } from "./ayudantes.js";

let config, pool;

before(async () => {
  ({ config, pool } = await baseLimpia());
});
after(async () => {
  await pool?.end();
});

test("GET /api/salud responde ok cuando MySQL contesta", async () => {
  const app = crearApp({ config, db: pool, registro: registroEnMemoria() });
  const r = await request(app).get("/api/salud");
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { estado: "ok", bd: "ok" });
});

test("GET /api/salud responde 503 sin detalles cuando MySQL no contesta", async () => {
  const registro = registroEnMemoria();
  const caida = {
    query: async () => {
      throw Object.assign(new Error("connect ECONNREFUSED 10.0.0.5:3306"), {
        code: "ECONNREFUSED"
      });
    }
  };
  const app = crearApp({ config, db: caida, registro });
  const r = await request(app).get("/api/salud");
  assert.equal(r.status, 503);
  assert.deepEqual(r.body, { estado: "degradado", bd: "error" });
  assert.ok(!JSON.stringify(r.body).includes("10.0.0.5"), "no expone la IP de la BD");
  assert.ok(
    registro.lineas.some((l) => l.includes("ECONNREFUSED")),
    "sí lo registra en el log"
  );
});

test("conTransaccion hace COMMIT cuando la función termina bien", async () => {
  const id = await conTransaccion(pool, async (cx) => {
    const [r] = await cx.query("INSERT INTO categorias (nombre) VALUES (?)", ["[Prueba] commit"]);
    return r.insertId;
  });
  const [filas] = await pool.query("SELECT nombre FROM categorias WHERE id_categoria = ?", [id]);
  assert.equal(filas.length, 1);
});

test("conTransaccion hace ROLLBACK y relanza el error si la función falla", async () => {
  await assert.rejects(
    conTransaccion(pool, async (cx) => {
      await cx.query("INSERT INTO categorias (nombre) VALUES (?)", ["[Prueba] rollback"]);
      throw new Error("falla a la mitad");
    }),
    /falla a la mitad/
  );
  const [filas] = await pool.query("SELECT 1 FROM categorias WHERE nombre = ?", [
    "[Prueba] rollback"
  ]);
  assert.equal(filas.length, 0, "la fila insertada antes del error no debe existir");
});

test("conTransaccion libera la conexión aunque falle (el pool no se agota)", async () => {
  for (let i = 0; i < 15; i++) {
    await assert.rejects(
      conTransaccion(pool, async () => {
        throw new Error("x");
      })
    );
  }
  const [[fila]] = await pool.query("SELECT 1 AS uno");
  assert.equal(fila.uno, 1);
});

test("el pool devuelve DECIMAL como texto, DATETIME sin convertir a UTC e ids como número", async () => {
  const [[fila]] = await pool.query(
    "SELECT CAST('123.45' AS DECIMAL(12,2)) AS importe, CAST('2026-12-31 23:30:00' AS DATETIME) AS f, CAST(7 AS UNSIGNED) AS id"
  );
  assert.equal(fila.importe, "123.45");
  assert.equal(fila.f, "2026-12-31 23:30:00");
  assert.equal(fila.id, 7);
});
