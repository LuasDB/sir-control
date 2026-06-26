import Boom from "@hapi/boom"
import jwt from 'jsonwebtoken'
import config from "../config.js"

// Jerarquía de roles del sistema, de mayor a menor privilegio
const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  GERENTE: 'gerente',
  COORDINADOR: 'coordinador',
  INGENIERO: 'ingeniero',
  AUXILIAR: 'auxiliar'
}

// Roles que pueden gestionar (crear/cerrar) proyectos y actividades de cualquier usuario
const MANAGEMENT_ROLES = [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.GERENTE, ROLES.COORDINADOR]

const authenticate = (req,res,next)=>{
  try {
    const authHeader = req.headers.authorization
    if(!authHeader || !authHeader.startsWith('Bearer ')){
      throw Boom.unauthorized('Token no proporcionado')
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, config.jwtSecret)

    req.user = decoded
    next()

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(Boom.unauthorized('Token inválido'));
    } else if (error.name === 'TokenExpiredError') {
      next(Boom.unauthorized('Token expirado'));
    } else {
      next(error);
    }
  }
}

const authorize = (...allowedRoles)=>{
  return (req,res,next)=>{
    if(!req.user){
      return next(Boom.unauthorized('Usuario no autenticado'))
    }

    if(!allowedRoles.includes(req.user.role)){
      return next(Boom.unauthorized('Usuario no tiene permisos para esta acción'))
    }

    next()
  }
}

export { authenticate, authorize, ROLES, MANAGEMENT_ROLES }
