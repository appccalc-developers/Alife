import { retryHttpQuery } from './httpError'
import { QueryClient } from '@tanstack/react-query'

export const QUERY_STALE_TIME_MS = 30_000

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_TIME_MS,
      gcTime: 5 * 60_000,
      retry: retryHttpQuery,
      refetchOnWindowFocus: false,
    },
  },
})
