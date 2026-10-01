const API_OK_CODE = 0

const API_ERROR_TYPES = Object.freeze({
  CLIENT_DISABLED: 'client_disabled',
  CONTRACT: 'contract',
  TRANSPORT: 'transport',
  HTTP: 'http',
  BUSINESS: 'business',
})

const cloneMeta = (meta) => (meta && typeof meta === 'object' && !Array.isArray(meta) ? { ...meta } : {})

const createApiError = ({
  type = API_ERROR_TYPES.CONTRACT,
  code = 'UNKNOWN_ERROR',
  message = 'unknown_error',
  statusCode = null,
  retryable = false,
} = {}) => ({
  type,
  code,
  message: String(message || 'unknown_error'),
  statusCode: Number.isInteger(statusCode) ? statusCode : null,
  retryable: Boolean(retryable),
})

const createSuccessResult = (data, meta = {}) => ({
  ok: true,
  code: API_OK_CODE,
  message: 'ok',
  data,
  meta: cloneMeta(meta),
})

const createErrorResult = ({
  code = 'UNKNOWN_ERROR',
  message = 'unknown_error',
  data = null,
  meta = {},
  error = {},
} = {}) => ({
  ok: false,
  code,
  message: String(message || 'unknown_error'),
  data,
  meta: cloneMeta(meta),
  error: createApiError({ code, message, ...error }),
})

const normalizeEnvelope = (payload, options = {}) => {
  const statusCode = Number.isInteger(options.statusCode) ? options.statusCode : null
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return createErrorResult({
      code: 'INVALID_RESPONSE',
      message: 'invalid_response',
      error: { type: API_ERROR_TYPES.CONTRACT, statusCode },
    })
  }

  const code = Object.prototype.hasOwnProperty.call(payload, 'code') ? payload.code : 'INVALID_RESPONSE'
  const message = typeof payload.message === 'string' && payload.message
    ? payload.message
    : (code === API_OK_CODE ? 'ok' : 'request_failed')
  const data = Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : null
  const meta = cloneMeta(payload.meta)
  if (statusCode !== null) meta.statusCode = statusCode

  if (code === API_OK_CODE) return { ok: true, code, message, data, meta }
  return createErrorResult({
    code,
    message,
    data,
    meta,
    error: { type: API_ERROR_TYPES.BUSINESS, statusCode, retryable: false },
  })
}

const isRetryableHttpStatus = (statusCode) => statusCode === 429 || statusCode >= 500

const normalizeHttpResponse = (response) => {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    return createErrorResult({
      code: 'INVALID_TRANSPORT_RESPONSE',
      message: 'invalid_transport_response',
      error: { type: API_ERROR_TYPES.CONTRACT },
    })
  }

  const statusCode = Number(response.statusCode)
  if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
    return createErrorResult({
      code: 'INVALID_HTTP_STATUS',
      message: 'invalid_http_status',
      error: { type: API_ERROR_TYPES.CONTRACT },
    })
  }

  if (statusCode < 200 || statusCode >= 300) {
    const body = Object.prototype.hasOwnProperty.call(response, 'data') ? response.data : null
    const serverMeta = body && typeof body === 'object' && !Array.isArray(body) ? cloneMeta(body.meta) : {}
    return createErrorResult({
      code: `HTTP_${statusCode}`,
      message: 'http_error',
      data: body,
      meta: { ...serverMeta, statusCode },
      error: {
        type: API_ERROR_TYPES.HTTP,
        statusCode,
        retryable: isRetryableHttpStatus(statusCode),
      },
    })
  }

  return normalizeEnvelope(response.data, { statusCode })
}

const normalizeTransportError = () => createErrorResult({
  code: 'NETWORK_ERROR',
  message: 'network_error',
  error: { type: API_ERROR_TYPES.TRANSPORT, retryable: true },
})

const normalizePagination = (source = {}) => {
  const page = Number.isInteger(source.page) && source.page > 0 ? source.page : 1
  const pageSize = Number.isInteger(source.pageSize) && source.pageSize > 0 ? source.pageSize : 20
  const total = Number.isFinite(source.total) && source.total >= 0 ? source.total : 0
  const hasMore = typeof source.hasMore === 'boolean' ? source.hasMore : page * pageSize < total
  return { page, pageSize, total, hasMore }
}

module.exports = {
  API_ERROR_TYPES,
  API_OK_CODE,
  createApiError,
  createErrorResult,
  createSuccessResult,
  isRetryableHttpStatus,
  normalizeEnvelope,
  normalizeHttpResponse,
  normalizePagination,
  normalizeTransportError,
}