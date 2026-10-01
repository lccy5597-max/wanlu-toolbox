const ENVIRONMENT_NAMES = Object.freeze({
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
})

const PLACEHOLDER_API_BASE_URL = 'https://api.example.com'
const REMOTE_API_ENABLED = false
const DEFAULT_REQUEST_TIMEOUT_MS = 10000
const MIN_REQUEST_TIMEOUT_MS = 1000
const MAX_REQUEST_TIMEOUT_MS = 60000

const ENVIRONMENTS = Object.freeze({
  [ENVIRONMENT_NAMES.DEVELOPMENT]: Object.freeze({
    name: ENVIRONMENT_NAMES.DEVELOPMENT,
    apiBaseUrl: PLACEHOLDER_API_BASE_URL,
    remoteApiEnabled: REMOTE_API_ENABLED,
    requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
  }),
  [ENVIRONMENT_NAMES.PRODUCTION]: Object.freeze({
    name: ENVIRONMENT_NAMES.PRODUCTION,
    apiBaseUrl: PLACEHOLDER_API_BASE_URL,
    remoteApiEnabled: REMOTE_API_ENABLED,
    requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
  }),
})

const DEFAULT_ENVIRONMENT = ENVIRONMENT_NAMES.DEVELOPMENT

const getEnvironment = (name = DEFAULT_ENVIRONMENT) => {
  const selected = ENVIRONMENTS[name]
  if (!selected) throw new Error(`Unknown environment: ${name}`)
  return { ...selected }
}

module.exports = {
  DEFAULT_ENVIRONMENT,
  DEFAULT_REQUEST_TIMEOUT_MS,
  ENVIRONMENTS,
  ENVIRONMENT_NAMES,
  MAX_REQUEST_TIMEOUT_MS,
  MIN_REQUEST_TIMEOUT_MS,
  PLACEHOLDER_API_BASE_URL,
  REMOTE_API_ENABLED,
  getEnvironment,
}