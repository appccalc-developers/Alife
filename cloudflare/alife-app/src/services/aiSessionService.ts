import { sameOriginHttp } from './http'
import type { AiSessionAppContext, AiSessionAttachment, AiSessionMessageOptions, AiSessionResponse, AiSessionState } from '../types/aiSession'

export const fileToInlineAiAttachment = async (
  file: File,
  fallbackName = 'attachment',
): Promise<AiSessionAttachment> => {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  const contentType = file.type || 'application/octet-stream'
  return {
    name: file.name || fallbackName,
    contentType,
    size: file.size,
    source: 'inline',
    inlineData: {
      mimeType: contentType,
      data: btoa(binary),
    },
  }
}

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
        `${normalizedBasePath}/${encodeURIComponent(sessionId)}/message`,
        {
          message,
          inputMode: options.inputMode ?? 'text',
          ...(options.appContext ? { appContext: options.appContext } : {}),
          ...(options.attachments ? { attachments: options.attachments } : {}),
        },
      )
      return data
    },

    start: async (
      sessionId: string,
      payload: { appContext?: AiSessionAppContext; [key: string]: unknown } = {},
    ): Promise<AiSessionState<TDraft, TContext>> => {
      const { data } = await sameOriginHttp.post<AiSessionState<TDraft, TContext>>(
        `${normalizedBasePath}/${encodeURIComponent(sessionId)}/start`,
        payload,
      )
      return data
    },

    getState: async (sessionId: string, appContext?: AiSessionAppContext): Promise<AiSessionState<TDraft, TContext>> => {
      const path = `${normalizedBasePath}/${encodeURIComponent(sessionId)}/state`
      const { data } = appContext
        ? await sameOriginHttp.post<AiSessionState<TDraft, TContext>>(path, { appContext })
        : await sameOriginHttp.get<AiSessionState<TDraft, TContext>>(path)
      return data
    },

    close: async (sessionId: string): Promise<void> => {
      await sameOriginHttp.post(`${normalizedBasePath}/${encodeURIComponent(sessionId)}/close`)
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
