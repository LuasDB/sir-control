import { ObjectId } from 'mongodb'
import { db } from '../db/mongoClient.js'
import Boom from '@hapi/boom'

/*
 * Colección: project_chat
 *
 * Esquema de documento:
 * {
 *   project_id : ObjectId  (proyecto al que pertenece el mensaje)
 *   user_id    : ObjectId  (autor del mensaje)
 *   message    : String    (contenido del mensaje, máx 2000 caracteres)
 *   edited     : Boolean   (fue editado por el autor)
 *   deleted    : Boolean   (baja lógica — se muestra como "Mensaje eliminado")
 *   createdAt  : Date
 *   updatedAt  : Date
 * }
 *
 * Diseño:
 * - Los mensajes no se eliminan físicamente para preservar el hilo.
 * - Solo el autor puede editar/eliminar su mensaje (baja lógica).
 * - Managers pueden eliminar cualquier mensaje (moderación).
 * - Se devuelve la info del usuario (name, role) via $lookup para que
 *   el frontend no tenga que hacer llamadas adicionales.
 */

const MAX_MESSAGE_LENGTH = 2000

class ProjectChat {
  constructor() {}

  // ─── Envío de mensaje ────────────────────────────────────────────────────────

  async sendMessage(projectId, userId, message) {
    try {
      if (!ObjectId.isValid(projectId)) {
        throw Boom.badRequest(`El ID de proyecto "${projectId}" no es un ID válido`)
      }
      if (!ObjectId.isValid(userId)) {
        throw Boom.badRequest(`El ID de usuario "${userId}" no es un ID válido`)
      }

      const trimmed = message?.trim()

      if (!trimmed) {
        throw Boom.badData('El mensaje no puede estar vacío')
      }
      if (trimmed.length > MAX_MESSAGE_LENGTH) {
        throw Boom.badData(`El mensaje no puede superar ${MAX_MESSAGE_LENGTH} caracteres`)
      }

      // Verificar que el proyecto existe
      const project = await db.collection('projects').findOne(
        { _id: new ObjectId(projectId) },
        { projection: { _id: 1, status: 1 } }
      )

      if (!project) {
        throw Boom.notFound('El proyecto no fue encontrado')
      }

      const newMessage = {
        project_id : new ObjectId(projectId),
        user_id    : new ObjectId(userId),
        message    : trimmed,
        edited     : false,
        deleted    : false,
        createdAt  : new Date(),
        updatedAt  : new Date()
      }

      const result = await db.collection('project_chat').insertOne(newMessage)

      // Devolver con la info del usuario para emitir por socket inmediatamente
      const user = await db.collection('users').findOne(
        { _id: new ObjectId(userId) },
        { projection: { name: 1, role: 1,avatar_url:1 } }
      )

      return {
        _id      : result.insertedId,
        ...newMessage,
        user
      }

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo enviar el mensaje', error)
    }
  }

  // ─── Historial de mensajes ──────────────────────────────────────────────────

  /*
   * Trae el historial del chat de un proyecto con paginación cursor-based.
   * Se carga de más antiguo a más nuevo para el renderizado del chat.
   *
   * Para cargar más mensajes anteriores (scroll hacia arriba), el frontend
   * envía el _id del mensaje más antiguo que ya tiene como `before`.
   */
  async getMessages(projectId, filters = {}) {
    try {
      if (!ObjectId.isValid(projectId)) {
        throw Boom.badRequest(`El ID de proyecto "${projectId}" no es un ID válido`)
      }

      const limit  = Math.min(parseInt(filters.limit || 30, 10), 100)
      const query  = { project_id: new ObjectId(projectId) }

      // Cursor-based pagination: cargar mensajes anteriores a un _id dado
      if (filters.before && ObjectId.isValid(filters.before)) {
        query._id = { $lt: new ObjectId(filters.before) }
      }

      const messages = await db.collection('project_chat').aggregate([
        { $match: query },
        { $sort: { _id: -1 } },  // más reciente primero para paginar
        { $limit: limit },
        { $sort: { _id: 1 } },   // revertir para mostrar cronológico
        {
          $lookup: {
            from     : 'users',
            localField: 'user_id',
            foreignField: '_id',
            pipeline : [{ $project: { name: 1, role: 1,avatar_url:1 } }],
            as       : 'user'
          }
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          // Ocultar contenido de mensajes eliminados sin romper el hilo
          $project: {
            project_id: 1,
            user_id   : 1,
            user      : 1,
            message   : {
              $cond: {
                if  : '$deleted',
                then: null,
                else: '$message'
              }
            },
            edited   : 1,
            deleted  : 1,
            createdAt: 1,
            updatedAt: 1
          }
        }
      ]).toArray()

      // Indicar al frontend si hay más mensajes para cargar
      let hasMore = false
      if (messages.length > 0) {
        const oldest = messages[0]._id
        const countBefore = await db.collection('project_chat').countDocuments({
          project_id: new ObjectId(projectId),
          _id       : { $lt: oldest }
        })
        hasMore = countBefore > 0
      }

      return { messages, hasMore, limit }

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo traer el historial del chat', error)
    }
  }

  // ─── Edición de mensaje ─────────────────────────────────────────────────────

  /*
   * Solo el autor puede editar su propio mensaje.
   * No hay límite de tiempo para editar (simplificación acordada).
   */
  async editMessage(messageId, userId, newText) {
    try {
      if (!ObjectId.isValid(messageId)) {
        throw Boom.badRequest(`El ID de mensaje "${messageId}" no es un ID válido`)
      }

      const trimmed = newText?.trim()

      if (!trimmed) {
        throw Boom.badData('El mensaje no puede estar vacío')
      }
      if (trimmed.length > MAX_MESSAGE_LENGTH) {
        throw Boom.badData(`El mensaje no puede superar ${MAX_MESSAGE_LENGTH} caracteres`)
      }

      const existing = await db.collection('project_chat').findOne({
        _id: new ObjectId(messageId)
      })

      if (!existing) {
        throw Boom.notFound('Mensaje no encontrado')
      }

      if (existing.deleted) {
        throw Boom.conflict('No se puede editar un mensaje eliminado')
      }

      // Solo el autor puede editar
      if (existing.user_id.toString() !== userId.toString()) {
        throw Boom.forbidden('Solo puedes editar tus propios mensajes')
      }

      const updateOne = await db.collection('project_chat').updateOne(
        { _id: new ObjectId(messageId) },
        {
          $set: {
            message  : trimmed,
            edited   : true,
            updatedAt: new Date()
          }
        }
      )

      return { updateOne, message: trimmed }

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo editar el mensaje', error)
    }
  }

  // ─── Eliminación de mensaje (baja lógica) ───────────────────────────────────

  /*
   * El autor puede eliminar sus propios mensajes.
   * Los managers pueden eliminar cualquier mensaje (moderación).
   * No se elimina físicamente: el hilo permanece pero el contenido se oculta.
   */
  async deleteMessage(messageId, user) {
    try {
      if (!ObjectId.isValid(messageId)) {
        throw Boom.badRequest(`El ID de mensaje "${messageId}" no es un ID válido`)
      }

      const existing = await db.collection('project_chat').findOne({
        _id: new ObjectId(messageId)
      })

      if (!existing) {
        throw Boom.notFound('Mensaje no encontrado')
      }

      if (existing.deleted) {
        throw Boom.conflict('El mensaje ya fue eliminado')
      }

      const managementRoles = ['superadmin','admin','gerente','coordinador']
      const userId = (user._id || user.userId).toString()
      const isManager = managementRoles.includes(user.role)
      const isAuthor  = existing.user_id.toString() === userId

      if (!isManager && !isAuthor) {
        throw Boom.forbidden('Solo puedes eliminar tus propios mensajes')
      }

      const updateOne = await db.collection('project_chat').updateOne(
        { _id: new ObjectId(messageId) },
        {
          $set: {
            deleted  : true,
            updatedAt: new Date()
          }
        }
      )

      return updateOne

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo eliminar el mensaje', error)
    }
  }
}

export default ProjectChat
