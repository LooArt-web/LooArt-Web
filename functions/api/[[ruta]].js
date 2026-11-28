/**
 * Proxy de Cloudflare Pages (A2 / ADR-002): looart-web.pages.dev/api/* → back-end en Render.
 * - El sitio y la API comparten origen: la cookie de sesión del panel no es de terceros.
 * - Agrega X-Origen-Secreto (solo el proxy lo conoce) y X-IP-Visitante (para los límites).
 * - Si Render está dormido o despertando, responde 503 con Retry-After en lugar de un error genérico.
 * Variables del proyecto de Pages: API_ORIGEN (https://...onrender.com) y SECRETO_ORIGEN.
 */
const MAX_CUERPO = 20 * 1024 * 1024;

const json = (status, cuerpo, extra = {}) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extra,
    },
  });

const despertando = () =>
  json(
    503,
    {
      error: {
        codigo: "SERVIDOR_DESPERTANDO",
        mensaje:
          "El servidor se está iniciando. Intenta de nuevo en unos segundos.",
      },
    },
    { "Retry-After": "30" },
  );

const demasiadoGrande = () =>
  json(413, {
    error: {
      codigo: "CUERPO_DEMASIADO_GRANDE",
      mensaje: "La petición pasa de 20 MB.",
    },
  });

export async function onRequest({ request, env }) {
  if (!env.API_ORIGEN || !env.SECRETO_ORIGEN) {
    return json(500, {
      error: {
        codigo: "PROXY_SIN_CONFIGURAR",
        mensaje: "Falta configurar la API.",
      },
    });
  }
  const url = new URL(request.url);
  const destino = new URL(url.pathname + url.search, env.API_ORIGEN);

  const cabeceras = new Headers(request.headers);
  cabeceras.delete("host");
  cabeceras.set("X-Origen-Secreto", env.SECRETO_ORIGEN);
  cabeceras.set(
    "X-IP-Visitante",
    request.headers.get("CF-Connecting-IP") ?? "",
  );

  const conCuerpo = !["GET", "HEAD"].includes(request.method);
  if (
    conCuerpo &&
    Number(request.headers.get("Content-Length") ?? 0) > MAX_CUERPO
  ) {
    return demasiadoGrande();
  }
  // El cuerpo se lee completo: así llega a Render con Content-Length (la API rechaza envíos sin él).
  const cuerpo = conCuerpo ? await request.arrayBuffer() : undefined;
  if (cuerpo && cuerpo.byteLength > MAX_CUERPO) return demasiadoGrande();

  let respuesta;
  try {
    respuesta = await fetch(
      new Request(destino, {
        method: request.method,
        headers: cabeceras,
        body: cuerpo,
        redirect: "manual",
      }),
    );
  } catch (e) {
    // Puede ser Render despertando o un error de configuración (API_ORIGEN mal escrito): se registra.
    console.error(`proxy: no se pudo llegar a la API: ${e?.message ?? e}`);
    return despertando();
  }
  // Un 502/503 sin X-Id-Solicitud viene de Render (servicio dormido o arrancando), no de la API.
  const deLaApi = respuesta.headers.has("X-Id-Solicitud");
  if ((respuesta.status === 502 || respuesta.status === 503) && !deLaApi)
    return despertando();
  return respuesta;
}
