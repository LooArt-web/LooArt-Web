import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { crearApp } from "../../src/app.js";
import { leerConfig } from "../../src/config.js";
import { registroEnMemoria } from "../integracion/ayudantes.js";

const SECRETO = "s".repeat(40);
const config = leerConfig({
  NODE_ENV: "test",
  DB_HOST: "127.0.0.1",
  DB_USUARIO: "x",
  DB_CLAVE: "x",
  DB_NOMBRE: "looart1",
  ORIGENES_PERMITIDOS: "https://looart-web.pages.dev",
  WHATSAPP_NEGOCIO: "520000000000",
  URL_SITIO: "https://looart-web.pages.dev",
  SECRETO_ORIGEN: SECRETO
});
const dbOk = { query: async () => [[{ uno: 1 }]] };
const nuevaApp = (limites) =>
  crearApp({ config, db: dbOk, registro: registroEnMemoria(), ...(limites ? { limites } : {}) });

test("con SECRETO_ORIGEN, /api sin la cabecera del proxy o con una distinta responde 403", async () => {
  const app = nuevaApp();
  const sin = await request(app).get("/api/cotizaciones/" + "A".repeat(32));
  assert.equal(sin.status, 403);
  assert.equal(sin.body.error.codigo, "ORIGEN_NO_PERMITIDO");
  const mal = await request(app)
    .get("/api/cotizaciones/" + "A".repeat(32))
    .set("X-Origen-Secreto", "t".repeat(40));
  assert.equal(mal.status, 403);
});

test("con el secreto correcto la petición pasa", async () => {
  const r = await request(nuevaApp())
    .get("/api/cotizaciones/corto")
    .set("X-Origen-Secreto", SECRETO);
  assert.equal(r.status, 404, "llega a la ruta (token mal formado → 404)");
});

test("/api/salud responde sin secreto: lo usa el health check de Render", async () => {
  const r = await request(nuevaApp()).get("/api/salud");
  assert.equal(r.status, 200);
});

test("el límite por IP usa la IP del visitante que manda el proxy, no la del proxy", async () => {
  const app = nuevaApp({
    cotizaciones: { ventanaMs: 60_000, max: 1000 },
    pdf: { ventanaMs: 60_000, max: 1 }
  });
  const pdf = (ip) =>
    request(app)
      .get("/api/cotizaciones/corto/pdf")
      .set("X-Origen-Secreto", SECRETO)
      .set("X-IP-Visitante", ip);
  assert.equal((await pdf("203.0.113.1")).status, 404);
  assert.equal((await pdf("203.0.113.1")).status, 429, "el mismo visitante se limita");
  assert.equal((await pdf("203.0.113.2")).status, 404, "otro visitante no comparte el límite");
});

test("X-IP-Visitante se ignora si no viene con el secreto correcto", async () => {
  const sinSecreto = crearApp({
    config: leerConfig({
      NODE_ENV: "test",
      DB_HOST: "127.0.0.1",
      DB_USUARIO: "x",
      DB_CLAVE: "x",
      DB_NOMBRE: "looart1",
      ORIGENES_PERMITIDOS: "https://looart-web.pages.dev",
      WHATSAPP_NEGOCIO: "520000000000",
      URL_SITIO: "https://looart-web.pages.dev"
    }),
    db: dbOk,
    registro: registroEnMemoria(),
    limites: { cotizaciones: { ventanaMs: 60_000, max: 1000 }, pdf: { ventanaMs: 60_000, max: 1 } }
  });
  const pdf = (ip) =>
    request(sinSecreto).get("/api/cotizaciones/corto/pdf").set("X-IP-Visitante", ip);
  assert.equal((await pdf("203.0.113.1")).status, 404);
  assert.equal((await pdf("203.0.113.9")).status, 429, "cambiar la cabecera no evade el límite");
});
