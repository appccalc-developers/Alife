import { Router } from '../../shared/router'
import { handleGenerateEventPoster } from './generateEventPoster'
import { handleTranslateTextFields } from './translateTextFields'
import { handleGenerateEventClosureDraft } from './generateEventClosureDraft'
import { handleGenerateEventModuleSuggestions } from './generateEventModuleSuggestions'

const aiRouter = new Router()

aiRouter.get('/api/ai/status', async () => {
  return Response.json({ status: 'ok', features: ['event-planning', 'enrollment', 'review', 'text-translation', 'event-poster-generation', 'event-closure-drafting', 'event-module-suggestions'] })
})

aiRouter.post('/api/ai/translate-text-fields', async (req, env) => {
  return handleTranslateTextFields(req, env)
})

aiRouter.post('/api/ai/event-poster', async (req, env) => {
  return handleGenerateEventPoster(req, env)
})

aiRouter.post('/api/ai/event-closure', async (req, env) => {
  return handleGenerateEventClosureDraft(req, env)
})

aiRouter.post('/api/ai/event-module-suggestions', async (req, env) => {
  return handleGenerateEventModuleSuggestions(req, env)
})

export default aiRouter
