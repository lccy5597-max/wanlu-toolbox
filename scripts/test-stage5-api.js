const assert = require('assert')
const path = require('path')
const {
  DEFAULT_ENVIRONMENT,
  DEFAULT_REQUEST_TIMEOUT_MS,
  ENVIRONMENT_NAMES,
  MAX_REQUEST_TIMEOUT_MS,
  MIN_REQUEST_TIMEOUT_MS,
  PLACEHOLDER_API_BASE_URL,
  REMOTE_API_ENABLED,
  getEnvironment,
} = require('../config/environment')
const {
  API_ENDPOINTS,
  API_PREFIX,
  API_VERSION,
  DEFAULT_PAGE_SIZE,
  GITHUB_DEFAULT_PAGE_SIZE,
  GITHUB_MAX_PAGE_SIZE,
  GITHUB_PERIODS,
  MAX_PAGE_SIZE,
  buildArticleDetailPath,
  isRelativeApiPath,
} = require('../config/api-endpoints')
const {
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
} = require('../utils/api-contract')
const {
  DEFAULT_HEADERS,
  apiClient,
  buildUrl,
  createApiClient,
  encodeQuery,
  mergeHeaders,
  normalizeMethod,
  normalizeTimeout,
} = require('../utils/api-client')
const { createWechatTransport } = require('../utils/api-transport')
const {
  BUSINESS_ERROR_CODES,
  ERROR_CODE_RANGES,
  RICH_CONTENT_FORMAT,
  containsUnsafeRichContent,
  isIso8601WithTimezone,
  normalizePageRequest,
  validateApiResponse,
  validateContentDetail,
  validateContentSummary,
  validateGithubPageRequest,
  validateGithubPeriod,
  validateGithubRankingItem,
  validateHealthData,
  validatePagination,
} = require('../utils/api-schema')
const { runStage5StaticChecks, validateStage5Sources } = require('./stage5-static-rules')
const contractFixtures = require('./fixtures/stage5-api-contract')

let passed = 0
const test = async (name, fn) => {
  try {
    await fn()
    passed += 1
  } catch (error) {
    error.message = `${name}: ${error.message}`
    throw error
  }
}

const makeHttpTransport = (statusCode, data, capture) => ({
  request: async (input) => {
    if (capture) capture.input = input
    return { statusCode, data, headers: { 'x-test': '1' } }
  },
})

const staticFixture = (overrides = {}) => ({
  'config/environment.js': "const REMOTE_API_ENABLED = false\nDEVELOPMENT: 'development'\nPRODUCTION: 'production'\nhttps://api.example.com",
  'config/api-endpoints.js': "const API_VERSION = 'v1'\nconst API_PREFIX = '/api/v1'",
  'utils/api-client.js': 'const request = () => null',
  'utils/api-contract.js': 'const normalizeEnvelope = () => null',
  'utils/api-schema.js': "const RICH_CONTENT_FORMAT = 'sanitized_html'",
  'utils/api-transport.js': 'const request = () => wx.request({})',
  'services/content.js': "const { API_ENDPOINTS } = require('../config/api-endpoints')\nconst { validateContentSummary } = require('../utils/api-schema')",
  ...overrides,
})

const run = async () => {
  // Environment / disabled baseline.
  await test('default environment is development', () => assert.strictEqual(DEFAULT_ENVIRONMENT, 'development'))
  await test('development environment is available', () => assert.strictEqual(getEnvironment(ENVIRONMENT_NAMES.DEVELOPMENT).name, 'development'))
  await test('production environment is available', () => assert.strictEqual(getEnvironment(ENVIRONMENT_NAMES.PRODUCTION).name, 'production'))
  await test('development remote API is disabled', () => assert.strictEqual(getEnvironment('development').remoteApiEnabled, false))
  await test('production remote API is disabled', () => assert.strictEqual(getEnvironment('production').remoteApiEnabled, false))
  await test('global remote API switch is false', () => assert.strictEqual(REMOTE_API_ENABLED, false))
  await test('API base URL is placeholder', () => assert.strictEqual(PLACEHOLDER_API_BASE_URL, 'https://api.example.com'))
  await test('default timeout is bounded', () => assert(DEFAULT_REQUEST_TIMEOUT_MS >= MIN_REQUEST_TIMEOUT_MS && DEFAULT_REQUEST_TIMEOUT_MS <= MAX_REQUEST_TIMEOUT_MS))
  await test('both environments use default timeout', () => {
    assert.strictEqual(getEnvironment('development').requestTimeoutMs, DEFAULT_REQUEST_TIMEOUT_MS)
    assert.strictEqual(getEnvironment('production').requestTimeoutMs, DEFAULT_REQUEST_TIMEOUT_MS)
  })
  await test('unknown environment is rejected', () => assert.throws(() => getEnvironment('trial'), /Unknown environment/))
  await test('environment getter returns independent object', () => {
    const env = getEnvironment('development')
    env.apiBaseUrl = 'changed'
    assert.strictEqual(getEnvironment('development').apiBaseUrl, PLACEHOLDER_API_BASE_URL)
  })

  // Contract.
  await test('success result contract', () => assert.deepStrictEqual(createSuccessResult({ id: 1 }), { ok: true, code: 0, message: 'ok', data: { id: 1 }, meta: {} }))
  await test('error object contract contains required fields', () => assert.deepStrictEqual(createApiError({ code: 'E1', message: 'failed' }), {
    type: API_ERROR_TYPES.CONTRACT, code: 'E1', message: 'failed', statusCode: null, retryable: false,
  }))
  await test('error result keeps unified error object', () => assert.strictEqual(createErrorResult({ code: 'E1', message: 'failed' }).error.code, 'E1'))
  await test('success envelope normalizes', () => assert.strictEqual(normalizeEnvelope({ code: 0, message: 'ok', data: [1] }).ok, true))
  await test('business error envelope normalizes', () => assert.strictEqual(normalizeEnvelope({ code: 4001, message: 'bad', data: null }).error.type, API_ERROR_TYPES.BUSINESS))
  await test('invalid envelope is contract error', () => assert.strictEqual(normalizeEnvelope(null).error.type, API_ERROR_TYPES.CONTRACT))
  await test('API OK code is zero', () => assert.strictEqual(API_OK_CODE, 0))
  await test('pagination defaults are stable', () => assert.deepStrictEqual(normalizePagination(), { page: 1, pageSize: 20, total: 0, hasMore: false }))
  await test('pagination derives hasMore', () => assert.strictEqual(normalizePagination({ page: 1, pageSize: 10, total: 11 }).hasMore, true))
  await test('pagination respects explicit hasMore', () => assert.strictEqual(normalizePagination({ page: 1, pageSize: 10, total: 100, hasMore: false }).hasMore, false))
  await test('transport error is retryable network error', () => {
    const result = normalizeTransportError(new Error('private details'))
    assert.strictEqual(result.error.type, API_ERROR_TYPES.TRANSPORT)
    assert.strictEqual(result.error.retryable, true)
    assert.strictEqual(result.message, 'network_error')
  })

  // Remote disabled must short circuit transport.
  await test('default API client is disabled', () => assert.strictEqual(apiClient.enabled, false))
  await test('disabled client does not call transport', async () => {
    let calls = 0
    const client = createApiClient({ enabled: false, transport: { request: async () => { calls += 1; throw new Error('must not run') } } })
    const result = await client.get('/health')
    assert.strictEqual(result.code, 'REMOTE_DISABLED')
    assert.strictEqual(result.error.type, API_ERROR_TYPES.CLIENT_DISABLED)
    assert.strictEqual(calls, 0)
  })
  await test('disabled get returns disabled result', async () => assert.strictEqual((await apiClient.get('/items')).code, 'REMOTE_DISABLED'))
  await test('disabled post returns disabled result', async () => assert.strictEqual((await apiClient.post('/items', { a: 1 })).code, 'REMOTE_DISABLED'))
  await test('enabled client without transport is unavailable', async () => assert.strictEqual((await createApiClient({ enabled: true }).get('/items')).code, 'TRANSPORT_UNAVAILABLE'))

  // URL and query.
  await test('baseUrl and path join', () => assert.strictEqual(buildUrl('https://api.example.com', '/v1/items'), 'https://api.example.com/v1/items'))
  await test('trailing base slash is removed', () => assert.strictEqual(buildUrl('https://api.example.com/', '/v1/items'), 'https://api.example.com/v1/items'))
  await test('leading path slash is added', () => assert.strictEqual(buildUrl('https://api.example.com', 'v1/items'), 'https://api.example.com/v1/items'))
  await test('https protocol is preserved', () => assert(buildUrl('https://api.example.com/', '/x').startsWith('https://')))
  await test('query string value encodes', () => assert.strictEqual(encodeQuery({ q: 'hello' }), 'q=hello'))
  await test('query number encodes', () => assert.strictEqual(encodeQuery({ page: 2 }), 'page=2'))
  await test('query boolean encodes', () => assert.strictEqual(encodeQuery({ active: false }), 'active=false'))
  await test('query Chinese encodes', () => assert.strictEqual(encodeQuery({ q: '挽鹿' }), 'q=%E6%8C%BD%E9%B9%BF'))
  await test('query space encodes', () => assert.strictEqual(encodeQuery({ q: 'a b' }), 'q=a%20b'))
  await test('query special chars encode', () => assert.strictEqual(encodeQuery({ q: 'a&b=c' }), 'q=a%26b%3Dc'))
  await test('query undefined is skipped', () => assert.strictEqual(encodeQuery({ q: undefined, page: 1 }), 'page=1'))
  await test('query null is skipped', () => assert.strictEqual(encodeQuery({ q: null, page: 1 }), 'page=1'))
  await test('GET sends encoded query URL', async () => {
    const capture = {}
    const client = createApiClient({ enabled: true, transport: makeHttpTransport(200, { code: 0, data: [] }, capture) })
    await client.get('/items', { query: { q: 'a b', page: 2 } })
    assert.strictEqual(capture.input.url, 'https://api.example.com/items?q=a%20b&page=2')
  })

  // Method / headers / timeout.
  await test('GET method normalizes', () => assert.strictEqual(normalizeMethod('get'), 'GET'))
  await test('POST method normalizes', () => assert.strictEqual(normalizeMethod(' post '), 'POST'))
  await test('illegal method is rejected', () => assert.strictEqual(normalizeMethod('DELETE'), null))
  await test('illegal method returns contract error without transport', async () => {
    let calls = 0
    const client = createApiClient({ enabled: true, transport: { request: async () => { calls += 1 } } })
    const result = await client.request('DELETE', '/items')
    assert.strictEqual(result.code, 'INVALID_METHOD')
    assert.strictEqual(result.error.type, API_ERROR_TYPES.CONTRACT)
    assert.strictEqual(calls, 0)
  })
  await test('default headers exist', () => assert.strictEqual(DEFAULT_HEADERS.Accept, 'application/json'))
  await test('default headers do not inject Authorization', () => assert.strictEqual(Object.prototype.hasOwnProperty.call(DEFAULT_HEADERS, 'Authorization'), false))
  await test('request headers override defaults', () => assert.strictEqual(mergeHeaders({ Accept: 'a' }, { Accept: 'b' }).Accept, 'b'))
  await test('custom default headers merge', () => assert.strictEqual(mergeHeaders({ 'X-App': 'wanlu' }, {})['X-App'], 'wanlu'))
  await test('default timeout normalizes', () => assert.strictEqual(normalizeTimeout(undefined), DEFAULT_REQUEST_TIMEOUT_MS))
  await test('valid custom timeout is accepted', () => assert.strictEqual(normalizeTimeout(5000), 5000))
  await test('zero timeout falls back', () => assert.strictEqual(normalizeTimeout(0), DEFAULT_REQUEST_TIMEOUT_MS))
  await test('negative timeout falls back', () => assert.strictEqual(normalizeTimeout(-1), DEFAULT_REQUEST_TIMEOUT_MS))
  await test('NaN timeout falls back', () => assert.strictEqual(normalizeTimeout(Number.NaN), DEFAULT_REQUEST_TIMEOUT_MS))
  await test('Infinity timeout falls back', () => assert.strictEqual(normalizeTimeout(Infinity), DEFAULT_REQUEST_TIMEOUT_MS))
  await test('too large timeout falls back', () => assert.strictEqual(normalizeTimeout(MAX_REQUEST_TIMEOUT_MS + 1), DEFAULT_REQUEST_TIMEOUT_MS))
  await test('client passes custom timeout and headers', async () => {
    const capture = {}
    const client = createApiClient({ enabled: true, defaultHeaders: { 'X-App': 'wanlu' }, transport: makeHttpTransport(200, { code: 0, data: null }, capture) })
    await client.get('/items', { timeout: 5000, headers: { Accept: 'custom' } })
    assert.strictEqual(capture.input.timeout, 5000)
    assert.strictEqual(capture.input.headers.Accept, 'custom')
    assert.strictEqual(capture.input.headers['X-App'], 'wanlu')
    assert.strictEqual(Object.prototype.hasOwnProperty.call(capture.input.headers, 'Authorization'), false)
  })
  await test('POST passes data without mutation', async () => {
    const data = { title: 'x' }
    const before = JSON.stringify(data)
    const capture = {}
    const client = createApiClient({ enabled: true, transport: makeHttpTransport(201, { code: 0, data: { id: 1 } }, capture) })
    await client.post('/items', data)
    assert.strictEqual(JSON.stringify(data), before)
    assert.strictEqual(capture.input.data, data)
  })
  await test('query and headers input are not mutated', async () => {
    const query = { q: 'x', nil: null }
    const headers = { 'X-Test': '1' }
    const before = JSON.stringify({ query, headers })
    const client = createApiClient({ enabled: true, transport: makeHttpTransport(200, { code: 0, data: null }) })
    await client.get('/items', { query, headers })
    assert.strictEqual(JSON.stringify({ query, headers }), before)
  })

  // WeChat transport: injected only, never real network.
  await test('WeChat transport maps wx.request success', async () => {
    const transport = createWechatTransport({ requestImpl: (options) => options.success({ statusCode: 200, data: { code: 0, data: 1 }, header: { h: 'v' }, cookies: ['a=1'] }) })
    const result = await transport.request({ url: 'https://api.example.com/x', method: 'GET', headers: {}, timeout: 10000 })
    assert.strictEqual(result.statusCode, 200)
    assert.deepStrictEqual(result.headers, { h: 'v' })
    assert.deepStrictEqual(result.cookies, ['a=1'])
  })
  await test('WeChat transport maps request fields', async () => {
    let seen
    const transport = createWechatTransport({ requestImpl: (options) => { seen = options; options.success({ statusCode: 200, data: { code: 0 } }) } })
    await transport.request({ url: 'https://api.example.com/x', method: 'POST', headers: { A: 'B' }, data: { x: 1 }, timeout: 4321 })
    assert.strictEqual(seen.url, 'https://api.example.com/x')
    assert.strictEqual(seen.method, 'POST')
    assert.deepStrictEqual(seen.header, { A: 'B' })
    assert.deepStrictEqual(seen.data, { x: 1 })
    assert.strictEqual(seen.timeout, 4321)
  })
  await test('WeChat transport maps wx.request fail to rejection', async () => {
    const transport = createWechatTransport({ requestImpl: (options) => options.fail({ errMsg: 'request:fail timeout' }) })
    await assert.rejects(() => transport.request({ url: 'x' }), /wx_request_failed/)
  })
  await test('WeChat transport supports injected requestImpl', async () => {
    let calls = 0
    const transport = createWechatTransport({ requestImpl: (options) => { calls += 1; options.success({ statusCode: 204, data: { code: 0 } }) } })
    await transport.request({ url: 'x' })
    assert.strictEqual(calls, 1)
  })
  await test('WeChat transport can load in Node without wx', async () => {
    const transport = createWechatTransport()
    await assert.rejects(() => transport.request({ url: 'x' }), /wx\.request is unavailable/)
  })

  // HTTP / response normalization.
  await test('HTTP 200 success', () => assert.strictEqual(normalizeHttpResponse({ statusCode: 200, data: { code: 0, data: 1 } }).ok, true))
  await test('HTTP 201 success', () => assert.strictEqual(normalizeHttpResponse({ statusCode: 201, data: { code: 0, data: 1 } }).meta.statusCode, 201))
  for (const statusCode of [400, 401, 404, 429, 500, 503]) {
    await test(`HTTP ${statusCode} maps to HTTP error`, () => {
      const result = normalizeHttpResponse({ statusCode, data: { code: statusCode, message: 'x' } })
      assert.strictEqual(result.error.type, API_ERROR_TYPES.HTTP)
      assert.strictEqual(result.error.statusCode, statusCode)
    })
  }
  await test('429 is retryable', () => assert.strictEqual(isRetryableHttpStatus(429), true))
  await test('500 is retryable', () => assert.strictEqual(isRetryableHttpStatus(500), true))
  await test('503 is retryable', () => assert.strictEqual(isRetryableHttpStatus(503), true))
  await test('400 is not retryable', () => assert.strictEqual(isRetryableHttpStatus(400), false))
  await test('401 is not retryable', () => assert.strictEqual(isRetryableHttpStatus(401), false))
  await test('404 is not retryable', () => assert.strictEqual(isRetryableHttpStatus(404), false))
  await test('empty success data remains null', () => assert.strictEqual(normalizeHttpResponse({ statusCode: 200, data: { code: 0, data: null } }).data, null))
  await test('success message is retained', () => assert.strictEqual(normalizeHttpResponse({ statusCode: 200, data: { code: 0, message: 'done', data: 1 } }).message, 'done'))
  await test('business error remains separate from HTTP error', () => {
    const result = normalizeHttpResponse({ statusCode: 200, data: { code: 4001, message: 'business_failed', data: null } })
    assert.strictEqual(result.error.type, API_ERROR_TYPES.BUSINESS)
    assert.strictEqual(result.error.statusCode, 200)
  })
  await test('transport rejection maps to network error', async () => {
    const client = createApiClient({ enabled: true, transport: { request: async () => { throw new Error('dns fail private detail') } } })
    const result = await client.get('/items')
    assert.strictEqual(result.code, 'NETWORK_ERROR')
    assert.strictEqual(result.error.type, API_ERROR_TYPES.TRANSPORT)
    assert.strictEqual(result.message, 'network_error')
  })
  await test('function transport remains injectable for tests', async () => {
    const client = createApiClient({ enabled: true, transport: async () => ({ statusCode: 200, data: { code: 0, data: { id: 1 } } }) })
    assert.deepStrictEqual((await client.get('/items')).data, { id: 1 })
  })

  // Stage 5 static constraints.
  await test('current project passes Stage 5 static rules', () => {
    const result = runStage5StaticChecks(path.resolve(__dirname, '..'))
    assert.deepStrictEqual(result.errors, [])
    assert.deepStrictEqual(result.warnings, [])
  })
  await test('static rule detects enabled remote switch', () => {
    const errors = validateStage5Sources(staticFixture({
      'config/environment.js': "const REMOTE_API_ENABLED = true\nDEVELOPMENT: 'development'\nPRODUCTION: 'production'\nhttps://api.example.com",
    }))
    assert(errors.some((item) => item.includes('默认远程开关')))
  })
  await test('static rule allows wx.request only in transport adapter', () => assert.deepStrictEqual(validateStage5Sources(staticFixture()), []))
  await test('static rule detects wx.request in API client', () => {
    const errors = validateStage5Sources(staticFixture({ 'utils/api-client.js': 'wx.request({})' }))
    assert(errors.some((item) => item.includes('不得直接实现网络 Transport') || item.includes('不得直接调用 wx.request')))
  })
  await test('static rule detects direct page wx.request', () => {
    const errors = validateStage5Sources(staticFixture({ 'pages/example/example.js': 'wx.request({})' }))
    assert(errors.some((item) => item.includes('不得直接调用 wx.request')))
  })
  await test('static rule detects direct service wx.request', () => {
    const errors = validateStage5Sources(staticFixture({ 'services/content.js': 'wx.request({})' }))
    assert(errors.some((item) => item.includes('不得直接调用 wx.request')))
  })
  await test('static rule detects fetch outside transport', () => {
    const errors = validateStage5Sources(staticFixture({ 'utils/other.js': 'fetch("x")' }))
    assert(errors.some((item) => item.includes('fetch')))
  })
  await test('static rule detects XMLHttpRequest outside transport', () => {
    const errors = validateStage5Sources(staticFixture({ 'utils/other.js': 'new XMLHttpRequest()' }))
    assert(errors.some((item) => item.includes('XMLHttpRequest')))
  })
  await test('static rule detects uploadFile outside baseline dormant adapter', () => {
    const errors = validateStage5Sources(staticFixture({ 'services/content.js': 'wx.uploadFile({})' }))
    assert(errors.some((item) => item.includes('upload')))
  })
  await test('static rule keeps inherited dormant moderation upload exception', () => {
    const errors = validateStage5Sources(staticFixture({ 'utils/image-moderation.js': 'wx.uploadFile({})' }))
    assert.deepStrictEqual(errors, [])
  })
  await test('static rule rejects fetch even inside WeChat transport', () => {
    const errors = validateStage5Sources(staticFixture({ 'utils/api-transport.js': 'wx.request({}); fetch("x")' }))
    assert(errors.some((item) => item.includes('普通 wx.request')))
  })
  await test('static rule detects hard-coded secret assignment', () => {
    const errors = validateStage5Sources(staticFixture({
      'config/environment.js': "const REMOTE_API_ENABLED = false\nDEVELOPMENT: 'development'\nPRODUCTION: 'production'\nhttps://api.example.com\nconst api_key='1234567890abcdef'",
    }))
    assert(errors.some((item) => item.includes('Secret')))
  })

  // Step 3 server API contract / endpoint specification.
  await test('API version is v1', () => assert.strictEqual(API_VERSION, 'v1'))
  await test('API prefix is versioned', () => assert.strictEqual(API_PREFIX, '/api/v1'))
  await test('health endpoint is versioned relative path', () => assert.strictEqual(API_ENDPOINTS.health, '/api/v1/health'))
  await test('content list endpoint is versioned relative path', () => assert.strictEqual(API_ENDPOINTS.content.articles, '/api/v1/content/articles'))
  await test('content detail endpoint builder returns versioned path', () => assert.strictEqual(buildArticleDetailPath('article-1'), '/api/v1/content/articles/article-1'))
  await test('content detail treats id as opaque and encodes it', () => assert.strictEqual(buildArticleDetailPath('wp/100 1'), '/api/v1/content/articles/wp%2F100%201'))
  await test('content detail rejects empty id', () => assert.throws(() => buildArticleDetailPath('  '), /article_id_required/))
  await test('GitHub rankings endpoint is versioned relative path', () => assert.strictEqual(API_ENDPOINTS.github.rankings, '/api/v1/github/rankings'))
  await test('formal endpoints are relative API paths', () => {
    assert.strictEqual(isRelativeApiPath(API_ENDPOINTS.health), true)
    assert.strictEqual(isRelativeApiPath(API_ENDPOINTS.content.articles), true)
    assert.strictEqual(isRelativeApiPath(API_ENDPOINTS.github.rankings), true)
  })
  await test('full server URL is not a relative API path', () => assert.strictEqual(isRelativeApiPath('https://api.example.com/api/v1/health'), false))

  // Pagination contract.
  await test('content pagination defaults to page 1 and pageSize 10', () => assert.deepStrictEqual(normalizePageRequest(), { page: 1, pageSize: DEFAULT_PAGE_SIZE }))
  await test('content pagination accepts maximum pageSize', () => assert.deepStrictEqual(normalizePageRequest({ page: 2, pageSize: MAX_PAGE_SIZE }), { page: 2, pageSize: MAX_PAGE_SIZE }))
  await test('content pagination rejects page below 1', () => assert.throws(() => normalizePageRequest({ page: 0 }), /invalid_page/))
  await test('content pagination rejects pageSize above maximum', () => assert.throws(() => normalizePageRequest({ pageSize: MAX_PAGE_SIZE + 1 }), /invalid_page_size/))
  await test('GitHub pagination defaults to five mobile items', () => assert.deepStrictEqual(validateGithubPageRequest(), { page: 1, pageSize: GITHUB_DEFAULT_PAGE_SIZE }))
  await test('GitHub pagination accepts maximum ten items', () => assert.deepStrictEqual(validateGithubPageRequest({ page: 1, pageSize: GITHUB_MAX_PAGE_SIZE }), { page: 1, pageSize: GITHUB_MAX_PAGE_SIZE }))
  await test('valid pagination response passes', () => assert.strictEqual(validatePagination({ page: 1, pageSize: 10, total: 11, hasMore: true }).ok, true))
  await test('inconsistent hasMore is rejected', () => assert.strictEqual(validatePagination({ page: 1, pageSize: 10, total: 11, hasMore: false }).ok, false))
  await test('negative pagination total is rejected', () => assert.strictEqual(validatePagination({ page: 1, pageSize: 10, total: -1, hasMore: false }).ok, false))

  // Unified server envelope / error namespaces.
  await test('valid server envelope passes schema validation', () => assert.strictEqual(validateApiResponse(contractFixtures.healthSuccess.data).ok, true))
  await test('server envelope requires numeric code', () => assert.strictEqual(validateApiResponse({ code: '0', message: 'ok', data: null }).ok, false))
  await test('requestId is optional string metadata', () => assert.strictEqual(validateApiResponse({ code: 0, message: 'ok', data: null, meta: { requestId: 'req-1' } }).ok, true))
  await test('retryAfter must be nonnegative integer', () => assert.strictEqual(validateApiResponse({ code: 10029, message: 'rate_limited', data: null, meta: { retryAfter: -1 } }).ok, false))
  await test('common error range begins at 10000', () => assert.strictEqual(ERROR_CODE_RANGES.COMMON.min, 10000))
  await test('content error range begins at 20000', () => assert.strictEqual(ERROR_CODE_RANGES.CONTENT.min, 20000))
  await test('GitHub error range begins at 30000', () => assert.strictEqual(ERROR_CODE_RANGES.GITHUB.min, 30000))
  await test('AI range is reserved at 40000', () => assert.strictEqual(ERROR_CODE_RANGES.AI_RESERVED.min, 40000))
  await test('rate limited business code is stable', () => assert.strictEqual(BUSINESS_ERROR_CODES.RATE_LIMITED, 10029))

  // Health / content / rich content.
  await test('health fixture passes contract', () => assert.strictEqual(validateHealthData(contractFixtures.healthSuccess.data.data).ok, true))
  await test('health API version mismatch is rejected', () => assert.strictEqual(validateHealthData({ status: 'ok', apiVersion: 'v2', serverTime: '2026-10-01T00:00:00Z' }).ok, false))
  await test('publishTime requires ISO 8601 timezone', () => assert.strictEqual(isIso8601WithTimezone('2026-10-01T08:30:00+08:00'), true))
  await test('publishTime without timezone is rejected', () => assert.strictEqual(isIso8601WithTimezone('2026-10-01T08:30:00'), false))
  await test('content summary fixture passes', () => assert.strictEqual(validateContentSummary(contractFixtures.articleSummary).ok, true))
  await test('content summary missing id is rejected', () => assert.strictEqual(validateContentSummary({ ...contractFixtures.articleSummary, id: '' }).ok, false))
  await test('content summary missing title is rejected', () => assert.strictEqual(validateContentSummary({ ...contractFixtures.articleSummary, title: '' }).ok, false))
  await test('content summary HTTP cover is rejected', () => assert.strictEqual(validateContentSummary({ ...contractFixtures.articleSummary, cover: 'http://example.com/a.jpg' }).ok, false))
  await test('content detail fixture passes', () => assert.strictEqual(validateContentDetail(contractFixtures.articleDetail).ok, true))
  await test('rich content first version is sanitized HTML', () => assert.strictEqual(RICH_CONTENT_FORMAT, 'sanitized_html'))
  await test('rich content rejects script tag', () => assert.strictEqual(validateContentDetail({ ...contractFixtures.articleDetail, content: '<script>alert(1)</script>' }).ok, false))
  await test('rich content rejects iframe tag', () => assert.strictEqual(validateContentDetail({ ...contractFixtures.articleDetail, content: '<iframe src="x"></iframe>' }).ok, false))
  await test('rich content rejects event handler attributes', () => assert.strictEqual(validateContentDetail({ ...contractFixtures.articleDetail, content: '<img src="https://example.com/a.jpg" onerror="x">' }).ok, false))
  await test('rich content rejects javascript URL', () => assert.strictEqual(containsUnsafeRichContent('<a href="javascript:alert(1)">x</a>'), true))

  // GitHub ranking contract.
  await test('GitHub periods are daily weekly all', () => assert.deepStrictEqual(GITHUB_PERIODS, ['daily', 'weekly', 'all']))
  await test('GitHub daily period is valid', () => assert.strictEqual(validateGithubPeriod('daily'), true))
  await test('GitHub today period is not part of API enum', () => assert.strictEqual(validateGithubPeriod('today'), false))
  await test('GitHub ranking item fixture passes', () => assert.strictEqual(validateGithubRankingItem(contractFixtures.githubItem).ok, true))
  await test('GitHub ranking negative stars are rejected', () => assert.strictEqual(validateGithubRankingItem({ ...contractFixtures.githubItem, stars: -1 }).ok, false))
  await test('GitHub ranking non-HTTPS URL is rejected', () => assert.strictEqual(validateGithubRankingItem({ ...contractFixtures.githubItem, url: 'http://github.com/a/b' }).ok, false))

  // Contract fixtures are local only and exercise existing normalizers.
  await test('health fixture normalizes as success', () => assert.strictEqual(normalizeHttpResponse(contractFixtures.healthSuccess).ok, true))
  await test('article list fixture has valid pagination', () => assert.strictEqual(validatePagination(contractFixtures.articleListSuccess.data.meta.pagination).ok, true))
  await test('article detail fixture normalizes as success', () => assert.strictEqual(normalizeHttpResponse(contractFixtures.articleDetailSuccess).ok, true))
  await test('GitHub fixture uses valid period', () => assert.strictEqual(validateGithubPeriod(contractFixtures.githubRankingsSuccess.data.data.period), true))
  await test('business error fixture remains business error', () => assert.strictEqual(normalizeHttpResponse(contractFixtures.businessError).error.type, API_ERROR_TYPES.BUSINESS))
  await test('rate limit fixture is retryable HTTP error', () => assert.strictEqual(normalizeHttpResponse(contractFixtures.rateLimit).error.retryable, true))
  await test('rate limit retryAfter metadata is preserved', () => assert.strictEqual(normalizeHttpResponse(contractFixtures.rateLimit).meta.retryAfter, 30))
  await test('fixture requestId is preserved', () => assert.strictEqual(normalizeHttpResponse(contractFixtures.healthSuccess).meta.requestId, 'req-fixture-health'))

  // Step 3 static boundaries.
  await test('static rule requires relative endpoint config', () => {
    const errors = validateStage5Sources(staticFixture({
      'config/api-endpoints.js': "const API_VERSION = 'v1'; const API_PREFIX='/api/v1'; const health='https://server.example.com/api/v1/health'",
    }))
    assert(errors.some((item) => item.includes('相对 API Path')))
  })
  await test('static rule rejects direct GitHub provider URL in packageGithub', () => {
    const errors = validateStage5Sources(staticFixture({ 'packageGithub/pages/index/index.js': "const url='https://api.github.com/repos'" }))
    assert(errors.some((item) => item.includes('不得直连 GitHub')))
  })
  await test('static rule rejects direct WordPress REST path in Content Service', () => {
    const errors = validateStage5Sources(staticFixture({ 'services/content.js': "const path='/wp-json/wp/v2/posts'" }))
    assert(errors.some((item) => item.includes('不得直连 GitHub / WordPress / AI Provider')))
  })
  await test('static rule rejects direct AI provider URL in packageAI', () => {
    const errors = validateStage5Sources(staticFixture({ 'packageAI/pages/index/index.js': "const url='https://api.openai.com/v1/chat/completions'" }))
    assert(errors.some((item) => item.includes('不得直连 GitHub / WordPress / AI Provider')))
  })
  await test('static rule ignores provider examples inside comments', () => {
    const errors = validateStage5Sources(staticFixture({ 'services/content.js': "// example only: https://api.github.com\nconst { API_ENDPOINTS } = require('../config/api-endpoints')\nconst { validateContentSummary } = require('../utils/api-schema')\nconst x = 1" }))
    assert.deepStrictEqual(errors, [])
  })

  console.log(`Stage 5 API/Transport/Contract tests: PASS (${passed} cases)`)
}

run().catch((error) => {
  console.error(error.stack || error.message)
  process.exit(1)
})
