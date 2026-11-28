import { Router } from "express";

/**
 * GET /api/salud — para el monitoreo del hosting.
 * Responde 503 si MySQL no contesta, sin decir por qué (el detalle va al log).
 */
export function rutasSalud({ db, registro }) {
  const r = Router();
  r.get("/", async (req, res) => {
    try {
      await db.query("SELECT 1");
      res.json({ estado: "ok", bd: "ok" });
    } catch (e) {
      registro.error({
        nivel: "error",
        idSolicitud: req.idSolicitud,
        evento: "salud_bd",
        codigo: e.code ?? null
      });
      res.status(503).json({ estado: "degradado", bd: "error" });
    }
  });
  return r;
}
