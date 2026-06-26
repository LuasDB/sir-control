import express from 'express'
import Boom from '@hapi/boom'
import Users from '../services/users.service.js'
import Auth from '../services/auth.service.js'
import { authenticate, authorize, ROLES } from '../middlewares/authMiddleware.js'

const router = express.Router()
const user = new Users()
const auth = new Auth()

// Roles que pueden administrar usuarios (alta, edición, baja)
const USER_ADMIN_ROLES = [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.GERENTE, ROLES.COORDINADOR]

const usersRouter = (io)=>{

  router.get('/',authenticate,async(req, res,next )=>{
    try {
      const filter ={
        role:req.query.role,
        active:req.query.active,
        department_id:req.query.department_id,
        search:req.query.search
      }
      const result = await user.getAll(filter)

      res.status(200).json({
        success:true,
        data:result
      })
    } catch (error) {
      next(error)
    }
  })

  router.get('/:id',authenticate,async(req, res,next )=>{
    try {
      const { id } = req.params
      const result = await user.getOneById(id)

      res.status(200).json({
        success:true,
        data:result
      })
    } catch (error) {
      next(error)
    }
  })

  // Alta de usuarios: superadmin, admin, gerente y coordinador pueden crear usuarios nuevos
  router.post('/',authenticate,authorize(...USER_ADMIN_ROLES),async(req, res,next )=>{
    try {
      const result = await auth.create(req.body)

      if(io){
        io.emit('user:created', result)
      }

      res.status(201).json({
        success:true,
        message:'Usuario creado',
        data:result
      })
    } catch (error) {
      next(error)
    }
  })

  router.patch('/:id',authenticate,authorize(...USER_ADMIN_ROLES),async(req, res,next )=>{
    try {
      const { body } = req
      const { id } = req.params
      const result = await user.updateOneById(id,body)
      res.status(200).json({
        success:true,
        message:'Registro actualizado',
        data:result
      })
    } catch (error) {
      next(error)
    }
  })

  router.delete('/:id',authenticate,authorize(...USER_ADMIN_ROLES),async(req, res,next )=>{
    try {
      const { id } = req.params
      const result = await user.deleteOneById(id)

      res.status(200).json({
        success:true,
        message:'Registro eliminado',
        data:result
      })
    } catch (error) {
      next(error)
    }
  })

  return router
}

export default usersRouter
