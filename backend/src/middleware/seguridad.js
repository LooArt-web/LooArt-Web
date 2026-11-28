import helmet from "helmet";
import cors from "cors";
import express from "express";

/**
 * Cabeceras de seguridad, CORS con lista explícita y límite de tamaño del cuerpo.
 * @param {{ origenesPermitidos: string[] }} config
 */
export function seguridadBase(config) {
  return [
    helmet(),
    cors({
      // Lista exacta: nunca "*" junto con credenciales (la cookie del panel).
      origin: [...config.origenesPermitidos],
      credentials: true
    }),
    express.json({ limit: "100kb" })
  ];
}
