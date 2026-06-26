import express from 'express'
import authRouter from './auth.router.js'
import usersRouter from './users.router.js'
import departmentsRouter from './departments.router.js'
import projectsRouter from './projects.router.js'
import clientsRouter from './clients.router.js'
import activitiesRouter from './activities.router.js'
import notificationsRouter from './notifications.router.js'
import chatRouter from './chat.router.js'
import eventsRouter from './events.router.js'
import reportsRouter from './reports.router.js'

const router = express.Router()

const AppRouter = (app,io) => {

  app.use('/api/v1', router)
  router.use('/auth', authRouter)
  router.use('/users', usersRouter(io))
  router.use('/departments', departmentsRouter(io))
  router.use('/projects', projectsRouter(io))
  router.use('/clients', clientsRouter(io))
  router.use('/activities', activitiesRouter(io))
  router.use('/notifications', notificationsRouter(io))
  router.use('/events', eventsRouter(io))
  router.use('/reports', reportsRouter(io))
  // Chat: montado bajo /projects/:projectId/chat
  router.use('/projects', chatRouter(io))

}

export default AppRouter
