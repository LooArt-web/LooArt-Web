import { test } from "node:test";
import assert from "node:assert/strict";
import { problemasServidor } from "../../src/servidor-bd.js";

test("MySQL 8.0.16 o superior no tiene problemas", () => {
  assert.deepEqual(problemasServidor({ version: "8.0.46" }), []);
  assert.deepEqual(problemasServidor({ version: "8.4.3" }), []);
});

test("MySQL anterior a 8.0.16 se rechaza: ignora los CHECK", () => {
  assert.match(problemasServidor({ version: "8.0.15" })[0], /8\.0\.16/);
  assert.match(problemasServidor({ version: "5.7.44-log" })[0], /8\.0\.16/);
});

test("TiDB con tidb_enable_check_constraint apagado se rechaza", () => {
  const p = problemasServidor({ version: "8.0.11-TiDB-v8.5.1", checkConstraint: "OFF" });
  assert.equal(p.length, 1);
  assert.match(p[0], /tidb_enable_check_constraint/);
});

test("TiDB con tidb_enable_check_constraint encendido no tiene problemas", () => {
  assert.deepEqual(problemasServidor({ version: "8.0.11-TiDB-v8.5.1", checkConstraint: "ON" }), []);
  assert.deepEqual(problemasServidor({ version: "8.0.11-TiDB-v8.5.1", checkConstraint: "1" }), []);
});
