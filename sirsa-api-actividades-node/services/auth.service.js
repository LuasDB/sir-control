import { db } from './../db/mongoClient.js'
import Boom from '@hapi/boom'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import config from '../config.js'
import { sendMail } from './../utils/sendMail.js'
import path from 'path'
import { ObjectId } from 'mongodb'

class Auth{
  constructor(){
     this.jwtSecret = config.jwtSecret
    this.jwtExpiration = '5h'
    this.resetTokenExpiration = '15min'
  }
//652000199780259 folio cancelación Telmex baja Netflix
  async create(data){

    try {
      const { name, email, password, role, department_id, area, gerencia_id, active } = data
      if(!name || !email ){
        throw Boom.badData('Todos los datos son necesarios')
      }

      const normalizedEmail = email.toLowerCase().trim()

      const user = await db.collection('users').findOne({email:normalizedEmail})

      if(user){
        throw Boom.conflict(`El usuario con correo ${normalizedEmail} ya existe`);
      }

      const newUser = {
        name,
        email:normalizedEmail,
        role: role || 'auxiliar',
        department_id: department_id ? new ObjectId(department_id) : null,
        area: area || null,
        gerencia_id: gerencia_id && ObjectId.isValid(gerencia_id) ? new ObjectId(gerencia_id) : null,
        active: active !== undefined ? active : true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      if(password){
        const hashedPassword = await bcrypt.hash(password,10);
        newUser.password = hashedPassword
      }


      const result = await db.collection('users').insertOne(newUser)

      if(result.insertedId){
        const resetToken = jwt.sign(
          { userId: result.insertedId,email:normalizedEmail },
          this.jwtSecret,
          { expiresIn: '1h' }
        );

        const resetLink = `${config.urlApp}/reset-password?token=${resetToken}`
        if(!password){
          sendMail({
            to:normalizedEmail,
            subject:'Creación de contraseña',
            data:{name,resetLink},
            templateEmail:'register',
            attachments:[{
              filename:'sir-flow',
              path:path.join('emails/sir-flow.png'),
              cid:'logo_empresa'
            }]
          })
        }

        return {id:result.insertedId,name,email:normalizedEmail,role:newUser.role,department_id:newUser.department_id}

      }

    } catch (error) {
      if(Boom.isBoom(error)){
        throw error
      }
      throw Boom.badImplementation('Error al registrar usuario',error)

    }

  }

  async login(data){
    try {
      const { password,email } = data
      const user = await db.collection('users').findOne({email:email?.toLowerCase().trim()})

      if(!user){
        throw Boom.unauthorized('Email o password incorrectos')
      }

      if(user.active === false){
        throw Boom.unauthorized('El usuario se encuentra inactivo')
      }

      const isPasswordValid = await bcrypt.compare(password,user.password)

      if(!isPasswordValid){
        throw Boom.unauthorized('Email o password incorrectos')
      }
      delete user.password

      const payload = user

      const token = jwt.sign(payload,this.jwtSecret,{ expiresIn:'5h'})

      return token

    } catch (error) {
      if(Boom.isBoom(error)){
        throw error
      }
      throw Boom.badImplementation('Error al registrar usuario',error)
    }
  }

  async forgotPassword(data){
    try {
      console.log(data)
      const { email } = data
      const user = await this.getUserByEmail(email)

      const resetToken = jwt.sign(
        { userId: user._id,email:user.email },
        this.jwtSecret,
        { expiresIn: this.resetTokenExpiration }
      );

      const resetLink = `${config.urlApp}/reset-password?token=${resetToken}`
      sendMail({
        to:email,
        subject:'Creación de contraseña',
        data:{name:user.name,resetLink},
        templateEmail:'restartPass',
        attachments:[{
          filename:'sir-flow',
            path:path.join('emails/sir-flow.png'),
            cid:'logo_empresa'
        }]
      })
      return 'Se ha enviado un enlace de restablecimiento de contraseña a tu correo.'
    } catch (error) {
      if(Boom.isBoom(error)){
        throw error
      }
      throw Boom.badImplementation('Error al registrar usuario',error)
    }
  }

  async getUserByEmail(email){
    try {
      const user = await db.collection('users').findOne({email:email})
      if (!user) {
        throw Boom.notFound('No se encontró un usuario con ese correo');
      }

      return user

    } catch (error) {
      if(Boom.isBoom(error)){
        throw error
      }
      throw Boom.badImplementation('Error al registrar usuario',error)
    }
  }

  async resetPassword(token, newPassword){
    try {
      const decoded = jwt.verify(token,this.jwtSecret)

      const user = await this.getUserByEmail(decoded.email)

      const hashedPassword = await bcrypt.hash(newPassword,10)

      await db.collection('users').updateOne(
        {_id:user._id},
        {$set:{password:hashedPassword}}
      )

      return { message:'Contraseña actualizada' }
    } catch (error) {
      if(Boom.isBoom(error)){
        throw error
      }
      throw Boom.badImplementation('Error al registrar usuario',error)
    }
  }


}

export default Auth
