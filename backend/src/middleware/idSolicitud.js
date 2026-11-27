import { randomUUID } from "node:crypto";

/** Asigna un id a cada petición para relacionar la respuesta con los logs. */
export function idSolicitud(req, res, next) {
  req.idSolicitud = randomUUID();
  res.set("X-Id-Solicitud", req.idSolicitud);
  next();
}
