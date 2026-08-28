import express from 'express'
import PushService from '../services/push.service.js'
import { authenticate } from '../middlewares/authMiddleware.js'

const router = express.Router()
const push = new PushService()

/*
 * Web Push — suscripción de dispositivos para notificaciones móviles.
 *
 * GET  /push/vapid-public-key   → llave pública VAPID (para pushManager.subscribe)
 * POST /push/subscribe          → guarda la PushSubscription del dispositivo actual
 * POST /push/unsubscribe        → elimina la suscripción (endpoint)
 */
const pushRouter = () => {

  router.get('/vapid-public-key', authenticate, (req, res) => {
    res.status(200).json({
      success: true,
      data: {
        key    : push.getPublicKey(),
        enabled: push.isEnabled()
      }
    })
  })

  router.post('/subscribe', authenticate, async (req, res, next) => {
    try {
      const userId = req.user._id || req.user.userId
      const { subscription } = req.body

      const saved = await push.saveSubscription(
        userId,
        subscription,
        req.headers['user-agent']
      )

      if (!saved) {
        return res.status(400).json({ success: false, message: 'Suscripción inválida' })
      }

      res.status(201).json({ success: true, message: 'Notificaciones activadas en este dispositivo' })
    } catch (error) {
      next(error)
    }
  })

  router.post('/unsubscribe', authenticate, async (req, res, next) => {
    try {
      const { endpoint } = req.body
      await push.removeSubscription(endpoint)
      res.status(200).json({ success: true, message: 'Notificaciones desactivadas en este dispositivo' })
    } catch (error) {
      next(error)
    }
  })

  return router
}

export default pushRouter
