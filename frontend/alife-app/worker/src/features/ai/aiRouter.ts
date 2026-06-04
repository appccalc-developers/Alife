import { Router } from '../../shared/router'

const aiRouter = new Router()

aiRouter.get('/api/ai/status', async () => {
  return Response.json({ status: 'ok', features: ['event-planning', 'enrollment', 'review'] })
})

export default aiRouter
