const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  CACHE_VERSION,
  CONTENT_CACHE_KEY,
  DETAIL_TTL_MS,
  LIST_TTL_MS,
  MAX_DETAIL_CONTENT_CHARS,
  MAX_DETAIL_ENTRIES,
  MAX_LIST_ENTRIES,
  MAX_STALE_MS,
  buildDetailCacheKey,
  buildListCacheKey,
  createContentCache,
  getCacheFreshness,
} = require('../services/content-cache')
const { createContentService } = require('../services/content')
const { createArticlesPageDefinition } = require('../packageContent/pages/articles/articles')
const { createArticleDetailPageDefinition } = require('../packageContent/pages/article-detail/article-detail')
const { API_ERROR_TYPES, createErrorResult, normalizeHttpResponse } = require('../utils/api-contract')
const { getEnvironment } = require('../config/environment')
const fixtures = require('./fixtures/stage5-api-contract')
const {
  validateContentCacheSources,
  validateGithubControlledSources,
} = require('./stage5-static-rules')

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

const createMemoryStorage = (options = {}) => {
  const memory = new Map()
  const state = {
    failRead: Boolean(options.failRead),
    failSet: Boolean(options.failSet),
    failRemove: Boolean(options.failRemove),
  }
  return {
    memory,
    state,
    readRaw(key) {
      if (state.failRead) return { ok: false, found: false, error: new Error('read_failed') }
      const found = memory.has(key)
      return { ok: true, found, key, value: found ? clone(memory.get(key)) : undefined }
    },
    set(key, value) {
      if (state.failSet) return { ok: false, error: new Error('set_failed') }
      memory.set(key, clone(value))
      return { ok: true, value }
    },
    remove(key) {
      if (state.failRemove) return { ok: false, error: new Error('remove_failed') }
      memory.delete(key)
      return { ok: true }
    },
  }
}

const createClock = (initial = 1000) => ({ now: initial })
const makeCache = (storage, clock) => createContentCache({ storage, nowProvider: () => clock.now })

const listData = (options = {}) => {
  const page = options.page || 1
  const pageSize = options.pageSize || 10
  const total = options.total === undefined ? 1 : options.total
  const item = { ...fixtures.articleSummary, id: options.id || `article-${page}` }
  return {
    items: options.empty ? [] : [item],
    pagination: {
      page,
      pageSize,
      total,
      hasMore: page * pageSize < total,
    },
  }
}

const detailData = (id = 'article-1001', overrides = {}) => ({
  ...fixtures.articleDetail,
  id,
  ...overrides,
})

const createFakeClient = (resultOrFactory, calls = []) => ({
  get: async (requestPath, options = {}) => {
    calls.push({ path: requestPath, options })
    return typeof resultOrFactory === 'function'
      ? resultOrFactory(requestPath, options)
      : resultOrFactory
  },
})

const createListPageHarness = (service) => {
  const definition = createArticlesPageDefinition({ service })
  return {
    ...definition,
    data: { ...definition.data },
    setData(patch) { this.data = { ...this.data, ...patch } },
  }
}

const createDetailPageHarness = (service) => {
  const definition = createArticleDetailPageDefinition({ service })
  return {
    ...definition,
    data: { ...definition.data },
    setData(patch) { this.data = { ...this.data, ...patch } },
  }
}

const failure = (type, options = {}) => createErrorResult({
  code: options.code === undefined ? 'TEST_ERROR' : options.code,
  message: 'test_error',
  error: {
    type,
    retryable: Boolean(options.retryable),
    statusCode: options.statusCode || null,
  },
})

const actualStaticSources = () => ({
  'app.json': read('app.json'),
  'services/content.js': read('services/content.js'),
  'services/content-cache.js': read('services/content-cache.js'),
  'services/github.js': read('services/github.js'),
  'packageContent/pages/articles/articles.js': read('packageContent/pages/articles/articles.js'),
  'packageContent/pages/article-detail/article-detail.js': read('packageContent/pages/article-detail/article-detail.js'),
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
  // Namespace / constants / key stability.
  await test('Content Cache uses independent wl_content_cache_v1 key', () => assert.strictEqual(CONTENT_CACHE_KEY, 'wl_content_cache_v1'))
  await test('Content Cache version is 1', () => assert.strictEqual(CACHE_VERSION, 1))
  await test('list TTL is five minutes', () => assert.strictEqual(LIST_TTL_MS, 5 * 60 * 1000))
  await test('detail TTL is thirty minutes', () => assert.strictEqual(DETAIL_TTL_MS, 30 * 60 * 1000))
  await test('max stale is twenty four hours', () => assert.strictEqual(MAX_STALE_MS, 24 * 60 * 60 * 1000))
  await test('list entry limit is 10', () => assert.strictEqual(MAX_LIST_ENTRIES, 10))
  await test('detail entry limit is 30', () => assert.strictEqual(MAX_DETAIL_ENTRIES, 30))
  await test('detail content cache size limit is 200000 chars', () => assert.strictEqual(MAX_DETAIL_CONTENT_CHARS, 200000))
  await test('list key includes page', () => assert(buildListCacheKey({ page: 2, pageSize: 10 }).includes('page=2')))
  await test('list key includes pageSize', () => assert(buildListCacheKey({ page: 1, pageSize: 20 }).includes('pageSize=20')))
  await test('list key has stable omitted category token', () => assert(buildListCacheKey({ page: 1, pageSize: 10 }).endsWith('category=-')))
  await test('list key encodes category', () => assert(buildListCacheKey({ page: 1, pageSize: 10, category: 'AI 教程' }).includes(encodeURIComponent('AI 教程'))))
  await test('different list pages do not collide', () => assert.notStrictEqual(buildListCacheKey({ page: 1, pageSize: 10 }), buildListCacheKey({ page: 2, pageSize: 10 })))
  await test('different list page sizes do not collide', () => assert.notStrictEqual(buildListCacheKey({ page: 1, pageSize: 10 }), buildListCacheKey({ page: 1, pageSize: 20 })))
  await test('different categories do not collide', () => assert.notStrictEqual(buildListCacheKey({ page: 1, pageSize: 10, category: 'A' }), buildListCacheKey({ page: 1, pageSize: 10, category: 'B' })))
  await test('detail key preserves opaque id through encoding', () => assert.strictEqual(buildDetailCacheKey('a/b 中文?x=1'), `detail:id=${encodeURIComponent('a/b 中文?x=1')}`))

  // Fresh / stale / expired with injected clock.
  await test('freshness helper reports fresh', () => assert.strictEqual(getCacheFreshness({ expiresAt: 2000 }, 2000), 'fresh'))
  await test('freshness helper reports stale inside max stale', () => assert.strictEqual(getCacheFreshness({ expiresAt: 2000 }, 2001), 'stale'))
  await test('freshness helper reports expired after max stale', () => assert.strictEqual(getCacheFreshness({ expiresAt: 2000 }, 2000 + MAX_STALE_MS + 1), 'expired'))
  await test('list cache is fresh before list TTL', () => {
    const storage = createMemoryStorage(); const clock = createClock(); const cache = makeCache(storage, clock)
    cache.writeList({ page: 1, pageSize: 10 }, listData())
    clock.now += LIST_TTL_MS
    assert.strictEqual(cache.readList({ page: 1, pageSize: 10 }).freshness, 'fresh')
  })
  await test('list cache becomes stale after TTL', () => {
    const storage = createMemoryStorage(); const clock = createClock(); const cache = makeCache(storage, clock)
    cache.writeList({ page: 1, pageSize: 10 }, listData())
    clock.now += LIST_TTL_MS + 1
    assert.strictEqual(cache.readList({ page: 1, pageSize: 10 }).freshness, 'stale')
  })
  await test('detail cache is fresh before detail TTL', () => {
    const storage = createMemoryStorage(); const clock = createClock(); const cache = makeCache(storage, clock)
    cache.writeDetail('a', detailData('a'))
    clock.now += DETAIL_TTL_MS
    assert.strictEqual(cache.readDetail('a').freshness, 'fresh')
  })
  await test('stale cache is usable through max stale boundary', () => {
    const storage = createMemoryStorage(); const clock = createClock(); const cache = makeCache(storage, clock)
    cache.writeDetail('a', detailData('a'))
    clock.now += DETAIL_TTL_MS + MAX_STALE_MS
    assert.strictEqual(cache.readDetail('a').hit, true)
  })
  await test('expired cache is a miss after max stale', () => {
    const storage = createMemoryStorage(); const clock = createClock(); const cache = makeCache(storage, clock)
    cache.writeDetail('a', detailData('a'))
    clock.now += DETAIL_TTL_MS + MAX_STALE_MS + 1
    const result = cache.readDetail('a')
    assert.deepStrictEqual([result.hit, result.reason], [false, 'expired'])
  })

  // Write / read / corruption / storage failure / mutation.
  await test('valid list writes under independent namespace', () => {
    const storage = createMemoryStorage(); const cache = makeCache(storage, createClock())
    assert.strictEqual(cache.writeList({ page: 1, pageSize: 10 }, listData()).cached, true)
    assert.strictEqual(storage.memory.has(CONTENT_CACHE_KEY), true)
  })
  await test('valid detail writes under independent namespace', () => {
    const storage = createMemoryStorage(); const cache = makeCache(storage, createClock())
    assert.strictEqual(cache.writeDetail('a', detailData('a')).cached, true)
  })
  await test('valid empty list can be cached', () => {
    const storage = createMemoryStorage(); const cache = makeCache(storage, createClock())
    assert.strictEqual(cache.writeList({ page: 1, pageSize: 10 }, listData({ empty: true, total: 0 })).cached, true)
  })
  await test('invalid list data is never cached', () => {
    const storage = createMemoryStorage(); const cache = makeCache(storage, createClock())
    assert.strictEqual(cache.writeList({ page: 1, pageSize: 10 }, { items: 'bad' }).cached, false)
    assert.strictEqual(storage.memory.size, 0)
  })
  await test('invalid detail data is never cached', () => {
    const storage = createMemoryStorage(); const cache = makeCache(storage, createClock())
    assert.strictEqual(cache.writeDetail('a', { id: 'a', content: '<script>x</script>' }).cached, false)
    assert.strictEqual(storage.memory.size, 0)
  })
  await test('oversize detail is not cached', () => {
    const storage = createMemoryStorage(); const cache = makeCache(storage, createClock())
    const result = cache.writeDetail('a', detailData('a', { content: 'x'.repeat(MAX_DETAIL_CONTENT_CHARS + 1) }))
    assert.deepStrictEqual([result.ok, result.cached, result.reason], [true, false, 'oversize'])
  })
  await test('storage write failure is reported without throw', () => {
    const storage = createMemoryStorage({ failSet: true }); const cache = makeCache(storage, createClock())
    assert.strictEqual(cache.writeList({ page: 1, pageSize: 10 }, listData()).reason, 'storage_write_failed')
  })
  await test('storage read failure is safe miss', () => {
    const storage = createMemoryStorage({ failRead: true }); const cache = makeCache(storage, createClock())
    assert.deepStrictEqual([cache.readList({ page: 1, pageSize: 10 }).ok, cache.readList({ page: 1, pageSize: 10 }).hit], [false, false])
  })
  await test('corrupt cache root is safely treated as miss', () => {
    const storage = createMemoryStorage(); storage.memory.set(CONTENT_CACHE_KEY, { version: 999, entries: 'bad' })
    const cache = makeCache(storage, createClock())
    assert.strictEqual(cache.readList({ page: 1, pageSize: 10 }).hit, false)
  })
  await test('invalid cached list schema is a miss', () => {
    const storage = createMemoryStorage(); const clock = createClock(); const key = buildListCacheKey({ page: 1, pageSize: 10 })
    storage.memory.set(CONTENT_CACHE_KEY, { version: 1, entries: { [key]: { type: 'list', key, cachedAt: 1, expiresAt: 999999, data: { items: 'bad' } } } })
    assert.strictEqual(makeCache(storage, clock).readList({ page: 1, pageSize: 10 }).reason, 'invalid_schema')
  })
  await test('invalid cached detail schema is a miss', () => {
    const storage = createMemoryStorage(); const key = buildDetailCacheKey('a')
    storage.memory.set(CONTENT_CACHE_KEY, { version: 1, entries: { [key]: { type: 'detail', key, cachedAt: 1, expiresAt: 999999, data: { id: 'a', content: '<script>x</script>' } } } })
    assert.strictEqual(makeCache(storage, createClock()).readDetail('a').reason, 'invalid_schema')
  })
  await test('write does not mutate source data', () => {
    const storage = createMemoryStorage(); const cache = makeCache(storage, createClock()); const source = listData(); const before = JSON.stringify(source)
    cache.writeList({ page: 1, pageSize: 10 }, source)
    assert.strictEqual(JSON.stringify(source), before)
  })
  await test('cache read does not expose internal mutable reference', () => {
    const storage = createMemoryStorage(); const cache = makeCache(storage, createClock()); cache.writeDetail('a', detailData('a'))
    const first = cache.readDetail('a'); first.data.title = 'mutated'
    assert.notStrictEqual(cache.readDetail('a').data.title, 'mutated')
  })

  // Capacity / eviction / clear boundary.
  await test('list entries are capped at 10 with oldest eviction', () => {
    const storage = createMemoryStorage(); const clock = createClock(); const cache = makeCache(storage, clock)
    for (let page = 1; page <= 11; page += 1) { cache.writeList({ page, pageSize: 10 }, listData({ page, total: 200 })); clock.now += 1 }
    const entries = Object.values(storage.memory.get(CONTENT_CACHE_KEY).entries).filter((entry) => entry.type === 'list')
    assert.strictEqual(entries.length, 10)
    assert.strictEqual(entries.some((entry) => entry.key.includes('page=1:')), false)
  })
  await test('detail entries are capped at 30 with oldest eviction', () => {
    const storage = createMemoryStorage(); const clock = createClock(); const cache = makeCache(storage, clock)
    for (let i = 1; i <= 31; i += 1) { cache.writeDetail(`id-${i}`, detailData(`id-${i}`)); clock.now += 1 }
    const entries = Object.values(storage.memory.get(CONTENT_CACHE_KEY).entries).filter((entry) => entry.type === 'detail')
    assert.strictEqual(entries.length, 30)
    assert.strictEqual(entries.some((entry) => entry.key === buildDetailCacheKey('id-1')), false)
  })
  await test('clearContentCache only removes Content namespace', () => {
    const storage = createMemoryStorage(); const cache = makeCache(storage, createClock())
    storage.memory.set('wl_meta_v1', { keep: true }); cache.writeList({ page: 1, pageSize: 10 }, listData()); cache.clearContentCache()
    assert.strictEqual(storage.memory.has(CONTENT_CACHE_KEY), false)
    assert.deepStrictEqual(storage.memory.get('wl_meta_v1'), { keep: true })
  })
  await test('clearContentCache handles remove failure without throw', () => {
    const storage = createMemoryStorage({ failRemove: true }); const cache = makeCache(storage, createClock())
    assert.strictEqual(cache.clearContentCache().ok, false)
  })

  // Content Service Network First / fallback conditions.
  await test('network list success returns network metadata and writes cache', async () => {
    const storage = createMemoryStorage(); const clock = createClock(); const cache = makeCache(storage, clock)
    const service = createContentService({ apiClient: createFakeClient(normalizeHttpResponse(fixtures.articleListSuccess)), cache })
    const result = await service.getArticles()
    assert.deepStrictEqual([result.data.source, result.data.isFallback], ['network', false])
    assert.strictEqual(cache.readList({ page: 1, pageSize: 10 }).hit, true)
  })
  await test('network detail success returns network metadata and writes cache', async () => {
    const storage = createMemoryStorage(); const clock = createClock(); const cache = makeCache(storage, clock)
    const service = createContentService({ apiClient: createFakeClient(normalizeHttpResponse(fixtures.articleDetailSuccess)), cache })
    const result = await service.getArticleDetail(fixtures.articleDetail.id)
    assert.deepStrictEqual([result.data.source, result.data.isFallback], ['network', false])
    assert.strictEqual(cache.readDetail(fixtures.articleDetail.id).hit, true)
  })
  await test('network success survives cache write failure', async () => {
    const storage = createMemoryStorage({ failSet: true }); const cache = makeCache(storage, createClock())
    const result = await createContentService({ apiClient: createFakeClient(normalizeHttpResponse(fixtures.articleListSuccess)), cache }).getArticles()
    assert.deepStrictEqual([result.ok, result.data.source], [true, 'network'])
  })
  await test('oversize detail still returns network success', async () => {
    const source = clone(fixtures.articleDetailSuccess); source.data.data.content = 'x'.repeat(MAX_DETAIL_CONTENT_CHARS + 1)
    const storage = createMemoryStorage(); const cache = makeCache(storage, createClock())
    const result = await createContentService({ apiClient: createFakeClient(normalizeHttpResponse(source)), cache }).getArticleDetail('oversize')
    assert.strictEqual(result.ok, true)
    assert.strictEqual(cache.readDetail('oversize').hit, false)
  })
  await test('transport error falls back to cached list', async () => {
    const storage = createMemoryStorage(); const clock = createClock(); const cache = makeCache(storage, clock); const query = { page: 1, pageSize: 10 }
    cache.writeList(query, listData())
    const result = await createContentService({ apiClient: createFakeClient(failure(API_ERROR_TYPES.TRANSPORT, { retryable: true })), cache }).getArticles()
    assert.deepStrictEqual([result.ok, result.data.source, result.data.isFallback], [true, 'cache', true])
  })
  await test('429 falls back to cached list', async () => {
    const storage = createMemoryStorage(); const clock = createClock(); const cache = makeCache(storage, clock); cache.writeList({ page: 1, pageSize: 10 }, listData())
    const result = await createContentService({ apiClient: createFakeClient(normalizeHttpResponse(fixtures.rateLimit)), cache }).getArticles()
    assert.strictEqual(result.data.isFallback, true)
  })
  for (const statusCode of [500, 503]) {
    await test(`HTTP ${statusCode} falls back to cached detail`, async () => {
      const storage = createMemoryStorage(); const clock = createClock(); const cache = makeCache(storage, clock); cache.writeDetail('a', detailData('a'))
      const http = normalizeHttpResponse({ statusCode, data: { code: 10053, message: 'service_unavailable', data: null } })
      const result = await createContentService({ apiClient: createFakeClient(http), cache }).getArticleDetail('a')
      assert.deepStrictEqual([result.ok, result.data.source], [true, 'cache'])
    })
  }
  await test('retryable error without cache preserves original error object', async () => {
    const original = failure(API_ERROR_TYPES.TRANSPORT, { retryable: true })
    const result = await createContentService({ apiClient: createFakeClient(original), cache: makeCache(createMemoryStorage(), createClock()) }).getArticles()
    assert.strictEqual(result, original)
  })
  await test('client_disabled never reads fallback cache', async () => {
    let reads = 0
    const cache = { readList: () => { reads += 1; return { ok: true, hit: true, data: listData() } }, writeList: () => ({}), readDetail: () => ({ ok: false }), writeDetail: () => ({}) }
    const result = await createContentService({ apiClient: createFakeClient(failure(API_ERROR_TYPES.CLIENT_DISABLED)), cache }).getArticles()
    assert.strictEqual(result.error.type, API_ERROR_TYPES.CLIENT_DISABLED)
    assert.strictEqual(reads, 0)
  })
  await test('business error never falls back', async () => {
    const storage = createMemoryStorage(); const cache = makeCache(storage, createClock()); cache.writeList({ page: 1, pageSize: 10 }, listData())
    const business = failure(API_ERROR_TYPES.BUSINESS, { code: 10001 })
    assert.strictEqual(await createContentService({ apiClient: createFakeClient(business), cache }).getArticles(), business)
  })
  await test('CONTENT_NOT_FOUND never falls back to old detail', async () => {
    const storage = createMemoryStorage(); const cache = makeCache(storage, createClock()); cache.writeDetail('missing', detailData('missing'))
    const business = normalizeHttpResponse(fixtures.businessError)
    const result = await createContentService({ apiClient: createFakeClient(business), cache }).getArticleDetail('missing')
    assert.strictEqual(result, business)
  })
  await test('contract error never falls back', async () => {
    const storage = createMemoryStorage(); const cache = makeCache(storage, createClock()); cache.writeList({ page: 1, pageSize: 10 }, listData())
    const contract = failure(API_ERROR_TYPES.CONTRACT)
    assert.strictEqual(await createContentService({ apiClient: createFakeClient(contract), cache }).getArticles(), contract)
  })
  for (const statusCode of [400, 401, 404]) {
    await test(`HTTP ${statusCode} never falls back`, async () => {
      const storage = createMemoryStorage(); const cache = makeCache(storage, createClock()); cache.writeList({ page: 1, pageSize: 10 }, listData())
      const http = normalizeHttpResponse({ statusCode, data: { code: 10001, message: 'invalid_request', data: null } })
      assert.strictEqual(await createContentService({ apiClient: createFakeClient(http), cache }).getArticles(), http)
    })
  }
  await test('fallback returns cachedAt metadata', async () => {
    const storage = createMemoryStorage(); const clock = createClock(5000); const cache = makeCache(storage, clock); cache.writeDetail('a', detailData('a'))
    const result = await createContentService({ apiClient: createFakeClient(failure(API_ERROR_TYPES.TRANSPORT, { retryable: true })), cache }).getArticleDetail('a')
    assert.strictEqual(result.data.cachedAt, 5000)
  })
  await test('stale but bounded cache can fallback', async () => {
    const storage = createMemoryStorage(); const clock = createClock(); const cache = makeCache(storage, clock); cache.writeList({ page: 1, pageSize: 10 }, listData()); clock.now += LIST_TTL_MS + 1
    const result = await createContentService({ apiClient: createFakeClient(failure(API_ERROR_TYPES.TRANSPORT, { retryable: true })), cache }).getArticles()
    assert.strictEqual(result.data.isFallback, true)
  })
  await test('expired cache does not fallback', async () => {
    const storage = createMemoryStorage(); const clock = createClock(); const cache = makeCache(storage, clock); cache.writeList({ page: 1, pageSize: 10 }, listData()); clock.now += LIST_TTL_MS + MAX_STALE_MS + 1
    const original = failure(API_ERROR_TYPES.TRANSPORT, { retryable: true })
    assert.strictEqual(await createContentService({ apiClient: createFakeClient(original), cache }).getArticles(), original)
  })

  // Page integration: fallback is success with a lightweight hint; disabled/not-found stay unchanged.
  await test('list page marks cache fallback success', async () => {
    const service = { getArticles: async () => ({ ok: true, data: { ...listData(), source: 'cache', isFallback: true, cachedAt: 1 } }) }
    const page = createListPageHarness(service); await page.onLoad()
    assert.deepStrictEqual([page.data.status, page.data.isFallback], ['success', true])
  })
  await test('list page network success has no fallback flag', async () => {
    const service = { getArticles: async () => ({ ok: true, data: { ...listData(), source: 'network', isFallback: false, cachedAt: null } }) }
    const page = createListPageHarness(service); await page.onLoad(); assert.strictEqual(page.data.isFallback, false)
  })
  await test('list loadMore cached page preserves existing items and shows fallback', async () => {
    let call = 0
    const service = { getArticles: async () => { call += 1; return call === 1
      ? { ok: true, data: { ...listData({ page: 1, total: 20, id: 'a' }), source: 'network', isFallback: false } }
      : { ok: true, data: { ...listData({ page: 2, total: 20, id: 'b' }), source: 'cache', isFallback: true, cachedAt: 1 } } } }
    const page = createListPageHarness(service); await page.onLoad(); await page.loadMore()
    assert.deepStrictEqual([page.data.items.length, page.data.isFallback], [2, true])
  })
  await test('list client_disabled keeps fallback flag false', async () => {
    const page = createListPageHarness({ getArticles: async () => failure(API_ERROR_TYPES.CLIENT_DISABLED) }); await page.onLoad()
    assert.deepStrictEqual([page.data.status, page.data.isFallback], ['unavailable', false])
  })
  await test('detail page marks cache fallback success', async () => {
    const page = createDetailPageHarness({ getArticleDetail: async () => ({ ok: true, data: { ...detailData('a'), source: 'cache', isFallback: true, cachedAt: 1 } }) })
    await page.onLoad({ id: 'a' }); assert.deepStrictEqual([page.data.status, page.data.isFallback], ['success', true])
  })
  await test('detail network success has no fallback flag', async () => {
    const page = createDetailPageHarness({ getArticleDetail: async () => ({ ok: true, data: { ...detailData('a'), source: 'network', isFallback: false, cachedAt: null } }) })
    await page.onLoad({ id: 'a' }); assert.strictEqual(page.data.isFallback, false)
  })
  await test('detail client_disabled remains unavailable without fallback', async () => {
    const page = createDetailPageHarness({ getArticleDetail: async () => failure(API_ERROR_TYPES.CLIENT_DISABLED) }); await page.onLoad({ id: 'a' })
    assert.deepStrictEqual([page.data.status, page.data.isFallback], ['unavailable', false])
  })
  await test('detail not found remains not_found without fallback', async () => {
    const page = createDetailPageHarness({ getArticleDetail: async () => failure(API_ERROR_TYPES.BUSINESS, { code: 20004 }) }); await page.onLoad({ id: 'a' })
    assert.deepStrictEqual([page.data.status, page.data.isFallback], ['not_found', false])
  })
  await test('list WXML contains user-safe cache fallback hint', () => assert(read('packageContent/pages/articles/articles.wxml').includes('当前显示缓存内容')))
  await test('detail WXML contains user-safe cache fallback hint', () => assert(read('packageContent/pages/article-detail/article-detail.wxml').includes('当前显示缓存内容')))

  // Static boundaries and controlled packageGithub preparation.
  await test('actual Content Cache static rules pass', () => assert.deepStrictEqual(validateContentCacheSources(actualStaticSources()), []))
  await test('Content Cache static rejects alternate wl_content key', () => {
    const sources = actualStaticSources(); sources['services/content-cache.js'] += "\nconst bad='wl_content_profile_v1'"
    assert(validateContentCacheSources(sources).some((item) => item.includes('未批准 Content Storage Key') || item.includes('用户画像')))
  })
  await test('Content Cache static rejects Stage 3 key access', () => {
    const sources = actualStaticSources(); sources['services/content-cache.js'] += "\nconst bad='wl_history_v1'"
    assert(validateContentCacheSources(sources).some((item) => item.includes('Stage 3 Storage Key')))
  })
  await test('Content Cache static rejects direct wx Storage', () => {
    const sources = actualStaticSources(); sources['services/content-cache.js'] += '\nwx.getStorageSync("x")'
    assert(validateContentCacheSources(sources).some((item) => item.includes('wx.*Storage')))
  })
  await test('Content Cache static rejects global clearStorage', () => {
    const sources = actualStaticSources(); sources['services/content-cache.js'] += '\nwx.clearStorage()'
    assert(validateContentCacheSources(sources).some((item) => item.includes('clearStorage')))
  })
  await test('Content pages do not directly import Content Cache', () => {
    const sources = actualStaticSources(); assert(!/services\/content-cache/.test(`${sources['packageContent/pages/articles/articles.js']}\n${sources['packageContent/pages/article-detail/article-detail.js']}`))
  })
  await test('actual packageGithub controlled boundary passes', () => assert.deepStrictEqual(validateGithubControlledSources(actualStaticSources()), []))
  await test('packageGithub controlled boundary rejects direct wx.request', () => {
    const sources = actualStaticSources(); sources['packageGithub/pages/index/index.js'] += '\nwx.request({})'
    assert(validateGithubControlledSources(sources).some((item) => item.includes('网络请求')))
  })
  await test('packageGithub controlled boundary rejects api.github.com', () => {
    const sources = actualStaticSources(); sources['packageGithub/pages/index/index.js'] += "\nconst host='https://api.github.com'"
    assert(validateGithubControlledSources(sources).some((item) => item.includes('GitHub Provider')))
  })
  await test('packageGithub controlled boundary rejects fake ranking data', () => {
    const sources = actualStaticSources(); sources['packageGithub/pages/index/index.wxml'] += '<view>今日热榜示例</view>'
    assert(validateGithubControlledSources(sources).some((item) => item.includes('假榜单')))
  })
  await test('packageGithub controlled boundary requires GitHub Service consumption in Step 9', () => {
    const sources = actualStaticSources(); sources['packageGithub/pages/index/index.js'] = sources['packageGithub/pages/index/index.js'].replace("require('../../../services/github')", "require('../../../services/noop')")
    assert(validateGithubControlledSources(sources).some((item) => item.includes('GitHub Service')))
  })
  await test('packageGithub controlled boundary rejects TabBar opening', () => {
    const sources = actualStaticSources(); const app = JSON.parse(sources['app.json']); app.tabBar.list.push({ pagePath: 'packageGithub/pages/index/index' }); sources['app.json'] = JSON.stringify(app)
    assert(validateGithubControlledSources(sources).some((item) => item.includes('TabBar')))
  })
  await test('packageGithub controlled boundary rejects homepage entry', () => {
    const sources = actualStaticSources(); sources['pages/index/index.js'] += "\nconst path='/packageGithub/pages/index/index'"
    assert(validateGithubControlledSources(sources).some((item) => item.includes('正式入口')))
  })
  await test('packageGithub stays on one registered existing page', () => {
    const app = JSON.parse(read('app.json')); const pkg = app.subPackages.find((item) => item.root === 'packageGithub'); assert.deepStrictEqual(pkg.pages, ['pages/index/index'])
  })
  await test('registered page count remains 36', () => {
    const app = JSON.parse(read('app.json')); const count = app.pages.length + app.subPackages.reduce((sum, item) => sum + item.pages.length, 0); assert.strictEqual(count, 36)
  })
  await test('homepage has no GitHub entry', () => assert(!/packageGithub\/|services\/github/.test(`${read('pages/index/index.js')}\n${read('pages/index/index.wxml')}`)))
  await test('discover page has no GitHub entry', () => assert(!/packageGithub\/|services\/github/.test(`${read('pages/discover/discover.js')}\n${read('pages/discover/discover.wxml')}`)))
  await test('packageGithub page has no provider request or fake stars', () => assert(!/wx\.request|fetch\s*\(|api\.github\.com|stars?\s*[:=]\s*\d+/i.test(`${read('packageGithub/pages/index/index.js')}\n${read('packageGithub/pages/index/index.wxml')}`)))
  await test('services/github.js remains free of direct provider network', () => assert(!/wx\.request|fetch\s*\(|api\.github\.com/i.test(read('services/github.js'))))
  await test('development Remote remains false', () => assert.strictEqual(getEnvironment('development').remoteApiEnabled, false))
  await test('production Remote remains false', () => assert.strictEqual(getEnvironment('production').remoteApiEnabled, false))

  console.log(`Stage 5 Content Cache/GitHub Boundary tests: PASS (${passed} cases)`)
}

run().catch((error) => {
  console.error(error.stack || error.message)
  process.exit(1)
})
