import express from 'express'
import Notifications from '../services/notifications.service.js'
import { authenticate } from '../middlewares/authMiddleware.js'

const router = express.Router()
const notifications = new Notifications()

/*
 * Endpoints de notificaciones — todos requieren autenticación.
 * Cada usuario solo accede a sus propias notificaciones.
 *
 * GET  /notifications              → lista paginada de mis notificaciones
 * GET  /notifications/unread-count → solo el badge (número no leídas)
 * PATCH /notifications/:id/read    → marcar una como leída
 * PATCH /notifications/read-all    → marcar todas como leídas
 */

const notificationsRouter = (io) => {

  // GET /notifications?read=&type=&page=&limit=
  router.get('/', authenticate, async (req, res, next) => {
    try {
      const userId = req.user._id || req.user.userId

      const filters = {
        read  : req.query.read,
        type  : req.query.type,
        page  : req.query.page,
        limit : req.query.limit
      }

      const result = await notifications.getByUser(userId, filters)

      res.status(200).json({
        success: true,
        data   : result
      })
    } catch (error) {
      next(error)
    }
  })

  // GET /notifications/unread-count — badge del ícono de campana
  // IMPORTANTE: esta ruta va ANTES de /:id para que Express no la interprete como parámetro
  router.get('/unread-count', authenticate, async (req, res, next) => {
    try {
      const userId = req.user._id || req.user.userId
      const result = await notifications.getUnreadCount(userId)

      res.status(200).json({
        success: true,
        data   : result
      })
    } catch (error) {
      next(error)
    }
  })

  // PATCH /notifications/read-all — marcar todas como leídas
  // También va ANTES de /:id
  router.patch('/read-all', authenticate, async (req, res, next) => {
    try {
      const userId = req.user._id || req.user.userId
      const result = await notifications.markAllAsRead(userId)

      if (io) {
        // Notificar al cliente que el badge debe ponerse en 0
        io.emit(`notifications:cleared:${userId}`, { unread: 0 })
      }

      res.status(200).json({
        success: true,
        message: `${result.modified} notificación(es) marcadas como leídas`,
        data   : result
      })
    } catch (error) {
      next(error)
    }
  })

  // PATCH /notifications/:id/read — marcar una notificación específica como leída
  router.patch('/:id/read', authenticate, async (req, res, next) => {
    try {
      const userId = req.user._id || req.user.userId
      const result = await notifications.markAsRead(req.params.id, userId)

      res.status(200).json({
        success: true,
        message: 'Notificación marcada como leída',
        data   : result
      })
    } catch (error) {
      next(error)
    }
  })

  return router
}

export default notificationsRouter
