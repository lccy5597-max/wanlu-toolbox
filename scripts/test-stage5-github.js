const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  API_ENDPOINTS,
  GITHUB_DEFAULT_PAGE_SIZE,
  GITHUB_MAX_PAGE_SIZE,
  GITHUB_PERIODS,
} = require('../config/api-endpoints')
const {
  API_ERROR_TYPES,
  createErrorResult,
  normalizeHttpResponse,
} = require('../utils/api-contract')
const { createApiClient } = require('../utils/api-client')
const {
  BUSINESS_ERROR_CODES,
  validateGithubPageRequest,
  validateGithubPeriod,
  validateGithubRankingItem,
  validateGithubRankingResponse,
} = require('../utils/api-schema')
const {
  createGithubService,
  getRankings,
  githubService,
} = require('../services/github')
const { getEnvironment } = require('../config/environment')
const fixtures = require('./fixtures/stage5-api-contract')
const { validateGithubControlledSources } = require('./stage5-static-rules')

const ROOT = path.resolve(__dirname, '..')
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
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8')
const normalized = (fixture) => normalizeHttpResponse(fixture)

const createFakeClient = (resultOrFactory, capture = {}) => ({
  get: async (requestPath, options = {}) => {
    capture.calls = (capture.calls || 0) + 1
    capture.path = requestPath
    capture.options = options
    return typeof resultOrFactory === 'function'
      ? resultOrFactory(requestPath, options)
      : resultOrFactory
  },
})

const failure = (type, options = {}) => createErrorResult({
  code: options.code === undefined ? 'TEST_ERROR' : options.code,
  message: options.message || 'test_error',
  meta: options.meta || {},
  error: {
    type,
    retryable: Boolean(options.retryable),
    statusCode: options.statusCode || null,
  },
})

const actualStaticSources = () => ({
  'app.json': read('app.json'),
  'services/github.js': read('services/github.js'),
  'packageGithub/pages/index/index.js': read('packageGithub/pages/index/index.js'),
  'packageGithub/pages/index/index.json': read('packageGithub/pages/index/index.json'),
  'packageGithub/pages/index/index.wxml': read('packageGithub/pages/index/index.wxml'),
  'packageGithub/pages/index/index.wxss': read('packageGithub/pages/index/index.wxss'),
  'pages/index/index.js': read('pages/index/index.js'),
  'pages/index/index.wxml': read('pages/index/index.wxml'),
  'pages/discover/discover.js': read('pages/discover/discover.js'),
  'pages/discover/discover.wxml': read('pages/discover/discover.wxml'),
})

const run = async () => {
  // Construction / import boundary.
  await test('createGithubService accepts injected client', () => {
    const service = createGithubService({ apiClient: createFakeClient(normalized(fixtures.validGithubDaily)) })
    assert.strictEqual(typeof service.getRankings, 'function')
  })
  await test('createGithubService rejects empty client', () => assert.throws(() => createGithubService({ apiClient: {} }), /github_api_client_get_required/))
  await test('createGithubService rejects null client', () => assert.throws(() => createGithubService({ apiClient: null }), /github_api_client_get_required/))
  await test('default githubService exists', () => assert.strictEqual(typeof githubService.getRankings, 'function'))
  await test('module convenience getRankings exists', () => assert.strictEqual(typeof getRankings, 'function'))
  await test('module source has no import-time timer', () => assert(!/\bset(?:Timeout|Interval)\s*\(/.test(read('services/github.js'))))
  await test('module loads in Node without global wx', () => {
    const modulePath = require.resolve('../services/github')
    const previousWx = global.wx
    try {
      delete global.wx
      delete require.cache[modulePath]
      const fresh = require('../services/github')
      assert.strictEqual(typeof fresh.createGithubService, 'function')
    } finally {
      if (previousWx === undefined) delete global.wx
      else global.wx = previousWx
    }
  })
  await test('module import causes zero wx network/storage side effects', () => {
    let networkCalls = 0
    let storageCalls = 0
    const modulePath = require.resolve('../services/github')
    const previousWx = global.wx
    global.wx = {
      request: () => { networkCalls += 1 },
      getStorageSync: () => { storageCalls += 1 },
      setStorageSync: () => { storageCalls += 1 },
    }
    try {
      delete require.cache[modulePath]
      require('../services/github')
      assert.deepStrictEqual([networkCalls, storageCalls], [0, 0])
    } finally {
      if (previousWx === undefined) delete global.wx
      else global.wx = previousWx
    }
  })

  // Period: exact, explicit enum only.
  await test('formal GitHub periods remain daily weekly all', () => assert.deepStrictEqual(GITHUB_PERIODS, ['daily', 'weekly', 'all']))
  for (const period of ['daily', 'weekly', 'all']) {
    await test(`${period} is a valid period`, () => assert.strictEqual(validateGithubPeriod(period), true))
  }
  for (const [name, period] of [
    ['undefined', undefined],
    ['null', null],
    ['blank', ''],
    ['spaces', '   '],
    ['uppercase', 'DAILY'],
    ['mixed case', 'Weekly'],
    ['today alias', 'today'],
    ['non-string', 1],
  ]) {
    await test(`${name} period is contract error without client call`, async () => {
      const capture = {}
      const result = await createGithubService({ apiClient: createFakeClient(normalized(fixtures.validGithubDaily), capture) }).getRankings(period)
      assert.strictEqual(result.error.type, API_ERROR_TYPES.CONTRACT)
      assert.strictEqual(capture.calls || 0, 0)
    })
  }

  // Pagination: strict numbers, default 1/5, max 10.
  await test('GitHub page defaults to 1', () => assert.strictEqual(validateGithubPageRequest().page, 1))
  await test('GitHub pageSize defaults to 5', () => assert.strictEqual(validateGithubPageRequest().pageSize, GITHUB_DEFAULT_PAGE_SIZE))
  await test('GitHub page 2 is valid', () => assert.deepStrictEqual(validateGithubPageRequest({ page: 2 }), { page: 2, pageSize: 5 }))
  await test('GitHub pageSize 10 is valid', () => assert.deepStrictEqual(validateGithubPageRequest({ pageSize: 10 }), { page: 1, pageSize: GITHUB_MAX_PAGE_SIZE }))
  await test('GitHub numeric string page is rejected', () => assert.throws(() => validateGithubPageRequest({ page: '2' }), /invalid_page/))
  await test('GitHub numeric string pageSize is rejected', () => assert.throws(() => validateGithubPageRequest({ pageSize: '5' }), /invalid_page_size/))
  for (const [name, value] of [
    ['page zero', 0],
    ['page negative', -1],
    ['page NaN', Number.NaN],
    ['page Infinity', Infinity],
  ]) {
    await test(`${name} is contract error`, async () => {
      const capture = {}
      const result = await createGithubService({ apiClient: createFakeClient(normalized(fixtures.validGithubDaily), capture) }).getRankings('daily', { page: value })
      assert.strictEqual(result.error.type, API_ERROR_TYPES.CONTRACT)
      assert.strictEqual(capture.calls || 0, 0)
    })
  }
  for (const [name, value] of [
    ['pageSize zero', 0],
    ['pageSize negative', -1],
    ['pageSize NaN', Number.NaN],
    ['pageSize Infinity', Infinity],
    ['pageSize above 10', 11],
  ]) {
    await test(`${name} is contract error`, async () => {
      const capture = {}
      const result = await createGithubService({ apiClient: createFakeClient(normalized(fixtures.validGithubDaily), capture) }).getRankings('daily', { pageSize: value })
      assert.strictEqual(result.error.type, API_ERROR_TYPES.CONTRACT)
      assert.strictEqual(capture.calls || 0, 0)
    })
  }
  await test('null options is contract error', async () => assert.strictEqual((await createGithubService({ apiClient: createFakeClient(null) }).getRankings('daily', null)).error.type, API_ERROR_TYPES.CONTRACT))
  await test('array options is contract error', async () => assert.strictEqual((await createGithubService({ apiClient: createFakeClient(null) }).getRankings('daily', [])).error.type, API_ERROR_TYPES.CONTRACT))

  // Request shape.
  await test('ranking request uses configured endpoint', async () => {
    const capture = {}
    await createGithubService({ apiClient: createFakeClient(normalized(fixtures.validGithubDaily), capture) }).getRankings('daily')
    assert.strictEqual(capture.path, API_ENDPOINTS.github.rankings)
  })
  await test('ranking request uses GET client method exactly once', async () => {
    const capture = {}
    await createGithubService({ apiClient: createFakeClient(normalized(fixtures.validGithubDaily), capture) }).getRankings('daily')
    assert.strictEqual(capture.calls, 1)
  })
  await test('ranking query contains period page pageSize only', async () => {
    const capture = {}
    await createGithubService({ apiClient: createFakeClient(normalized(fixtures.validGithubDaily), capture) }).getRankings('daily', { page: 1, pageSize: 5 })
    assert.deepStrictEqual(Object.keys(capture.options.query).sort(), ['page', 'pageSize', 'period'])
  })
  await test('ranking query sends daily period', async () => {
    const capture = {}
    await createGithubService({ apiClient: createFakeClient(normalized(fixtures.validGithubDaily), capture) }).getRankings('daily')
    assert.strictEqual(capture.options.query.period, 'daily')
  })
  await test('ranking query sends page', async () => {
    const capture = {}
    const response = clone(fixtures.validGithubDaily)
    response.data.meta.pagination = { page: 2, pageSize: 5, total: 10, hasMore: false }
    await createGithubService({ apiClient: createFakeClient(normalized(response), capture) }).getRankings('daily', { page: 2 })
    assert.strictEqual(capture.options.query.page, 2)
  })
  await test('ranking query sends pageSize', async () => {
    const capture = {}
    const response = clone(fixtures.validGithubDaily)
    response.data.meta.pagination.pageSize = 10
    response.data.meta.pagination.total = 2
    await createGithubService({ apiClient: createFakeClient(normalized(response), capture) }).getRankings('daily', { pageSize: 10 })
    assert.strictEqual(capture.options.query.pageSize, 10)
  })
  await test('ranking request does not send headers from Service', async () => {
    const capture = {}
    await createGithubService({ apiClient: createFakeClient(normalized(fixtures.validGithubDaily), capture) }).getRankings('daily')
    assert.strictEqual(Object.prototype.hasOwnProperty.call(capture.options, 'headers'), false)
  })
  await test('ranking query has no identity or provider token fields', async () => {
    const capture = {}
    await createGithubService({ apiClient: createFakeClient(normalized(fixtures.validGithubDaily), capture) }).getRankings('daily')
    const keys = Object.keys(capture.options.query)
    ;['token', 'authorization', 'openId', 'unionId', 'userId', 'deviceId', 'fingerprint', 'location'].forEach((key) => assert(!keys.includes(key)))
  })

  // Valid ranking results / schema.
  for (const [period, fixture] of [
    ['daily', fixtures.validGithubDaily],
    ['weekly', fixtures.validGithubWeekly],
    ['all', fixtures.validGithubAll],
  ]) {
    await test(`valid ${period} ranking succeeds`, async () => {
      const result = await createGithubService({ apiClient: createFakeClient(normalized(fixture)) }).getRankings(period)
      assert.strictEqual(result.ok, true)
      assert.strictEqual(result.data.period, period)
    })
  }
  await test('ranking response returns items and pagination', async () => {
    const result = await createGithubService({ apiClient: createFakeClient(normalized(fixtures.validGithubDaily)) }).getRankings('daily')
    assert(Array.isArray(result.data.items))
    assert.deepStrictEqual(result.data.pagination, { page: 1, pageSize: 5, total: 2, hasMore: false })
  })
  await test('empty ranking is valid success', async () => {
    const result = await createGithubService({ apiClient: createFakeClient(normalized(fixtures.emptyGithubRanking)) }).getRankings('daily')
    assert.strictEqual(result.ok, true)
    assert.deepStrictEqual(result.data.items, [])
    assert.strictEqual(result.data.pagination.total, 0)
  })
  await test('repository schema accepts fixture', () => assert.strictEqual(validateGithubRankingItem(fixtures.githubItem).ok, true))
  await test('repository id is preserved as opaque string', async () => {
    const source = clone(fixtures.validGithubDaily)
    source.data.data.items[0].id = 'repo/a 中文?x=1'
    const result = await createGithubService({ apiClient: createFakeClient(normalized(source)) }).getRankings('daily')
    assert.strictEqual(result.data.items[0].id, 'repo/a 中文?x=1')
  })
  await test('repository service fields are exact business fields only', async () => {
    const result = await createGithubService({ apiClient: createFakeClient(normalized(fixtures.validGithubWeekly)) }).getRankings('weekly')
    assert.deepStrictEqual(Object.keys(result.data.items[0]).sort(), ['author', 'description', 'fullName', 'id', 'language', 'name', 'stars', 'updatedAt', 'url'].sort())
  })
  await test('stars accepts zero safe integer', () => assert.strictEqual(validateGithubRankingItem({ ...fixtures.githubItem, stars: 0 }).ok, true))
  await test('stars rejects unsafe integer', () => assert.strictEqual(validateGithubRankingItem({ ...fixtures.githubItem, stars: Number.MAX_SAFE_INTEGER + 1 }).ok, false))
  await test('repository URL requires HTTPS', () => assert.strictEqual(validateGithubRankingItem({ ...fixtures.githubItem, url: 'http://github.com/example/example' }).ok, false))
  await test('updatedAt requires ISO timezone', () => assert.strictEqual(validateGithubRankingItem({ ...fixtures.githubItem, updatedAt: '2026-10-01T00:00:00' }).ok, false))
  await test('ranking response validator checks requested period', () => {
    const data = fixtures.validGithubWeekly.data.data
    const pagination = fixtures.validGithubWeekly.data.meta.pagination
    assert.strictEqual(validateGithubRankingResponse(data, pagination, { period: 'daily' }).ok, false)
  })

  // Invalid repository / response contract.
  for (const [name, change] of [
    ['missing id', (item) => { delete item.id }],
    ['blank name', (item) => { item.name = '   ' }],
    ['blank fullName', (item) => { item.fullName = '' }],
    ['blank author', (item) => { item.author = '' }],
    ['negative stars', (item) => { item.stars = -1 }],
    ['fraction stars', (item) => { item.stars = 1.5 }],
    ['Infinity stars', (item) => { item.stars = Infinity }],
    ['string stars', (item) => { item.stars = '123' }],
    ['bad url', (item) => { item.url = 'ftp://github.com/example/example' }],
    ['bad updatedAt', (item) => { item.updatedAt = 'yesterday' }],
  ]) {
    await test(`${name} makes entire ranking a contract error`, async () => {
      const source = clone(fixtures.validGithubDaily)
      change(source.data.data.items[0])
      const result = await createGithubService({ apiClient: createFakeClient(normalized(source)) }).getRankings('daily')
      assert.strictEqual(result.error.type, API_ERROR_TYPES.CONTRACT)
      assert.strictEqual(result.code, 'INVALID_GITHUB_RANKING_RESPONSE')
    })
  }
  await test('invalid fixture item makes whole response contract error', async () => {
    const result = await createGithubService({ apiClient: createFakeClient(normalized(fixtures.invalidGithubItem)) }).getRankings('daily')
    assert.strictEqual(result.error.type, API_ERROR_TYPES.CONTRACT)
  })
  await test('invalid GitHub pagination is contract error', async () => {
    const result = await createGithubService({ apiClient: createFakeClient(normalized(fixtures.invalidGithubPagination)) }).getRankings('daily')
    assert.strictEqual(result.error.type, API_ERROR_TYPES.CONTRACT)
  })
  await test('missing items is contract error', async () => {
    const response = normalized(fixtures.validGithubDaily)
    response.data = { period: 'daily' }
    const result = await createGithubService({ apiClient: createFakeClient(response) }).getRankings('daily')
    assert.strictEqual(result.error.type, API_ERROR_TYPES.CONTRACT)
  })
  await test('mismatched response period is contract error', async () => {
    const result = await createGithubService({ apiClient: createFakeClient(normalized(fixtures.validGithubWeekly)) }).getRankings('daily')
    assert.strictEqual(result.error.type, API_ERROR_TYPES.CONTRACT)
  })

  // Unified error preservation.
  for (const [name, errorResult, type] of [
    ['client_disabled', failure(API_ERROR_TYPES.CLIENT_DISABLED, { code: 'REMOTE_DISABLED' }), API_ERROR_TYPES.CLIENT_DISABLED],
    ['transport', failure(API_ERROR_TYPES.TRANSPORT, { code: 'NETWORK_ERROR', retryable: true }), API_ERROR_TYPES.TRANSPORT],
    ['HTTP', failure(API_ERROR_TYPES.HTTP, { code: 'HTTP_503', statusCode: 503, retryable: true }), API_ERROR_TYPES.HTTP],
    ['business', failure(API_ERROR_TYPES.BUSINESS, { code: 30001 }), API_ERROR_TYPES.BUSINESS],
    ['contract', failure(API_ERROR_TYPES.CONTRACT, { code: 'INVALID_RESPONSE' }), API_ERROR_TYPES.CONTRACT],
  ]) {
    await test(`${name} error object is preserved`, async () => {
      const result = await createGithubService({ apiClient: createFakeClient(errorResult) }).getRankings('daily')
      assert.strictEqual(result, errorResult)
      assert.strictEqual(result.error.type, type)
    })
  }
  await test('GITHUB_UPSTREAM_ERROR business code is preserved', async () => {
    const upstream = normalized(fixtures.githubUpstreamError)
    const result = await createGithubService({ apiClient: createFakeClient(upstream) }).getRankings('daily')
    assert.strictEqual(result, upstream)
    assert.strictEqual(result.code, BUSINESS_ERROR_CODES.GITHUB_UPSTREAM_ERROR)
    assert.strictEqual(result.error.type, API_ERROR_TYPES.BUSINESS)
  })
  await test('HTTP retryable flag is preserved', async () => {
    const http = failure(API_ERROR_TYPES.HTTP, { code: 'HTTP_503', statusCode: 503, retryable: true })
    const result = await createGithubService({ apiClient: createFakeClient(http) }).getRankings('daily')
    assert.strictEqual(result.error.retryable, true)
  })

  // No client-side ranking algorithm / mutation.
  await test('server item order is preserved exactly', async () => {
    const result = await createGithubService({ apiClient: createFakeClient(normalized(fixtures.validGithubDaily)) }).getRankings('daily')
    assert.deepStrictEqual(result.data.items.map((item) => item.id), ['repo-1001', 'repo-1002'])
    assert(result.data.items[0].stars < result.data.items[1].stars)
  })
  await test('service returns new repository objects', async () => {
    const response = normalized(fixtures.validGithubDaily)
    const original = response.data.items[0]
    const result = await createGithubService({ apiClient: createFakeClient(response) }).getRankings('daily')
    assert.notStrictEqual(result.data.items[0], original)
  })
  await test('fixture is not mutated by service', async () => {
    const source = clone(fixtures.validGithubDaily)
    const before = JSON.stringify(source)
    await createGithubService({ apiClient: createFakeClient(normalized(source)) }).getRankings('daily')
    assert.strictEqual(JSON.stringify(source), before)
  })
  await test('service source has no sort or trending score calculation', () => assert(!/\.sort\s*\(|trending\s*score|trendingScore|trendScore/i.test(read('services/github.js'))))
  await test('service output contains no UI display fields', async () => {
    const result = await createGithubService({ apiClient: createFakeClient(normalized(fixtures.validGithubDaily)) }).getRankings('daily')
    const item = result.data.items[0]
    ;['displayStars', 'displayUpdatedAt', 'languageColor', 'rankLabel', 'periodLabel'].forEach((key) => assert.strictEqual(Object.prototype.hasOwnProperty.call(item, key), false))
  })

  // Remote disabled / no real network.
  await test('default githubService returns client_disabled', async () => {
    const result = await githubService.getRankings('daily')
    assert.strictEqual(result.error.type, API_ERROR_TYPES.CLIENT_DISABLED)
  })
  await test('disabled API client makes zero transport calls', async () => {
    let transportCalls = 0
    const apiClient = createApiClient({
      enabled: false,
      transport: { request: async () => { transportCalls += 1; throw new Error('must_not_run') } },
    })
    const result = await createGithubService({ apiClient }).getRankings('daily')
    assert.strictEqual(result.error.type, API_ERROR_TYPES.CLIENT_DISABLED)
    assert.strictEqual(transportCalls, 0)
  })
  await test('development remote remains false', () => assert.strictEqual(getEnvironment('development').remoteApiEnabled, false))
  await test('production remote remains false', () => assert.strictEqual(getEnvironment('production').remoteApiEnabled, false))

  // Static/security/page boundary.
  await test('actual GitHub service and Step 9 page boundary passes', () => assert.deepStrictEqual(validateGithubControlledSources(actualStaticSources()), []))
  await test('GitHub service has no direct wx.request', () => assert(!/wx\.request\s*\(/.test(read('services/github.js'))))
  await test('GitHub service has no api.github.com', () => assert(!/api\.github\.com/i.test(read('services/github.js'))))
  await test('GitHub service has no Storage call or cache key', () => assert(!/wx\.(?:getStorage|setStorage|removeStorage|clearStorage)|\bstorage\.|wl_github_|wl_content_cache/.test(read('services/github.js'))))
  await test('GitHub service does not import fixtures', () => assert(!/scripts\/fixtures|fixtures\/stage5/.test(read('services/github.js'))))
  await test('GitHub service does not hardcode server URL', () => assert(!/https?:\/\//.test(read('services/github.js'))))
  await test('GitHub service does not hardcode endpoint literal', () => assert(!/\/api\/v1\/github\/rankings/.test(read('services/github.js'))))
  await test('GitHub service source has no provider token material', () => assert(!/github[_-]?(?:token|pat)|github_pat_|ghp_|Authorization\s*[:=]/i.test(read('services/github.js'))))
  await test('packageGithub consumes GitHub Service without API infrastructure access', () => {
    const source = `${read('packageGithub/pages/index/index.js')}\n${read('packageGithub/pages/index/index.wxml')}`
    assert(/services\/github/.test(source))
    assert(!/utils\/api-(?:client|transport|schema)|config\/api-endpoints/.test(source))
  })
  await test('packageGithub has no direct provider network', () => assert(!/wx\.request|\bfetch\s*\(|XMLHttpRequest|api\.github\.com/i.test(`${read('packageGithub/pages/index/index.js')}\n${read('packageGithub/pages/index/index.wxml')}`)))
  await test('packageGithub has no production fake ranking', () => assert(!/今日热榜示例|本周热榜示例|总榜示例|stars?\s*[:=]\s*\d+/i.test(`${read('packageGithub/pages/index/index.js')}\n${read('packageGithub/pages/index/index.wxml')}`)))
  await test('homepage has no GitHub entry', () => assert(!/packageGithub\/|services\/github/.test(`${read('pages/index/index.js')}\n${read('pages/index/index.wxml')}`)))
  await test('discover page has no GitHub entry', () => assert(!/packageGithub\/|services\/github/.test(`${read('pages/discover/discover.js')}\n${read('pages/discover/discover.wxml')}`)))
  await test('TabBar has no GitHub entry', () => {
    const app = JSON.parse(read('app.json'))
    assert(!app.tabBar.list.some((item) => String(item.pagePath || '').startsWith('packageGithub/')))
  })
  await test('packageGithub still contains one existing page only', () => {
    const app = JSON.parse(read('app.json'))
    const pkg = app.subPackages.find((item) => item.root === 'packageGithub')
    assert.deepStrictEqual(pkg.pages, ['pages/index/index'])
  })
  await test('registered page count remains 36', () => {
    const app = JSON.parse(read('app.json'))
    const count = app.pages.length + app.subPackages.reduce((sum, item) => sum + item.pages.length, 0)
    assert.strictEqual(count, 36)
  })
  await test('static rule rejects direct wx.request in GitHub service', () => {
    const sources = actualStaticSources(); sources['services/github.js'] += '\nwx.request({})'
    assert(validateGithubControlledSources(sources).some((item) => item.includes('Provider 网络请求')))
  })
  await test('static rule rejects api.github.com in GitHub service', () => {
    const sources = actualStaticSources(); sources['services/github.js'] += "\nconst provider='https://api.github.com'"
    assert(validateGithubControlledSources(sources).some((item) => item.includes('Provider 网络请求')))
  })
  await test('static rule rejects Storage in GitHub service', () => {
    const sources = actualStaticSources(); sources['services/github.js'] += "\nstorage.set('wl_github_cache_v1', {})"
    assert(validateGithubControlledSources(sources).some((item) => item.includes('Storage')))
  })
  await test('static rule rejects fixture import in GitHub service', () => {
    const sources = actualStaticSources(); sources['services/github.js'] += "\nrequire('../scripts/fixtures/stage5-api-contract')"
    assert(validateGithubControlledSources(sources).some((item) => item.includes('Fixture')))
  })
  await test('static rule rejects client-side sort in GitHub service', () => {
    const sources = actualStaticSources(); sources['services/github.js'] += '\nitems.sort(() => 0)'
    assert(validateGithubControlledSources(sources).some((item) => item.includes('客户端排序')))
  })

  console.log(`Stage 5 GitHub Service tests: PASS (${passed} cases)`)
}

run().catch((error) => {
  console.error(error.stack || error.message)
  process.exit(1)
})
