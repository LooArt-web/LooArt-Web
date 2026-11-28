import { test } from "node:test";
import assert from "node:assert/strict";
import { conTransaccion } from "../../src/db.js";

/** Pool falso: la conexión registra lo que se le pide y puede fallar al hacer ROLLBACK. */
function poolFalso({ fallaRollback = false } = {}) {
  const llamadas = [];
  const conexion = {
    beginTransaction: async () => llamadas.push("begin"),
    commit: async () => llamadas.push("commit"),
    rollback: async () => {
      llamadas.push("rollback");
      if (fallaRollback) throw new Error("conexión perdida");
    },
    release: () => llamadas.push("release")
  };
  return { llamadas, getConnection: async () => conexion };
}

test("si el ROLLBACK también falla, se relanza el error ORIGINAL y se libera la conexión", async () => {
  const pool = poolFalso({ fallaRollback: true });
  await assert.rejects(
    conTransaccion(pool, async () => {
      throw new Error("error original del renglón");
    }),
    /error original del renglón/
  );
  assert.deepEqual(pool.llamadas, ["begin", "rollback", "release"]);
});
