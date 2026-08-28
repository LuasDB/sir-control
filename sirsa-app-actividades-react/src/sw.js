/// <reference lib="webworker" />
//
// Service Worker de SIR-Flow (estrategia injectManifest).
// - Precache del shell de la app (generado por vite-plugin-pwa en self.__WB_MANIFEST)
// - Fallback SPA a index.html
// - Web Push: muestra notificaciones del sistema aunque la PWA esté cerrada
//
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

self.skipWaiting()
clientsClaim()

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST || [])

// Cualquier navegación desconocida sirve index.html (SPA con react-router)
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api\//, /^\/sw\.js$/, /^\/workbox-.*\.js$/, /^\/manifest\.webmanifest$/],
  })
)

// ─── Web Push ────────────────────────────────────────────────────────────────
const parsePushData = (event) => {
  if (!event.data) return {}
  try {
    return event.data.json()
  } catch {
    return { body: event.data.text() }
  }
}

self.addEventListener('push', (event) => {
  const data = parsePushData(event)

  const title = data.title || 'SIR-Flow'
  const options = {
    body: data.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-64x64.png',
    lang: 'es-MX',
    tag: data.tag || 'sir-flow',
    renotify: true,
    data: { url: data.url || '/notifications' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/notifications'

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })

      for (const client of clientList) {
        // Si ya hay una ventana de la app abierta, enfócala y navega
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) {
            try { await client.navigate(targetUrl) } catch { /* ignora navegación cross-origin */ }
          }
          return
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl)
      }
    })()
  )
})
