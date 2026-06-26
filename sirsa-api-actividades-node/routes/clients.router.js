import express from 'express'
import Clients from '../services/clients.service.js'
import { authenticate, authorize, MANAGEMENT_ROLES } from '../middlewares/authMiddleware.js'

const router = express.Router()
const clients = new Clients()

/*
 * Los clientes se crean automáticamente al crear un proyecto,
 * pero este router permite su gestión directa (listado para selects,
 * edición de datos de contacto, etc.)
 */
const clientsRouter = (io) => {

  // GET /clients?search=&active=
  router.get('/', authenticate, async (req, res, next) => {
    try {
      const filters = {
        search: req.query.search,
        active: req.query.active
      }
      const result = await clients.getAll(filters)

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
      const result = await clients.getOneById(req.params.id)

      res.status(200).json({
        success: true,
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

  router.post('/', authenticate, authorize(...MANAGEMENT_ROLES), async (req, res, next) => {
    try {
      const result = await clients.create(req.body)

      res.status(201).json({
        success: true,
        message: result.existed ? 'Cliente ya existente, se devuelve el registro' : 'Cliente creado',
        data: result.client
      })
    } catch (error) {
      next(error)
    }
  })

  router.patch('/:id', authenticate, authorize(...MANAGEMENT_ROLES), async (req, res, next) => {
    try {
      const result = await clients.updateOneById(req.params.id, req.body)

      res.status(200).json({
        success: true,
        message: 'Cliente actualizado',
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

  return router
}

export default clientsRouter
