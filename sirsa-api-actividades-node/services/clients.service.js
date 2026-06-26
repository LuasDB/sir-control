import { ObjectId } from 'mongodb'
import { db } from '../db/mongoClient.js'
import Boom from '@hapi/boom'

/*
 * Colección: clients
 * Almacena los datos del cliente asociados a una orden de servicio / proyecto.
 * Se mantiene separada para reutilizar clientes entre múltiples proyectos
 * y facilitar búsquedas / reportes por razón social.
 *
 * Esquema de documento:
 * {
 *   razon_social : String  (requerido)
 *   contact_name : String
 *   phone        : String
 *   email        : String
 *   active       : Boolean
 *   createdAt    : Date
 *   updatedAt    : Date
 * }
 */
class Clients {
  constructor() {}

  async create(data) {
    try {
      const { razon_social, contact_name, phone, email } = data

      if (!razon_social) {
        throw Boom.badData('La razón social del cliente es obligatoria')
      }

      // Permite múltiples proyectos para la misma razón social,
      // pero evita registros duplicados exactos (misma razón social + mismo correo)
      const existing = await db.collection('clients').findOne({
        razon_social: { $regex: `^${razon_social}$`, $options: 'i' },
        email: email || null
      })

      if (existing) {
        // En lugar de lanzar error, devolvemos el cliente existente
        // para que el router decida si reutilizarlo o crear uno nuevo
        return { existed: true, client: existing }
      }

      const newClient = {
        razon_social,
        contact_name: contact_name || null,
        phone: phone || null,
        email: email ? email.toLowerCase().trim() : null,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const result = await db.collection('clients').insertOne(newClient)

      return { existed: false, client: { _id: result.insertedId, ...newClient } }

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo crear el cliente', error)
    }
  }

  async getAll(filters = {}) {
    try {
      const query = {}

      if (filters.search) {
        query.$or = [
          { razon_social: { $regex: filters.search, $options: 'i' } },
          { contact_name: { $regex: filters.search, $options: 'i' } },
          { email: { $regex: filters.search, $options: 'i' } }
        ]
      }

      if (filters.active !== undefined) {
        query.active = filters.active === 'true' || filters.active === true
      }

      const clients = await db.collection('clients')
        .find(query)
        .sort({ razon_social: 1 })
        .toArray()

      return clients

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudieron traer los clientes', error)
    }
  }

  async getOneById(id) {
    try {
      if (!ObjectId.isValid(id)) {
        throw Boom.badRequest(`El ID ${id} no es un ID válido`)
      }

      const client = await db.collection('clients').findOne({ _id: new ObjectId(id) })

      if (!client) {
        throw Boom.notFound('El cliente no fue encontrado')
      }

      return client

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo traer el cliente', error)
    }
  }

  async updateOneById(id, newData) {
    try {
      if (!ObjectId.isValid(id)) {
        throw Boom.badRequest(`El ID ${id} no es un ID válido`)
      }

      const { _id, ...dataToUpdate } = newData

      if (dataToUpdate.email) {
        dataToUpdate.email = dataToUpdate.email.toLowerCase().trim()
      }

      dataToUpdate.updatedAt = new Date()

      const updateOne = await db.collection('clients').updateOne(
        { _id: new ObjectId(id) },
        { $set: dataToUpdate }
      )

      if (updateOne.matchedCount === 0) {
        throw Boom.notFound(`No se encontró un cliente con ID ${id}`)
      }

      return updateOne

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo actualizar el cliente', error)
    }
  }
}

export default Clients
