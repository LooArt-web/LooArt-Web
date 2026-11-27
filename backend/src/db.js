import mysql from "mysql2/promise";

/**
 * Pool de conexiones a MySQL.
 * - decimalNumbers: false → DECIMAL llega como texto ("123.45"); se convierte con dominio/dinero.js.
 * - dateStrings: true    → DATETIME llega como texto, sin convertir a la zona del servidor ni a UTC.
 */
export function crearPool(config) {
  return mysql.createPool({
    host: config.db.host,
    port: config.db.puerto,
    user: config.db.usuario,
    password: config.db.clave,
    database: config.db.nombre,
    connectionLimit: 10,
    decimalNumbers: false,
    // BIGINT (ids) llega como number mientras sea seguro (< 2^53); solo si no cabe, como texto.
    supportBigNumbers: true,
    bigNumberStrings: false,
    dateStrings: true,
    charset: "utf8mb4_0900_ai_ci"
  });
}

/**
 * Ejecuta `fn` dentro de una transacción. Si `fn` termina bien hace COMMIT;
 * si lanza un error hace ROLLBACK y relanza ese error. Siempre libera la conexión.
 * @template T
 * @param {import("mysql2/promise").Pool} pool
 * @param {(conexion: import("mysql2/promise").PoolConnection) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function conTransaccion(pool, fn) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await fn(conexion);
    await conexion.commit();
    return resultado;
  } catch (error) {
    // Si el ROLLBACK también falla (conexión perdida), se conserva el error original:
    // es el que explica qué pasó. MySQL descarta la transacción al cerrarse la conexión.
    await conexion.rollback().catch(() => {});
    throw error;
  } finally {
    conexion.release();
  }
}
