import express from 'express'
import fs from 'fs'
import path from 'path'
import Activities from '../services/activities.service.js'
import Notifications from '../services/notifications.service.js'
import { NOTIFICATION_TYPES } from '../services/notifications.service.js'
import upload from '../configurations/multer-config.js'
import { authenticate, authorize, ROLES, MANAGEMENT_ROLES } from '../middlewares/authMiddleware.js'
import { db } from '../db/mongoClient.js'
import { ObjectId } from 'mongodb'

const router = express.Router()
const activities  = new Activities()
const notifService = new Notifications()

/*
 * Resumen de endpoints y permisos:
 *
 * GET  /activities                              → todos los autenticados
 * GET  /activities/:id                          → todos los autenticados
 * GET  /activities/:id/logs                     → todos los autenticados
 * POST /activities                              → ingeniero, gerente, coordinador, admin, superadmin
 * PATCH /activities/:id                         → asignados + managers
 * PATCH /activities/:id/status                  → asignados (→ en_proceso, en_revision) + managers (todo)
 * POST /activities/:id/notes                    → asignados + managers
 *
 * POST   /activities/:id/checklist              → asignados + managers
 * PATCH  /activities/:id/checklist/:itemId      → asignados + managers
 * DELETE /activities/:id/checklist/:itemId      → solo managers
 *
 * POST   /activities/:id/attachments            → asignados + managers (multer, hasta 20MB)
 * DELETE /activities/:id/attachments/:attachId  → solo managers
 *
 * Roles que NO pueden crear actividades: auxiliar
 * Roles que NO pueden cerrar/cancelar: ingeniero, auxiliar
 */

// Configuración de multer para actividades
const activityUpload = upload('activities').array('files', 10)

/*
 * Cambio 3: Antes de que multer guarde el archivo, consultamos el folio OS
 * del proyecto al que pertenece la actividad y lo ponemos en req.folioOs.
 * multer-config.js lo usa para crear la subcarpeta uploads/activities/<folio_os>/
 */
const injectFolioOs = async (req, res, next) => {
  try {
    const activity = await db.collection('activities').findOne(
      { _id: new ObjectId(req.params.id) },
      { projection: { project_id: 1 } }
    )
    if (activity?.project_id) {
      const project = await db.collection('projects').findOne(
        { _id: activity.project_id },
        { projection: { folio_os: 1 } }
      )
      req.folioOs = project?.folio_os || null
    }
  } catch { /* si falla, multer usa carpeta genérica */ }
  next()
}

const handleUpload = (req, res, next) => {
  activityUpload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next({ output: { statusCode: 413, payload: { message: 'El archivo supera el límite de 20MB' } } })
      }
      return next(err)
    }
    next()
  })
}

// Roles que pueden crear actividades (auxiliar no puede)
const CREATOR_ROLES = [
  ROLES.SUPERADMIN, ROLES.ADMIN,
  ROLES.GERENTE, ROLES.COORDINADOR,
  ROLES.INGENIERO
]

const activitiesRouter = (io) => {

  // ─── Listado y detalle ──────────────────────────────────────────────────────

  /*
   * GET /activities
   * Query params: project_id, phase_id, status, priority, assignee_id, search, overdue
   */
  router.get('/', authenticate, async (req, res, next) => {
    try {
      const filters = {
        project_id  : req.query.project_id,
        phase_id    : req.query.phase_id,
        status      : req.query.status,
        priority    : req.query.priority,
        assignee_id : req.query.assignee_id,
        search      : req.query.search,
        overdue     : req.query.overdue
      }
      const result = await activities.getAll(filters)

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
      const result = await activities.getOneById(req.params.id)

      res.status(200).json({
        success: true,
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

  // ─── Creación ───────────────────────────────────────────────────────────────

  /*
   * POST /activities
   * Body:
   * {
   *   project_id  : String (requerido)
   *   phase_id    : String
   *   name        : String (requerido)
   *   description : String
   *   priority    : 'baja' | 'media' | 'alta' | 'urgente'
   *   weight      : Number (1-10)
   *   assignees   : [String] (array de user IDs)
   *   depends_on  : String (activity ID, opcional)
   *   start_date  : Date
   *   target_date : Date
   *   checklist   : [{ title: String }]
   * }
   */
  router.post('/', authenticate, authorize(...CREATOR_ROLES), async (req, res, next) => {
    try {
      const createdBy = req.user._id || req.user.userId

      const result = await activities.create(req.body, createdBy)

      if (io) {
        io.emit('activity:created', {
          id         : result.id,
          name       : result.name,
          project_id : result.project_id,
          assignees  : result.assignees,
          target_date: result.target_date,
          createdBy
        })
      }

      // Cambio 4: Notificar a TODOS los asignados (obligatorio por diseño)
      if (result.assignees?.length) {
        const assigneeIds = result.assignees.map(id => id.toString())

        // Obtener nombre del proyecto para el body de la notificación
        let projectLabel = result.project_id?.toString()
        try {
          const proj = await db.collection('projects').findOne(
            { _id: new ObjectId(result.project_id) },
            { projection: { folio_os: 1, name: 1 } }
          )
          if (proj) projectLabel = `${proj.folio_os} — ${proj.name}`
        } catch { /* usa el ID como fallback */ }

        await notifService.createMany(assigneeIds, {
          type       : NOTIFICATION_TYPES.ACTIVITY_ASSIGNED,
          title      : 'Se te asignó una nueva actividad',
          body       : `"${result.name}" · Proyecto: ${projectLabel}`,
          activity_id: result.id?.toString(),
          project_id : result.project_id?.toString()
        })

        if (io) {
          assigneeIds.forEach(uid => {
            io.to(`user:${uid}`).emit(`notification:${uid}`, {
              type       : NOTIFICATION_TYPES.ACTIVITY_ASSIGNED,
              title      : 'Se te asignó una nueva actividad',
              body       : `"${result.name}" · Proyecto: ${projectLabel}`,
              activity_id: result.id?.toString(),
              project_id : result.project_id?.toString(),
              read       : false,
              createdAt  : new Date()
            })
          })
        }
      }

      res.status(201).json({
        success: true,
        message: 'Actividad creada',
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

  // ─── Actualización general ──────────────────────────────────────────────────

  /*
   * PATCH /activities/:id
   * Actualiza nombre, descripción, prioridad, fechas, asignados, ponderación, etc.
   * NO cambia estatus (usar /status).
   */
  router.patch('/:id', authenticate, async (req, res, next) => {
    try {
      const result = await activities.updateOneById(req.params.id, req.body, req.user)

      if (io) {
        // Cambio 3: emitir a TODOS para sincronización en tiempo real
        io.emit('activity:updated', {
          id        : req.params.id,
          updatedBy : req.user._id || req.user.userId,
          fields    : Object.keys(req.body)
        })
      }

      res.status(200).json({
        success: true,
        message: 'Actividad actualizada',
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

  // ─── Cambio de estatus ──────────────────────────────────────────────────────

  /*
   * PATCH /activities/:id/status
   * Body: { status: String, note: String }
   *
   * Ingeniero/Auxiliar: solo pueden cambiar a en_proceso | en_revision
   * Gerente/Coordinador/Admin/Superadmin: pueden cambiar a cualquier estatus
   */
  router.patch('/:id/status', authenticate, async (req, res, next) => {
    try {
      const { status, note } = req.body

      const result = await activities.updateStatus(
        req.params.id,
        status,
        req.user,
        note
      )

      if (io) {
        io.emit('activity:status_changed', {
          id         : req.params.id,
          prevStatus : result.prevStatus,
          newStatus  : result.newStatus,
          changedBy  : req.user._id || req.user.userId,
          note
        })

        // Emitir alerta específica si se retrasa
        if (result.newStatus === 'retrasado') {
          io.emit('activity:overdue', { id: req.params.id })
        }
      }

      // ── Notificar cambio de estatus a asignados y managers ──
      try {
        const activity = await db.collection('activities').findOne(
          { _id: new ObjectId(req.params.id) },
          { projection: { assignees: 1, project_id: 1, name: 1 } }
        )

        if (activity) {
          const project = await db.collection('projects').findOne(
            { _id: activity.project_id },
            { projection: { department_id: 1, folio_os: 1 } }
          )

          const managers = project?.department_id
            ? await db.collection('users').find({
                department_id: project.department_id,
                role         : { $in: ['gerente', 'coordinador'] },
                active       : true
              }, { projection: { _id: 1 } }).toArray()
            : []

          const changedBy = (req.user._id || req.user.userId).toString()
          const recipients = [
            ...(activity.assignees || []).map(id => id.toString()),
            ...managers.map(m => m._id.toString())
          ]
          const unique = [...new Set(recipients)].filter(id => id !== changedBy)

          if (unique.length) {
            const notifPayload = {
              type       : NOTIFICATION_TYPES.STATUS_CHANGED,
              title      : `Actividad "${activity.name}"`,
              body       : `Estatus cambiado a "${result.newStatus}"`,
              activity_id: req.params.id,
              project_id : activity.project_id?.toString()
            }
            await notifService.createMany(unique, notifPayload)
            if (io) {
              unique.forEach(uid => {
                io.to(`user:${uid}`).emit(`notification:${uid}`, { ...notifPayload, read: false, createdAt: new Date() })
              })
            }
          }
        }
      } catch (e) {
        console.error('[NOTIF] status_changed notification error:', e)
      }

      res.status(200).json({
        success: true,
        message: `Estatus actualizado a "${status}"`,
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

  // ─── Notas de avance ────────────────────────────────────────────────────────

  /*
   * POST /activities/:id/notes
   * Body: { note: String }
   * Cualquier usuario asignado puede registrar avances.
   * Managers pueden registrar avances en cualquier actividad.
   */
  router.post('/:id/notes', authenticate, async (req, res, next) => {
    try {
      const { note } = req.body
      const result = await activities.addProgressNote(
        req.params.id,
        note,
        req.user
      )

      if (io) {
        io.emit('activity:note_added', {
          activityId: req.params.id,
          note,
          by: req.user._id || req.user.userId
        })
      }

      res.status(201).json({
        success: true,
        message: 'Avance registrado',
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

  // ─── Bitácora / auditoría ────────────────────────────────────────────────────

  /*
   * GET /activities/:id/logs?action=
   */
  router.get('/:id/logs', authenticate, async (req, res, next) => {
    try {
      const result = await activities.getLogs(req.params.id, {
        action: req.query.action
      })

      res.status(200).json({
        success: true,
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

  // ─── Checklist ───────────────────────────────────────────────────────────────

  // POST /activities/:id/checklist — Agrega un ítem al checklist
  router.post('/:id/checklist', authenticate, async (req, res, next) => {
    try {
      const result = await activities.addChecklistItem(
        req.params.id,
        req.body,
        req.user
      )

      res.status(201).json({
        success: true,
        message: 'Elemento agregado al checklist',
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

  /*
   * PATCH /activities/:id/checklist/:itemId
   * Body: { completed: Boolean, days_taken: Number }
   * Marca o desmarca un ítem del checklist.
   */
  router.patch('/:id/checklist/:itemId', authenticate, async (req, res, next) => {
    try {
      const { completed, days_taken } = req.body
      const result = await activities.toggleChecklistItem(
        req.params.id,
        req.params.itemId,
        completed,
        days_taken,
        req.user
      )

      if (io) {
        io.emit('activity:checklist_updated', {
          activityId : req.params.id,
          itemId     : req.params.itemId,
          completed,
          by         : req.user._id || req.user.userId
        })
      }

      res.status(200).json({
        success: true,
        message: `Elemento ${completed ? 'completado' : 'desmarcado'}`,
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

  // DELETE /activities/:id/checklist/:itemId — cualquier usuario asignado
  router.delete('/:id/checklist/:itemId', authenticate, async (req, res, next) => {
    try {
      const result = await activities.deleteChecklistItem(
        req.params.id,
        req.params.itemId,
        req.user
      )

      res.status(200).json({
        success: true,
        message: 'Elemento eliminado del checklist',
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

  // ─── Adjuntos (archivos) ──────────────────────────────────────────────────────

  /*
   * POST /activities/:id/attachments
   * Multipart/form-data, campo "files" (múltiple, hasta 10 archivos, 20MB c/u)
   *
   * El middleware de multer guarda los archivos en uploads/activities/
   * y este endpoint registra la metadata en el documento de la actividad.
   */
  router.post('/:id/attachments', authenticate, injectFolioOs, handleUpload, async (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) {
        return next({ output: { statusCode: 400, payload: { message: 'No se enviaron archivos' } } })
      }

      const uploaded = []

      for (const file of req.files) {
        const attachment = await activities.addAttachment(
          req.params.id,
          {
            filename     : file.filename,
            original_name: file.originalname,
            path         : file.path,
            size         : file.size,
            mimetype     : file.mimetype
          },
          req.user
        )
        uploaded.push(attachment)
      }

      if (io) {
        io.emit('activity:attachment_added', {
          activityId : req.params.id,
          count      : uploaded.length,
          by         : req.user._id || req.user.userId
        })
      }

      res.status(201).json({
        success: true,
        message: `${uploaded.length} archivo(s) adjuntado(s)`,
        data: uploaded
      })
    } catch (error) {
      // Si el service falla, eliminar los archivos subidos para no dejar basura
      if (req.files) {
        req.files.forEach(f => {
          fs.unlink(f.path, () => {})
        })
      }
      next(error)
    }
  })

  /*
   * DELETE /activities/:id/attachments/:attachId
   * Solo managers. Elimina el registro y el archivo físico del disco.
   */
  router.delete('/:id/attachments/:attachId', authenticate, async (req, res, next) => {
    try {
      const result = await activities.deleteAttachment(
        req.params.id,
        req.params.attachId,
        req.user
      )

      // Eliminar archivo físico del disco
      if (result.filePath) {
        fs.unlink(path.resolve(result.filePath), (err) => {
          if (err) console.error('No se pudo eliminar el archivo físico:', err.message)
        })
      }

      res.status(200).json({
        success: true,
        message: 'Adjunto eliminado',
        data: result.updateOne
      })
    } catch (error) {
      next(error)
    }
  })

  return router
}

export default activitiesRouter
