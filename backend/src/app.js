import express from "express";
import { idSolicitud } from "./middleware/idSolicitud.js";
import { seguridadBase } from "./middleware/seguridad.js";
import { manejadorErrores, noEncontrado } from "./errores.js";
import { rutasSalud } from "./modulos/salud/rutas.js";

const registroConsola = {
  error: (obj) => console.error(JSON.stringify(obj)),
  info: (obj) => console.log(JSON.stringify(obj))
};

/**
 * Arma la aplicación. Las dependencias se inyectan para poder probarla
 * con un MySQL real o con uno que simula estar caído.
 * @param {{ config: object, db: { query: Function }, registro?: object }} deps
 */
export function crearApp({ config, db, registro = registroConsola }) {
  const app = express();
  app.disable("x-powered-by");

  app.use(idSolicitud);
  app.use(seguridadBase(config));

  app.use("/api/salud", rutasSalud({ db, registro }));

  app.use(noEncontrado);
  app.use(manejadorErrores(registro));
  return app;
}
