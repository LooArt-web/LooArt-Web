import { test } from "node:test";
import assert from "node:assert/strict";
import { validarResguardo } from "../integracion/resguardo.js";

const base = { entorno: "test", db: { nombre: "looart1", host: "127.0.0.1", tls: false } };
const remoto = { ...base, db: { ...base.db, host: "gateway.ejemplo.tidbcloud.com", tls: true } };

test("acepta la BD local de pruebas", () => {
  assert.doesNotThrow(() => validarResguardo(base, {}));
});

test("rechaza si no es NODE_ENV=test o la base no es looart1", () => {
  assert.throws(() => validarResguardo({ ...base, entorno: "production" }, {}), /NODE_ENV/);
  assert.throws(
    () => validarResguardo({ ...base, db: { ...base.db, nombre: "x" } }, {}),
    /looart1/
  );
});

test("un host remoto solo se acepta si se nombra en PRUEBAS_HOST_REMOTO y va con TLS", () => {
  assert.throws(() => validarResguardo(remoto, {}), /DB_HOST/);
  assert.throws(() => validarResguardo(remoto, { PRUEBAS_HOST_REMOTO: "otro.host" }), /DB_HOST/);
  assert.throws(
    () =>
      validarResguardo(
        { ...remoto, db: { ...remoto.db, tls: false } },
        { PRUEBAS_HOST_REMOTO: remoto.db.host }
      ),
    /TLS/
  );
  assert.doesNotThrow(() => validarResguardo(remoto, { PRUEBAS_HOST_REMOTO: remoto.db.host }));
});
