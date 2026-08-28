import webpush from 'web-push'
import { ObjectId } from 'mongodb'
import { db } from '../db/mongoClient.js'
import config from '../config.js'

/*
 * Colección: push_subscriptions
 *
 * Guarda las suscripciones Web Push (PushSubscription del navegador) de cada
 * usuario. Un mismo usuario puede tener varias (una por dispositivo / navegador).
 *
 * Esquema de documento:
 * {
 *   user_id   : ObjectId
 *   endpoint  : String   (URL única del push service — clave natural)
 *   keys      : { p256dh: String, auth: String }
 *   userAgent : String | null
 *   createdAt : Date
 *   updatedAt : Date
 * }
 *
 * Web Push (VAPID): la notificación llega al dispositivo aunque la PWA esté
 * cerrada. El Service Worker recibe el evento 'push' y muestra la notificación
 * del sistema. Requiere HTTPS. En iOS solo funciona con la PWA instalada
 * (Añadir a pantalla de inicio), iOS 16.4+.
 */

let configured = false

/*
 * Configura las llaves VAPID una sola vez. Devuelve false si no están
 * definidas en el entorno (el push queda deshabilitado sin romper la API).
 */
const ensureConfigured = () => {
  if (configured) return true
  if (!config.vapidPublicKey || !config.vapidPrivateKey) {
    return false
  }
  try {
    webpush.setVapidDetails(
      config.vapidSubject,
      config.vapidPublicKey,
      config.vapidPrivateKey
    )
    configured = true
    return true
  } catch (err) {
    console.error('[PUSH] Llaves VAPID inválidas — Web Push deshabilitado:', err.message)
    return false
  }
}

class PushService {
  constructor() {}

  isEnabled() {
    return ensureConfigured()
  }

  getPublicKey() {
    return config.vapidPublicKey || null
  }

  // ─── Gestión de suscripciones ───────────────────────────────────────────────

  /*
   * Registra (o actualiza) la suscripción de un dispositivo para un usuario.
   * Se identifica por endpoint para no duplicar.
   */
  async saveSubscription(userId, subscription, userAgent = null) {
    if (!ObjectId.isValid(userId)) return null
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return null
    }

    const now = new Date()
    await db.collection('push_subscriptions').updateOne(
      { endpoint: subscription.endpoint },
      {
        $set: {
          user_id  : new ObjectId(userId),
          endpoint : subscription.endpoint,
          keys     : { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
          userAgent: userAgent || null,
          updatedAt: now
        },
        $setOnInsert: { createdAt: now }
      },
      { upsert: true }
    )
    return true
  }

  /*
   * Elimina una suscripción por su endpoint (al desactivar en el dispositivo).
   */
  async removeSubscription(endpoint) {
    if (!endpoint) return null
    return db.collection('push_subscriptions').deleteOne({ endpoint })
  }

  // ─── Envío ──────────────────────────────────────────────────────────────────

  /*
   * Envía una notificación push a todos los dispositivos de un usuario.
   * Fire-and-forget: nunca lanza, solo registra en consola.
   * Limpia automáticamente las suscripciones caducadas (404 / 410).
   *
   * @param {string}  userId
   * @param {object}  payload  - { title, body, url?, tag?, type? }
   */
  async sendToUser(userId, payload) {
    return this.sendToUsers([userId], payload)
  }

  async sendToUsers(userIds, payload) {
    try {
      if (!ensureConfigured()) return
      const ids = [...new Set((userIds || []).map(id => id?.toString()))]
        .filter(id => id && ObjectId.isValid(id))
        .map(id => new ObjectId(id))

      if (!ids.length) return

      const subs = await db.collection('push_subscriptions')
        .find({ user_id: { $in: ids } })
        .toArray()

      if (!subs.length) return

      const body = JSON.stringify({
        title: payload.title || 'SIR-Flow',
        body : payload.body || '',
        url  : payload.url || '/notifications',
        tag  : payload.tag || payload.type || 'sir-flow',
        type : payload.type || null
      })

      const stale = []

      await Promise.all(subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            body,
            { TTL: 60 * 60 * 24, urgency: 'high' }
          )
        } catch (err) {
          // 404 / 410 → suscripción muerta: se elimina
          if (err.statusCode === 404 || err.statusCode === 410) {
            stale.push(sub.endpoint)
          } else {
            console.error('[PUSH] error enviando a', sub.endpoint?.slice(0, 60), err.statusCode || err.message)
          }
        }
      }))

      if (stale.length) {
        await db.collection('push_subscriptions').deleteMany({ endpoint: { $in: stale } })
      }
    } catch (error) {
      console.error('[PUSH] sendToUsers error:', error)
    }
  }
}

export default PushService
