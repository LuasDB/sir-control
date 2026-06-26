import express from 'express'
import Departments from '../services/departments.service.js'
import { authenticate, authorize, ROLES } from '../middlewares/authMiddleware.js'

const router = express.Router()
const departments = new Departments()

const departmentsRouter = (io)=>{

  // Cualquier usuario autenticado puede listar departamentos y áreas
  // (necesario para selects de proyectos, usuarios, filtros del dashboard, etc.)
  router.get('/',authenticate,async(req, res, next)=>{
    try {
      const filter = {
        active: req.query.active !== undefined ? req.query.active === 'true' : undefined,
        search: req.query.search
      }
      const result = await departments.getAll(filter)

      res.status(200).json({
        success:true,
        data:result
      })
    } catch (error) {
      next(error)
    }
  })

  router.get('/:id',authenticate,async(req, res, next)=>{
    try {
      const { id } = req.params
      const result = await departments.getOneById(id)

      res.status(200).json({
        success:true,
        data:result
      })
    } catch (error) {
      next(error)
    }
  })

  // Solo superadmin/admin pueden crear departamentos nuevos
  router.post('/',authenticate,authorize(ROLES.SUPERADMIN, ROLES.ADMIN),async(req, res, next)=>{
    try {
      const result = await departments.create(req.body)

      if(io){
        io.emit('department:created', result)
      }

      res.status(201).json({
        success:true,
        message:'Departamento creado',
        data:result
      })
    } catch (error) {
      next(error)
    }
  })

  // Solo superadmin/admin pueden editar datos generales del departamento
  router.patch('/:id',authenticate,authorize(ROLES.SUPERADMIN, ROLES.ADMIN),async(req, res, next)=>{
    try {
      const { body } = req
      const { id } = req.params
      const result = await departments.updateOneById(id, body)

      res.status(200).json({
        success:true,
        message:'Departamento actualizado',
        data:result
      })
    } catch (error) {
      next(error)
    }
  })

  // Agregar un área al departamento
  router.post('/:id/areas',authenticate,authorize(ROLES.SUPERADMIN, ROLES.ADMIN),async(req, res, next)=>{
    try {
      const { id } = req.params
      const { name } = req.body
      const result = await departments.addArea(id, name)

      res.status(200).json({
        success:true,
        message:'Área agregada',
        data:result
      })
    } catch (error) {
      next(error)
    }
  })

  // Eliminar un área del departamento
  router.delete('/:id/areas/:areaName',authenticate,authorize(ROLES.SUPERADMIN, ROLES.ADMIN),async(req, res, next)=>{
    try {
      const { id, areaName } = req.params
      const result = await departments.removeArea(id, areaName)

      res.status(200).json({
        success:true,
        message:'Área eliminada',
        data:result
      })
    } catch (error) {
      next(error)
    }
  })

  // Baja lógica del departamento (no se elimina físicamente)
  router.delete('/:id',authenticate,authorize(ROLES.SUPERADMIN, ROLES.ADMIN),async(req, res, next)=>{
    try {
      const { id } = req.params
      const result = await departments.deactivate(id)

      res.status(200).json({
        success:true,
        message:'Departamento desactivado',
        data:result
      })
    } catch (error) {
      next(error)
    }
  })

  return router
}

export default departmentsRouter
