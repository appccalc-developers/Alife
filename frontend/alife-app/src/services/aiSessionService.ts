import { sameOriginHttp } from './http'
import type { AiSessionResponse, AiSessionState } from '../types/aiSession'

export const createAiSessionService = <TDraft, TContext = unknown>(basePath: string) => {
  const normalizedBasePath = basePath.replace(/\/$/, '')

  return {
    sendMessage: async (
      sessionId: string,
      message: string,
      inputMode: 'text' | 'voice' = 'text',
    ): Promise<AiSessionResponse<TDraft, TContext>> => {
      const { data } = await sameOriginHttp.post<AiSessionResponse<TDraft, TContext>>(
        `${normalizedBasePath}/${encodeURIComponent(sessionId)}/message`,
        { message, inputMode },
      )
      return data
    },

    getState: async (sessionId: string): Promise<AiSessionState<TDraft, TContext>> => {
      const { data } = await sameOriginHttp.get<AiSessionState<TDraft, TContext>>(
        `${normalizedBasePath}/${encodeURIComponent(sessionId)}/state`,
      )
      return data
    },

    createStream: (sessionId: string): EventSource =>
      new EventSource(`${normalizedBasePath}/${encodeURIComponent(sessionId)}/stream`),
  }
}
