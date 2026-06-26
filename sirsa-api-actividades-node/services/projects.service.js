import { ObjectId } from 'mongodb'
import { db } from '../db/mongoClient.js'
import Boom from '@hapi/boom'

/*
 * Colección: projects
 * Cada proyecto corresponde a una Orden de Servicio del área técnica.
 *
 * Esquema de documento:
 * {
 *   folio_os        : String     (clave única de la orden de servicio)
 *   clave           : String     (clave interna del proyecto)
 *   name            : String     (actividad principal / descripción corta)
 *   description     : String     (descripción completa del alcance)
 *   area            : String     (Trabajos especiales | Dosimetría | TI | QHSE | Metrología | Medicina Nuclear | Gerencia)
 *   department_id   : ObjectId   (departamento asignado)
 *   client_id       : ObjectId   (referencia a colección clients)
 *   seller_id       : ObjectId   (usuario con rol vendedor / referencia a users)
 *   received_at     : Date       (fecha de recepción de la OS)
 *   target_date     : Date       (fecha objetivo de entrega)
 *   closed_at       : Date|null  (fecha real de cierre)
 *   status          : String     (pendiente | en_proceso | retrasado | en_revision | cerrado | cancelado)
 *   progress        : Number     (0-100, calculado en base a actividades cerradas)
 *   phases          : Array      (fases del proyecto, embebidas en el documento)
 *   created_by      : ObjectId   (usuario que creó el proyecto)
 *   createdAt       : Date
 *   updatedAt       : Date
 * }
 *
 * Fase embebida:
 * {
 *   _id         : ObjectId
 *   name        : String
 *   order_index : Number
 *   status      : String  (pendiente | en_proceso | cerrada)
 *   createdAt   : Date
 * }
 */

const VALID_STATUSES = ['pendiente', 'en_proceso', 'retrasado', 'en_revision', 'cerrado', 'cancelado']
const VALID_AREAS = ['Trabajos especiales', 'Dosimetría', 'TI', 'QHSE', 'Metrología', 'Medicina Nuclear', 'Gerencia']

class Projects {
  constructor() {}

  // ─── Proyectos ─────────────────────────────────────────────────────────────

  async create(data) {
    try {
      const {
        folio_os, clave, name, description,
        area, department_id, client_id, seller_id,
        received_at, target_date, phases, members
      } = data

      if (!name || !folio_os) {
        throw Boom.badData('El nombre del proyecto y el folio de la OS son obligatorios')
      }

      // Verificar folio único
      const existing = await db.collection('projects').findOne({ folio_os })
      if (existing) {
        throw Boom.conflict(`Ya existe un proyecto con el folio OS ${folio_os}`)
      }

      if (area && !VALID_AREAS.includes(area)) {
        throw Boom.badData(`El área "${area}" no es válida. Opciones: ${VALID_AREAS.join(', ')}`)
      }

      // Preparar fases iniciales si se envían
      const initialPhases = Array.isArray(phases)
        ? phases.map((p, i) => ({
            _id: new ObjectId(),
            name: p.name,
            order_index: p.order_index ?? i,
            status: 'pendiente',
            createdAt: new Date()
          }))
        : []

      // Cambio 6: members — usuarios invitados al proyecto
      // El creador siempre queda incluido automáticamente
      const creatorId = data.created_by ? new ObjectId(data.created_by) : null
      const memberIds = Array.isArray(members)
        ? members.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id))
        : []
      // Agregar el creador si no está ya en la lista
      if (creatorId && !memberIds.some(id => id.equals(creatorId))) {
        memberIds.push(creatorId)
      }

      const newProject = {
        folio_os,
        clave: clave || null,
        name,
        description: description || null,
        area: area || null,
        department_id: department_id ? new ObjectId(department_id) : null,
        client_id: client_id ? new ObjectId(client_id) : null,
        seller_id: seller_id ? new ObjectId(seller_id) : null,
        received_at: received_at ? new Date(received_at) : new Date(),
        target_date: target_date ? new Date(target_date) : null,
        closed_at: null,
        status: 'pendiente',
        progress: 0,
        phases: initialPhases,
        members: memberIds,
        created_by: creatorId,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const result = await db.collection('projects').insertOne(newProject)

      return { id: result.insertedId, ...newProject }

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo crear el proyecto', error)
    }
  }

  async getAll(filters = {}) {
    try {
      const query = {}

      if (filters.status) query.status = filters.status
      if (filters.area) query.area = filters.area
      if (filters.department_id && ObjectId.isValid(filters.department_id)) {
        query.department_id = new ObjectId(filters.department_id)
      }
      if (filters.client_id && ObjectId.isValid(filters.client_id)) {
        query.client_id = new ObjectId(filters.client_id)
      }
      if (filters.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { folio_os: { $regex: filters.search, $options: 'i' } },
          { clave: { $regex: filters.search, $options: 'i' } }
        ]
      }

      // Cambio 6: superadmin y admin ven todos los proyectos;
      // el resto solo ve los proyectos donde están en members
      if (filters.userId && !['superadmin','admin'].includes(filters.userRole)) {
        query.members = new ObjectId(filters.userId)
      }

      // Agrupamos la info del cliente y el creador para no requerir
      // múltiples llamadas desde el frontend
      const projects = await db.collection('projects').aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'clients',
            localField: 'client_id',
            foreignField: '_id',
            as: 'client'
          }
        },
        { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'users',
            localField: 'created_by',
            foreignField: '_id',
            pipeline: [{ $project: { password: 0 } }],
            as: 'created_by_user'
          }
        },
        { $unwind: { path: '$created_by_user', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'users',
            localField: 'seller_id',
            foreignField: '_id',
            pipeline: [{ $project: { password: 0 } }],
            as: 'seller'
          }
        },
        { $unwind: { path: '$seller', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from     : 'users',
            localField: 'members',
            foreignField: '_id',
            pipeline : [{ $project: { name: 1, role: 1 } }],
            as       : 'members_info'
          }
        },
        { $sort: { createdAt: -1 } }
      ]).toArray()

      // Recalcular estatus de retraso automáticamente al traer lista
      const now = new Date()
      const toUpdate = []

      const result = projects.map(p => {
        if (
          p.target_date &&
          new Date(p.target_date) < now &&
          !['cerrado', 'cancelado'].includes(p.status) &&
          p.status !== 'retrasado'
        ) {
          toUpdate.push(p._id)
          return { ...p, status: 'retrasado' }
        }
        return p
      })

      // Actualizar en BD los que están retrasados sin bloquear la respuesta
      if (toUpdate.length > 0) {
        db.collection('projects').updateMany(
          { _id: { $in: toUpdate } },
          { $set: { status: 'retrasado', updatedAt: new Date() } }
        ).catch(e => console.error('Error actualizando proyectos retrasados:', e))
      }

      return result

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudieron traer los proyectos', error)
    }
  }

  async getOneById(id) {
    try {
      if (!ObjectId.isValid(id)) {
        throw Boom.badRequest(`El ID ${id} no es un ID válido`)
      }

      const result = await db.collection('projects').aggregate([
        { $match: { _id: new ObjectId(id) } },
        {
          $lookup: {
            from: 'clients',
            localField: 'client_id',
            foreignField: '_id',
            as: 'client'
          }
        },
        { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'users',
            localField: 'created_by',
            foreignField: '_id',
            pipeline: [{ $project: { password: 0 } }],
            as: 'created_by_user'
          }
        },
        { $unwind: { path: '$created_by_user', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'users',
            localField: 'seller_id',
            foreignField: '_id',
            pipeline: [{ $project: { password: 0 } }],
            as: 'seller'
          }
        },
        { $unwind: { path: '$seller', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'departments',
            localField: 'department_id',
            foreignField: '_id',
            as: 'department'
          }
        },
        { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from     : 'users',
            localField: 'members',
            foreignField: '_id',
            pipeline : [{ $project: { name: 1, role: 1, email: 1 } }],
            as       : 'members_info'
          }
        }
      ]).toArray()

      if (!result.length) {
        throw Boom.notFound('El proyecto no fue encontrado')
      }

      return result[0]

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo traer el proyecto', error)
    }
  }

  async updateOneById(id, newData, updatedById) {
    try {
      if (!ObjectId.isValid(id)) {
        throw Boom.badRequest(`El ID ${id} no es un ID válido`)
      }

      const { _id, phases, progress, created_by, createdAt, ...dataToUpdate } = newData

      // Convertir ObjectIds cuando aplique
      if (dataToUpdate.department_id && ObjectId.isValid(dataToUpdate.department_id)) {
        dataToUpdate.department_id = new ObjectId(dataToUpdate.department_id)
      }
      if (dataToUpdate.client_id && ObjectId.isValid(dataToUpdate.client_id)) {
        dataToUpdate.client_id = new ObjectId(dataToUpdate.client_id)
      }
      if (dataToUpdate.seller_id && ObjectId.isValid(dataToUpdate.seller_id)) {
        dataToUpdate.seller_id = new ObjectId(dataToUpdate.seller_id)
      }
      if (dataToUpdate.received_at) {
        dataToUpdate.received_at = new Date(dataToUpdate.received_at)
      }
      if (dataToUpdate.target_date) {
        dataToUpdate.target_date = new Date(dataToUpdate.target_date)
      }
      if (dataToUpdate.area && !VALID_AREAS.includes(dataToUpdate.area)) {
        throw Boom.badData(`El área "${dataToUpdate.area}" no es válida`)
      }

      dataToUpdate.updatedAt = new Date()

      const updateOne = await db.collection('projects').updateOne(
        { _id: new ObjectId(id) },
        { $set: dataToUpdate }
      )

      if (updateOne.matchedCount === 0) {
        throw Boom.notFound(`No se encontró un proyecto con ID ${id}`)
      }

      return updateOne

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo actualizar el proyecto', error)
    }
  }

  /*
   * Cierre formal del proyecto.
   * Solo disponible para gerente/coordinador/superadmin/admin.
   * Marca el estatus como 'cerrado' y registra la fecha real de cierre.
   */
  async closeProject(id, closedById) {
    try {
      if (!ObjectId.isValid(id)) {
        throw Boom.badRequest(`El ID ${id} no es un ID válido`)
      }

      const project = await db.collection('projects').findOne({ _id: new ObjectId(id) })

      if (!project) {
        throw Boom.notFound('El proyecto no fue encontrado')
      }

      if (project.status === 'cerrado') {
        throw Boom.conflict('El proyecto ya se encuentra cerrado')
      }

      if (project.status === 'cancelado') {
        throw Boom.conflict('No se puede cerrar un proyecto cancelado')
      }

      const updateOne = await db.collection('projects').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            status: 'cerrado',
            closed_at: new Date(),
            updatedAt: new Date()
          }
        }
      )

      return updateOne

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo cerrar el proyecto', error)
    }
  }

  async cancelProject(id) {
    try {
      if (!ObjectId.isValid(id)) {
        throw Boom.badRequest(`El ID ${id} no es un ID válido`)
      }

      const project = await db.collection('projects').findOne({ _id: new ObjectId(id) })

      if (!project) {
        throw Boom.notFound('El proyecto no fue encontrado')
      }

      if (['cerrado', 'cancelado'].includes(project.status)) {
        throw Boom.conflict(`El proyecto ya se encuentra ${project.status}`)
      }

      const updateOne = await db.collection('projects').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            status: 'cancelado',
            updatedAt: new Date()
          }
        }
      )

      return updateOne

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo cancelar el proyecto', error)
    }
  }

  /*
   * Recalcula el progreso del proyecto en base a actividades.
   * Se llama desde activities.service.js cada vez que una actividad
   * cambia de estatus (especialmente al cerrarse).
   */
  async recalculateProgress(projectId) {
    try {
      if (!ObjectId.isValid(projectId)) return

      const total = await db.collection('activities').countDocuments({
        project_id: new ObjectId(projectId),
        status: { $ne: 'cancelado' }
      })

      if (total === 0) {
        await db.collection('projects').updateOne(
          { _id: new ObjectId(projectId) },
          { $set: { progress: 0, updatedAt: new Date() } }
        )
        return 0
      }

      const closed = await db.collection('activities').countDocuments({
        project_id: new ObjectId(projectId),
        status: 'cerrado'
      })

      const progress = Math.round((closed / total) * 100)

      await db.collection('projects').updateOne(
        { _id: new ObjectId(projectId) },
        { $set: { progress, updatedAt: new Date() } }
      )

      return progress

    } catch (error) {
      console.error('Error recalculando progreso del proyecto:', error)
    }
  }

  // ─── Fases (embebidas en el documento del proyecto) ────────────────────────

  async addPhase(projectId, phaseData) {
    try {
      if (!ObjectId.isValid(projectId)) {
        throw Boom.badRequest(`El ID ${projectId} no es un ID válido`)
      }

      if (!phaseData.name) {
        throw Boom.badData('El nombre de la fase es obligatorio')
      }

      const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) })

      if (!project) {
        throw Boom.notFound('El proyecto no fue encontrado')
      }

      const newPhase = {
        _id: new ObjectId(),
        name: phaseData.name,
        order_index: phaseData.order_index ?? (project.phases?.length || 0),
        status: 'pendiente',
        createdAt: new Date()
      }

      await db.collection('projects').updateOne(
        { _id: new ObjectId(projectId) },
        {
          $push: { phases: newPhase },
          $set: { updatedAt: new Date() }
        }
      )

      return newPhase

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo agregar la fase', error)
    }
  }

  async updatePhase(projectId, phaseId, newData) {
    try {
      if (!ObjectId.isValid(projectId) || !ObjectId.isValid(phaseId)) {
        throw Boom.badRequest('IDs no válidos')
      }

      const { _id, createdAt, ...dataToUpdate } = newData

      // Construir $set dinámico para el subdocumento (array element por id)
      const setObj = {}
      Object.keys(dataToUpdate).forEach(key => {
        setObj[`phases.$[phase].${key}`] = dataToUpdate[key]
      })
      setObj['updatedAt'] = new Date()

      const updateOne = await db.collection('projects').updateOne(
        { _id: new ObjectId(projectId) },
        { $set: setObj },
        { arrayFilters: [{ 'phase._id': new ObjectId(phaseId) }] }
      )

      if (updateOne.matchedCount === 0) {
        throw Boom.notFound('El proyecto o fase no fue encontrado')
      }

      return updateOne

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo actualizar la fase', error)
    }
  }

  async deletePhase(projectId, phaseId) {
    try {
      if (!ObjectId.isValid(projectId) || !ObjectId.isValid(phaseId)) {
        throw Boom.badRequest('IDs no válidos')
      }

      // Verificar que no tenga actividades asociadas a esta fase
      const activitiesInPhase = await db.collection('activities').countDocuments({
        project_id: new ObjectId(projectId),
        phase_id: new ObjectId(phaseId)
      })

      if (activitiesInPhase > 0) {
        throw Boom.conflict(
          `No se puede eliminar la fase porque tiene ${activitiesInPhase} actividad(es) asociada(s)`
        )
      }

      const updateOne = await db.collection('projects').updateOne(
        { _id: new ObjectId(projectId) },
        {
          $pull: { phases: { _id: new ObjectId(phaseId) } },
          $set: { updatedAt: new Date() }
        }
      )

      if (updateOne.matchedCount === 0) {
        throw Boom.notFound('El proyecto no fue encontrado')
      }

      return updateOne

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo eliminar la fase', error)
    }
  }

  /*
   * Cambio 6: Agregar un usuario al array members del proyecto.
   */
  async addMember(projectId, userId) {
    try {
      if (!ObjectId.isValid(projectId) || !ObjectId.isValid(userId)) {
        throw Boom.badRequest('IDs no válidos')
      }
      const updateOne = await db.collection('projects').updateOne(
        { _id: new ObjectId(projectId) },
        {
          $addToSet: { members: new ObjectId(userId) },
          $set     : { updatedAt: new Date() }
        }
      )
      if (updateOne.matchedCount === 0) throw Boom.notFound('Proyecto no encontrado')
      return updateOne
    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo agregar el miembro', error)
    }
  }

  /*
   * Cambio 6: Quitar un usuario del array members del proyecto.
   */
  async removeMember(projectId, userId) {
    try {
      if (!ObjectId.isValid(projectId) || !ObjectId.isValid(userId)) {
        throw Boom.badRequest('IDs no válidos')
      }
      const updateOne = await db.collection('projects').updateOne(
        { _id: new ObjectId(projectId) },
        {
          $pull: { members: new ObjectId(userId) },
          $set : { updatedAt: new Date() }
        }
      )
      if (updateOne.matchedCount === 0) throw Boom.notFound('Proyecto no encontrado')
      return updateOne
    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo remover el miembro', error)
    }
  }

  // ─── Dashboard ─────────────────────────────────────────────────────────────

  /*
   * Estadísticas generales para el dashboard principal.
   * Opcionalmente filtra por área o department_id.
   */
  async getDashboardStats(filters = {}) {
    try {
      const matchProject = {}

      if (filters.area) matchProject.area = filters.area
      if (filters.department_id && ObjectId.isValid(filters.department_id)) {
        matchProject.department_id = new ObjectId(filters.department_id)
      }

      // ── Conteos de proyectos por estatus ──
      const projectStats = await db.collection('projects').aggregate([
        { $match: matchProject },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]).toArray()

      const projectStatusMap = {}
      projectStats.forEach(s => { projectStatusMap[s._id] = s.count })

      // ── Proyectos activos con progreso (para tabla del dashboard) ──
      const activeProjects = await db.collection('projects').aggregate([
        {
          $match: {
            ...matchProject,
            status: { $nin: ['cerrado', 'cancelado'] }
          }
        },
        {
          $lookup: {
            from: 'clients',
            localField: 'client_id',
            foreignField: '_id',
            as: 'client'
          }
        },
        { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            folio_os: 1, name: 1, area: 1, status: 1,
            progress: 1, target_date: 1,
            'client.razon_social': 1
          }
        },
        { $sort: { target_date: 1 } }
      ]).toArray()

      // ── Conteos de actividades por estatus ──
      const activityMatchStage = {}
      if (filters.area || filters.department_id) {
        // Necesitamos hacer lookup desde activities hacia projects para filtrar
        const projectIds = await db.collection('projects')
          .find(matchProject, { projection: { _id: 1 } })
          .map(p => p._id).toArray()
        activityMatchStage.project_id = { $in: projectIds }
      }

      const activityStats = await db.collection('activities').aggregate([
        { $match: activityMatchStage },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]).toArray()

      const activityStatusMap = {}
      activityStats.forEach(s => { activityStatusMap[s._id] = s.count })

      // ── Actividades próximas a vencer (próximos 7 días + ya vencidas) ──
      const now = new Date()
      const in7Days = new Date(now)
      in7Days.setDate(in7Days.getDate() + 7)

      const upcomingActivities = await db.collection('activities').aggregate([
        {
          $match: {
            ...activityMatchStage,
            status: { $nin: ['cerrado', 'cancelado'] },
            target_date: { $lte: in7Days }
          }
        },
        {
          $lookup: {
            from: 'projects',
            localField: 'project_id',
            foreignField: '_id',
            pipeline: [{ $project: { folio_os: 1, name: 1, area: 1 } }],
            as: 'project'
          }
        },
        { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'users',
            localField: 'assignees',
            foreignField: '_id',
            pipeline: [{ $project: { name: 1 } }],
            as: 'assignees_info'
          }
        },
        {
          $project: {
            name: 1, status: 1, priority: 1, target_date: 1,
            project: 1, assignees_info: 1
          }
        },
        { $sort: { target_date: 1 } },
        { $limit: 10 }
      ]).toArray()

      // ── Carga de trabajo por usuario (actividades activas asignadas) ──
      const workload = await db.collection('activities').aggregate([
        {
          $match: {
            ...activityMatchStage,
            status: { $nin: ['cerrado', 'cancelado'] }
          }
        },
        { $unwind: '$assignees' },
        {
          $group: {
            _id: '$assignees',
            total: { $sum: 1 },
            totalWeight: { $sum: { $ifNull: ['$weight', 1] } }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            pipeline: [{ $project: { name: 1, role: 1 } }],
            as: 'user'
          }
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { $sort: { total: -1 } },
        { $limit: 10 }
      ]).toArray()

      return {
        projects: {
          total: Object.values(projectStatusMap).reduce((a, b) => a + b, 0),
          byStatus: projectStatusMap,
          active: activeProjects
        },
        activities: {
          total: Object.values(activityStatusMap).reduce((a, b) => a + b, 0),
          byStatus: activityStatusMap,
          upcoming: upcomingActivities
        },
        workload
      }

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudieron obtener las estadísticas del dashboard', error)
    }
  }

  /*
   * Dashboard específico de un proyecto:
   * progreso, actividades por estatus, última actividad, fases.
   */
  async getProjectDashboard(projectId) {
    try {
      if (!ObjectId.isValid(projectId)) {
        throw Boom.badRequest(`El ID ${projectId} no es un ID válido`)
      }

      const project = await this.getOneById(projectId)

      const activityStats = await db.collection('activities').aggregate([
        { $match: { project_id: new ObjectId(projectId) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]).toArray()

      const byStatus = {}
      activityStats.forEach(s => { byStatus[s._id] = s.count })

      const recentActivities = await db.collection('activities')
        .find({ project_id: new ObjectId(projectId) })
        .sort({ updatedAt: -1 })
        .limit(5)
        .project({ name: 1, status: 1, priority: 1, target_date: 1, assignees: 1 })
        .toArray()

      return {
        project: {
          _id: project._id,
          folio_os: project.folio_os,
          name: project.name,
          area: project.area,
          status: project.status,
          progress: project.progress,
          target_date: project.target_date,
          phases: project.phases,
          client: project.client
        },
        activities: {
          byStatus,
          total: Object.values(byStatus).reduce((a, b) => a + b, 0),
          recent: recentActivities
        }
      }

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo obtener el dashboard del proyecto', error)
    }
  }
}

export default Projects
