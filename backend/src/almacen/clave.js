/** Claves de almacenamiento: las genera el servidor, pero se validan siempre. */
const CLAVE_VALIDA = /^[a-z0-9][a-z0-9/_.-]*$/;

export function validarClave(clave) {
  if (
    typeof clave !== "string" ||
    clave.length > 255 ||
    !CLAVE_VALIDA.test(clave) ||
    clave.split("/").some((parte) => parte === "" || parte === "." || parte === "..")
  ) {
    throw new Error("Clave de almacenamiento inválida");
  }
  return clave;
}

export const codificarClave = (clave) => clave.split("/").map(encodeURIComponent).join("/");
