import { Router } from '../../shared/router'
import { handleGenerateEventPoster } from './generateEventPoster'
import { handleTranslateTextFields } from './translateTextFields'

const aiRouter = new Router()

aiRouter.get('/api/ai/status', async () => {
  return Response.json({ status: 'ok', features: ['event-planning', 'enrollment', 'review', 'text-translation', 'event-poster-generation'] })
})

aiRouter.post('/api/ai/translate-text-fields', async (req, env) => {
  return handleTranslateTextFields(req, env)
})

aiRouter.post('/api/ai/event-poster', async (req, env) => {
  return handleGenerateEventPoster(req, env)
})

export default aiRouter
