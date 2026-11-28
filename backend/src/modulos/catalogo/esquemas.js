import { z } from "zod";
import { ErrorApi } from "../../errores.js";

/** Id de BIGINT como texto: entero positivo sin ceros a la izquierda y < 2^53. */
const id = z
  .string()
  .regex(/^[1-9]\d{0,14}$/)
  .transform(Number);

const consultaProductos = z.object({ categoria: id.optional() }).strict();
const consultaVacia = z.object({}).strict();

export function validarId(valor) {
  const r = id.safeParse(valor);
  if (!r.success) throw new ErrorApi(400, "ID_INVALIDO", "El identificador no es válido.");
  return r.data;
}

function validarConsulta(esquema, query) {
  const r = esquema.safeParse({ ...query });
  if (!r.success)
    throw new ErrorApi(400, "CONSULTA_INVALIDA", "Los parámetros de la consulta no son válidos.");
  return r.data;
}

export const validarConsultaProductos = (q) => validarConsulta(consultaProductos, q);
export const validarConsultaVacia = (q) => validarConsulta(consultaVacia, q);
