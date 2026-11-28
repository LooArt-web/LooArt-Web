import { timingSafeEqual, createHash } from "node:crypto";
import { isIP } from "node:net";
import { ErrorApi } from "../errores.js";

const huella = (s) => createHash("sha256").update(String(s)).digest();

/**
 * Proxy de Cloudflare Pages (A2): solo él conoce SECRETO_ORIGEN y lo manda en
 * X-Origen-Secreto. Si coincide, se confía en X-IP-Visitante (la IP real del
 * visitante, para los límites de peticiones); si no, /api responde 403.
 * /api/salud queda libre para el health check de Render.
 */
export function validarOrigen(config) {
  const esperado = config.secretoOrigen ? huella(config.secretoOrigen) : null;
  return (req, _res, next) => {
    if (!esperado) return next();
    const recibido = req.get("x-origen-secreto");
    const valido = recibido !== undefined && timingSafeEqual(huella(recibido), esperado);
    if (!valido) {
      if (req.path === "/api/salud") return next();
      return next(new ErrorApi(403, "ORIGEN_NO_PERMITIDO", "Acceso no permitido."));
    }
    const ip = req.get("x-ip-visitante");
    if (ip && isIP(ip)) Object.defineProperty(req, "ip", { value: ip, configurable: true });
    next();
  };
}
