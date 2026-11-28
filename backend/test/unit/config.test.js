import { test } from "node:test";
import assert from "node:assert/strict";
import { leerConfig } from "../../src/config.js";

const ENV_OK = Object.freeze({
  NODE_ENV: "development",
  PUERTO: "3000",
  DB_HOST: "127.0.0.1",
  DB_PUERTO: "3306",
  DB_USUARIO: "looart_app",
  DB_CLAVE: "clave-super-secreta-123",
  DB_NOMBRE: "looart1",
  ORIGENES_PERMITIDOS: "https://looart-web.pages.dev, http://localhost:5500",
  ALMACEN: "disco",
  WHATSAPP_NEGOCIO: "520000000000",
  URL_SITIO: "https://looart-web.pages.dev"
});

test("leerConfig convierte tipos y separa los orígenes", () => {
  const c = leerConfig({ ...ENV_OK });
  assert.equal(c.puerto, 3000);
  assert.equal(c.db.puerto, 3306);
  assert.equal(c.db.nombre, "looart1");
  assert.deepEqual(c.origenesPermitidos, ["https://looart-web.pages.dev", "http://localhost:5500"]);
  assert.equal(c.almacen.tipo, "disco");
  assert.ok(Object.isFrozen(c), "la configuración no se puede modificar en ejecución");
});

test("leerConfig ignora variables ajenas del sistema (PATH, HOME...)", () => {
  const c = leerConfig({ ...ENV_OK, PATH: "/usr/bin", HOME: "/root" });
  assert.equal(c.db.usuario, "looart_app");
});

test("si falta una variable, el error la nombra sin mostrar ningún valor", () => {
  const env = { ...ENV_OK };
  delete env.DB_CLAVE;
  assert.throws(
    () => leerConfig(env),
    (e) => {
      assert.match(e.message, /DB_CLAVE/);
      for (const valor of Object.values(ENV_OK)) {
        assert.ok(!e.message.includes(valor), `el mensaje filtró el valor ${valor}`);
      }
      return true;
    }
  );
});

test("un valor inválido tampoco aparece en el mensaje de error", () => {
  assert.throws(
    () => leerConfig({ ...ENV_OK, DB_PUERTO: "tres-mil-secreto" }),
    (e) => /DB_PUERTO/.test(e.message) && !e.message.includes("tres-mil-secreto")
  );
});

test("rechaza el comodín * en los orígenes permitidos", () => {
  assert.throws(() => leerConfig({ ...ENV_OK, ORIGENES_PERMITIDOS: "*" }), /ORIGENES_PERMITIDOS/);
  assert.throws(
    () => leerConfig({ ...ENV_OK, ORIGENES_PERMITIDOS: "https://a.com,*" }),
    /ORIGENES_PERMITIDOS/
  );
});

test("rechaza orígenes que no son URL http(s) sin ruta", () => {
  assert.throws(
    () => leerConfig({ ...ENV_OK, ORIGENES_PERMITIDOS: "looart-web.pages.dev" }),
    /ORIGENES_PERMITIDOS/
  );
  assert.throws(
    () => leerConfig({ ...ENV_OK, ORIGENES_PERMITIDOS: "https://a.com/ruta" }),
    /ORIGENES_PERMITIDOS/
  );
});

test("ALMACEN=r2 exige las credenciales de R2", () => {
  assert.throws(() => leerConfig({ ...ENV_OK, ALMACEN: "r2" }), /R2_BUCKET/);
  const c = leerConfig({
    ...ENV_OK,
    ALMACEN: "r2",
    R2_CUENTA: "cuenta",
    R2_LLAVE: "llave",
    R2_SECRETO: "secreto",
    R2_BUCKET: "looart",
    R2_URL_PUBLICA: "https://archivos.looart.mx"
  });
  assert.equal(c.almacen.tipo, "r2");
  assert.equal(c.almacen.r2.bucket, "looart");
});

test("rechaza un tipo de almacenamiento desconocido", () => {
  assert.throws(() => leerConfig({ ...ENV_OK, ALMACEN: "ftp" }), /ALMACEN/);
});

test("SECRETO_ORIGEN, si se define, debe tener al menos 32 caracteres", () => {
  assert.throws(() => leerConfig({ ...ENV_OK, SECRETO_ORIGEN: "corto" }), /SECRETO_ORIGEN/);
  const c = leerConfig({ ...ENV_OK, SECRETO_ORIGEN: "x".repeat(32) });
  assert.equal(c.secretoOrigen.length, 32);
});

test("WHATSAPP_NEGOCIO es obligatoria y solo admite de 12 a 13 dígitos", () => {
  const env = { ...ENV_OK };
  delete env.WHATSAPP_NEGOCIO;
  assert.throws(() => leerConfig(env), /WHATSAPP_NEGOCIO/);
  for (const malo of ["52 55 1234", "5255", "+520000000000", "52000000000000"]) {
    assert.throws(() => leerConfig({ ...ENV_OK, WHATSAPP_NEGOCIO: malo }), /WHATSAPP_NEGOCIO/);
  }
  assert.equal(leerConfig({ ...ENV_OK }).whatsappNegocio, "520000000000");
});

test("URL_SITIO es obligatoria y debe ser un origen sin ruta", () => {
  const env = { ...ENV_OK };
  delete env.URL_SITIO;
  assert.throws(() => leerConfig(env), /URL_SITIO/);
  assert.throws(() => leerConfig({ ...ENV_OK, URL_SITIO: "*" }), /URL_SITIO/);
  assert.throws(
    () => leerConfig({ ...ENV_OK, URL_SITIO: "https://looart-web.pages.dev/folio" }),
    /URL_SITIO/
  );
  assert.equal(leerConfig({ ...ENV_OK }).urlSitio, "https://looart-web.pages.dev");
});

test("DB_TLS activa TLS hacia la BD; por omisión está apagado", () => {
  assert.equal(leerConfig({ ...ENV_OK }).db.tls, false);
  assert.equal(leerConfig({ ...ENV_OK, DB_TLS: "true" }).db.tls, true);
  assert.equal(leerConfig({ ...ENV_OK, DB_TLS: "false" }).db.tls, false);
  assert.throws(() => leerConfig({ ...ENV_OK, DB_TLS: "si" }), /DB_TLS/);
});

test("ALMACEN=bd (archivos en la BD, temporal) es válido y no exige credenciales de R2", () => {
  assert.equal(leerConfig({ ...ENV_OK, ALMACEN: "bd" }).almacen.tipo, "bd");
});

test("en producción SECRETO_ORIGEN es obligatorio (la API solo se usa a través del proxy)", () => {
  assert.throws(() => leerConfig({ ...ENV_OK, NODE_ENV: "production" }), /SECRETO_ORIGEN/);
  const c = leerConfig({ ...ENV_OK, NODE_ENV: "production", SECRETO_ORIGEN: "s".repeat(40) });
  assert.equal(c.entorno, "production");
});

test("PUERTO toma PORT (lo fija Render) si PUERTO no viene", () => {
  assert.equal(leerConfig({ ...ENV_OK, PUERTO: undefined, PORT: "10000" }).puerto, 10000);
  assert.equal(leerConfig({ ...ENV_OK, PUERTO: "3000", PORT: "10000" }).puerto, 3000);
});
