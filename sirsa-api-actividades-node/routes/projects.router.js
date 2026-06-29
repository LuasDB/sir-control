import express from 'express'
import Boom from '@hapi/boom'
import Projects from '../services/projects.service.js'
import Clients from '../services/clients.service.js'
import { authenticate, authorize, ROLES, MANAGEMENT_ROLES } from '../middlewares/authMiddleware.js'

const router = express.Router()
const projects = new Projects()
const clients = new Clients()

/*
 * Resumen de permisos por endpoint:
 *
 * GET  /projects                → todos los autenticados (ver proyectos del dept.)
 * GET  /projects/dashboard      → todos los autenticados (estadísticas generales)
 * GET  /projects/:id            → todos los autenticados
 * GET  /projects/:id/dashboard  → todos los autenticados (estadísticas del proyecto)
 * POST /projects                → gerente, coordinador, admin, superadmin
 * PATCH /projects/:id           → gerente, coordinador, admin, superadmin
 * POST  /projects/:id/close     → gerente, coordinador, admin, superadmin
 * POST  /projects/:id/cancel    → gerente, coordinador, admin, superadmin
 *
 * POST   /projects/:id/phases   → gerente, coordinador, admin, superadmin
 * PATCH  /projects/:id/phases/:phaseId → gerente, coordinador, admin, superadmin
 * DELETE /projects/:id/phases/:phaseId → gerente, coordinador, admin, superadmin (solo si sin actividades)
 */

const projectsRouter = (io) => {

  // ─── Dashboard general ──────────────────────────────────────────────────────

  router.get('/dashboard', authenticate, async (req, res, next) => {
    try {
      const filters = {
        area: req.query.area,
        department_id: req.query.department_id,
        userId: req.user._id || req.user.userId,
        userRole: req.user.role
      }
      const result = await projects.getDashboardStats(filters)

      res.status(200).json({
        success: true,
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

  // ─── Dashboard de un proyecto específico ───────────────────────────────────

  router.get('/:id/dashboard', authenticate, async (req, res, next) => {
    try {
      const result = await projects.getProjectDashboard(req.params.id)

      res.status(200).json({
        success: true,
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

  // ─── CRUD Proyectos ─────────────────────────────────────────────────────────

  // GET /projects?status=&area=&department_id=&client_id=&search=
  router.get('/', authenticate, async (req, res, next) => {
    try {
      const filters = {
        status       : req.query.status,
        area         : req.query.area,
        department_id: req.query.department_id,
        client_id    : req.query.client_id,
        search       : req.query.search,
        // Cambio 6: filtro por member según el usuario autenticado
        userId       : req.user._id || req.user.userId,
        userRole     : req.user.role
      }
      const result = await projects.getAll(filters)

      res.status(200).json({
        success: true,
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

  router.get('/:id', authenticate, async (req, res, next) => {
    try {
      const result = await projects.getOneById(req.params.id)

      res.status(200).json({
        success: true,
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

  /*
   * POST /projects
   * Crea el proyecto. Si se envía un objeto "client" en el body,
   * se busca o crea el cliente automáticamente para no obligar al usuario
   * a hacer dos llamadas desde el frontend.
   *
   * Body esperado:
   * {
   *   folio_os     : String (requerido)
   *   clave        : String
   *   name         : String (requerido)
   *   description  : String
   *   area         : String
   *   department_id: String (ObjectId)
   *   seller_id    : String (ObjectId)
   *   received_at  : Date
   *   target_date  : Date
   *   phases       : [{ name, order_index }]
   *   // Opción A: ID del cliente ya registrado
   *   client_id    : String (ObjectId)
   *   // Opción B: Datos del cliente nuevo (se crea automáticamente)
   *   client: {
   *     razon_social : String (requerido si no se envía client_id)
   *     contact_name : String
   *     phone        : String
   *     email        : String
   *   }
   * }
   */
  router.post('/', authenticate, authorize(...MANAGEMENT_ROLES), async (req, res, next) => {
    try {
      const body = { ...req.body, created_by: req.user._id || req.user.userId }

      // Si se envían datos de cliente nuevo, crearlo/reutilizarlo primero
      if (!body.client_id && body.client) {
        const clientResult = await clients.create(body.client)
        body.client_id = clientResult.client._id.toString()
        delete body.client
      }

      const result = await projects.create(body)

      if (io) {
        io.emit('project:created', {
          id: result.id,
          name: result.name,
          folio_os: result.folio_os,
          area: result.area,
          createdBy: req.user._id || req.user.userId
        })
      }

      res.status(201).json({
        success: true,
        message: 'Proyecto creado',
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

  router.patch('/:id', authenticate, authorize(...MANAGEMENT_ROLES), async (req, res, next) => {
    try {
      const result = await projects.updateOneById(
        req.params.id,
        req.body,
        req.user._id || req.user.userId
      )

      // Cambio 3: emitir a TODOS para que la UI se actualice en tiempo real
      if (io) {
        io.emit('project:updated', {
          projectId : req.params.id,
          updatedBy : req.user._id || req.user.userId,
          fields    : Object.keys(req.body)
        })
      }

      res.status(200).json({
        success: true,
        message: 'Proyecto actualizado',
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

  // POST /projects/:id/close — cierre formal del proyecto
  router.post('/:id/close', authenticate, authorize(...MANAGEMENT_ROLES), async (req, res, next) => {
    try {
      const result = await projects.closeProject(
        req.params.id,
        req.user._id || req.user.userId
      )

      if (io) {
        io.emit('project:closed', { projectId: req.params.id })
      }

      res.status(200).json({
        success: true,
        message: 'Proyecto cerrado',
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

  // PATCH /projects/:id/status
router.patch('/:id/status', authenticate, authorize(...MANAGEMENT_ROLES), async (req, res, next) => {
  try {
    const { status } = req.body
    const result = await projects.updateStatus(
      req.params.id,
      status,
      req.user._id || req.user.userId
    )

    if (io) {
      io.emit('project:updated', { projectId: req.params.id, status })
    }

    res.status(200).json({
      success: true,
      message: `Estatus actualizado a "${status}"`,
      data: result
    })
  } catch (error) { next(error) }
})

  // POST /projects/:id/cancel
  router.post('/:id/cancel', authenticate, authorize(...MANAGEMENT_ROLES), async (req, res, next) => {
    try {
      const result = await projects.cancelProject(req.params.id)

      if (io) {
        io.emit('project:cancelled', { projectId: req.params.id })
      }

      res.status(200).json({
        success: true,
        message: 'Proyecto cancelado',
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

  // ─── Miembros del proyecto ────────────────────────────────────────────────────

  // POST /projects/:id/members  — agregar usuario al proyecto
  router.post('/:id/members', authenticate, authorize(...MANAGEMENT_ROLES), async (req, res, next) => {
    try {
      const { userId } = req.body
      if (!userId) return next(Boom.badData('userId es requerido'))
      const result = await projects.addMember(req.params.id, userId)
      if (io) io.emit('project:member_added', { projectId: req.params.id, userId })
      res.status(200).json({ success: true, message: 'Usuario agregado al proyecto', data: result })
    } catch (error) { next(error) }
  })

  // DELETE /projects/:id/members/:userId  — quitar usuario del proyecto
  router.delete('/:id/members/:userId', authenticate, authorize(...MANAGEMENT_ROLES), async (req, res, next) => {
    try {
      const result = await projects.removeMember(req.params.id, req.params.userId)
      res.status(200).json({ success: true, message: 'Usuario removido del proyecto', data: result })
    } catch (error) { next(error) }
  })

  // ─── Fases ──────────────────────────────────────────────────────────────────

  // POST /projects/:id/phases
  router.post('/:id/phases', authenticate, authorize(...MANAGEMENT_ROLES), async (req, res, next) => {
    try {
      const result = await projects.addPhase(req.params.id, req.body)

      if (io) {
        io.emit('project:phase_added', { projectId: req.params.id, phase: result })
      }

      res.status(201).json({
        success: true,
        message: 'Fase agregada',
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

  // PATCH /projects/:id/phases/:phaseId
  router.patch('/:id/phases/:phaseId', authenticate, authorize(...MANAGEMENT_ROLES), async (req, res, next) => {
    try {
      const result = await projects.updatePhase(req.params.id, req.params.phaseId, req.body)

      res.status(200).json({
        success: true,
        message: 'Fase actualizada',
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

  // DELETE /projects/:id/phases/:phaseId
  router.delete('/:id/phases/:phaseId', authenticate, authorize(...MANAGEMENT_ROLES), async (req, res, next) => {
    try {
      const result = await projects.deletePhase(req.params.id, req.params.phaseId)

      res.status(200).json({
        success: true,
        message: 'Fase eliminada',
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

  return router
}

export default projectsRouter
