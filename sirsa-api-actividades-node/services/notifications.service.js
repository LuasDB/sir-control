import { ObjectId } from 'mongodb'
import { db } from '../db/mongoClient.js'
import Boom from '@hapi/boom'

/*
 * Colección: notifications
 *
 * Esquema de documento:
 * {
 *   user_id       : ObjectId   (destinatario)
 *   activity_id   : ObjectId | null
 *   project_id    : ObjectId | null
 *   type          : String     (ver NOTIFICATION_TYPES abajo)
 *   title         : String
 *   body          : String
 *   scheduled_for : Date | null  (solo para alertas de vencimiento programadas)
 *   sent          : Boolean      (false = pendiente de envío por el scheduler)
 *   cancelled     : Boolean      (true = actividad cerrada/cancelada antes de enviarse)
 *   read          : Boolean
 *   createdAt     : Date
 * }
 *
 * Tipos de notificación (NOTIFICATION_TYPES):
 *   activity_assigned  → se te asignó una actividad nueva
 *   progress_update    → alguien registró un avance en una actividad tuya
 *   project_comment    → nuevo comentario en el chat de un proyecto
 *   status_changed     → cambio de estatus en una actividad que te involucra
 *   due_soon           → actividad por vencer (programada, 3 días y 1 día antes)
 *   overdue            → actividad vencida
 *   project_created    → se creó un nuevo proyecto (para managers)
 *   project_closed     → proyecto cerrado
 */

export const NOTIFICATION_TYPES = {
  ACTIVITY_ASSIGNED : 'activity_assigned',
  PROGRESS_UPDATE   : 'progress_update',
  PROJECT_COMMENT   : 'project_comment',
  STATUS_CHANGED    : 'status_changed',
  DUE_SOON          : 'due_soon',
  OVERDUE           : 'overdue',
  PROJECT_CREATED   : 'project_created',
  PROJECT_CLOSED    : 'project_closed'
}

class Notifications {
  constructor() {}

  // ─── Creación de notificaciones ─────────────────────────────────────────────

  /*
   * Crea una o varias notificaciones inmediatas (sent=true, scheduled_for=null).
   * Recibe un array de destinatarios para poder notificar a varias personas
   * con una sola llamada (ej: asignados + gerentes + coordinadores).
   *
   * @param {string[]} userIds   - Array de IDs de destinatarios
   * @param {object}   payload   - { type, title, body, activity_id, project_id }
   * @returns {InsertManyResult}
   */
  async createMany(userIds, payload) {
    try {
      if (!userIds?.length) return null

      const { type, title, body, activity_id, project_id } = payload

      const docs = userIds
        .filter(id => ObjectId.isValid(id))
        .map(userId => ({
          user_id      : new ObjectId(userId),
          activity_id  : activity_id && ObjectId.isValid(activity_id) ? new ObjectId(activity_id)  : null,
          project_id   : project_id  && ObjectId.isValid(project_id)  ? new ObjectId(project_id)   : null,
          type,
          title,
          body,
          scheduled_for: null,
          sent         : true,   // inmediata, ya se emite por socket en el router
          cancelled    : false,
          read         : false,
          createdAt    : new Date()
        }))

      if (!docs.length) return null

      return await db.collection('notifications').insertMany(docs)

    } catch (error) {
      // Fire-and-forget — no lanzamos Boom para no cortar el flujo principal
      console.error('[NOTIF] createMany error:', error)
      return null
    }
  }

  // ─── Consultas ──────────────────────────────────────────────────────────────

  /*
   * Trae todas las notificaciones de un usuario con paginación.
   * Filtra por leídas/no leídas y por tipo.
   */
  async getByUser(userId, filters = {}) {
    try {
      if (!ObjectId.isValid(userId)) {
        throw Boom.badRequest(`El ID "${userId}" no es un ID válido`)
      }

      const query = { user_id: new ObjectId(userId), cancelled: { $ne: true } }

      if (filters.read !== undefined) {
        query.read = filters.read === 'true' || filters.read === true
      }
      if (filters.type) {
        query.type = filters.type
      }

      const page  = Math.max(parseInt(filters.page  || 1, 10), 1)
      const limit = Math.min(parseInt(filters.limit || 20, 10), 100)
      const skip  = (page - 1) * limit

      const [notifications, total, unread] = await Promise.all([
        db.collection('notifications')
          .find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray(),
        db.collection('notifications').countDocuments(query),
        db.collection('notifications').countDocuments({
          user_id  : new ObjectId(userId),
          read     : false,
          cancelled: { $ne: true }
        })
      ])

      return { notifications, total, unread, page, limit }

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudieron traer las notificaciones', error)
    }
  }

  /*
   * Devuelve solo el conteo de no leídas — útil para el badge del ícono.
   */
  async getUnreadCount(userId) {
    try {
      if (!ObjectId.isValid(userId)) {
        throw Boom.badRequest(`El ID "${userId}" no es un ID válido`)
      }

      const count = await db.collection('notifications').countDocuments({
        user_id  : new ObjectId(userId),
        read     : false,
        cancelled: { $ne: true }
      })

      return { unread: count }

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo obtener el conteo de notificaciones', error)
    }
  }

  // ─── Marcado como leído ─────────────────────────────────────────────────────

  /*
   * Marca una notificación específica como leída.
   * Solo el dueño de la notificación puede marcarla.
   */
  async markAsRead(notificationId, userId) {
    try {
      if (!ObjectId.isValid(notificationId)) {
        throw Boom.badRequest(`El ID "${notificationId}" no es un ID válido`)
      }

      const updateOne = await db.collection('notifications').updateOne(
        {
          _id     : new ObjectId(notificationId),
          user_id : new ObjectId(userId)
        },
        { $set: { read: true } }
      )

      if (updateOne.matchedCount === 0) {
        throw Boom.notFound('Notificación no encontrada o no te pertenece')
      }

      return updateOne

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo marcar la notificación como leída', error)
    }
  }

  /*
   * Marca TODAS las notificaciones del usuario como leídas.
   * Se llama cuando el usuario abre el panel de notificaciones.
   */
  async markAllAsRead(userId) {
    try {
      if (!ObjectId.isValid(userId)) {
        throw Boom.badRequest(`El ID "${userId}" no es un ID válido`)
      }

      const result = await db.collection('notifications').updateMany(
        { user_id: new ObjectId(userId), read: false },
        { $set: { read: true } }
      )

      return { modified: result.modifiedCount }

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudieron marcar las notificaciones', error)
    }
  }

  // ─── Scheduler de vencimientos ──────────────────────────────────────────────

  /*
   * Busca notificaciones programadas cuya scheduled_for ya pasó,
   * las marca como sent=true y devuelve el array para que el caller
   * (server.js) las emita por socket en tiempo real.
   *
   * Se invoca desde un setInterval en server.js cada 60 segundos.
   * Diseño: pull-based (el servidor consulta la BD) para no depender
   * de cron jobs externos ni librerías adicionales.
   */
  async dispatchPendingNotifications() {
    try {
      const now = new Date()

      // Obtener pendientes antes de marcarlas, para poder emitirlas
      const pending = await db.collection('notifications').find({
        sent         : false,
        cancelled    : { $ne: true },
        scheduled_for: { $lte: now }
      }).toArray()

      if (!pending.length) return []

      const ids = pending.map(n => n._id)

      await db.collection('notifications').updateMany(
        { _id: { $in: ids } },
        { $set: { sent: true } }
      )

      return pending

    } catch (error) {
      console.error('[SCHEDULER] dispatchPendingNotifications error:', error)
      return []
    }
  }

  /*
   * Busca actividades vencidas que aún no tienen notificación de tipo 'overdue',
   * crea las notificaciones y las devuelve para emitirlas por socket.
   *
   * También se llama desde el scheduler en server.js.
   */
  async createOverdueNotifications() {
    try {
      const now = new Date()

      // Actividades vencidas, no cerradas/canceladas
      const overdueActivities = await db.collection('activities').find({
        target_date: { $lt: now },
        status     : { $nin: ['cerrado', 'cancelado', 'retrasado'] }
      }).toArray()

      if (!overdueActivities.length) return []

      const created = []

      for (const activity of overdueActivities) {
        // Verificar que no exista ya una notificación 'overdue' para esta actividad
        const alreadyNotified = await db.collection('notifications').findOne({
          activity_id: activity._id,
          type       : NOTIFICATION_TYPES.OVERDUE
        })
        if (alreadyNotified) continue

        // Obtener managers del departamento del proyecto
        const project = await db.collection('projects').findOne(
          { _id: activity.project_id },
          { projection: { department_id: 1 } }
        )

        const managers = project?.department_id
          ? await db.collection('users').find({
              department_id: project.department_id,
              role         : { $in: ['gerente', 'coordinador'] },
              active       : true
            }, { projection: { _id: 1 } }).toArray()
          : []

        const recipients = [
          ...(activity.assignees || []),
          ...managers.map(m => m._id)
        ]

        // Deduplicar
        const uniqueIds = [...new Set(recipients.map(id => id.toString()))]

        const docs = uniqueIds.map(userId => ({
          user_id      : new ObjectId(userId),
          activity_id  : activity._id,
          project_id   : activity.project_id,
          type         : NOTIFICATION_TYPES.OVERDUE,
          title        : '⚠️ Actividad vencida',
          body         : `"${activity.name}" ha superado su fecha objetivo`,
          scheduled_for: null,
          sent         : true,
          cancelled    : false,
          read         : false,
          createdAt    : new Date()
        }))

        if (docs.length) {
          await db.collection('notifications').insertMany(docs)
          // Marcar actividad como retrasada
          await db.collection('activities').updateOne(
            { _id: activity._id },
            { $set: { status: 'retrasado', updatedAt: new Date() } }
          )
          created.push({ activity, notifications: docs })
        }
      }

      return created

    } catch (error) {
      console.error('[SCHEDULER] createOverdueNotifications error:', error)
      return []
    }
  }
}

export default Notifications
