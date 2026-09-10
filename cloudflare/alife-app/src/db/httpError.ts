export class HttpStatusError extends Error {
  readonly status: number
  constructor(path: string, status: number) {
    super(`GET ${path} failed with status ${status}`)
    this.name = 'HttpStatusError'
    this.status = status
  }
}

export const isNotFound = (error: unknown): error is HttpStatusError =>
  error instanceof HttpStatusError && error.status === 404

export const retryHttpQuery = (failureCount: number, error: unknown) =>
  !isNotFound(error) && failureCount < 1
