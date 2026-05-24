import { sameOriginHttp } from './http'
import type { AiSessionAppContext, AiSessionMessageOptions, AiSessionResponse, AiSessionState } from '../types/aiSession'

export const createAiSessionService = <TDraft, TContext = unknown>(basePath: string) => {
  const normalizedBasePath = basePath.replace(/\/$/, '')

  return {
    sendMessage: async (
      sessionId: string,
      message: string,
      inputModeOrOptions: 'text' | 'voice' | AiSessionMessageOptions = 'text',
    ): Promise<AiSessionResponse<TDraft, TContext>> => {
      const options = typeof inputModeOrOptions === 'string'
        ? { inputMode: inputModeOrOptions }
        : inputModeOrOptions
      const { data } = await sameOriginHttp.post<AiSessionResponse<TDraft, TContext>>(
        withAppContextSearch(`${normalizedBasePath}/${encodeURIComponent(sessionId)}/message`, options.appContext),
        { message, inputMode: options.inputMode ?? 'text', attachments: options.attachments },
      )
      return data
    },

    start: async (
      sessionId: string,
      payload: { appContext?: AiSessionAppContext; [key: string]: unknown } = {},
    ): Promise<AiSessionState<TDraft, TContext>> => {
      const { appContext, ...body } = payload
      const { data } = await sameOriginHttp.post<AiSessionState<TDraft, TContext>>(
        withAppContextSearch(`${normalizedBasePath}/${encodeURIComponent(sessionId)}/start`, appContext),
        body,
      )
      return data
    },

    getState: async (sessionId: string, appContext?: AiSessionAppContext): Promise<AiSessionState<TDraft, TContext>> => {
      const { data } = await sameOriginHttp.get<AiSessionState<TDraft, TContext>>(
        withAppContextSearch(`${normalizedBasePath}/${encodeURIComponent(sessionId)}/state`, appContext),
      )
      return data
    },

    createStream: (sessionId: string, appContext?: AiSessionAppContext): EventSource =>
      new EventSource(withAppContextSearch(`${normalizedBasePath}/${encodeURIComponent(sessionId)}/stream`, appContext)),
  }
}

function withAppContextSearch(path: string, appContext?: AiSessionAppContext) {
  if (!appContext) {
    return path
  }

  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(appContext)) {
    if (value === undefined || value === null) {
      continue
    }

    params.set(key, typeof value === 'string' ? value : JSON.stringify(value))
  }

  const query = params.toString()
  return query ? `${path}${path.includes('?') ? '&' : '?'}${query}` : path
}
