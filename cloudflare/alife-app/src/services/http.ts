import axios from 'axios'
import type { AxiosError } from 'axios'

export type ApiError = {
  message: string
  status?: number
  code?: string
  details?: unknown
  method?: string
  url?: string
}

type ErrorPayload = {
  message?: string
  title?: string
  detail?: string
  errors?: Record<string, string[]>
  code?: string
}

const isApiError = (error: unknown): error is ApiError =>
  typeof error === 'object' &&
  error !== null &&
  'message' in error &&
  typeof (error as { message?: unknown }).message === 'string'

export const normalizeApiError = (error: unknown): ApiError => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ErrorPayload | string>
    const payload = axiosError.response?.data
    const textPayload = typeof payload === 'string' ? payload.trim() : ''
    const details = typeof payload === 'object' ? payload?.errors ?? payload : textPayload || payload
    const method = axiosError.config?.method?.toUpperCase()
    const url = axiosError.config?.url ?? axiosError.response?.config.url
    const requestHint = import.meta.env.DEV && url ? ` (${method ?? 'GET'} ${url})` : ''
    const message =
      textPayload ||
      (typeof payload === 'object' ? payload?.message : undefined) ||
      (typeof payload === 'object' ? payload?.title : undefined) ||
      (typeof payload === 'object' ? payload?.detail : undefined) ||
      axiosError.message ||
      'Request failed.'

    return {
      message: `${message}${requestHint}`,
      status: axiosError.response?.status,
      code: (typeof payload === 'object' ? payload?.code : undefined) ?? axiosError.code,
      details,
      method,
      url,
    }
  }

  if (isApiError(error)) {
    return error
  }

  if (error instanceof Error) {
    return { message: error.message }
  }

  return { message: 'Unknown error.' }
}

const productionBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim()
// In dev, same-origin `/api/*` is proxied by Vite (see vite.config.ts) so the browser never hits cross-origin CORS.
const baseURL = import.meta.env.DEV ? '' : productionBaseUrl

const attachErrorNormalization = (client: ReturnType<typeof axios.create>) => {
  client.interceptors.response.use(
    (response) => response,
    (error) => Promise.reject(normalizeApiError(error)),
  )

  return client
}

export const http = attachErrorNormalization(axios.create({
  baseURL,
  withCredentials: true,
}))

export const sameOriginHttp = attachErrorNormalization(axios.create({
  withCredentials: true,
}))
