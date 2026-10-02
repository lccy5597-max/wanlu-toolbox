import { BUSINESS_ERROR_CODES } from '../constants/api'

export class AppError extends Error {
  readonly statusCode: number
  readonly code: number
  readonly publicMessage: string

  constructor(statusCode: number, code: number, publicMessage: string) {
    super(publicMessage)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
    this.publicMessage = publicMessage
  }
}

export const invalidRequest = (): AppError => new AppError(
  400,
  BUSINESS_ERROR_CODES.INVALID_REQUEST,
  'invalid_request',
)

export const resourceNotFound = (): AppError => new AppError(
  404,
  BUSINESS_ERROR_CODES.RESOURCE_NOT_FOUND,
  'resource_not_found',
)

export const serviceUnavailable = (): AppError => new AppError(
  503,
  BUSINESS_ERROR_CODES.SERVICE_UNAVAILABLE,
  'service_unavailable',
)

export const upstreamError = (): AppError => new AppError(
  500,
  BUSINESS_ERROR_CODES.UPSTREAM_ERROR,
  'upstream_error',
)

export const contentNotFound = (): AppError => new AppError(
  404,
  BUSINESS_ERROR_CODES.CONTENT_NOT_FOUND,
  'content_not_found',
)
