import { Router } from '../../shared/router'
import { handleTranslateTextFields } from './translateTextFields'

const aiRouter = new Router()

aiRouter.get('/api/ai/status', async () => {
  return Response.json({ status: 'ok', features: ['event-planning', 'enrollment', 'review', 'text-translation'] })
})

aiRouter.post('/api/ai/translate-text-fields', async (req, env) => {
  return handleTranslateTextFields(req, env)
})

export default aiRouter
