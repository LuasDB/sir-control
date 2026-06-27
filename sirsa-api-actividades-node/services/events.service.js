import { ObjectId } from 'mongodb'
import { db } from '../db/mongoClient.js'
import Boom from '@hapi/boom'

/*
 * Colección: events
 *
 * Esquema:
 * {
 *   title        : String    (requerido)
 *   description  : String
 *   type         : String    (reunion | recordatorio | tarea | vencimiento)
 *   start        : Date      (requerido — fecha y hora de inicio)
 *   end          : Date      (fecha y hora de fin, opcional)
 *   all_day      : Boolean   (evento de día completo)
 *   project_id   : ObjectId  (proyecto relacionado, opcional)
 *   participants : [ObjectId](usuarios invitados)
 *   created_by   : ObjectId
 *   color        : String    (hex, para el calendario)
 *   reminded     : Boolean   (ya se mostró el prompt de bienvenida)
 *   createdAt    : Date
 *   updatedAt    : Date
 * }
 */

const VALID_TYPES = ['reunion', 'recordatorio', 'tarea', 'vencimiento']

// Colores por tipo alineados con paleta SIRSA
export const TYPE_COLORS = {
  reunion      : '#2E75B6',   // azul info
  recordatorio : '#B08629',   // amarillo oscuro
  tarea        : '#626261',   // gris corporativo
  vencimiento  : '#E63946',   // rojo
}

export const TYPE_LABELS = {
  reunion      : 'Reunión',
  recordatorio : 'Recordatorio',
  tarea        : 'Tarea',
  vencimiento  : 'Vencimiento',
}

class Events {
  constructor() {}

  async create(data, createdBy) {
    try {
      const { title, description, type, start, end, all_day, project_id, participants, color } = data

      if (!title || !start) {
        throw Boom.badData('El título y la fecha de inicio son obligatorios')
      }
      if (type && !VALID_TYPES.includes(type)) {
        throw Boom.badData(`Tipo "${type}" no válido. Opciones: ${VALID_TYPES.join(', ')}`)
      }

      const participantIds = Array.isArray(participants)
        ? participants.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id))
        : []

      // El creador siempre es participante
      const creatorId = new ObjectId(createdBy)
      if (!participantIds.some(id => id.equals(creatorId))) {
        participantIds.push(creatorId)
      }

      const newEvent = {
        title,
        description : description || null,
        type        : type || 'reunion',
        start       : new Date(start),
        end         : end ? new Date(end) : null,
        all_day     : all_day || false,
        project_id  : project_id && ObjectId.isValid(project_id) ? new ObjectId(project_id) : null,
        participants: participantIds,
        created_by  : creatorId,
        color       : color || TYPE_COLORS[type || 'reunion'],
        reminded    : false,
        createdAt   : new Date(),
        updatedAt   : new Date()
      }

      const result = await db.collection('events').insertOne(newEvent)
      return { id: result.insertedId, ...newEvent }

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo crear el evento', error)
    }
  }

  /*
   * Obtener eventos del usuario autenticado en un rango de fechas.
   * Filtra por participante (el usuario ve solo sus eventos o los que creó).
   * Admins y superadmins ven todos.
   */
  async getAll(filters = {}, userId, userRole) {
    try {
      const query = {}

      // Rango de fechas (requerido para el calendario)
      if (filters.from || filters.to) {
        query.start = {}
        if (filters.from) query.start.$gte = new Date(filters.from)
        if (filters.to)   query.start.$lte = new Date(filters.to)
      }

      // Filtrar por tipo
      if (filters.type) query.type = filters.type

      // Filtrar por proyecto
      if (filters.project_id && ObjectId.isValid(filters.project_id)) {
        query.project_id = new ObjectId(filters.project_id)
      }

      // Admins ven todo; resto solo sus eventos
      if (!['superadmin', 'admin'].includes(userRole)) {
        const uid = new ObjectId(userId)
        query.$or = [
          { created_by  : uid },
          { participants: uid }
        ]
      }

      const events = await db.collection('events').aggregate([
        { $match: query },
        {
          $lookup: {
            from     : 'users',
            localField: 'participants',
            foreignField: '_id',
            pipeline : [{ $project: { name: 1, role: 1,avatar_url:1 } }],
            as       : 'participants_info'
          }
        },
        {
          $lookup: {
            from     : 'users',
            localField: 'created_by',
            foreignField: '_id',
            pipeline : [{ $project: { name: 1 ,avatar_url:1} }],
            as       : 'creator'
          }
        },
        { $unwind: { path: '$creator', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from     : 'projects',
            localField: 'project_id',
            foreignField: '_id',
            pipeline : [{ $project: { folio_os: 1, name: 1 } }],
            as       : 'project'
          }
        },
        { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
        { $sort: { start: 1 } }
      ]).toArray()

      return events

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudieron traer los eventos', error)
    }
  }

  async getOneById(id) {
    try {
      if (!ObjectId.isValid(id)) throw Boom.badRequest(`ID "${id}" no válido`)

      const result = await db.collection('events').aggregate([
        { $match: { _id: new ObjectId(id) } },
        {
          $lookup: {
            from     : 'users',
            localField: 'participants',
            foreignField: '_id',
            pipeline : [{ $project: { name: 1, role: 1, email: 1,avatar_url:1 } }],
            as       : 'participants_info'
          }
        },
        {
          $lookup: {
            from     : 'users',
            localField: 'created_by',
            foreignField: '_id',
            pipeline : [{ $project: { name: 1,avatar_url:1 } }],
            as       : 'creator'
          }
        },
        { $unwind: { path: '$creator', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from     : 'projects',
            localField: 'project_id',
            foreignField: '_id',
            pipeline : [{ $project: { folio_os: 1, name: 1 } }],
            as       : 'project'
          }
        },
        { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
      ]).toArray()

      if (!result.length) throw Boom.notFound('Evento no encontrado')
      return result[0]

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo traer el evento', error)
    }
  }

  async updateOneById(id, newData, userId, userRole) {
    try {
      if (!ObjectId.isValid(id)) throw Boom.badRequest(`ID "${id}" no válido`)

      const event = await db.collection('events').findOne({ _id: new ObjectId(id) })
      if (!event) throw Boom.notFound('Evento no encontrado')

      // Solo el creador o admins pueden editar
      const isAdmin   = ['superadmin', 'admin'].includes(userRole)
      const isCreator = event.created_by.toString() === userId.toString()
      if (!isAdmin && !isCreator) {
        throw Boom.forbidden('Solo el creador puede editar este evento')
      }

      const { _id, created_by, createdAt, ...dataToUpdate } = newData

      if (dataToUpdate.start)  dataToUpdate.start = new Date(dataToUpdate.start)
      if (dataToUpdate.end)    dataToUpdate.end   = new Date(dataToUpdate.end)
      if (dataToUpdate.type && !VALID_TYPES.includes(dataToUpdate.type)) {
        throw Boom.badData('Tipo de evento no válido')
      }
      if (dataToUpdate.participants) {
        dataToUpdate.participants = dataToUpdate.participants
          .filter(i => ObjectId.isValid(i))
          .map(i => new ObjectId(i))
        // Mantener al creador siempre
        const creatorId = new ObjectId(event.created_by)
        if (!dataToUpdate.participants.some(id => id.equals(creatorId))) {
          dataToUpdate.participants.push(creatorId)
        }
      }
      if (dataToUpdate.project_id) {
        dataToUpdate.project_id = ObjectId.isValid(dataToUpdate.project_id)
          ? new ObjectId(dataToUpdate.project_id) : null
      }

      // Actualizar color automáticamente si cambió el tipo
      if (dataToUpdate.type && !dataToUpdate.color) {
        dataToUpdate.color = TYPE_COLORS[dataToUpdate.type]
      }

      dataToUpdate.updatedAt = new Date()

      const updateOne = await db.collection('events').updateOne(
        { _id: new ObjectId(id) },
        { $set: dataToUpdate }
      )

      if (updateOne.matchedCount === 0) throw Boom.notFound('Evento no encontrado')
      return updateOne

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo actualizar el evento', error)
    }
  }

  async deleteOneById(id, userId, userRole) {
    try {
      if (!ObjectId.isValid(id)) throw Boom.badRequest(`ID "${id}" no válido`)

      const event = await db.collection('events').findOne({ _id: new ObjectId(id) })
      if (!event) throw Boom.notFound('Evento no encontrado')

      const isAdmin   = ['superadmin', 'admin'].includes(userRole)
      const isCreator = event.created_by.toString() === userId.toString()
      if (!isAdmin && !isCreator) {
        throw Boom.forbidden('Solo el creador puede eliminar este evento')
      }

      const result = await db.collection('events').deleteOne({ _id: new ObjectId(id) })
      if (result.deletedCount === 0) throw Boom.notFound('Evento no encontrado')
      return result

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo eliminar el evento', error)
    }
  }

  /*
   * Eventos del día de hoy y los próximos N días para el prompt de bienvenida.
   * Solo devuelve eventos del usuario que no han sido vistos aún (reminded: false),
   * o todos los del día si se pide sin filtro de reminded.
   */
  async getUpcoming(userId, userRole, days = 3) {
    try {
      const now   = new Date()
      const start = new Date(now); start.setHours(0, 0, 0, 0)
      const end   = new Date(start); end.setDate(end.getDate() + days)

      const query = {
        start: { $gte: start, $lte: end }
      }

      if (!['superadmin', 'admin'].includes(userRole)) {
        const uid = new ObjectId(userId)
        query.$or = [{ created_by: uid }, { participants: uid }]
      }

      const events = await db.collection('events')
        .find(query)
        .sort({ start: 1 })
        .project({ title: 1, type: 1, start: 1, end: 1, all_day: 1, color: 1, project_id: 1 })
        .toArray()

      return events

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudieron traer los eventos próximos', error)
    }
  }
}

export default Events
