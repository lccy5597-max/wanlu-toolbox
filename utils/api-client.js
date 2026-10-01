const {
  DEFAULT_REQUEST_TIMEOUT_MS,
  MAX_REQUEST_TIMEOUT_MS,
  MIN_REQUEST_TIMEOUT_MS,
  getEnvironment,
} = require('../config/environment')
const {
  API_ERROR_TYPES,
  createErrorResult,
  normalizeHttpResponse,
  normalizeTransportError,
} = require('./api-contract')

const ALLOWED_METHODS = Object.freeze(['GET', 'POST'])
const DEFAULT_HEADERS = Object.freeze({
  Accept: 'application/json',
  'Content-Type': 'application/json',
})

const normalizeMethod = (method) => {
  const value = String(method || 'GET').trim().toUpperCase()
  return ALLOWED_METHODS.includes(value) ? value : null
}

const normalizePath = (path) => {
  const value = String(path || '').trim()
  if (!value) return '/'
  return value.startsWith('/') ? value : `/${value}`
}

const normalizeTimeout = (value, fallback = DEFAULT_REQUEST_TIMEOUT_MS) => {
  const normalizedFallback = Number.isFinite(fallback)
    && fallback >= MIN_REQUEST_TIMEOUT_MS
    && fallback <= MAX_REQUEST_TIMEOUT_MS
    ? fallback
    : DEFAULT_REQUEST_TIMEOUT_MS
  return Number.isFinite(value)
    && value >= MIN_REQUEST_TIMEOUT_MS
    && value <= MAX_REQUEST_TIMEOUT_MS
    ? value
    : normalizedFallback
}

const encodeQuery = (query = {}) => {
  if (!query || typeof query !== 'object' || Array.isArray(query)) return ''
  return Object.keys(query)
    .filter((key) => query[key] !== undefined && query[key] !== null)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(query[key]))}`)
    .join('&')
}

const buildUrl = (baseUrl, path, query = {}) => {
  const base = String(baseUrl || '').trim().replace(/\/+$/, '')
  const normalizedPath = normalizePath(path)
  const queryString = encodeQuery(query)
  return `${base}${normalizedPath}${queryString ? `?${queryString}` : ''}`
}

const mergeHeaders = (defaultHeaders = {}, requestHeaders = {}) => ({
  ...DEFAULT_HEADERS,
  ...(defaultHeaders && typeof defaultHeaders === 'object' ? defaultHeaders : {}),
  ...(requestHeaders && typeof requestHeaders === 'object' ? requestHeaders : {}),
})

const resolveTransportRequest = (transport) => {
  if (typeof transport === 'function') return transport
  if (transport && typeof transport.request === 'function') return transport.request.bind(transport)
  return null
}

const createApiClient = (options = {}) => {
  const environment = options.environment ? { ...options.environment } : getEnvironment()
  const enabled = options.enabled === undefined ? Boolean(environment.remoteApiEnabled) : Boolean(options.enabled)
  const transportRequest = resolveTransportRequest(options.transport)
  const defaultHeaders = options.defaultHeaders ? { ...options.defaultHeaders } : {}
  const defaultTimeout = normalizeTimeout(options.timeout, environment.requestTimeoutMs)

  const request = async (method, path, requestOptions = {}) => {
    const requestedMethod = String(method || 'GET').trim().toUpperCase()
    const normalizedPath = normalizePath(path)

    if (!enabled) {
      return createErrorResult({
        code: 'REMOTE_DISABLED',
        message: 'remote_api_disabled',
        meta: { method: requestedMethod, path: normalizedPath },
        error: { type: API_ERROR_TYPES.CLIENT_DISABLED, retryable: false },
      })
    }

    const normalizedMethod = normalizeMethod(requestedMethod)
    if (!normalizedMethod) {
      return createErrorResult({
        code: 'INVALID_METHOD',
        message: 'invalid_method',
        meta: { method: requestedMethod, path: normalizedPath },
        error: { type: API_ERROR_TYPES.CONTRACT, retryable: false },
      })
    }

    if (!transportRequest) {
      return createErrorResult({
        code: 'TRANSPORT_UNAVAILABLE',
        message: 'transport_unavailable',
        meta: { method: normalizedMethod, path: normalizedPath },
        error: { type: API_ERROR_TYPES.TRANSPORT, retryable: false },
      })
    }

    const query = requestOptions.query && typeof requestOptions.query === 'object'
      ? { ...requestOptions.query }
      : {}
    const headers = mergeHeaders(defaultHeaders, requestOptions.headers)
    const timeout = normalizeTimeout(requestOptions.timeout, defaultTimeout)
    const url = buildUrl(environment.apiBaseUrl, normalizedPath, query)
    const transportInput = {
      method: normalizedMethod,
      url,
      headers,
      query,
      data: requestOptions.data,
      timeout,
    }

    try {
      const response = await transportRequest(transportInput)
      return normalizeHttpResponse(response)
    } catch (error) {
      return normalizeTransportError(error)
    }
  }

  return Object.freeze({
    enabled,
    environment: Object.freeze({ ...environment }),
    request,
    get: (path, options = {}) => request('GET', path, options),
    post: (path, data, options = {}) => request('POST', path, { ...options, data }),
  })
}

const apiClient = createApiClient()

module.exports = {
  ALLOWED_METHODS,
  DEFAULT_HEADERS,
  apiClient,
  buildUrl,
  createApiClient,
  encodeQuery,
  mergeHeaders,
  normalizeMethod,
  normalizePath,
  normalizeTimeout,
}