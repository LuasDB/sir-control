import { ObjectId } from 'mongodb'
import { db } from '../db/mongoClient.js'
import  Boom  from "@hapi/boom"

class Users{
  constructor(){}

  async getAll(filters = {}){
    try {
      const query = {}

      if (filters.role) query.role = filters.role;
      if (filters.active !== undefined) query.active = filters.active === 'true' || filters.active === true;
      if (filters.area) query.area = filters.area
      if (filters.gerencia_id && ObjectId.isValid(filters.gerencia_id)) {
        query.gerencia_id = new ObjectId(filters.gerencia_id)
      }
      if (filters.department_id) {
        if(!ObjectId.isValid(filters.department_id)){
          throw Boom.badRequest(`El ID ${filters.department_id} no es un ID válido`)
        }
        query.department_id = new ObjectId(filters.department_id)
      }
      if (filters.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { email: { $regex: filters.search, $options: 'i' } }
        ]
      }

      const users = await db.collection('users').find(
        query,
        {projection:{password:0}})
        .sort({createdAt:-1}).toArray()

      return users

    } catch (error) {
      if(Boom.isBoom(error)){
        throw error
      }else{
      throw Boom.badImplementation('No se pudo traer a todos los usuarios',error)}
    }
  }
  async getOneById(id){
    try {
      if(!ObjectId.isValid(id)){
        throw Boom.badRequest(`El ID ${id} no es un ID valido`)
      }
      const user = await db.collection('users')
      .findOne( {_id:new ObjectId(id)},
                {projection:{password:0}})

      if(!user){
        throw Boom.notFound('El elemento no fue encontrado')
      }

      return user

    } catch (error) {
      if(Boom.isBoom(error)){
        throw error
      }else{
      throw Boom.badImplementation('No se pudo traer el usuario',error)}
    }
  }
  async updateOneById(id, newData){

    try {
      if(!ObjectId.isValid(id)){
        throw Boom.badRequest(`El ID ${id} no es un ID valido`)
      }

      // _id y password no deben actualizarse por esta vía
      // (password se gestiona vía reset-password / forgot-password)
      const { _id, password, ...dataToUpdate } = newData

      if(dataToUpdate.department_id){
        if(!ObjectId.isValid(dataToUpdate.department_id)){
          throw Boom.badRequest(`El ID de departamento ${dataToUpdate.department_id} no es válido`)
        }
        dataToUpdate.department_id = new ObjectId(dataToUpdate.department_id)
      }
      if(dataToUpdate.gerencia_id){
        if(!ObjectId.isValid(dataToUpdate.gerencia_id)){
          throw Boom.badRequest(`El ID de gerencia ${dataToUpdate.gerencia_id} no es válido`)
        }
        dataToUpdate.gerencia_id = new ObjectId(dataToUpdate.gerencia_id)
      }

      dataToUpdate.updatedAt = new Date()

      const updateOne = await db.collection('users').updateOne(
        {_id: new ObjectId(id)},
        {$set:dataToUpdate}
      )

      if (updateOne.matchedCount === 0) {
        throw Boom.notFound(`No se encontró un documento con ID ${id} en la colección users`);
      }
      return updateOne
    } catch (error) {
      if(Boom.isBoom(error)){
        throw error
      }else{
      throw Boom.badImplementation('No se pudo editar el usuario',error)}
    }
  }
  async deleteOneById(id){
    try {
      if(!ObjectId.isValid(id)){
        throw Boom.badRequest(`El ID ${id} no es un ID valido`)
      }
      const deleteUser = await db.collection('users')
      .deleteOne( {_id:new ObjectId(id)})

      if(deleteUser.deletedCount === 0){
        throw Boom.notFound('El elemento no fue encontrado')
      }

      return deleteUser

    } catch (error) {
      if(Boom.isBoom(error)){
        throw error
      }else{
      throw Boom.badImplementation('No se pudo eliminar el usuario',error)}
    }
  }
}

export default Users
