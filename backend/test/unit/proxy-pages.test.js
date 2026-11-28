import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../../../functions/api/[[ruta]].js";

const ENV = { API_ORIGEN: "https://looart-api.onrender.com", SECRETO_ORIGEN: "s".repeat(40) };
const fetchOriginal = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

function peticion(url, init = {}) {
  return new Request(url, {
    ...init,
    headers: { "CF-Connecting-IP": "203.0.113.7", Cookie: "x=1", ...(init.headers ?? {}) }
  });
}

test("reenvía a Render con la misma ruta y consulta, el secreto y la IP del visitante", async () => {
  let enviada;
  globalThis.fetch = async (req) => {
    enviada = req;
    return new Response('{"ok":true}', {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };
  const r = await onRequest({
    request: peticion("https://looart-web.pages.dev/api/catalogo/productos?categoria=1"),
    env: ENV
  });
  assert.equal(r.status, 200);
  assert.equal(enviada.url, "https://looart-api.onrender.com/api/catalogo/productos?categoria=1");
  assert.equal(enviada.headers.get("X-Origen-Secreto"), ENV.SECRETO_ORIGEN);
  assert.equal(enviada.headers.get("X-IP-Visitante"), "203.0.113.7");
  assert.equal(enviada.headers.get("Cookie"), "x=1", "la cookie del panel viaja");
});

test("el visitante no puede inyectar su propio secreto ni su IP", async () => {
  let enviada;
  globalThis.fetch = async (req) => {
    enviada = req;
    return new Response("{}", { status: 200 });
  };
  await onRequest({
    request: peticion("https://looart-web.pages.dev/api/salud", {
      headers: { "X-Origen-Secreto": "falso", "X-IP-Visitante": "1.2.3.4" }
    }),
    env: ENV
  });
  assert.equal(enviada.headers.get("X-Origen-Secreto"), ENV.SECRETO_ORIGEN);
  assert.equal(enviada.headers.get("X-IP-Visitante"), "203.0.113.7");
});

test("reenvía el cuerpo de un POST (multipart de la cotización)", async () => {
  let cuerpo;
  globalThis.fetch = async (req) => {
    cuerpo = await req.text();
    return new Response("{}", { status: 201 });
  };
  const r = await onRequest({
    request: peticion("https://looart-web.pages.dev/api/cotizaciones", {
      method: "POST",
      body: "datos=1",
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    }),
    env: ENV
  });
  assert.equal(r.status, 201);
  assert.equal(cuerpo, "datos=1");
});

test("si Render no responde (despertando), contesta 503 con Retry-After y JSON claro", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("fetch failed");
  };
  const r = await onRequest({
    request: peticion("https://looart-web.pages.dev/api/salud"),
    env: ENV
  });
  assert.equal(r.status, 503);
  assert.equal(r.headers.get("Retry-After"), "30");
  assert.equal((await r.json()).error.codigo, "SERVIDOR_DESPERTANDO");
});

test("un 502 o 503 de Render también se traduce a 503 con Retry-After", async () => {
  globalThis.fetch = async () => new Response("Bad Gateway", { status: 502 });
  const r = await onRequest({
    request: peticion("https://looart-web.pages.dev/api/salud"),
    env: ENV
  });
  assert.equal(r.status, 503);
  assert.equal(r.headers.get("Retry-After"), "30");
});

test("sin API_ORIGEN o SECRETO_ORIGEN configurados responde 500 sin llamar a nadie", async () => {
  globalThis.fetch = async () => assert.fail("no debió llamar");
  const r = await onRequest({
    request: peticion("https://looart-web.pages.dev/api/salud"),
    env: {}
  });
  assert.equal(r.status, 500);
});

test("un 503 de nuestra propia API (trae X-Id-Solicitud) se deja pasar tal cual", async () => {
  globalThis.fetch = async () =>
    new Response('{"estado":"degradado","bd":"error"}', {
      status: 503,
      headers: { "X-Id-Solicitud": "abc", "Content-Type": "application/json" }
    });
  const r = await onRequest({
    request: peticion("https://looart-web.pages.dev/api/salud"),
    env: ENV
  });
  assert.equal(r.status, 503);
  assert.equal((await r.json()).bd, "error");
});

test("el proxy rechaza con 413 un cuerpo de más de 20 MB sin llamar a Render", async () => {
  globalThis.fetch = async () => assert.fail("no debió llamar");
  const r = await onRequest({
    request: peticion("https://looart-web.pages.dev/api/cotizaciones", {
      method: "POST",
      body: new Uint8Array(20 * 1024 * 1024 + 1)
    }),
    env: ENV
  });
  assert.equal(r.status, 413);
});

test("si fetch falla, el proxy registra el motivo (no lo oculta) y responde 503", async () => {
  const errores = [];
  const original = console.error;
  console.error = (...a) => errores.push(a.join(" "));
  globalThis.fetch = async () => {
    throw new TypeError("getaddrinfo ENOTFOUND mal.onrender.com");
  };
  try {
    const r = await onRequest({
      request: peticion("https://looart-web.pages.dev/api/salud"),
      env: ENV
    });
    assert.equal(r.status, 503);
  } finally {
    console.error = original;
  }
  assert.ok(errores.some((e) => e.includes("ENOTFOUND")));
});
