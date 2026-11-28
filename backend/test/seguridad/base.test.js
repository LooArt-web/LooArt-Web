import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { crearApp } from "../../src/app.js";
import { manejadorErrores, ErrorApi } from "../../src/errores.js";
import { idSolicitud } from "../../src/middleware/idSolicitud.js";
import { leerConfig } from "../../src/config.js";
import { registroEnMemoria } from "../integracion/ayudantes.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

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
const dbOk = { query: async () => [[{ uno: 1 }]] };
const nuevaApp = (registro = registroEnMemoria()) => crearApp({ config, db: dbOk, registro });

/** App mínima con el manejador real, para provocar errores a propósito. */
function appConError(error, registro) {
  const app = express();
  app.use(idSolicitud);
  app.get("/falla", () => {
    throw error;
  });
  app.use(manejadorErrores(registro));
  return app;
}

test("un error inesperado responde 500 genérico, sin SQL ni traza", async () => {
  const registro = registroEnMemoria();
  const r = await request(
    appConError(new Error("SELECT secreto FROM usuarios WHERE correo='z@x.mx'"), registro)
  ).get("/falla");
  assert.equal(r.status, 500);
  assert.equal(r.body.error.codigo, "ERROR_INTERNO");
  assert.match(r.body.error.idSolicitud, UUID);
  assert.equal(Object.keys(r.body.error).sort().join(), "codigo,idSolicitud,mensaje");
  assert.ok(!r.text.includes("SELECT"), "no expone SQL");
  assert.ok(!r.text.includes("at "), "no expone la traza");
  assert.ok(
    registro.lineas.every((l) => !l.includes("z@x.mx")),
    "el log no guarda el mensaje crudo, que puede traer datos personales"
  );
  assert.ok(
    registro.lineas.some((l) => l.includes(r.body.error.idSolicitud)),
    "el log lleva el id para rastrear el error"
  );
});

test("un ErrorApi conserva su estado, código y mensaje", async () => {
  const r = await request(
    appConError(new ErrorApi(422, "CANTIDAD_MINIMA", "Mínimo 5 piezas"), registroEnMemoria())
  ).get("/falla");
  assert.equal(r.status, 422);
  assert.equal(r.body.error.codigo, "CANTIDAD_MINIMA");
  assert.equal(r.body.error.mensaje, "Mínimo 5 piezas");
});

test("cada respuesta lleva X-Id-Solicitud y coincide con el del cuerpo de error", async () => {
  const r = await request(nuevaApp()).get("/api/no-existe");
  assert.equal(r.status, 404);
  assert.equal(r.body.error.codigo, "NO_ENCONTRADO");
  assert.equal(r.headers["x-id-solicitud"], r.body.error.idSolicitud);
});

test("un cuerpo JSON de más de 100 KB responde 413", async () => {
  const r = await request(nuevaApp())
    .post("/api/salud")
    .set("Content-Type", "application/json")
    .send(JSON.stringify({ relleno: "x".repeat(101 * 1024) }));
  assert.equal(r.status, 413);
  assert.equal(r.body.error.codigo, "CUERPO_DEMASIADO_GRANDE");
});

test("un JSON mal formado responde 400 sin eco del contenido", async () => {
  const r = await request(nuevaApp())
    .post("/api/salud")
    .set("Content-Type", "application/json")
    .send('{"nombre": "<script>');
  assert.equal(r.status, 400);
  assert.equal(r.body.error.codigo, "JSON_INVALIDO");
  assert.ok(!r.text.includes("<script>"));
});

test("cabeceras de seguridad presentes y sin X-Powered-By", async () => {
  const r = await request(nuevaApp()).get("/api/salud");
  assert.equal(r.headers["x-content-type-options"], "nosniff");
  assert.ok(r.headers["content-security-policy"], "falta Content-Security-Policy");
  assert.equal(r.headers["x-powered-by"], undefined);
});

test("CORS: el origen permitido recibe credenciales; uno ajeno no recibe permiso", async () => {
  const ok = await request(nuevaApp())
    .get("/api/salud")
    .set("Origin", "https://looart-web.pages.dev");
  assert.equal(ok.headers["access-control-allow-origin"], "https://looart-web.pages.dev");
  assert.equal(ok.headers["access-control-allow-credentials"], "true");

  const ajeno = await request(nuevaApp()).get("/api/salud").set("Origin", "https://malicioso.com");
  assert.equal(ajeno.headers["access-control-allow-origin"], undefined);
});
