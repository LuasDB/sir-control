/**
 * generate-vapid.js — Genera un par de llaves VAPID para Web Push.
 *
 * Uso (una sola vez):
 *   node generate-vapid.js
 *
 * Copia la salida a tu archivo .env:
 *   VAPID_PUBLIC_KEY=...
 *   VAPID_PRIVATE_KEY=...
 *   VAPID_SUBJECT=mailto:soporte@siradiacion.com.mx
 *
 * La llave pública se comparte con el navegador; la privada NUNCA se expone.
 * Si regeneras las llaves, todas las suscripciones push existentes quedan
 * inválidas y los usuarios deben volver a activar las notificaciones.
 */
import webpush from 'web-push'

const { publicKey, privateKey } = webpush.generateVAPIDKeys()

console.log('\n# ── Llaves VAPID para Web Push ──────────────────────────────')
console.log(`VAPID_PUBLIC_KEY=${publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${privateKey}`)
console.log('VAPID_SUBJECT=mailto:soporte@siradiacion.com.mx')
console.log('# ───────────────────────────────────────────────────────────\n')
