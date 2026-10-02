import type { ErrorRequestHandler, RequestHandler } from 'express'
import { BUSINESS_ERROR_CODES } from '../constants/api'
import { AppError, resourceNotFound } from '../errors/app-error'
import { errorEnvelope } from '../utils/envelope'

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(resourceNotFound())
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json(errorEnvelope(error.code, error.publicMessage))
    return
  }

  res.status(500).json(errorEnvelope(
    BUSINESS_ERROR_CODES.UPSTREAM_ERROR,
    'upstream_error',
  ))
}
