export type ProviderErrorKind = 'invalid_payload' | 'timeout' | 'http_error' | 'unavailable'

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind
  readonly statusCode: number | null

  constructor(kind: ProviderErrorKind, statusCode: number | null = null) {
    super(`provider_${kind}`)
    this.name = 'ProviderError'
    this.kind = kind
    this.statusCode = Number.isInteger(statusCode) ? statusCode : null
  }
}

export const providerInvalidPayload = (): ProviderError => new ProviderError('invalid_payload')
export const providerTimeout = (): ProviderError => new ProviderError('timeout')
export const providerHttpError = (statusCode: number): ProviderError => new ProviderError('http_error', statusCode)
export const providerUnavailable = (): ProviderError => new ProviderError('unavailable')

export const normalizeProviderError = (error: unknown): ProviderError => (
  error instanceof ProviderError ? error : providerUnavailable()
)
