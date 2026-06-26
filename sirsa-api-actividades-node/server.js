import express from 'express'
import cors from 'cors'
import AppRouter from './routes/index.js'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { logErrors,errorHandler} from './middlewares/hanldeErrors.js'
import { client } from './db/mongoClient.js'
import swaggerUi from 'swagger-ui-express'
import { readFile } from 'fs/promises'
import config from './config.js'
import Notifications from './services/notifications.service.js'

const data = await readFile('./api_documentation_swaggerUi.json', 'utf-8')
const swaggerDoc = JSON.parse(data)

const port = config.port || 3000

// ── Express ──────────────────────────────────────────────────────────────────
const app = express()
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc))

// CORS — descomenta y configura la whitelist cuando vayas a producción
// const whitelist = ['http://localhost:5173']
// const options = {
//   origin: (origin, callback) => {
//     if (whitelist.includes(origin) || !origin) {
//       callback(null, true)
//     } else {
//       callback(new Error('No permitido por CORS'))
//     }
//   }
// }
// app.use(cors(options))
app.use(cors())

// ── Socket.io ────────────────────────────────────────────────────────────────
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin : '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  }
})

io.on('connection', (socket) => {
  console.log(`🔌 Socket conectado: ${socket.id}`)

  /*
   * El cliente emite 'user:register' con su userId al conectarse,
   * para que el servidor lo suscriba a su canal personal de notificaciones.
   * El frontend debe hacer: socket.emit('user:register', userId)
   */
  socket.on('user:register', (userId) => {
    if (userId) {
      socket.join(`user:${userId}`)
      console.log(`👤 Usuario ${userId} registrado en su sala`)
    }
  })

  /*
   * El cliente emite 'chat:join' con el projectId al abrir el chat
   * de un proyecto. El servidor lo une a la sala `project:<projectId>`.
   * El frontend debe hacer: socket.emit('chat:join', projectId)
   */
  socket.on('chat:join', (projectId) => {
    if (projectId) {
      socket.join(`project:${projectId}`)
      console.log(`💬 Socket ${socket.id} unido a sala project:${projectId}`)
    }
  })

  /*
   * El cliente emite 'chat:leave' al salir del chat de un proyecto.
   */
  socket.on('chat:leave', (projectId) => {
    if (projectId) {
      socket.leave(`project:${projectId}`)
    }
  })

  socket.on('disconnect', () => {
    console.log(`❌ Socket desconectado: ${socket.id}`)
  })
})

// ── Scheduler de notificaciones ──────────────────────────────────────────────
/*
 * Cada 60 segundos:
 * 1. Despacha notificaciones programadas (alertas de 3 días y 1 día antes de vencer).
 * 2. Detecta actividades vencidas y crea notificaciones de tipo 'overdue'.
 *
 * Por cada notificación se emite al canal personal del usuario:
 * `notification:<userId>` — el frontend escucha este evento para actualizar el badge.
 */
let schedulerInterval = null

const startScheduler = () => {
  const notifService = new Notifications()

  schedulerInterval = setInterval(async () => {
    try {
      // 1. Despachar notificaciones programadas (due_soon: 3 días y 1 día)
      const pending = await notifService.dispatchPendingNotifications()
      if (pending.length) {
        console.log(`🔔 Despachando ${pending.length} notificación(es) programada(s)`)
        pending.forEach(notif => {
          io.to(`user:${notif.user_id}`).emit(`notification:${notif.user_id}`, notif)
        })
      }

      // 2. Crear y despachar notificaciones de actividades vencidas
      const overdueGroups = await notifService.createOverdueNotifications()
      if (overdueGroups.length) {
        console.log(`⚠️  ${overdueGroups.length} actividad(es) marcadas como vencidas`)
        overdueGroups.forEach(({ notifications: docs }) => {
          docs.forEach(notif => {
            io.to(`user:${notif.user_id}`).emit(`notification:${notif.user_id}`, notif)
            // Emitir también alerta global para que el dashboard actualice contadores
            io.emit('activity:overdue', { activity_id: notif.activity_id })
          })
        })
      }
    } catch (err) {
      console.error('❌ Error en scheduler de notificaciones:', err)
    }
  }, 60 * 1000) // cada 60 segundos

  console.log('⏱️  Scheduler de notificaciones iniciado (intervalo: 60s)')
}

// ── Inicio del servidor ──────────────────────────────────────────────────────
const startServer = async () => {
  try {
    await client.connect()
    console.log('✅ Conectado a MongoDB')

    // Rutas
    AppRouter(app, io)
    app.use(logErrors)
    app.use(errorHandler)

    // Archivos estáticos (uploads)
    app.use('/uploads', express.static('uploads'))

    // Servidor HTTP
    httpServer.listen(port, () => {
      console.log(`🚀 Servidor iniciado en puerto: ${port}`)
      console.log(`📚 Documentación API: http://localhost:${port}/api-docs`)
    })

    // Iniciar scheduler después de conectar a la BD
    startScheduler()

  } catch (error) {
    console.error('❌ Error al conectar con MongoDB:', error)
    process.exit(1)
  }
}

// ── Cierre limpio ─────────────────────────────────────────────────────────────
process.on('SIGINT', async () => {
  if (schedulerInterval) clearInterval(schedulerInterval)
  await client.close()
  console.log('🛑 Conexión con MongoDB cerrada')
  process.exit(0)
})

startServer()
