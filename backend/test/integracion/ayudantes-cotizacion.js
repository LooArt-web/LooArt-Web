import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { crearAlmacenDisco } from "../../src/almacen/disco.js";

/** Bytes mínimos de un PNG real (firma + encabezado). */
export const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32, 1)
]);

export const CLIENTE = {
  nombre: "Ana Pérez",
  celular: "+52 55 1234 5678",
  correo: "Ana@Ejemplo.com",
  cp: "01000"
};

/** Almacenamiento en una carpeta temporal propia de cada archivo de pruebas. */
export async function almacenTemporal() {
  const dir = await mkdtemp(path.join(tmpdir(), "looart-almacen-"));
  const almacen = crearAlmacenDisco({ dir, urlBase: "/archivos" });
  return { dir, almacen };
}

/** Lista recursiva de archivos guardados (para comprobar que no quedan huérfanos). */
export async function archivosGuardados(dir) {
  const r = await readdir(dir, { recursive: true, withFileTypes: true });
  return r.filter((e) => e.isFile()).map((e) => e.name);
}

/** Envía una cotización como multipart: `datos` en JSON y `imagen_N` por renglón. */
export function enviarCotizacion(app, datos, imagenes = {}) {
  let r = request(app).post("/api/cotizaciones").field("datos", JSON.stringify(datos));
  for (const [campo, { buffer, nombre, tipo }] of Object.entries(imagenes)) {
    r = r.attach(campo, buffer, { filename: nombre, contentType: tipo });
  }
  return r;
}

export async function contar(pool, tabla) {
  const [[f]] = await pool.query(`SELECT COUNT(*) AS n FROM ${tabla}`);
  return f.n;
}
