import express from 'express'
import ActivityTypes from '../services/activityTypes.service.js'
import { authenticate, authorize, ROLES } from '../middlewares/authMiddleware.js'

const router = express.Router()
const activityTypes = new ActivityTypes()

// Roles que pueden dar de alta / editar el catálogo de tipos de actividad
const CATALOG_ROLES = [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.GERENTE, ROLES.COORDINADOR]

const activityTypesRouter = (io) => {

  /*
   * GET /activity-types?active=true&search=
   * Cualquier usuario autenticado puede listarlos (necesario para el
   * select del formulario de alta de actividades).
   */
  router.get('/', authenticate, async (req, res, next) => {
    try {
      const filter = {
        active: req.query.active !== undefined ? req.query.active : undefined,
        search: req.query.search
      }
      const result = await activityTypes.getAll(filter)

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
      const result = await activityTypes.getOneById(req.params.id)

      res.status(200).json({
        success: true,
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

  // Alta de un nuevo tipo de actividad — coordinadores y admin
  router.post('/', authenticate, authorize(...CATALOG_ROLES), async (req, res, next) => {
    try {
      const result = await activityTypes.create(req.body)

      if (io) io.emit('activity_type:created', result)

      res.status(201).json({
        success: true,
        message: 'Tipo de actividad creado',
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

  // Edición de nombre / descripción
  router.patch('/:id', authenticate, authorize(...CATALOG_ROLES), async (req, res, next) => {
    try {
      const result = await activityTypes.updateOneById(req.params.id, req.body)

      if (io) io.emit('activity_type:updated', { id: req.params.id })

      res.status(200).json({
        success: true,
        message: 'Tipo de actividad actualizado',
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

  // Reactivar un tipo dado de baja
  router.patch('/:id/activate', authenticate, authorize(...CATALOG_ROLES), async (req, res, next) => {
    try {
      const result = await activityTypes.activate(req.params.id)

      if (io) io.emit('activity_type:updated', { id: req.params.id })

      res.status(200).json({
        success: true,
        message: 'Tipo de actividad reactivado',
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

  // Baja lógica
  router.delete('/:id', authenticate, authorize(...CATALOG_ROLES), async (req, res, next) => {
    try {
      const result = await activityTypes.deactivate(req.params.id)

      if (io) io.emit('activity_type:updated', { id: req.params.id })

      res.status(200).json({
        success: true,
        message: 'Tipo de actividad desactivado',
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

  return router
}

export default activityTypesRouter
