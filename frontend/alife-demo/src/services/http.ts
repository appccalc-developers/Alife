import axios from 'axios'
import type { AxiosError } from 'axios'

export type ApiError = {
  message: string
  status?: number
  code?: string
  details?: unknown
}

type ErrorPayload = {
  message?: string
  title?: string
  detail?: string
  errors?: Record<string, string[]>
}

export const normalizeApiError = (error: unknown): ApiError => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ErrorPayload>
    const payload = axiosError.response?.data
    const details = payload?.errors ?? payload

    return {
      message:
        payload?.message ||
        payload?.title ||
        payload?.detail ||
        axiosError.message ||
        'Request failed.',
      status: axiosError.response?.status,
      code: axiosError.code,
      details,
    }
  }

  if (error instanceof Error) {
    return { message: error.message }
  }

  return { message: 'Unknown error.' }
}

const productionBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim()
// In dev, same-origin `/api/*` is proxied by Vite (see vite.config.ts) so the browser never hits cross-origin CORS.
const baseURL = import.meta.env.DEV ? '' : productionBaseUrl

export const http = axios.create({
  baseURL,
  withCredentials: true,
})

http.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(normalizeApiError(error)),
)
