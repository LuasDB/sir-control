import express from 'express'
import Events from '../services/events.service.js'
import { authenticate } from '../middlewares/authMiddleware.js'

const router = express.Router()
const events = new Events()

/*
 * GET  /events?from=&to=&type=&project_id=   → calendario del mes
 * GET  /events/upcoming?days=3               → prompt de bienvenida
 * GET  /events/:id                           → detalle
 * POST /events                               → crear evento
 * PATCH /events/:id                          → editar (solo creador o admin)
 * DELETE /events/:id                         → eliminar (solo creador o admin)
 */

const eventsRouter = (io) => {

  // GET /events/upcoming — para el prompt de bienvenida al iniciar sesión
  // Va ANTES de /:id para que Express no lo interprete como parámetro
  router.get('/upcoming', authenticate, async (req, res, next) => {
    try {
      const userId   = req.user._id || req.user.userId
      const userRole = req.user.role
      const days     = parseInt(req.query.days || 3)

      const result = await events.getUpcoming(userId, userRole, days)

      res.status(200).json({ success: true, data: result })
    } catch (error) { next(error) }
  })

  // GET /events
  router.get('/', authenticate, async (req, res, next) => {
    try {
      const userId   = req.user._id || req.user.userId
      const userRole = req.user.role

      const filters = {
        from      : req.query.from,
        to        : req.query.to,
        type      : req.query.type,
        project_id: req.query.project_id,
      }

      const result = await events.getAll(filters, userId, userRole)

      res.status(200).json({ success: true, data: result })
    } catch (error) { next(error) }
  })

  // GET /events/:id
  router.get('/:id', authenticate, async (req, res, next) => {
    try {
      const result = await events.getOneById(req.params.id)
      res.status(200).json({ success: true, data: result })
    } catch (error) { next(error) }
  })

  // POST /events
  router.post('/', authenticate, async (req, res, next) => {
    try {
      const createdBy = req.user._id || req.user.userId
      const result    = await events.create(req.body, createdBy)

      // Notificar a participantes en tiempo real
      if (io && result.participants?.length) {
        result.participants.forEach(uid => {
          const id = uid.toString()
          if (id !== createdBy.toString()) {
            io.to(`user:${id}`).emit(`notification:${id}`, {
              type     : 'event_invited',
              title    : 'Te invitaron a un evento',
              body     : `"${result.title}" — ${new Date(result.start).toLocaleDateString('es-MX', {
                weekday:'short', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'
              })}`,
              event_id : result.id?.toString(),
              read     : false,
              createdAt: new Date()
            })
          }
        })
      }

      res.status(201).json({ success: true, message: 'Evento creado', data: result })
    } catch (error) { next(error) }
  })

  // PATCH /events/:id
  router.patch('/:id', authenticate, async (req, res, next) => {
    try {
      const userId   = req.user._id || req.user.userId
      const userRole = req.user.role
      const result   = await events.updateOneById(req.params.id, req.body, userId, userRole)

      res.status(200).json({ success: true, message: 'Evento actualizado', data: result })
    } catch (error) { next(error) }
  })

  // DELETE /events/:id
  router.delete('/:id', authenticate, async (req, res, next) => {
    try {
      const userId   = req.user._id || req.user.userId
      const userRole = req.user.role
      const result   = await events.deleteOneById(req.params.id, userId, userRole)

      res.status(200).json({ success: true, message: 'Evento eliminado', data: result })
    } catch (error) { next(error) }
  })

  return router
}

export default eventsRouter
