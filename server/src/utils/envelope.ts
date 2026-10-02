export interface ApiEnvelope<T> {
  readonly code: number
  readonly message: string
  readonly data: T
  readonly meta: Record<string, unknown>
}

export const successEnvelope = <T>(data: T, meta: Record<string, unknown> = {}): ApiEnvelope<T> => ({
  code: 0,
  message: 'ok',
  data,
  meta: { ...meta },
})

export const errorEnvelope = (code: number, message: string): ApiEnvelope<null> => ({
  code,
  message,
  data: null,
  meta: {},
})
