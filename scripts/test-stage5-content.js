const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  API_ENDPOINTS,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  buildArticleDetailPath,
} = require('../config/api-endpoints')
const {
  API_ERROR_TYPES,
  createErrorResult,
  normalizeHttpResponse,
} = require('../utils/api-contract')
const { createApiClient } = require('../utils/api-client')
const {
  contentService,
  createContentService,
  getArticles,
  getArticleDetail,
} = require('../services/content')
const fixtures = require('./fixtures/stage5-api-contract')
const { validateStage5Sources } = require('./stage5-static-rules')

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

const clone = (value) => JSON.parse(JSON.stringify(value))
const normalized = (fixture) => normalizeHttpResponse(fixture)

const createFakeClient = (resultOrFactory, capture = {}) => ({
  get: async (requestPath, options = {}) => {
    capture.calls = (capture.calls || 0) + 1
    capture.path = requestPath
    capture.options = options
    if (typeof resultOrFactory === 'function') return resultOrFactory(requestPath, options)
    return resultOrFactory
  },
})

const safeStaticFixture = (contentSource, overrides = {}) => ({
  'config/environment.js': "const REMOTE_API_ENABLED = false\nDEVELOPMENT: 'development'\nPRODUCTION: 'production'\nhttps://api.example.com",
  'config/api-endpoints.js': "const API_VERSION = 'v1'\nconst API_PREFIX = '/api/v1'",
  'utils/api-client.js': 'const request = () => null',
  'utils/api-contract.js': 'const normalizeEnvelope = () => null',
  'utils/api-schema.js': "const RICH_CONTENT_FORMAT = 'sanitized_html'",
  'utils/api-transport.js': 'const request = () => wx.request({})',
  'services/content.js': contentSource,
  ...overrides,
})

const SAFE_CONTENT_SOURCE = "const { API_ENDPOINTS } = require('../config/api-endpoints')\nconst { validateContentSummary } = require('../utils/api-schema')\nconst getArticles = () => API_ENDPOINTS.content.articles"

const run = async () => {
  // Construction / import boundary.
  await test('createContentService accepts injected client', () => {
    const service = createContentService({ apiClient: createFakeClient(normalized(fixtures.articleListSuccess)) })
    assert.strictEqual(typeof service.getArticles, 'function')
    assert.strictEqual(typeof service.getArticleDetail, 'function')
  })
  await test('createContentService rejects missing client get', () => assert.throws(() => createContentService({ apiClient: {} }), /content_api_client_get_required/))
  await test('createContentService rejects null client', () => assert.throws(() => createContentService({ apiClient: null }), /content_api_client_get_required/))
  await test('default contentService is constructed', () => assert.strictEqual(typeof contentService.getArticles, 'function'))
  await test('module convenience getArticles export exists', () => assert.strictEqual(typeof getArticles, 'function'))
  await test('module convenience getArticleDetail export exists', () => assert.strictEqual(typeof getArticleDetail, 'function'))
  await test('module source has no import-time timer', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../services/content.js'), 'utf8')
    assert(!/\bset(?:Timeout|Interval)\s*\(/.test(source))
  })
  await test('module loads in Node without global wx', () => {
    const modulePath = require.resolve('../services/content')
    const previousWx = global.wx
    try {
      delete global.wx
      delete require.cache[modulePath]
      const fresh = require('../services/content')
      assert.strictEqual(typeof fresh.createContentService, 'function')
    } finally {
      if (previousWx === undefined) delete global.wx
      else global.wx = previousWx
    }
  })

  // getArticles input normalization.
  await test('getArticles defaults page to 1', async () => {
    const capture = {}
    const service = createContentService({ apiClient: createFakeClient(normalized(fixtures.articleListSuccess), capture) })
    await service.getArticles()
    assert.strictEqual(capture.options.query.page, DEFAULT_PAGE)
  })
  await test('getArticles defaults pageSize to 10', async () => {
    const capture = {}
    const service = createContentService({ apiClient: createFakeClient(normalized(fixtures.articleListSuccess), capture) })
    await service.getArticles()
    assert.strictEqual(capture.options.query.pageSize, DEFAULT_PAGE_SIZE)
  })
  await test('numeric string page is normalized', async () => {
    const capture = {}
    const service = createContentService({ apiClient: createFakeClient(normalized(fixtures.articleListSuccess), capture) })
    await service.getArticles({ page: '2' })
    assert.strictEqual(capture.options.query.page, 2)
  })
  await test('numeric string pageSize is normalized', async () => {
    const capture = {}
    const service = createContentService({ apiClient: createFakeClient(normalized(fixtures.articleListSuccess), capture) })
    await service.getArticles({ pageSize: '20' })
    assert.strictEqual(capture.options.query.pageSize, 20)
  })
  for (const [name, value] of [
    ['page null', null],
    ['page empty string', ''],
    ['page zero', 0],
    ['page negative', -1],
    ['page NaN', Number.NaN],
    ['page Infinity', Infinity],
  ]) {
    await test(`${name} is contract error`, async () => {
      const capture = {}
      const service = createContentService({ apiClient: createFakeClient(normalized(fixtures.articleListSuccess), capture) })
      const result = await service.getArticles({ page: value })
      assert.strictEqual(result.error.type, API_ERROR_TYPES.CONTRACT)
      assert.strictEqual(capture.calls || 0, 0)
    })
  }
  for (const [name, value] of [
    ['pageSize null', null],
    ['pageSize empty string', ''],
    ['pageSize zero', 0],
    ['pageSize negative', -1],
    ['pageSize NaN', Number.NaN],
    ['pageSize Infinity', Infinity],
    ['pageSize over max', MAX_PAGE_SIZE + 1],
  ]) {
    await test(`${name} is contract error`, async () => {
      const capture = {}
      const service = createContentService({ apiClient: createFakeClient(normalized(fixtures.articleListSuccess), capture) })
      const result = await service.getArticles({ pageSize: value })
      assert.strictEqual(result.error.type, API_ERROR_TYPES.CONTRACT)
      assert.strictEqual(capture.calls || 0, 0)
    })
  }
  await test('pageSize max 20 is valid', async () => {
    const capture = {}
    const result = await createContentService({ apiClient: createFakeClient(normalized(fixtures.articleListSuccess), capture) }).getArticles({ pageSize: 20 })
    assert.strictEqual(result.ok, true)
    assert.strictEqual(capture.options.query.pageSize, 20)
  })
  await test('options null is contract error', async () => assert.strictEqual((await createContentService({ apiClient: createFakeClient(null) }).getArticles(null)).error.type, API_ERROR_TYPES.CONTRACT))
  await test('options array is contract error', async () => assert.strictEqual((await createContentService({ apiClient: createFakeClient(null) }).getArticles([])).error.type, API_ERROR_TYPES.CONTRACT))
  await test('category omitted is not sent', async () => {
    const capture = {}
    await createContentService({ apiClient: createFakeClient(normalized(fixtures.articleListSuccess), capture) }).getArticles()
    assert.strictEqual(Object.prototype.hasOwnProperty.call(capture.options.query, 'category'), false)
  })
  await test('category null is not sent', async () => {
    const capture = {}
    await createContentService({ apiClient: createFakeClient(normalized(fixtures.articleListSuccess), capture) }).getArticles({ category: null })
    assert.strictEqual(Object.prototype.hasOwnProperty.call(capture.options.query, 'category'), false)
  })
  await test('blank category is not sent', async () => {
    const capture = {}
    await createContentService({ apiClient: createFakeClient(normalized(fixtures.articleListSuccess), capture) }).getArticles({ category: '   ' })
    assert.strictEqual(Object.prototype.hasOwnProperty.call(capture.options.query, 'category'), false)
  })
  await test('category is trimmed', async () => {
    const capture = {}
    await createContentService({ apiClient: createFakeClient(normalized(fixtures.articleListSuccess), capture) }).getArticles({ category: ' AI教程 ' })
    assert.strictEqual(capture.options.query.category, 'AI教程')
  })
  await test('non-string category is contract error', async () => {
    const capture = {}
    const result = await createContentService({ apiClient: createFakeClient(normalized(fixtures.articleListSuccess), capture) }).getArticles({ category: 1 })
    assert.strictEqual(result.error.type, API_ERROR_TYPES.CONTRACT)
    assert.strictEqual(capture.calls || 0, 0)
  })

  // List request / response.
  await test('list uses configured endpoint', async () => {
    const capture = {}
    await createContentService({ apiClient: createFakeClient(normalized(fixtures.articleListSuccess), capture) }).getArticles()
    assert.strictEqual(capture.path, API_ENDPOINTS.content.articles)
  })
  await test('list calls client get exactly once', async () => {
    const capture = {}
    await createContentService({ apiClient: createFakeClient(normalized(fixtures.articleListSuccess), capture) }).getArticles()
    assert.strictEqual(capture.calls, 1)
  })
  await test('list query contains only expected keys', async () => {
    const capture = {}
    await createContentService({ apiClient: createFakeClient(normalized(fixtures.articleListSuccess), capture) }).getArticles({ category: 'AI教程' })
    assert.deepStrictEqual(Object.keys(capture.options.query).sort(), ['category', 'page', 'pageSize'])
  })
  await test('list query never sends undefined or null', async () => {
    const capture = {}
    await createContentService({ apiClient: createFakeClient(normalized(fixtures.articleListSuccess), capture) }).getArticles({ category: null })
    assert.strictEqual(Object.values(capture.options.query).some((value) => value === undefined || value === null), false)
  })
  await test('valid list returns stable service data', async () => {
    const result = await createContentService({ apiClient: createFakeClient(normalized(fixtures.articleListSuccess)) }).getArticles()
    assert.strictEqual(result.ok, true)
    assert.strictEqual(Array.isArray(result.data.items), true)
    assert.deepStrictEqual(result.data.pagination, { page: 1, pageSize: 10, total: 1, hasMore: false })
  })
  await test('summary excludes detail content field', async () => {
    const source = clone(fixtures.articleListSuccess)
    source.data.data.items[0].content = '<p>must not leak into list</p>'
    const result = await createContentService({ apiClient: createFakeClient(normalized(source)) }).getArticles()
    assert.strictEqual(Object.prototype.hasOwnProperty.call(result.data.items[0], 'content'), false)
  })
  await test('summary preserves optional author', async () => {
    const result = await createContentService({ apiClient: createFakeClient(normalized(fixtures.articleListSuccess)) }).getArticles()
    assert.strictEqual(result.data.items[0].author, fixtures.articleSummary.author)
  })
  await test('summary allows omitted author', async () => {
    const source = clone(fixtures.articleListSuccess)
    delete source.data.data.items[0].author
    const result = await createContentService({ apiClient: createFakeClient(normalized(source)) }).getArticles()
    assert.strictEqual(result.ok, true)
    assert.strictEqual(Object.prototype.hasOwnProperty.call(result.data.items[0], 'author'), false)
  })
  await test('empty article list is valid success', async () => {
    const result = await createContentService({ apiClient: createFakeClient(normalized(fixtures.emptyArticleList)) }).getArticles()
    assert.strictEqual(result.ok, true)
    assert.deepStrictEqual(result.data.items, [])
    assert.strictEqual(result.data.pagination.total, 0)
  })
  await test('invalid summary makes whole list contract error', async () => {
    const result = await createContentService({ apiClient: createFakeClient(normalized(fixtures.invalidArticleSummary)) }).getArticles()
    assert.strictEqual(result.error.type, API_ERROR_TYPES.CONTRACT)
    assert.strictEqual(result.code, 'INVALID_CONTENT_LIST_RESPONSE')
  })
  await test('invalid pagination is contract error', async () => {
    const result = await createContentService({ apiClient: createFakeClient(normalized(fixtures.invalidPagination)) }).getArticles()
    assert.strictEqual(result.error.type, API_ERROR_TYPES.CONTRACT)
  })
  await test('missing items is contract error', async () => {
    const response = normalized(fixtures.articleListSuccess)
    response.data = {}
    const result = await createContentService({ apiClient: createFakeClient(response) }).getArticles()
    assert.strictEqual(result.error.type, API_ERROR_TYPES.CONTRACT)
  })
  await test('array list data envelope is contract error', async () => {
    const response = normalized(fixtures.articleListSuccess)
    response.data = []
    const result = await createContentService({ apiClient: createFakeClient(response) }).getArticles()
    assert.strictEqual(result.error.type, API_ERROR_TYPES.CONTRACT)
  })
  await test('invalid summary cover is contract error', async () => {
    const source = clone(fixtures.articleListSuccess)
    source.data.data.items[0].cover = 'http://example.com/x.jpg'
    const result = await createContentService({ apiClient: createFakeClient(normalized(source)) }).getArticles()
    assert.strictEqual(result.error.type, API_ERROR_TYPES.CONTRACT)
  })
  await test('invalid summary publishTime is contract error', async () => {
    const source = clone(fixtures.articleListSuccess)
    source.data.data.items[0].publishTime = '2026/10/01'
    const result = await createContentService({ apiClient: createFakeClient(normalized(source)) }).getArticles()
    assert.strictEqual(result.error.type, API_ERROR_TYPES.CONTRACT)
  })
  await test('list does not mutate fixture', async () => {
    const source = clone(fixtures.articleListSuccess)
    const before = JSON.stringify(source)
    await createContentService({ apiClient: createFakeClient(normalized(source)) }).getArticles({ category: ' AI教程 ' })
    assert.strictEqual(JSON.stringify(source), before)
  })

  // Detail input / endpoint.
  await test('detail uses configured endpoint builder', async () => {
    const capture = {}
    await createContentService({ apiClient: createFakeClient(normalized(fixtures.articleDetailSuccess), capture) }).getArticleDetail('article-1001')
    assert.strictEqual(capture.path, API_ENDPOINTS.content.articleDetail('article-1001'))
  })
  await test('detail trims opaque id', async () => {
    const capture = {}
    await createContentService({ apiClient: createFakeClient(normalized(fixtures.articleDetailSuccess), capture) }).getArticleDetail(' article-1001 ')
    assert.strictEqual(capture.path, buildArticleDetailPath('article-1001'))
  })
  await test('detail safely encodes slash in id once', async () => {
    const capture = {}
    await createContentService({ apiClient: createFakeClient(normalized(fixtures.articleDetailSuccess), capture) }).getArticleDetail('a/b')
    assert(capture.path.endsWith('/a%2Fb'))
    assert(!capture.path.endsWith('/a%252Fb'))
  })
  await test('detail safely encodes spaces', async () => {
    const capture = {}
    await createContentService({ apiClient: createFakeClient(normalized(fixtures.articleDetailSuccess), capture) }).getArticleDetail('a b')
    assert(capture.path.endsWith('/a%20b'))
  })
  await test('detail safely encodes Chinese id', async () => {
    const capture = {}
    await createContentService({ apiClient: createFakeClient(normalized(fixtures.articleDetailSuccess), capture) }).getArticleDetail('挽鹿')
    assert(capture.path.includes('%E6%8C%BD%E9%B9%BF'))
  })
  await test('detail safely encodes question mark', async () => {
    const capture = {}
    await createContentService({ apiClient: createFakeClient(normalized(fixtures.articleDetailSuccess), capture) }).getArticleDetail('a?b')
    assert(capture.path.endsWith('/a%3Fb'))
  })
  for (const [name, id] of [
    ['blank id', ''],
    ['whitespace id', '   '],
    ['null id', null],
    ['undefined id', undefined],
    ['numeric id', 123],
  ]) {
    await test(`${name} is contract error`, async () => {
      const capture = {}
      const result = await createContentService({ apiClient: createFakeClient(normalized(fixtures.articleDetailSuccess), capture) }).getArticleDetail(id)
      assert.strictEqual(result.error.type, API_ERROR_TYPES.CONTRACT)
      assert.strictEqual(capture.calls || 0, 0)
    })
  }

  // Detail response / errors.
  await test('valid detail returns normalized business object', async () => {
    const result = await createContentService({ apiClient: createFakeClient(normalized(fixtures.articleDetailSuccess)) }).getArticleDetail(fixtures.articleDetail.id)
    assert.strictEqual(result.ok, true)
    assert.strictEqual(result.data.id, fixtures.articleDetail.id)
    assert.strictEqual(result.data.content, fixtures.articleDetail.content)
  })
  await test('detail HTML is not modified by service', async () => {
    const result = await createContentService({ apiClient: createFakeClient(normalized(fixtures.articleDetailSuccess)) }).getArticleDetail(fixtures.articleDetail.id)
    assert.strictEqual(result.data.content, fixtures.articleDetail.content)
  })
  await test('detail allows optional author omission', async () => {
    const source = clone(fixtures.articleDetailSuccess)
    delete source.data.data.author
    const result = await createContentService({ apiClient: createFakeClient(normalized(source)) }).getArticleDetail('x')
    assert.strictEqual(result.ok, true)
    assert.strictEqual(Object.prototype.hasOwnProperty.call(result.data, 'author'), false)
  })
  await test('detail allows optional cover omission', async () => {
    const source = clone(fixtures.articleDetailSuccess)
    delete source.data.data.cover
    const result = await createContentService({ apiClient: createFakeClient(normalized(source)) }).getArticleDetail('x')
    assert.strictEqual(result.ok, true)
    assert.strictEqual(Object.prototype.hasOwnProperty.call(result.data, 'cover'), false)
  })
  await test('unsafe detail content is contract error', async () => {
    const result = await createContentService({ apiClient: createFakeClient(normalized(fixtures.invalidArticleDetail)) }).getArticleDetail('x')
    assert.strictEqual(result.error.type, API_ERROR_TYPES.CONTRACT)
  })
  await test('invalid detail title is contract error', async () => {
    const source = clone(fixtures.articleDetailSuccess)
    source.data.data.title = ''
    const result = await createContentService({ apiClient: createFakeClient(normalized(source)) }).getArticleDetail('x')
    assert.strictEqual(result.error.type, API_ERROR_TYPES.CONTRACT)
  })
  await test('CONTENT_NOT_FOUND business error is preserved', async () => {
    const business = normalized(fixtures.businessError)
    const result = await createContentService({ apiClient: createFakeClient(business) }).getArticleDetail('missing')
    assert.strictEqual(result, business)
    assert.strictEqual(result.code, 20004)
    assert.strictEqual(result.error.type, API_ERROR_TYPES.BUSINESS)
  })
  await test('transport error is preserved', async () => {
    const transportError = createErrorResult({ code: 'NETWORK_ERROR', message: 'network_error', error: { type: API_ERROR_TYPES.TRANSPORT, retryable: true } })
    const result = await createContentService({ apiClient: createFakeClient(transportError) }).getArticles()
    assert.strictEqual(result, transportError)
    assert.strictEqual(result.error.retryable, true)
  })
  await test('HTTP error is preserved', async () => {
    const httpError = normalizeHttpResponse({ statusCode: 503, data: { code: 10053, message: 'service_unavailable', data: null } })
    const result = await createContentService({ apiClient: createFakeClient(httpError) }).getArticles()
    assert.strictEqual(result, httpError)
    assert.strictEqual(result.error.type, API_ERROR_TYPES.HTTP)
    assert.strictEqual(result.error.retryable, true)
  })
  await test('generic business error is preserved', async () => {
    const business = normalizeHttpResponse({ statusCode: 200, data: { code: 10001, message: 'invalid_request', data: null } })
    const result = await createContentService({ apiClient: createFakeClient(business) }).getArticles()
    assert.strictEqual(result, business)
    assert.strictEqual(result.error.type, API_ERROR_TYPES.BUSINESS)
  })
  await test('default content service stays client_disabled', async () => {
    const result = await contentService.getArticles()
    assert.strictEqual(result.code, 'REMOTE_DISABLED')
    assert.strictEqual(result.error.type, API_ERROR_TYPES.CLIENT_DISABLED)
  })
  await test('module getArticles convenience stays client_disabled', async () => assert.strictEqual((await getArticles()).code, 'REMOTE_DISABLED'))
  await test('module getArticleDetail convenience stays client_disabled after valid id', async () => assert.strictEqual((await getArticleDetail('x')).code, 'REMOTE_DISABLED'))
  await test('disabled API client prevents transport call through content service', async () => {
    let transportCalls = 0
    const disabledClient = createApiClient({
      enabled: false,
      transport: { request: async () => { transportCalls += 1; throw new Error('must not execute') } },
    })
    const result = await createContentService({ apiClient: disabledClient }).getArticles()
    assert.strictEqual(result.code, 'REMOTE_DISABLED')
    assert.strictEqual(transportCalls, 0)
  })
  await test('detail does not mutate fixture', async () => {
    const source = clone(fixtures.articleDetailSuccess)
    const before = JSON.stringify(source)
    await createContentService({ apiClient: createFakeClient(normalized(source)) }).getArticleDetail('article-1001')
    assert.strictEqual(JSON.stringify(source), before)
  })

  // Content-specific static boundaries.
  await test('safe content service static fixture passes', () => assert.deepStrictEqual(validateStage5Sources(safeStaticFixture(SAFE_CONTENT_SOURCE)), []))
  await test('static rule rejects content direct wx.request', () => {
    const errors = validateStage5Sources(safeStaticFixture(`${SAFE_CONTENT_SOURCE}\nwx.request({})`))
    assert(errors.some((item) => item.includes('wx.request')))
  })
  await test('static rule rejects content uploadFile', () => {
    const errors = validateStage5Sources(safeStaticFixture(`${SAFE_CONTENT_SOURCE}\nwx.uploadFile({})`))
    assert(errors.some((item) => item.includes('upload')))
  })
  await test('static rule rejects WordPress wp-json direct path', () => {
    const errors = validateStage5Sources(safeStaticFixture(`${SAFE_CONTENT_SOURCE}\nconst path = '/wp-json/wp/v2/posts'`))
    assert(errors.some((item) => item.includes('WordPress')))
  })
  await test('static rule rejects full server URL in content service', () => {
    const errors = validateStage5Sources(safeStaticFixture(`${SAFE_CONTENT_SOURCE}\nconst base = 'https://server.example.test'`))
    assert(errors.some((item) => item.includes('完整 Server URL')))
  })
  await test('static rule rejects hardcoded api v1 endpoint in content service', () => {
    const errors = validateStage5Sources(safeStaticFixture(`${SAFE_CONTENT_SOURCE}\nconst direct = '/api/v1/content/articles'`))
    assert(errors.some((item) => item.includes('硬编码 /api/v1')))
  })
  await test('static rule rejects storage write in content service', () => {
    const errors = validateStage5Sources(safeStaticFixture(`${SAFE_CONTENT_SOURCE}\nstorage.set('content_cache', {})`))
    assert(errors.some((item) => item.includes('Storage')))
  })
  await test('static rule rejects fixture import in content service', () => {
    const errors = validateStage5Sources(safeStaticFixture(`${SAFE_CONTENT_SOURCE}\nconst fake = require('../scripts/fixtures/stage5-api-contract')`))
    assert(errors.some((item) => item.includes('fixtures')))
  })
  await test('static rule rejects hardcoded fake article in content service', () => {
    const errors = validateStage5Sources(safeStaticFixture(`${SAFE_CONTENT_SOURCE}\nconst fake = { title: '假文章', excerpt: '测试' }`))
    assert(errors.some((item) => item.includes('假文章')))
  })
  await test('static rule requires endpoint config reuse', () => {
    const source = "const { validateContentSummary } = require('../utils/api-schema')"
    const errors = validateStage5Sources(safeStaticFixture(source))
    assert(errors.some((item) => item.includes('api-endpoints')))
  })
  await test('static rule requires schema reuse', () => {
    const source = "const { API_ENDPOINTS } = require('../config/api-endpoints')"
    const errors = validateStage5Sources(safeStaticFixture(source))
    assert(errors.some((item) => item.includes('api-schema')))
  })

  console.log(`Stage 5 Content Service tests: PASS (${passed} cases)`)
}

run().catch((error) => {
  console.error(error.stack || error.message)
  process.exit(1)
})
