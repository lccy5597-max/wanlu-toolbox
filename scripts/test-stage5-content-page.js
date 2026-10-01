const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  formatPublishDate,
  getContentListErrorView,
  mergeArticleItems,
  toArticleListItem,
} = require('../utils/content-list-view-model')
const {
  PAGE_SIZE,
  createArticlesPageDefinition,
} = require('../packageContent/pages/articles/articles')
const {
  validateContentPageSources,
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

const article = (id, overrides = {}) => ({
  id,
  title: `文章 ${id}`,
  excerpt: `摘要 ${id}`,
  cover: `https://cdn.example.com/${encodeURIComponent(id)}.webp`,
  publishTime: '2026-10-01T08:30:00+08:00',
  category: '资讯',
  author: '挽鹿资讯网',
  ...overrides,
})

const success = (items, options = {}) => ({
  ok: true,
  code: 0,
  message: 'ok',
  data: {
    items,
    pagination: {
      page: options.page || 1,
      pageSize: PAGE_SIZE,
      total: options.total === undefined ? items.length : options.total,
      hasMore: Boolean(options.hasMore),
    },
  },
  meta: {},
})

const failure = (type, retryable = false) => ({
  ok: false,
  code: type === 'business' ? 20004 : 'TEST_ERROR',
  message: 'test_error',
  error: { type, retryable, statusCode: type === 'http' ? 503 : null },
})

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const createQueueService = (queue, calls = []) => ({
  getArticles: (options) => {
    calls.push({ ...options })
    if (!queue.length) throw new Error('fake_service_queue_empty')
    const next = queue.shift()
    return typeof next === 'function' ? next(options) : next
  },
})

const createPageHarness = (service) => {
  const definition = createArticlesPageDefinition({ service })
  const page = {
    ...definition,
    data: { ...definition.data },
    _setDataCount: 0,
    setData(patch) {
      this._setDataCount += 1
      this.data = { ...this.data, ...patch }
    },
  }
  return page
}

const contentStaticFixture = (overrides = {}) => ({
  'app.json': JSON.stringify({
    pages: ['pages/index/index', 'pages/discover/discover'],
    subPackages: [{ root: 'packageContent', name: 'content', pages: ['pages/articles/articles'] }],
    tabBar: { list: [{ pagePath: 'pages/index/index' }] },
  }),
  'packageContent/pages/articles/articles.js': "const { contentService } = require('../../../services/content')\nconst load = () => contentService.getArticles({ page: 1, pageSize: 10 })",
  'packageContent/pages/articles/articles.json': '{"usingComponents":{}}',
  'packageContent/pages/articles/articles.wxml': '<view>{{item.title}}</view>',
  'packageContent/pages/articles/articles.wxss': '.page{}',
  'pages/index/index.js': 'const x = 1',
  'pages/index/index.wxml': '<view>首页</view>',
  'pages/discover/discover.js': 'const x = 1',
  'pages/discover/discover.wxml': '<view>发现</view>',
  ...overrides,
})

const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8')

const run = async () => {
  // ViewModel / pure logic.
  await test('publish date formats as YYYY-MM-DD', () => assert.strictEqual(formatPublishDate('2026-10-01T08:30:00+08:00'), '2026-10-01'))
  await test('invalid publish date becomes empty display text', () => assert.strictEqual(formatPublishDate('invalid'), ''))
  await test('summary maps stable display fields', () => assert.strictEqual(toArticleListItem(article('a')).title, '文章 a'))
  await test('summary does not copy detail content', () => assert.strictEqual(Object.prototype.hasOwnProperty.call(toArticleListItem(article('a', { content: '<p>x</p>' })), 'content'), false))
  await test('cover exists sets cover flags', () => assert.deepStrictEqual([toArticleListItem(article('a')).hasCover, toArticleListItem(article('a')).coverVisible], [true, true]))
  await test('cover null is safe and hidden', () => assert.strictEqual(toArticleListItem(article('a', { cover: null })).coverVisible, false))
  await test('optional author can be absent', () => {
    const source = article('a')
    delete source.author
    assert.strictEqual(Object.prototype.hasOwnProperty.call(toArticleListItem(source), 'author'), false)
  })
  await test('view model does not mutate input summary', () => {
    const source = article('a')
    const before = JSON.stringify(source)
    toArticleListItem(source)
    assert.strictEqual(JSON.stringify(source), before)
  })
  await test('first page replace ignores previous list', () => assert.deepStrictEqual(mergeArticleItems([article('old')], [article('new')], { replace: true }).map((item) => item.id), ['new']))
  await test('second page appends items', () => assert.deepStrictEqual(mergeArticleItems([article('a')], [article('b')]).map((item) => item.id), ['a', 'b']))
  await test('duplicate article id is deduplicated', () => assert.deepStrictEqual(mergeArticleItems([article('a')], [article('a'), article('b')]).map((item) => item.id), ['a', 'b']))
  await test('empty incoming page preserves current items', () => assert.deepStrictEqual(mergeArticleItems([article('a')], []).map((item) => item.id), ['a']))
  await test('merge does not mutate source arrays', () => {
    const first = [article('a')]
    const second = [article('b')]
    const before = JSON.stringify([first, second])
    mergeArticleItems(first, second)
    assert.strictEqual(JSON.stringify([first, second]), before)
  })
  await test('client disabled maps to unavailable without retry', () => assert.deepStrictEqual([getContentListErrorView(failure('client_disabled')).state, getContentListErrorView(failure('client_disabled')).retryable], ['unavailable', false]))
  await test('transport maps to retryable network error', () => assert.deepStrictEqual([getContentListErrorView(failure('transport', true)).state, getContentListErrorView(failure('transport', true)).retryable], ['error', true]))
  await test('retryable HTTP stays retryable', () => assert.strictEqual(getContentListErrorView(failure('http', true)).retryable, true))
  await test('business error maps to user-safe error state', () => assert.strictEqual(getContentListErrorView(failure('business')).title, '内容加载失败'))
  await test('contract error maps without technical text', () => assert.strictEqual(getContentListErrorView(failure('contract')).description, '请稍后再试'))

  // Page construction and first load.
  await test('page size is fixed at 10', () => assert.strictEqual(PAGE_SIZE, 10))
  await test('page factory rejects invalid service', () => assert.throws(() => createArticlesPageDefinition({ service: {} }), /content_service_get_articles_required/))
  await test('page initial state starts at page 1', () => assert.strictEqual(createPageHarness(createQueueService([success([])])).data.page, 1))
  await test('page initial state is initial', () => assert.strictEqual(createPageHarness(createQueueService([success([])])).data.status, 'initial'))
  await test('onLoad requests page 1 with fixed pageSize', async () => {
    const calls = []
    const page = createPageHarness(createQueueService([success([article('a')])], calls))
    await page.onLoad()
    assert.deepStrictEqual(calls, [{ page: 1, pageSize: 10 }])
  })
  await test('initial loading state is visible while request is pending', async () => {
    const pending = deferred()
    const page = createPageHarness(createQueueService([pending.promise]))
    const promise = page.onLoad()
    assert.strictEqual(page.data.status, 'loading')
    assert.strictEqual(page.data.isLoading, true)
    pending.resolve(success([article('a')]))
    await promise
  })
  await test('successful first load becomes success state', async () => {
    const page = createPageHarness(createQueueService([success([article('a')])]))
    await page.onLoad()
    assert.deepStrictEqual([page.data.status, page.data.items.length], ['success', 1])
  })
  await test('empty first load becomes empty not error', async () => {
    const page = createPageHarness(createQueueService([success([], { total: 0 })]))
    await page.onLoad()
    assert.deepStrictEqual([page.data.status, page.data.errorView], ['empty', null])
  })
  await test('client disabled becomes unavailable', async () => {
    const page = createPageHarness(createQueueService([failure('client_disabled')]))
    await page.onLoad()
    assert.strictEqual(page.data.status, 'unavailable')
  })
  await test('client disabled does not retry from retry action', async () => {
    const calls = []
    const page = createPageHarness(createQueueService([failure('client_disabled')], calls))
    await page.onLoad()
    await page.onRetry()
    assert.strictEqual(calls.length, 1)
  })
  await test('transport error becomes retryable error', async () => {
    const page = createPageHarness(createQueueService([failure('transport', true)]))
    await page.onLoad()
    assert.deepStrictEqual([page.data.status, page.data.errorView.retryable], ['error', true])
  })
  await test('retry reloads page 1 after error', async () => {
    const calls = []
    const page = createPageHarness(createQueueService([failure('transport', true), success([article('a')])], calls))
    await page.onLoad()
    await page.onRetry()
    assert.strictEqual(calls.length, 2)
    assert.strictEqual(page.data.status, 'success')
  })
  await test('thrown service error maps to retryable transport state', async () => {
    const page = createPageHarness({ getArticles: async () => { throw new Error('private transport detail') } })
    await page.onLoad()
    assert.deepStrictEqual([page.data.status, page.data.errorView.retryable], ['error', true])
  })
  await test('default production content service stays unavailable without wx', async () => {
    const definition = createArticlesPageDefinition()
    const page = { ...definition, data: { ...definition.data }, setData(patch) { this.data = { ...this.data, ...patch } } }
    await page.onLoad()
    assert.strictEqual(page.data.status, 'unavailable')
  })

  // Pagination / interaction.
  await test('load more requests next page', async () => {
    const calls = []
    const page = createPageHarness(createQueueService([
      success([article('a')], { page: 1, total: 2, hasMore: true }),
      success([article('b')], { page: 2, total: 2, hasMore: false }),
    ], calls))
    await page.onLoad()
    await page.onReachBottom()
    assert.deepStrictEqual(calls[1], { page: 2, pageSize: 10 })
  })
  await test('load more appends page data', async () => {
    const page = createPageHarness(createQueueService([
      success([article('a')], { page: 1, total: 2, hasMore: true }),
      success([article('b')], { page: 2, total: 2, hasMore: false }),
    ]))
    await page.onLoad()
    await page.loadMore()
    assert.deepStrictEqual(page.data.items.map((item) => item.id), ['a', 'b'])
  })
  await test('load more deduplicates repeated article id', async () => {
    const page = createPageHarness(createQueueService([
      success([article('a')], { page: 1, total: 3, hasMore: true }),
      success([article('a'), article('b')], { page: 2, total: 3, hasMore: false }),
    ]))
    await page.onLoad()
    await page.loadMore()
    assert.deepStrictEqual(page.data.items.map((item) => item.id), ['a', 'b'])
  })
  await test('hasMore false prevents another request', async () => {
    const calls = []
    const page = createPageHarness(createQueueService([success([article('a')], { hasMore: false })], calls))
    await page.onLoad()
    await page.loadMore()
    assert.strictEqual(calls.length, 1)
  })
  await test('loadingMore prevents duplicate request', async () => {
    const pending = deferred()
    const calls = []
    const page = createPageHarness(createQueueService([
      success([article('a')], { page: 1, total: 2, hasMore: true }),
      pending.promise,
    ], calls))
    await page.onLoad()
    const first = page.loadMore()
    await page.loadMore()
    assert.strictEqual(calls.length, 2)
    pending.resolve(success([article('b')], { page: 2, total: 2, hasMore: false }))
    await first
  })
  await test('load more failure preserves current items', async () => {
    const page = createPageHarness(createQueueService([
      success([article('a')], { page: 1, total: 2, hasMore: true }),
      failure('transport', true),
    ]))
    await page.onLoad()
    await page.loadMore()
    assert.deepStrictEqual(page.data.items.map((item) => item.id), ['a'])
  })
  await test('load more failure exposes retry state', async () => {
    const page = createPageHarness(createQueueService([
      success([article('a')], { page: 1, total: 2, hasMore: true }),
      failure('transport', true),
    ]))
    await page.onLoad()
    await page.loadMore()
    assert.strictEqual(page.data.loadMoreError.retryable, true)
  })
  await test('load more retry can recover', async () => {
    const page = createPageHarness(createQueueService([
      success([article('a')], { page: 1, total: 2, hasMore: true }),
      failure('transport', true),
      success([article('b')], { page: 2, total: 2, hasMore: false }),
    ]))
    await page.onLoad()
    await page.loadMore()
    await page.onLoadMoreRetry()
    assert.deepStrictEqual(page.data.items.map((item) => item.id), ['a', 'b'])
  })
  await test('newer refresh result is not overwritten by stale request', async () => {
    const oldRequest = deferred()
    const newRequest = deferred()
    const page = createPageHarness(createQueueService([oldRequest.promise, newRequest.promise]))
    const oldPromise = page.onLoad()
    const newPromise = page.loadFirstPage({ force: true })
    newRequest.resolve(success([article('new')]))
    await newPromise
    oldRequest.resolve(success([article('old')]))
    await oldPromise
    assert.deepStrictEqual(page.data.items.map((item) => item.id), ['new'])
  })
  await test('unload invalidates pending async result', async () => {
    const pending = deferred()
    const page = createPageHarness(createQueueService([pending.promise]))
    const promise = page.onLoad()
    const countBeforeUnload = page._setDataCount
    page.onUnload()
    pending.resolve(success([article('late')]))
    await promise
    assert.strictEqual(page._setDataCount, countBeforeUnload)
  })
  await test('cover error hides only failed cover', async () => {
    const page = createPageHarness(createQueueService([success([article('a'), article('b')])]))
    await page.onLoad()
    page.onCoverError({ currentTarget: { dataset: { id: 'a' } } })
    assert.deepStrictEqual(page.data.items.map((item) => item.coverVisible), [false, true])
  })
  await test('cover null view model does not require image area', () => assert.strictEqual(toArticleListItem(article('a', { cover: null })).hasCover, false))

  // Static and registration boundaries.
  await test('valid content page fixture passes page static rules', () => assert.deepStrictEqual(validateContentPageSources(contentStaticFixture()), []))
  await test('page static rule rejects direct wx.request', () => assert(validateContentPageSources(contentStaticFixture({ 'packageContent/pages/articles/articles.js': "const { contentService } = require('../../../services/content'); wx.request({})" })).some((item) => item.includes('网络请求'))))
  await test('page static rule rejects fetch', () => assert(validateContentPageSources(contentStaticFixture({ 'packageContent/pages/articles/articles.js': "const { contentService } = require('../../../services/content'); fetch('x')" })).some((item) => item.includes('网络请求'))))
  await test('page static rule rejects Storage writes', () => assert(validateContentPageSources(contentStaticFixture({ 'packageContent/pages/articles/articles.js': "const { contentService } = require('../../../services/content'); wx.setStorageSync('x', 1)" })).some((item) => item.includes('Storage'))))
  await test('page static rule rejects fixture import', () => assert(validateContentPageSources(contentStaticFixture({ 'packageContent/pages/articles/articles.js': "const { contentService } = require('../../../services/content'); const f=require('../../../scripts/fixtures/x')" })).some((item) => item.includes('fixtures'))))
  await test('page static rule rejects WordPress direct path', () => assert(validateContentPageSources(contentStaticFixture({ 'packageContent/pages/articles/articles.js': "const { contentService } = require('../../../services/content'); const p='/wp-json/wp/v2/posts'" })).some((item) => item.includes('Provider'))))
  await test('page static rule rejects wanluu direct host', () => assert(validateContentPageSources(contentStaticFixture({ 'packageContent/pages/articles/articles.js': "const { contentService } = require('../../../services/content'); const host='wanluu.com'" })).some((item) => item.includes('wanluu.com'))))
  await test('page static rule rejects hard-coded fake article copy', () => assert(validateContentPageSources(contentStaticFixture({ 'packageContent/pages/articles/articles.js': "const { contentService } = require('../../../services/content'); const title='AI最新资讯'" })).some((item) => item.includes('假文章'))))
  await test('page static rule rejects WebView', () => assert(validateContentPageSources(contentStaticFixture({ 'packageContent/pages/articles/articles.wxml': '<web-view src="x" />' })).some((item) => item.includes('WebView'))))
  await test('page static rule rejects rich-text on list page', () => assert(validateContentPageSources(contentStaticFixture({ 'packageContent/pages/articles/articles.wxml': '<rich-text nodes="{{item.content}}" />' })).some((item) => item.includes('Rich Text'))))
  await test('page static rule rejects direct detail content binding', () => assert(validateContentPageSources(contentStaticFixture({ 'packageContent/pages/articles/articles.wxml': '<view>{{item.content}}</view>' })).some((item) => item.includes('完整文章'))))
  await test('page static rule requires package registration', () => assert(validateContentPageSources(contentStaticFixture({ 'app.json': JSON.stringify({ subPackages: [], tabBar: { list: [] } }) })).some((item) => item.includes('正确注册'))))
  await test('page static rule rejects packageContent in TabBar', () => assert(validateContentPageSources(contentStaticFixture({ 'app.json': JSON.stringify({ subPackages: [{ root: 'packageContent', pages: ['pages/articles/articles'] }], tabBar: { list: [{ pagePath: 'packageContent/pages/articles/articles' }] } }) })).some((item) => item.includes('TabBar'))))
  await test('page static rule rejects homepage content entry', () => assert(validateContentPageSources(contentStaticFixture({ 'pages/index/index.wxml': '<view data-url="/packageContent/pages/articles/articles">资讯</view>' })).some((item) => item.includes('正式入口'))))
  await test('page static rule rejects discover content entry', () => assert(validateContentPageSources(contentStaticFixture({ 'pages/discover/discover.js': "const url='/packageContent/pages/articles/articles'" })).some((item) => item.includes('正式入口'))))
  await test('actual article page four files exist', () => {
    ;['js', 'json', 'wxml', 'wxss'].forEach((extension) => assert(fs.existsSync(path.join(ROOT, `packageContent/pages/articles/articles.${extension}`))))
  })
  await test('actual app registers packageContent article page', () => {
    const appConfig = JSON.parse(read('app.json'))
    const contentPackage = appConfig.subPackages.find((item) => item.root === 'packageContent')
    assert(contentPackage.pages.includes('pages/articles/articles'))
  })
  await test('actual article page is not in TabBar', () => {
    const appConfig = JSON.parse(read('app.json'))
    assert(!appConfig.tabBar.list.some((item) => String(item.pagePath).startsWith('packageContent/')))
  })
  await test('actual homepage has no content entry', () => assert(!/packageContent\//.test(`${read('pages/index/index.js')}\n${read('pages/index/index.wxml')}`)))
  await test('actual discover page has no content entry', () => assert(!/packageContent\//.test(`${read('pages/discover/discover.js')}\n${read('pages/discover/discover.wxml')}`)))
  await test('actual article page source has no web-view or fixture import', () => {
    const source = `${read('packageContent/pages/articles/articles.js')}\n${read('packageContent/pages/articles/articles.wxml')}`
    assert(!/<web-view\b/i.test(source))
    assert(!/scripts\/fixtures\//.test(source))
  })
  await test('actual article page source has no direct network or Storage call', () => {
    const source = read('packageContent/pages/articles/articles.js')
    assert(!/wx\.request\s*\(|wx\.uploadFile\s*\(|\bfetch\s*\(|XMLHttpRequest|wx\.setStorage/.test(source))
  })

  console.log(`Stage 5 Content Page tests: PASS (${passed} cases)`)
}

run().catch((error) => {
  console.error(error.stack || error.message)
  process.exit(1)
})
