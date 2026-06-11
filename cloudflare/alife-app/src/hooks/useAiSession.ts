import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { createAiSessionService } from '../services/aiSessionService'
import { normalizeApiError } from '../services/http'
import type { AiSessionAppContext, AiSessionMessageOptions, AiSessionResponse, AiSessionSsePayload, AiSessionState } from '../types/aiSession'

export const useAiSession = <TDraft, TContext = unknown>(
  sessionId: string,
  basePath: string,
  appContext?: AiSessionAppContext,
) => {
  const service = useMemo(() => createAiSessionService<TDraft, TContext>(basePath), [basePath])
  const [state, setState] = useState<AiSessionState<TDraft, TContext> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sessionId) {
      setState(null)
      return
    }

    let isMounted = true
    const source = service.createStream(sessionId)

    const applyState = (nextState: AiSessionState<TDraft, TContext>) => {
      if (isMounted) {
        setState(nextState)
      }
    }

    source.addEventListener('snapshot', (event) => {
      applyState(JSON.parse((event as MessageEvent<string>).data) as AiSessionState<TDraft, TContext>)
    })

    source.addEventListener('message', (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as AiSessionSsePayload<TDraft, TContext>
      if (payload.state) {
        applyState(payload.state)
      }
    })

    service.getState(sessionId, appContext)
      .then(applyState)
      .catch((reason) => {
        if (isMounted) {
          setError(normalizeApiError(reason).message)
        }
      })

    return () => {
      isMounted = false
      source.close()
    }
  }, [appContext, service, sessionId])

  const sendMessage = useCallback(async (
    message: string,
    inputModeOrOptions: 'text' | 'voice' | AiSessionMessageOptions = 'text',
  ) => {
    setLoading(true)
    setError('')

    try {
      const options = typeof inputModeOrOptions === 'string'
        ? { inputMode: inputModeOrOptions, appContext }
        : { ...inputModeOrOptions, appContext: inputModeOrOptions.appContext ?? appContext }
      const response = await service.sendMessage(sessionId, message, options)

      if (response.responseMode === 'result' && response.result) {
        const nextDraft = response.result
        setState((current) => current
          ? {
            ...current,
            draft: nextDraft,
            context: response.context ?? current.context ?? null,
            updatedAt: new Date().toISOString(),
          }
          : current)
      }

      return response
    } catch (reason) {
      const apiError = normalizeApiError(reason)
      setError(apiError.message)
      throw apiError
    } finally {
      setLoading(false)
    }
  }, [appContext, service, sessionId])

  const clearError = useCallback(() => setError(''), [])

  return {
    state,
    setState,
    loading,
    error,
    clearError,
    sendMessage,
  } as {
    state: AiSessionState<TDraft, TContext> | null
    setState: Dispatch<SetStateAction<AiSessionState<TDraft, TContext> | null>>
    loading: boolean
    error: string
    clearError: () => void
    sendMessage: (message: string, inputModeOrOptions?: 'text' | 'voice' | AiSessionMessageOptions) => Promise<AiSessionResponse<TDraft, TContext>>
  }
}
