import { Router } from '../../shared/router'
import planner from './planner'
import enrolment from './enrolment'
import reviewer from './reviewer'
import { handleRamGuidance } from './ramGuidance'

const eventRouter = new Router()
eventRouter.post('/api/events/ram-guidance', (request, env) => handleRamGuidance(request, env))

eventRouter.all('/api/events/details-session/*', async (req, env) => planner.fetch(req, env))

// Route enrollment sessions
eventRouter.all('/api/enrollments/session/*', async (req, env) => {
  return enrolment.fetch(req, env)
})

// Route review sessions
eventRouter.all('/api/reviews/session/*', async (req, env) => {
  return reviewer.fetch(req, env)
})

export default eventRouter
