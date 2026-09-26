export type ServiceErrorCode =
  | 'NETWORK'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'RATE_LIMITED'

export class ServiceError extends Error {
  constructor(
    public code: ServiceErrorCode,
    message: string,
    public details?: Record<string, string>,
  ) {
    super(message)
    this.name = 'ServiceError'
  }
}

export function errorMessage(err: unknown) {
  if (err instanceof ServiceError) return err.message
  if (err instanceof Error) return err.message
  return 'Algo deu errado. Tente novamente.'
}
