import { ObjectId } from 'mongodb'
import { db } from '../db/mongoClient.js'
import Boom from '@hapi/boom'

/*
 * Colección: activity_types
 *
 * Catálogo de "tipos de actividad" que coordinadores y administradores
 * dan de alta para clasificar cada actividad al momento de crearla.
 * Ej. "Trámites", "Seguimiento a correo", "Informe anual", etc.
 *
 * Esquema de documento:
 * {
 *   name        : String   (requerido, único)
 *   description : String | null
 *   active      : Boolean  (baja lógica)
 *   createdAt   : Date
 *   updatedAt   : Date
 * }
 */
class ActivityTypes {
  constructor() {}

  async create(data) {
    try {
      const { name, description } = data

      if (!name || !name.trim()) {
        throw Boom.badData('El nombre del tipo de actividad es obligatorio')
      }

      const cleanName = name.trim()

      const existing = await db.collection('activity_types').findOne({
        name: { $regex: `^${cleanName}$`, $options: 'i' }
      })

      if (existing) {
        throw Boom.conflict(`El tipo de actividad "${cleanName}" ya existe`)
      }

      const newType = {
        name       : cleanName,
        description: description?.trim() || null,
        active     : true,
        createdAt  : new Date(),
        updatedAt  : new Date()
      }

      const result = await db.collection('activity_types').insertOne(newType)

      return { id: result.insertedId, ...newType }

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo crear el tipo de actividad', error)
    }
  }

  async getAll(filters = {}) {
    try {
      const query = {}

      if (filters.active !== undefined) {
        query.active = filters.active === 'true' || filters.active === true
      }
      if (filters.search) {
        query.name = { $regex: filters.search, $options: 'i' }
      }

      const types = await db.collection('activity_types')
        .find(query)
        .sort({ name: 1 })
        .toArray()

      return types

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudieron traer los tipos de actividad', error)
    }
  }

  async getOneById(id) {
    try {
      if (!ObjectId.isValid(id)) {
        throw Boom.badRequest(`El ID ${id} no es un ID válido`)
      }

      const type = await db.collection('activity_types')
        .findOne({ _id: new ObjectId(id) })

      if (!type) {
        throw Boom.notFound('El tipo de actividad no fue encontrado')
      }

      return type

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo traer el tipo de actividad', error)
    }
  }

  async updateOneById(id, newData) {
    try {
      if (!ObjectId.isValid(id)) {
        throw Boom.badRequest(`El ID ${id} no es un ID válido`)
      }

      const { _id, createdAt, ...dataToUpdate } = newData

      if (dataToUpdate.name !== undefined) {
        if (!dataToUpdate.name || !dataToUpdate.name.trim()) {
          throw Boom.badData('El nombre del tipo de actividad es obligatorio')
        }
        dataToUpdate.name = dataToUpdate.name.trim()

        const duplicate = await db.collection('activity_types').findOne({
          _id : { $ne: new ObjectId(id) },
          name: { $regex: `^${dataToUpdate.name}$`, $options: 'i' }
        })
        if (duplicate) {
          throw Boom.conflict(`El tipo de actividad "${dataToUpdate.name}" ya existe`)
        }
      }

      if (dataToUpdate.description !== undefined) {
        dataToUpdate.description = dataToUpdate.description?.trim() || null
      }

      dataToUpdate.updatedAt = new Date()

      const updateOne = await db.collection('activity_types').updateOne(
        { _id: new ObjectId(id) },
        { $set: dataToUpdate }
      )

      if (updateOne.matchedCount === 0) {
        throw Boom.notFound(`No se encontró un tipo de actividad con ID ${id}`)
      }

      return updateOne

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo actualizar el tipo de actividad', error)
    }
  }

  /*
   * Baja lógica: se desactiva en lugar de eliminarse para no romper
   * la relación con las actividades que ya lo tienen asignado.
   */
  async deactivate(id) {
    try {
      if (!ObjectId.isValid(id)) {
        throw Boom.badRequest(`El ID ${id} no es un ID válido`)
      }

      const updateOne = await db.collection('activity_types').updateOne(
        { _id: new ObjectId(id) },
        { $set: { active: false, updatedAt: new Date() } }
      )

      if (updateOne.matchedCount === 0) {
        throw Boom.notFound(`No se encontró un tipo de actividad con ID ${id}`)
      }

      return updateOne

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo desactivar el tipo de actividad', error)
    }
  }

  /*
   * Reactiva un tipo previamente dado de baja.
   */
  async activate(id) {
    try {
      if (!ObjectId.isValid(id)) {
        throw Boom.badRequest(`El ID ${id} no es un ID válido`)
      }

      const updateOne = await db.collection('activity_types').updateOne(
        { _id: new ObjectId(id) },
        { $set: { active: true, updatedAt: new Date() } }
      )

      if (updateOne.matchedCount === 0) {
        throw Boom.notFound(`No se encontró un tipo de actividad con ID ${id}`)
      }

      return updateOne

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo reactivar el tipo de actividad', error)
    }
  }
}

export default ActivityTypes
