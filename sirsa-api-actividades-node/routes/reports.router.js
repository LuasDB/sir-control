import express from 'express'
import Reports from '../services/reports.service.js'
import { authenticate, authorize, MANAGEMENT_ROLES } from '../middlewares/authMiddleware.js'

const router = express.Router()
const reports = new Reports()

/*
 * GET /reports/workload
 * Query params:
 *   from        : ISO date (inicio del periodo)
 *   to          : ISO date (fin del periodo)
 *   area        : String  (filtrar por área)
 *   gerencia_id : ObjectId
 *   user_id     : ObjectId (para ver solo una persona)
 *
 * Solo accesible para gerentes, coordinadores, admin y superadmin
 */

const reportsRouter = (io) => {

  router.get('/workload', authenticate, authorize(...MANAGEMENT_ROLES), async (req, res, next) => {
    try {
      const filters = {
        from        : req.query.from,
        to          : req.query.to,
        area        : req.query.area,
        gerencia_id : req.query.gerencia_id,
        user_id     : req.query.user_id,
      }
      const result = await reports.getWorkloadReport(filters)

      res.status(200).json({ success: true, data: result })
    } catch (error) { next(error) }
  })

  return router
}

export default reportsRouter
