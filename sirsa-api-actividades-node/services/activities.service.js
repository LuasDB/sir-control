import { ObjectId } from 'mongodb'
import { db } from '../db/mongoClient.js'
import Boom from '@hapi/boom'
import Projects from './projects.service.js'

/*
 * Colección: activities
 *
 * Esquema de documento:
 * {
 *   project_id   : ObjectId   (proyecto al que pertenece)
 *   phase_id     : ObjectId | null (fase embebida del proyecto, opcional)
 *   name         : String     (requerido)
 *   description  : String
 *   priority     : String     (baja | media | alta | urgente)
 *   status       : String     (pendiente | en_proceso | retrasado | en_revision | cerrado | cancelado)
 *   weight       : Number     (ponderación 1-10 para análisis de carga de trabajo)
 *   assignees    : [ObjectId] (usuarios asignados, puede ser más de uno)
 *   depends_on   : ObjectId | null (actividad de la que depende, si aplica)
 *   start_date   : Date
 *   target_date  : Date
 *   closed_at    : Date | null
 *   days_taken   : Number | null (días reales de ejecución al cerrar)
 *   checklist    : [{ _id, title, completed, days_taken, completed_at }]
 *   attachments  : [{ _id, filename, original_name, path, size, version, uploaded_by, uploaded_at }]
 *   created_by   : ObjectId
 *   createdAt    : Date
 *   updatedAt    : Date
 * }
 *
 * Colección: activity_logs (bitácora de auditoría)
 * {
 *   activity_id  : ObjectId
 *   project_id   : ObjectId
 *   user_id      : ObjectId
 *   action       : String  (status_change | progress_update | assignee_added | checklist_update | attachment_added | comment)
 *   detail       : Object  (prev_status, new_status, note, etc.)
 *   createdAt    : Date
 * }
 */

const VALID_STATUSES   = ['pendiente','en_proceso','retrasado','en_revision','cerrado','cancelado']
const VALID_PRIORITIES = ['baja','media','alta','urgente']

// Cambio 4: Niveles de complejidad con ponderación fija
export const COMPLEXITY_LEVELS = {
  basica    : { label: 'Básica',      weight: 1 },
  intermedia: { label: 'Intermedia',  weight: 2 },
  avanzada  : { label: 'Avanzada',    weight: 4 },
  critica   : { label: 'Crítica',     weight: 8 },
}

// Convierte el nivel de complejidad a su valor numérico
const complexityToWeight = (complexity) => {
  return COMPLEXITY_LEVELS[complexity]?.weight || 1
}

// Roles que pueden cerrar/cancelar actividades y proyectos
const CLOSING_ROLES = ['superadmin','admin','gerente','coordinador']

// Días de anticipación para alertas de vencimiento
const ALERT_DAYS = [3, 1]

class Activities {
  constructor() {
    this.projectService = new Projects()
  }

  // ─── Helpers privados ───────────────────────────────────────────────────────

  _log(activityId, projectId, userId, action, detail = {}) {
    db.collection('activity_logs').insertOne({
      activity_id : new ObjectId(activityId),
      project_id  : new ObjectId(projectId),
      user_id     : userId ? new ObjectId(userId) : null,
      action,
      detail,
      createdAt   : new Date()
    }).catch(e => console.error('[LOG ERROR] activity_logs:', e))
  }

  /*
   * Cambio 1: Todos los usuarios pueden registrar avances y cambiar estatus.
   * Solo se restringe CERRAR/CANCELAR a roles de gestión.
   * Cualquier usuario autenticado puede operar siempre que esté asignado,
   * excepto managers que pueden operar en cualquier actividad.
   */
  _assertCanEdit(user, activity, targetStatus = null) {
    const isManager = CLOSING_ROLES.includes(user.role)

    // Managers pueden hacer todo
    if (isManager) return true

    // Cambio 1: No-managers NO pueden cerrar ni cancelar
    if (targetStatus && ['cerrado','cancelado'].includes(targetStatus)) {
      throw Boom.forbidden('Solo gerentes y coordinadores pueden cerrar o cancelar actividades')
    }

    // Para cualquier otra operación, el usuario debe estar asignado
    const userId = (user._id || user.userId).toString()
    const isAssigned = (activity.assignees || [])
      .map(id => id.toString())
      .includes(userId)

    if (!isAssigned) {
      throw Boom.forbidden('No estás asignado a esta actividad')
    }

    return true
  }

  /*
   * Crea las notificaciones de vencimiento en colección `notifications`.
   * Llamado cada vez que se crea/actualiza target_date.
   */
  async _scheduleNotifications(activity) {
    try {
      if (!activity.target_date || ['cerrado','cancelado'].includes(activity.status)) return

      const targetDate = new Date(activity.target_date)
      const notifs = []

      for (const days of ALERT_DAYS) {
        const alertDate = new Date(targetDate)
        alertDate.setDate(alertDate.getDate() - days)

        const recipients = [
          ...(activity.assignees || []),
          // gerentes y coordinadores se notifican en activities.router vía io
        ]

        for (const userId of recipients) {
          notifs.push({
            user_id     : new ObjectId(userId),
            activity_id : activity._id,
            project_id  : activity.project_id,
            type        : 'due_soon',
            title       : `Actividad por vencer en ${days} día(s)`,
            body        : `"${activity.name}" vence el ${targetDate.toLocaleDateString('es-MX')}`,
            scheduled_for: alertDate,
            read        : false,
            sent        : false,
            createdAt   : new Date()
          })
        }
      }

      if (notifs.length) {
        await db.collection('notifications').insertMany(notifs)
      }
    } catch (e) {
      console.error('[NOTIF ERROR] _scheduleNotifications:', e)
    }
  }

  // ─── CRUD de actividades ────────────────────────────────────────────────────

  async create(data, createdBy) {
    try {
      const {
        project_id, phase_id, name, description,
        priority, complexity, assignees, depends_on,
        start_date, target_date, checklist
      } = data

      if (!project_id || !name) {
        throw Boom.badData('El proyecto y el nombre de la actividad son obligatorios')
      }

      // Cambio 4: obligatorio asignar al menos un usuario
      if (!Array.isArray(assignees) || assignees.length === 0) {
        throw Boom.badData('Debes asignar la actividad a al menos un usuario')
      }

      if (!ObjectId.isValid(project_id)) {
        throw Boom.badRequest(`project_id "${project_id}" no es un ID válido`)
      }

      // Verificar que el proyecto existe
      const project = await db.collection('projects').findOne(
        { _id: new ObjectId(project_id) },
        { projection: { _id: 1, status: 1 } }
      )
      if (!project) throw Boom.notFound('El proyecto no fue encontrado')
      if (['cerrado','cancelado'].includes(project.status)) {
        throw Boom.conflict('No se pueden agregar actividades a un proyecto cerrado o cancelado')
      }

      // Verificar fase si se envía
      if (phase_id && !ObjectId.isValid(phase_id)) {
        throw Boom.badRequest(`phase_id "${phase_id}" no es un ID válido`)
      }

      // Verificar dependencia
      if (depends_on) {
        if (!ObjectId.isValid(depends_on)) {
          throw Boom.badRequest(`depends_on "${depends_on}" no es un ID válido`)
        }
        const depActivity = await db.collection('activities').findOne(
          { _id: new ObjectId(depends_on) },
          { projection: { _id: 1 } }
        )
        if (!depActivity) throw Boom.notFound('La actividad dependiente no fue encontrada')
      }

      // Normalizar asignados
      const assigneeIds = Array.isArray(assignees)
        ? assignees.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id))
        : []

      // Normalizar checklist
      const initialChecklist = Array.isArray(checklist)
        ? checklist.map(item => ({
            _id          : new ObjectId(),
            title        : item.title,
            completed    : false,
            days_taken   : null,
            completed_at : null
          }))
        : []

      if (priority && !VALID_PRIORITIES.includes(priority)) {
        throw Boom.badData(`Prioridad "${priority}" no válida. Opciones: ${VALID_PRIORITIES.join(', ')}`)
      }

      const newActivity = {
        project_id  : new ObjectId(project_id),
        phase_id    : phase_id ? new ObjectId(phase_id) : null,
        name,
        description : description || null,
        priority    : priority || 'media',
        status      : 'pendiente',
        complexity  : complexity || 'basica',
        weight      : complexityToWeight(complexity || 'basica'),
        assignees   : assigneeIds,
        depends_on  : depends_on ? new ObjectId(depends_on) : null,
        start_date  : start_date ? new Date(start_date) : new Date(),
        target_date : target_date ? new Date(target_date) : null,
        closed_at   : null,
        days_taken  : null,
        checklist   : initialChecklist,
        attachments : [],
        created_by  : createdBy ? new ObjectId(createdBy) : null,
        createdAt   : new Date(),
        updatedAt   : new Date()
      }

      const result = await db.collection('activities').insertOne(newActivity)

      newActivity._id = result.insertedId

      // Bitácora
      this._log(result.insertedId, project_id, createdBy, 'created', { name })

      // Programar notificaciones de vencimiento
      await this._scheduleNotifications(newActivity)

      return { id: result.insertedId, ...newActivity }

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo crear la actividad', error)
    }
  }

  async getAll(filters = {}) {
    try {
      const query = {}

      if (filters.project_id && ObjectId.isValid(filters.project_id)) {
        query.project_id = new ObjectId(filters.project_id)
      }
      if (filters.phase_id && ObjectId.isValid(filters.phase_id)) {
        query.phase_id = new ObjectId(filters.phase_id)
      }
      if (filters.status)   query.status   = filters.status
      if (filters.priority) query.priority  = filters.priority

      // Filtro por asignado (un usuario puede ver sus propias actividades)
      if (filters.assignee_id && ObjectId.isValid(filters.assignee_id)) {
        query.assignees = new ObjectId(filters.assignee_id)
      }

      if (filters.search) {
        query.$or = [
          { name        : { $regex: filters.search, $options: 'i' } },
          { description : { $regex: filters.search, $options: 'i' } }
        ]
      }

      // Filtro de actividades vencidas
      if (filters.overdue === 'true') {
        query.target_date = { $lt: new Date() }
        query.status = { $nin: ['cerrado','cancelado'] }
      }

      const activities = await db.collection('activities').aggregate([
        { $match: query },
        // Info del proyecto
        {
          $lookup: {
            from     : 'projects',
            localField: 'project_id',
            foreignField: '_id',
            pipeline : [{ $project: { folio_os: 1, name: 1, area: 1 } }],
            as       : 'project'
          }
        },
        { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
        // Info de asignados
        {
          $lookup: {
            from     : 'users',
            localField: 'assignees',
            foreignField: '_id',
            pipeline : [{ $project: { name: 1, role: 1,avatar_url:1 } }],
            as       : 'assignees_info'
          }
        },
        // Info de actividad dependiente
        {
          $lookup: {
            from     : 'activities',
            localField: 'depends_on',
            foreignField: '_id',
            pipeline : [{ $project: { name: 1, status: 1 } }],
            as       : 'depends_on_info'
          }
        },
        { $unwind: { path: '$depends_on_info', preserveNullAndEmptyArrays: true } },
        { $sort: { target_date: 1, priority: -1, createdAt: -1 } }
      ]).toArray()

      // Marcar automáticamente como retrasadas
      const now = new Date()
      const toUpdate = []

      const result = activities.map(a => {
        if (
          a.target_date &&
          new Date(a.target_date) < now &&
          !['cerrado','cancelado','retrasado'].includes(a.status)
        ) {
          toUpdate.push(a._id)
          return { ...a, status: 'retrasado' }
        }
        return a
      })

      if (toUpdate.length > 0) {
        db.collection('activities').updateMany(
          { _id: { $in: toUpdate } },
          { $set: { status: 'retrasado', updatedAt: new Date() } }
        ).catch(e => console.error('Error marcando actividades retrasadas:', e))
      }

      return result

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudieron traer las actividades', error)
    }
  }

  async getOneById(id) {
    try {
      if (!ObjectId.isValid(id)) {
        throw Boom.badRequest(`El ID "${id}" no es un ID válido`)
      }

      const result = await db.collection('activities').aggregate([
        { $match: { _id: new ObjectId(id) } },
        {
          $lookup: {
            from     : 'projects',
            localField: 'project_id',
            foreignField: '_id',
            pipeline : [{ $project: { folio_os: 1, name: 1, area: 1, phases: 1 } }],
            as       : 'project'
          }
        },
        { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from     : 'users',
            localField: 'assignees',
            foreignField: '_id',
            pipeline : [{ $project: { name: 1, role: 1, email: 1,avatar_url:1 } }],
            as       : 'assignees_info'
          }
        },
        {
          $lookup: {
            from     : 'users',
            localField: 'created_by',
            foreignField: '_id',
            pipeline : [{ $project: { name: 1, role: 1,avatar_url:1 } }],
            as       : 'created_by_user'
          }
        },
        { $unwind: { path: '$created_by_user', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from     : 'activities',
            localField: 'depends_on',
            foreignField: '_id',
            pipeline : [{ $project: { name: 1, status: 1 } }],
            as       : 'depends_on_info'
          }
        },
        { $unwind: { path: '$depends_on_info', preserveNullAndEmptyArrays: true } }
      ]).toArray()

      if (!result.length) {
        throw Boom.notFound('La actividad no fue encontrada')
      }

      return result[0]

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo traer la actividad', error)
    }
  }

  /*
   * Actualización general de una actividad.
   * NO cambia el estatus (eso va por updateStatus).
   * NO gestiona archivos adjuntos (eso va por addAttachment).
   */
  async updateOneById(id, newData, user) {
    try {
      if (!ObjectId.isValid(id)) {
        throw Boom.badRequest(`El ID "${id}" no es un ID válido`)
      }

      const activity = await db.collection('activities').findOne({ _id: new ObjectId(id) })
      if (!activity) throw Boom.notFound('La actividad no fue encontrada')

      // Cambio 1: todos los usuarios pueden editar si están asignados; managers sin restricción
      this._assertCanEdit(user, activity)

      // Campos que no se actualizan por aquí
      const { _id, status, attachments, created_by, createdAt, project_id, ...dataToUpdate } = newData

      // Convertir IDs
      if (dataToUpdate.phase_id) {
        dataToUpdate.phase_id = ObjectId.isValid(dataToUpdate.phase_id)
          ? new ObjectId(dataToUpdate.phase_id) : null
      }
      if (dataToUpdate.depends_on) {
        if (!ObjectId.isValid(dataToUpdate.depends_on)) {
          throw Boom.badRequest(`depends_on "${dataToUpdate.depends_on}" no es un ID válido`)
        }
        dataToUpdate.depends_on = new ObjectId(dataToUpdate.depends_on)
      }
      if (dataToUpdate.assignees) {
        dataToUpdate.assignees = dataToUpdate.assignees
          .filter(id => ObjectId.isValid(id))
          .map(id => new ObjectId(id))
      }
      if (dataToUpdate.start_date)  dataToUpdate.start_date  = new Date(dataToUpdate.start_date)
      if (dataToUpdate.target_date) dataToUpdate.target_date = new Date(dataToUpdate.target_date)
      if (dataToUpdate.complexity) {
        if (!COMPLEXITY_LEVELS[dataToUpdate.complexity]) {
          throw Boom.badData(`Complejidad "${dataToUpdate.complexity}" no válida`)
        }
        dataToUpdate.weight = complexityToWeight(dataToUpdate.complexity)
      }
      if (dataToUpdate.weight) delete dataToUpdate.weight // weight se calcula desde complexity
      if (dataToUpdate.priority && !VALID_PRIORITIES.includes(dataToUpdate.priority)) {
        throw Boom.badData(`Prioridad "${dataToUpdate.priority}" no válida`)
      }

      dataToUpdate.updatedAt = new Date()

      const updateOne = await db.collection('activities').updateOne(
        { _id: new ObjectId(id) },
        { $set: dataToUpdate }
      )

      if (updateOne.matchedCount === 0) {
        throw Boom.notFound(`No se encontró la actividad con ID ${id}`)
      }

      // Re-programar notificaciones si cambió la fecha objetivo
      if (dataToUpdate.target_date) {
        // Limpiar notificaciones previas pendientes de envío
        await db.collection('notifications').deleteMany({
          activity_id : new ObjectId(id),
          type        : 'due_soon',
          sent        : false
        })
        await this._scheduleNotifications({ ...activity, ...dataToUpdate, _id: new ObjectId(id) })
      }

      this._log(id, activity.project_id, user._id || user.userId, 'updated', { fields: Object.keys(dataToUpdate) })

      return updateOne

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo actualizar la actividad', error)
    }
  }

  /*
   * Cambio de estatus con validación de permisos y reglas de negocio.
   *
   * Reglas:
   * - Si la actividad tiene depends_on y esa actividad no está cerrada,
   *   no se puede mover a en_proceso.
   * - Ingeniero/Auxiliar solo pueden mover a en_proceso | en_revision.
   * - Solo gerente/coordinador/admin/superadmin pueden cerrar o cancelar.
   * - Al cerrar: se registra closed_at, days_taken y se recalcula el progreso del proyecto.
   */
  async updateStatus(id, newStatus, user, note = '') {
    try {
      if (!ObjectId.isValid(id)) {
        throw Boom.badRequest(`El ID "${id}" no es un ID válido`)
      }

      if (!VALID_STATUSES.includes(newStatus)) {
        throw Boom.badData(`Estatus "${newStatus}" no válido. Opciones: ${VALID_STATUSES.join(', ')}`)
      }

      const activity = await db.collection('activities').findOne({ _id: new ObjectId(id) })
      if (!activity) throw Boom.notFound('La actividad no fue encontrada')

      // Validar permisos según rol
      this._assertCanEdit(user, activity, newStatus)

      const prevStatus = activity.status

      if (prevStatus === newStatus) {
        throw Boom.conflict(`La actividad ya tiene el estatus "${newStatus}"`)
      }

      if (['cerrado','cancelado'].includes(prevStatus)) {
        throw Boom.conflict(`No se puede cambiar el estatus de una actividad ${prevStatus}`)
      }

      // Verificar dependencia al intentar iniciar
      if (newStatus === 'en_proceso' && activity.depends_on) {
        const dep = await db.collection('activities').findOne(
          { _id: activity.depends_on },
          { projection: { status: 1, name: 1 } }
        )
        if (dep && dep.status !== 'cerrado') {
          throw Boom.conflict(
            `La actividad depende de "${dep.name}" que aún no está cerrada (estatus: ${dep.status})`
          )
        }
      }

      const setObj = {
        status    : newStatus,
        updatedAt : new Date()
      }

      // Al cerrar: calcular días reales de ejecución
      if (newStatus === 'cerrado') {
        setObj.closed_at = new Date()
        if (activity.start_date) {
          const diff = setObj.closed_at - new Date(activity.start_date)
          setObj.days_taken = Math.ceil(diff / (1000 * 60 * 60 * 24))
        }
      }

      const updateOne = await db.collection('activities').updateOne(
        { _id: new ObjectId(id) },
        { $set: setObj }
      )

      // Bitácora de cambio de estatus
      this._log(id, activity.project_id, user._id || user.userId, 'status_change', {
        prev_status : prevStatus,
        new_status  : newStatus,
        note
      })

      // Recalcular progreso del proyecto al cerrar o cancelar una actividad
      if (['cerrado','cancelado'].includes(newStatus)) {
        this.projectService.recalculateProgress(activity.project_id.toString())
          .catch(e => console.error('Error recalculando progreso:', e))
      }

      // Limpiar notificaciones pendientes si se cierra/cancela
      if (['cerrado','cancelado'].includes(newStatus)) {
        db.collection('notifications').updateMany(
          { activity_id: new ObjectId(id), sent: false },
          { $set: { cancelled: true } }
        ).catch(e => console.error('Error cancelando notificaciones:', e))
      }

      return { updateOne, prevStatus, newStatus }

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo actualizar el estatus de la actividad', error)
    }
  }

  // ─── Checklist ───────────────────────────────────────────────────────────────

  async addChecklistItem(activityId, itemData, user) {
    try {
      if (!ObjectId.isValid(activityId)) {
        throw Boom.badRequest(`El ID "${activityId}" no es un ID válido`)
      }

      const activity = await db.collection('activities').findOne({ _id: new ObjectId(activityId) })
      if (!activity) throw Boom.notFound('La actividad no fue encontrada')

      this._assertCanEdit(user, activity)

      if (!itemData.title) throw Boom.badData('El título del elemento del checklist es obligatorio')

      const newItem = {
        _id          : new ObjectId(),
        title        : itemData.title,
        completed    : false,
        days_taken   : null,
        completed_at : null
      }

      await db.collection('activities').updateOne(
        { _id: new ObjectId(activityId) },
        {
          $push: { checklist: newItem },
          $set : { updatedAt: new Date() }
        }
      )

      this._log(activityId, activity.project_id, user._id || user.userId, 'checklist_update', {
        action: 'added', item: newItem.title
      })

      return newItem

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo agregar el elemento al checklist', error)
    }
  }

  /*
   * Marca/desmarca un elemento del checklist como completado.
   * Registra los días que tomó desde que se inició la actividad.
   */
  async toggleChecklistItem(activityId, itemId, completed, daysTaken, user) {
    try {
      if (!ObjectId.isValid(activityId) || !ObjectId.isValid(itemId)) {
        throw Boom.badRequest('IDs no válidos')
      }

      const activity = await db.collection('activities').findOne({ _id: new ObjectId(activityId) })
      if (!activity) throw Boom.notFound('La actividad no fue encontrada')

      this._assertCanEdit(user, activity)

      const setObj = {
        'checklist.$[item].completed'    : completed,
        'checklist.$[item].days_taken'   : completed ? (daysTaken || null) : null,
        'checklist.$[item].completed_at' : completed ? new Date() : null,
        updatedAt                        : new Date()
      }

      const updateOne = await db.collection('activities').updateOne(
        { _id: new ObjectId(activityId) },
        { $set: setObj },
        { arrayFilters: [{ 'item._id': new ObjectId(itemId) }] }
      )

      if (updateOne.matchedCount === 0) {
        throw Boom.notFound('Actividad o elemento del checklist no encontrado')
      }

      this._log(activityId, activity.project_id, user._id || user.userId, 'checklist_update', {
        action   : completed ? 'completed' : 'uncompleted',
        item_id  : itemId,
        days_taken: daysTaken
      })

      return updateOne

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo actualizar el elemento del checklist', error)
    }
  }

  async deleteChecklistItem(activityId, itemId, user) {
    try {
      if (!ObjectId.isValid(activityId) || !ObjectId.isValid(itemId)) {
        throw Boom.badRequest('IDs no válidos')
      }

      const activity = await db.collection('activities').findOne({ _id: new ObjectId(activityId) })
      if (!activity) throw Boom.notFound('La actividad no fue encontrada')

      // Cambio 2: cualquier usuario asignado puede eliminar ítems del checklist
      this._assertCanEdit(user, activity)

      const updateOne = await db.collection('activities').updateOne(
        { _id: new ObjectId(activityId) },
        {
          $pull: { checklist: { _id: new ObjectId(itemId) } },
          $set : { updatedAt: new Date() }
        }
      )

      if (updateOne.matchedCount === 0) {
        throw Boom.notFound('Actividad no encontrada')
      }

      return updateOne

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo eliminar el elemento del checklist', error)
    }
  }

  // ─── Adjuntos (archivos) ─────────────────────────────────────────────────────

  /*
   * Registra en el documento de la actividad la metadata del archivo
   * subido por multer. El archivo físico ya fue guardado en disco por el middleware.
   *
   * Versionado simple: si ya existe un archivo con el mismo nombre original,
   * incrementa la versión. Si es nuevo, versión = 1.
   */
  async addAttachment(activityId, fileData, user) {
    try {
      if (!ObjectId.isValid(activityId)) {
        throw Boom.badRequest(`El ID "${activityId}" no es un ID válido`)
      }

      const activity = await db.collection('activities').findOne({ _id: new ObjectId(activityId) })
      if (!activity) throw Boom.notFound('La actividad no fue encontrada')

      this._assertCanEdit(user, activity)

      // Determinar versión
      const prevVersions = (activity.attachments || []).filter(
        a => a.original_name === fileData.original_name
      )
      const version = prevVersions.length + 1

      const newAttachment = {
        _id           : new ObjectId(),
        filename      : fileData.filename,      // nombre generado por multer en disco
        original_name : fileData.original_name, // nombre que el usuario vio
        path          : fileData.path,
        size          : fileData.size,
        mimetype      : fileData.mimetype,
        version,
        uploaded_by   : new ObjectId(user._id || user.userId),
        uploaded_at   : new Date()
      }

      await db.collection('activities').updateOne(
        { _id: new ObjectId(activityId) },
        {
          $push: { attachments: newAttachment },
          $set : { updatedAt: new Date() }
        }
      )

      this._log(activityId, activity.project_id, user._id || user.userId, 'attachment_added', {
        filename: fileData.original_name,
        version
      })

      return newAttachment

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo registrar el adjunto', error)
    }
  }

  async deleteAttachment(activityId, attachmentId, user) {
    try {
      if (!ObjectId.isValid(activityId) || !ObjectId.isValid(attachmentId)) {
        throw Boom.badRequest('IDs no válidos')
      }

      const activity = await db.collection('activities').findOne({ _id: new ObjectId(activityId) })
      if (!activity) throw Boom.notFound('La actividad no fue encontrada')

      // Cambio 2: cualquier usuario asignado puede eliminar adjuntos
      this._assertCanEdit(user, activity)

      const attachment = (activity.attachments || []).find(
        a => a._id.toString() === attachmentId
      )

      if (!attachment) throw Boom.notFound('El adjunto no fue encontrado')

      const updateOne = await db.collection('activities').updateOne(
        { _id: new ObjectId(activityId) },
        {
          $pull: { attachments: { _id: new ObjectId(attachmentId) } },
          $set : { updatedAt: new Date() }
        }
      )

      return { updateOne, filePath: attachment.path }

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo eliminar el adjunto', error)
    }
  }

  // ─── Registros de avance / bitácora ─────────────────────────────────────────

  /*
   * Registra un comentario/avance en la bitácora de la actividad.
   * Cualquier usuario asignado puede registrar avances.
   * Managers pueden registrar avances de cualquier actividad.
   */
  async addProgressNote(activityId, note, user) {
    try {
      if (!ObjectId.isValid(activityId)) {
        throw Boom.badRequest(`El ID "${activityId}" no es un ID válido`)
      }

      if (!note || !note.trim()) {
        throw Boom.badData('La nota de avance no puede estar vacía')
      }

      const activity = await db.collection('activities').findOne({ _id: new ObjectId(activityId) })
      if (!activity) throw Boom.notFound('La actividad no fue encontrada')

      this._assertCanEdit(user, activity)

      this._log(activityId, activity.project_id, user._id || user.userId, 'progress_update', {
        note: note.trim()
      })

      // Actualizar timestamp de la actividad para reflejar actividad reciente
      await db.collection('activities').updateOne(
        { _id: new ObjectId(activityId) },
        { $set: { updatedAt: new Date() } }
      )

      return { registered: true }

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo registrar el avance', error)
    }
  }

  // ─── Bitácora / auditoría ────────────────────────────────────────────────────

  async getLogs(activityId, filters = {}) {
    try {
      if (!ObjectId.isValid(activityId)) {
        throw Boom.badRequest(`El ID "${activityId}" no es un ID válido`)
      }

      const query = { activity_id: new ObjectId(activityId) }
      if (filters.action) query.action = filters.action

      const logs = await db.collection('activity_logs').aggregate([
        { $match: query },
        {
          $lookup: {
            from     : 'users',
            localField: 'user_id',
            foreignField: '_id',
            pipeline : [{ $project: { name: 1, role: 1,avatar_url:1 } }],
            as       : 'user'
          }
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { $sort: { createdAt: -1 } }
      ]).toArray()

      return logs

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo traer la bitácora', error)
    }
  }
}

export default Activities
