import { Router } from '../../shared/router'
import planner from './planner'
import enrolment from './enrolment'
import reviewer from './reviewer'

const eventRouter = new Router()

// Route extract endpoint
eventRouter.post('/api/events/extract', async (req, env) => {
  return planner.fetch(req, env)
})

// Route event planning sessions
eventRouter.all('/api/events/session/*', async (req, env) => {
  return planner.fetch(req, env)
})

// Route enrollment sessions
eventRouter.all('/api/enrollments/session/*', async (req, env) => {
  return enrolment.fetch(req, env)
})

// Route review sessions
eventRouter.all('/api/reviews/session/*', async (req, env) => {
  return reviewer.fetch(req, env)
})

export default eventRouter
