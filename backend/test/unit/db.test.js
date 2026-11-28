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

test("con TLS, el pool exige TLS 1.2+ y verifica el certificado del servidor", async () => {
  const { opcionesConexion } = await import("../../src/db.js");
  const base = { host: "h", puerto: 4000, usuario: "u", clave: "c", nombre: "looart1" };
  assert.equal(opcionesConexion({ db: { ...base, tls: false } }).ssl, undefined);
  assert.deepEqual(opcionesConexion({ db: { ...base, tls: true } }).ssl, {
    minVersion: "TLSv1.2",
    rejectUnauthorized: true
  });
  assert.equal(opcionesConexion({ db: { ...base, tls: true } }).port, 4000);
});
