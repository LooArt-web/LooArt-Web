import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { crearApp } from "../../src/app.js";
import { leerConfig } from "../../src/config.js";
import { registroEnMemoria } from "../integracion/ayudantes.js";

const config = leerConfig({
  NODE_ENV: "test",
  DB_HOST: "127.0.0.1",
  DB_USUARIO: "x",
  DB_CLAVE: "x",
  DB_NOMBRE: "looart1",
  ORIGENES_PERMITIDOS: "https://looart-web.pages.dev",
  WHATSAPP_NEGOCIO: "520000000000",
  URL_SITIO: "https://looart-web.pages.dev"
});
const sinBd = {
  query: async () => assert.fail("no debió consultar la BD"),
  getConnection: async () => assert.fail("no debió consultar la BD")
};

test("un token mal formado da 404 en PDF y WhatsApp sin consultar la BD", async () => {
  const app = crearApp({ config, db: sinBd, registro: registroEnMemoria() });
  for (const t of ["corto", "x".repeat(33), "%27%20OR%201%3D1%20--%20aaaaaaaaaaaaaaaa"]) {
    for (const final of ["pdf", "mensaje-whatsapp"]) {
      const r = await request(app).get(`/api/cotizaciones/${t}/${final}`);
      assert.equal(r.status, 404, `${t}/${final}`);
      assert.equal(r.body.error.codigo, "NO_ENCONTRADO");
    }
  }
});

test("la descarga del PDF tiene límite de peticiones por IP (429)", async () => {
  const app = crearApp({
    config,
    db: sinBd,
    limites: {
      cotizaciones: { ventanaMs: 60_000, max: 1000 },
      pdf: { ventanaMs: 60_000, max: 2 }
    },
    registro: registroEnMemoria()
  });
  const estados = [];
  for (let i = 0; i < 3; i++) {
    estados.push((await request(app).get("/api/cotizaciones/corto/pdf")).status);
  }
  assert.deepEqual(estados, [404, 404, 429]);
  assert.equal(
    (await request(app).get("/api/cotizaciones/corto/mensaje-whatsapp")).status,
    404,
    "el límite del PDF no bloquea el mensaje de WhatsApp"
  );
});
