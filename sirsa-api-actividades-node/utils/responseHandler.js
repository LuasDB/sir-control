/*
 * Respuesta exitosa estándar
*/
export const successResponse = (res, data, message = 'Operación exitosa', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  })
}

/*
 * Respuesta de error estándar
 */
export const errorResponse = (res, message = 'Error en la operación', statusCode = 500, errors = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors })
  })
}
