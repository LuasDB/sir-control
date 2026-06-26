import express from 'express'
import ProjectChat from '../services/projectChat.service.js'
import Notifications from '../services/notifications.service.js'
import { authenticate } from '../middlewares/authMiddleware.js'
import { NOTIFICATION_TYPES } from '../services/notifications.service.js'
import { ObjectId } from 'mongodb'
import { db } from '../db/mongoClient.js'

const router = express.Router()
const chat         = new ProjectChat()
const notifService = new Notifications()

/*
 * Endpoints del chat de proyecto:
 *
 * GET  /projects/:projectId/chat          → historial (paginación cursor-based)
 * POST /projects/:projectId/chat          → enviar mensaje
 * PATCH /projects/:projectId/chat/:msgId  → editar mensaje (solo el autor)
 * DELETE /projects/:projectId/chat/:msgId → eliminar mensaje (autor o manager)
 *
 * Socket.io — salas por proyecto:
 * El frontend se une a la sala con: socket.emit('chat:join', projectId)
 * El servidor emite en: `chat:${projectId}`
 * Eventos emitidos:
 *   chat:message        → nuevo mensaje
 *   chat:message_edited → mensaje editado
 *   chat:message_deleted→ mensaje eliminado (id del mensaje)
 */

const chatRouter = (io) => {

  // ─── Historial ──────────────────────────────────────────────────────────────

  /*
   * GET /projects/:projectId/chat?limit=30&before=<messageId>
   * Carga el historial del chat. Para cargar más mensajes anteriores,
   * el frontend envía el _id del mensaje más antiguo visible como `before`.
   */
  router.get('/:projectId/chat', authenticate, async (req, res, next) => {
    try {
      const result = await chat.getMessages(req.params.projectId, {
        limit : req.query.limit,
        before: req.query.before
      })

      res.status(200).json({
        success: true,
        data   : result
      })
    } catch (error) {
      next(error)
    }
  })

  // ─── Enviar mensaje ──────────────────────────────────────────────────────────

  /*
   * POST /projects/:projectId/chat
   * Body: { message: String }
   *
   * Flujo:
   * 1. Guarda el mensaje en BD.
   * 2. Emite el mensaje en la sala del proyecto vía socket.
   * 3. Crea notificaciones para todos los miembros del proyecto
   *    (asignados a actividades del proyecto + managers del departamento)
   *    excluyendo al remitente.
   * 4. Emite la notificación de forma individual a cada destinatario.
   */
  router.post('/:projectId/chat', authenticate, async (req, res, next) => {
    try {
      const { projectId } = req.params
      const { message }   = req.body
      const userId        = req.user._id || req.user.userId

      const newMessage = await chat.sendMessage(projectId, userId, message)

      // Emitir en la sala del proyecto para todos los conectados
      if (io) {
        io.to(`project:${projectId}`).emit('chat:message', newMessage)
      }

      // ── Cambio 5: Notificaciones — managers globales + members + asignados ──
      const project = await db.collection('projects').findOne(
        { _id: new ObjectId(projectId) },
        { projection: { name: 1, folio_os: 1, members: 1 } }
      )

      // Asignados a actividades del proyecto
      const assigneesRaw = await db.collection('activities').distinct(
        'assignees',
        { project_id: new ObjectId(projectId) }
      )

      // Cambio 5: TODOS los gerentes y coordinadores activos del sistema
      const globalManagers = await db.collection('users').find({
        role  : { $in: ['gerente', 'coordinador'] },
        active: true
      }, { projection: { _id: 1 } }).toArray()

      // Miembros directos del proyecto (cambio 6)
      const projectMembers = (project?.members || []).map(id => id.toString())

      // Deduplicar y excluir al remitente
      const allRecipients = [
        ...assigneesRaw.map(id => id.toString()),
        ...globalManagers.map(m => m._id.toString()),
        ...projectMembers
      ]
      const uniqueRecipients = [...new Set(allRecipients)]
        .filter(id => id !== userId.toString())

      if (uniqueRecipients.length) {
        const payload = {
          type       : NOTIFICATION_TYPES.PROJECT_COMMENT,
          title      : `Nuevo mensaje en ${project?.folio_os || 'un proyecto'}`,
          body       : `${newMessage.user?.name || 'Alguien'}: "${message.slice(0, 80)}${message.length > 80 ? '…' : ''}"`,
          project_id : projectId,
          activity_id: null
        }

        await notifService.createMany(uniqueRecipients, payload)

        if (io) {
          uniqueRecipients.forEach(recipientId => {
            io.to(`user:${recipientId}`).emit(`notification:${recipientId}`, {
              ...payload,
              read     : false,
              createdAt: new Date()
            })
          })
        }
      }

      res.status(201).json({
        success: true,
        message: 'Mensaje enviado',
        data   : newMessage
      })
    } catch (error) {
      next(error)
    }
  })

  // ─── Editar mensaje ──────────────────────────────────────────────────────────

  /*
   * PATCH /projects/:projectId/chat/:msgId
   * Body: { message: String }
   * Solo el autor puede editar.
   */
  router.patch('/:projectId/chat/:msgId', authenticate, async (req, res, next) => {
    try {
      const userId  = req.user._id || req.user.userId
      const { message } = req.body

      const result = await chat.editMessage(req.params.msgId, userId, message)

      if (io) {
        io.to(`project:${req.params.projectId}`).emit('chat:message_edited', {
          messageId: req.params.msgId,
          message  : result.message,
          editedAt : new Date()
        })
      }

      res.status(200).json({
        success: true,
        message: 'Mensaje editado',
        data   : result
      })
    } catch (error) {
      next(error)
    }
  })

  // ─── Eliminar mensaje ────────────────────────────────────────────────────────

  /*
   * DELETE /projects/:projectId/chat/:msgId
   * El autor puede eliminar sus mensajes.
   * Los managers pueden eliminar cualquier mensaje (moderación).
   */
  router.delete('/:projectId/chat/:msgId', authenticate, async (req, res, next) => {
    try {
      const result = await chat.deleteMessage(req.params.msgId, req.user)

      if (io) {
        io.to(`project:${req.params.projectId}`).emit('chat:message_deleted', {
          messageId: req.params.msgId
        })
      }

      res.status(200).json({
        success: true,
        message: 'Mensaje eliminado',
        data   : result
      })
    } catch (error) {
      next(error)
    }
  })

  return router
}

export default chatRouter
