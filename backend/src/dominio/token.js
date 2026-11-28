import { randomBytes } from "node:crypto";

/** 32 caracteres base64url: 24 bytes aleatorios = 192 bits (RN-021). */
export const TOKEN_VALIDO = /^[A-Za-z0-9_-]{32}$/;

export function generarToken() {
  return randomBytes(24).toString("base64url");
}
