import { leerConfig } from "./config.js";
import { crearPool } from "./db.js";
import { crearApp } from "./app.js";

let config;
try {
  config = leerConfig(process.env);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const pool = crearPool(config);
const app = crearApp({ config, db: pool });

const servidor = app.listen(config.puerto, () => {
  console.log(JSON.stringify({ nivel: "info", evento: "inicio", puerto: config.puerto }));
});

// Cierre ordenado: deja de aceptar peticiones y cierra el pool.
for (const senal of ["SIGINT", "SIGTERM"]) {
  process.on(senal, () => {
    servidor.close(() => pool.end().finally(() => process.exit(0)));
  });
}
