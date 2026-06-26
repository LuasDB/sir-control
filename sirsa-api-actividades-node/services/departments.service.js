import { ObjectId } from 'mongodb'
import { db } from '../db/mongoClient.js'
import Boom from '@hapi/boom'

class Departments{
  constructor(){}

  /*
   * Crea un nuevo departamento.
   * Cada departamento puede llevar un arreglo de áreas (ej. Dosimetría, Metrología, QHSE, etc.)
   * que después se usarán para clasificar proyectos.
   */
  async create(data){
    try {
      const { name, areas } = data

      if(!name){
        throw Boom.badData('El nombre del departamento es obligatorio')
      }

      const existing = await db.collection('departments').findOne({name})

      if(existing){
        throw Boom.conflict(`El departamento ${name} ya existe`)
      }

      const newDepartment = {
        name,
        areas: Array.isArray(areas) ? areas : [],
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const result = await db.collection('departments').insertOne(newDepartment)

      return { id: result.insertedId, ...newDepartment }

    } catch (error) {
      if(Boom.isBoom(error)){
        throw error
      }
      throw Boom.badImplementation('No se pudo crear el departamento', error)
    }
  }

  async getAll(filters = {}){
    try {
      const query = {}

      if (filters.active !== undefined) query.active = filters.active
      if (filters.search) {
        query.name = { $regex: filters.search, $options: 'i' }
      }

      const departments = await db.collection('departments')
        .find(query)
        .sort({ createdAt: -1 })
        .toArray()

      return departments

    } catch (error) {
      if(Boom.isBoom(error)){
        throw error
      }
      throw Boom.badImplementation('No se pudieron traer los departamentos', error)
    }
  }

  async getOneById(id){
    try {
      if(!ObjectId.isValid(id)){
        throw Boom.badRequest(`El ID ${id} no es un ID válido`)
      }

      const department = await db.collection('departments')
        .findOne({ _id: new ObjectId(id) })

      if(!department){
        throw Boom.notFound('El departamento no fue encontrado')
      }

      return department

    } catch (error) {
      if(Boom.isBoom(error)){
        throw error
      }
      throw Boom.badImplementation('No se pudo traer el departamento', error)
    }
  }

  async updateOneById(id, newData){
    try {
      if(!ObjectId.isValid(id)){
        throw Boom.badRequest(`El ID ${id} no es un ID válido`)
      }

      const { _id, ...dataToUpdate } = newData

      dataToUpdate.updatedAt = new Date()

      const updateOne = await db.collection('departments').updateOne(
        { _id: new ObjectId(id) },
        { $set: dataToUpdate }
      )

      if (updateOne.matchedCount === 0) {
        throw Boom.notFound(`No se encontró un departamento con ID ${id}`)
      }

      return updateOne

    } catch (error) {
      if(Boom.isBoom(error)){
        throw error
      }
      throw Boom.badImplementation('No se pudo editar el departamento', error)
    }
  }

  /*
   * Agrega una nueva área al arreglo "areas" del departamento, evitando duplicados.
   */
  async addArea(id, areaName){
    try {
      if(!ObjectId.isValid(id)){
        throw Boom.badRequest(`El ID ${id} no es un ID válido`)
      }

      if(!areaName){
        throw Boom.badData('El nombre del área es obligatorio')
      }

      const updateOne = await db.collection('departments').updateOne(
        { _id: new ObjectId(id) },
        {
          $addToSet: { areas: areaName },
          $set: { updatedAt: new Date() }
        }
      )

      if (updateOne.matchedCount === 0) {
        throw Boom.notFound(`No se encontró un departamento con ID ${id}`)
      }

      return updateOne

    } catch (error) {
      if(Boom.isBoom(error)){
        throw error
      }
      throw Boom.badImplementation('No se pudo agregar el área', error)
    }
  }

  /*
   * Elimina un área del arreglo "areas" del departamento.
   */
  async removeArea(id, areaName){
    try {
      if(!ObjectId.isValid(id)){
        throw Boom.badRequest(`El ID ${id} no es un ID válido`)
      }

      const updateOne = await db.collection('departments').updateOne(
        { _id: new ObjectId(id) },
        {
          $pull: { areas: areaName },
          $set: { updatedAt: new Date() }
        }
      )

      if (updateOne.matchedCount === 0) {
        throw Boom.notFound(`No se encontró un departamento con ID ${id}`)
      }

      return updateOne

    } catch (error) {
      if(Boom.isBoom(error)){
        throw error
      }
      throw Boom.badImplementation('No se pudo eliminar el área', error)
    }
  }

  /*
   * Baja lógica: desactiva el departamento en lugar de eliminarlo,
   * para no romper la relación con usuarios y proyectos ya existentes.
   */
  async deactivate(id){
    try {
      if(!ObjectId.isValid(id)){
        throw Boom.badRequest(`El ID ${id} no es un ID válido`)
      }

      const updateOne = await db.collection('departments').updateOne(
        { _id: new ObjectId(id) },
        { $set: { active: false, updatedAt: new Date() } }
      )

      if (updateOne.matchedCount === 0) {
        throw Boom.notFound(`No se encontró un departamento con ID ${id}`)
      }

      return updateOne

    } catch (error) {
      if(Boom.isBoom(error)){
        throw error
      }
      throw Boom.badImplementation('No se pudo desactivar el departamento', error)
    }
  }
}

export default Departments
