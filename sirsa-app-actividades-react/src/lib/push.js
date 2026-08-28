// ─── Web Push — suscripción del dispositivo a notificaciones ──────────────────
import { pushAPI } from '../services/api'

export const pushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

// navigator.serviceWorker.ready nunca resuelve si no hay SW (p.ej. en `npm run dev`).
// Lo limitamos con un timeout para no colgar la UI.
const swReady = (timeoutMs = 4000) =>
  Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => setTimeout(() => reject(new Error('SW no disponible')), timeoutMs)),
  ])

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

/*
 * Estado actual del push en este dispositivo:
 *   { supported, permission, subscribed }
 * permission: 'default' | 'granted' | 'denied'
 */
export const getPushStatus = async () => {
  if (!pushSupported()) {
    return { supported: false, permission: 'unsupported', subscribed: false }
  }
  const permission = Notification.permission
  let subscribed = false
  try {
    const reg = await swReady()
    const sub = await reg.pushManager.getSubscription()
    subscribed = !!sub
  } catch { /* SW aún no listo */ }
  return { supported: true, permission, subscribed }
}

/*
 * Pide permiso, crea la suscripción y la registra en el backend.
 * Devuelve true si quedó activo. Lanza Error con mensaje legible si falla.
 */
export const enablePush = async () => {
  if (!pushSupported()) {
    throw new Error('Este dispositivo o navegador no soporta notificaciones push.')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Permiso de notificaciones bloqueado. Actívalo en los ajustes del navegador para este sitio.'
        : 'No se concedió el permiso de notificaciones.'
    )
  }

  const { data } = await pushAPI.getVapidKey()
  const vapidKey = data?.data?.key
  if (!data?.data?.enabled || !vapidKey) {
    throw new Error('El servidor no tiene configuradas las notificaciones push todavía.')
  }

  const reg = await swReady()

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })
  }

  await pushAPI.subscribe(sub.toJSON())
  return true
}

/*
 * Cancela la suscripción local y la borra del backend.
 */
export const disablePush = async () => {
  if (!pushSupported()) return
  try {
    const reg = await swReady()
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await pushAPI.unsubscribe(sub.endpoint).catch(() => {})
      await sub.unsubscribe()
    }
  } catch { /* no-op */ }
}

/*
 * Si el permiso ya está concedido, re-registra la suscripción en el backend
 * (mantiene fresca la BD y cubre reinstalaciones / rotación de endpoint).
 * Silencioso: nunca lanza.
 */
export const syncPushSubscription = async () => {
  try {
    if (!pushSupported() || Notification.permission !== 'granted') return
    const { data } = await pushAPI.getVapidKey()
    const vapidKey = data?.data?.key
    if (!data?.data?.enabled || !vapidKey) return

    const reg = await swReady()
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
    }
    await pushAPI.subscribe(sub.toJSON())
  } catch { /* silencioso */ }
}
