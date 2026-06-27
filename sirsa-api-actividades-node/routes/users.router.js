import express from 'express'
import Boom from '@hapi/boom'
import fs from 'fs'
import Users from '../services/users.service.js'
import Auth from '../services/auth.service.js'
import upload from '../configurations/multer-config.js'
import { authenticate, authorize, ROLES, MANAGEMENT_ROLES } from '../middlewares/authMiddleware.js'

const router = express.Router()
const user = new Users()
const auth = new Auth()

const USER_ADMIN_ROLES = [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.GERENTE, ROLES.COORDINADOR]

// Multer para avatares — 2 MB, solo imágenes
const avatarUpload = upload('avatars').single('avatar')
const handleAvatarUpload = (req, res, next) => {
  avatarUpload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return next(Boom.badRequest('La imagen no puede superar 2 MB'))
      return next(err)
    }
    next()
  })
}

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


  // ── Avatar ────────────────────────────────────────────────────────────────────
  router.patch('/:id/avatar', authenticate, handleAvatarUpload, async (req, res, next) => {
    try {
      console.log('se toca este')
      if (!req.file) return next(Boom.badRequest('No se envió ninguna imagen'))
      const requesterId = (req.user._id || req.user.userId).toString()
      const isAdmin     = MANAGEMENT_ROLES.includes(req.user.role)
      if (requesterId !== req.params.id && !isAdmin) {
        fs.unlink(req.file.path, () => {})
        return next(Boom.forbidden('Solo puedes cambiar tu propia foto'))
      }
      // Eliminar avatar anterior
      const existing = await user.getOneById(req.params.id)
      if (existing?.avatar_path) fs.unlink(existing.avatar_path, () => {})

      await user.updateOneById(req.params.id, {
        avatar_path: req.file.path,
        avatar_url : `/uploads/avatars/${req.file.filename}`
      })
      res.status(200).json({
        success   : true,
        message   : 'Foto de perfil actualizada',
        avatar_url: `/uploads/avatars/${req.file.filename}`
      })
    } catch (error) {
      if (req.file) fs.unlink(req.file.path, () => {})
      next(error)
    }
  })

  router.delete('/:id/avatar', authenticate, async (req, res, next) => {
    try {
      const requesterId = (req.user._id || req.user.userId).toString()
      const isAdmin     = MANAGEMENT_ROLES.includes(req.user.role)
      if (requesterId !== req.params.id && !isAdmin) {
        return next(Boom.forbidden('Solo puedes eliminar tu propia foto'))
      }
      const existing = await user.getOneById(req.params.id)
      if (existing?.avatar_path) fs.unlink(existing.avatar_path, () => {})
      await user.updateOneById(req.params.id, { avatar_path: null, avatar_url: null })
      res.status(200).json({ success: true, message: 'Foto eliminada' })
    } catch (error) { next(error) }
  })

  // ── Configuración de cuenta propia ────────────────────────────────────────────
  router.patch('/me/settings', authenticate, async (req, res, next) => {
    try {
      const userId = req.user._id || req.user.userId
      const { name } = req.body
      const allowed = {}
      if (name) allowed.name = name
      const result = await user.updateOneById(userId, allowed)
      res.status(200).json({ success: true, message: 'Configuración actualizada', data: result })
    } catch (error) { next(error) }
  })

  return router
}

export default usersRouter
