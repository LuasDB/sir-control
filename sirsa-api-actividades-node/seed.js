/**
 * seed.js — Crea el primer usuario superadmin en la base de datos.
 *
 * Uso (una sola vez, desde la raíz del proyecto):
 *   node seed.js
 *
 * Elimina o renombra este archivo después de ejecutarlo.
 */

import 'dotenv/config'
import { MongoClient } from 'mongodb'
import bcrypt from 'bcrypt'
import config from './config.js'

const SUPERADMIN = {
  name       : 'Super Admin',
  email      : 'admin@siradiacion.com.mx', // ← cambia este correo
  password   : 'SIR2026$ecure',            // ← cambia esta contraseña
  role       : 'superadmin',
  department_id: null,
  active     : true,
  createdAt  : new Date(),
  updatedAt  : new Date(),
}

const seed = async () => {
  const client = new MongoClient(config.mongoURI)

  try {
    await client.connect()
    console.log('✅ Conectado a MongoDB:', config.database)

    const db = client.db(config.database)

    // Verificar si ya existe
    const existing = await db.collection('users').findOne({ email: SUPERADMIN.email })
    if (existing) {
      console.log(`⚠️  Ya existe un usuario con el correo ${SUPERADMIN.email}`)
      console.log('   Si olvidaste la contraseña, usa el endpoint /auth/forgot-password')
      return
    }

    // Hashear contraseña
    const hashedPassword = await bcrypt.hash(SUPERADMIN.password, 10)

    const result = await db.collection('users').insertOne({
      ...SUPERADMIN,
      password: hashedPassword,
    })

    console.log('\n🚀 Usuario superadmin creado exitosamente:')
    console.log(`   ID    : ${result.insertedId}`)
    console.log(`   Correo: ${SUPERADMIN.email}`)
    console.log(`   Clave : ${SUPERADMIN.password}`)
    console.log('\n⚠️  IMPORTANTE: cambia la contraseña desde la plataforma y elimina seed.js')

  } catch (error) {
    console.error('❌ Error al crear el usuario:', error)
  } finally {
    await client.close()
    process.exit(0)
  }
}

seed()
