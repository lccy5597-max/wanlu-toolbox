const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  ARTICLE_DETAIL_ROUTE,
  buildArticleDetailRoute,
  getContentDetailErrorView,
  parseArticleDetailRoute,
  toArticleDetailViewModel,
} = require('../utils/content-detail-view-model')
const { createArticleDetailPageDefinition } = require('../packageContent/pages/article-detail/article-detail')
const { createArticlesPageDefinition } = require('../packageContent/pages/articles/articles')
const { validateContentDetailPageSources } = require('./stage5-static-rules')
const contractFixtures = require('./fixtures/stage5-api-contract')
const { getEnvironment } = require('../config/environment')

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

const detail = (overrides = {}) => ({
  ...contractFixtures.articleDetail,
  ...overrides,
})

const success = (overrides = {}) => ({
  ok: true,
  code: 0,
  message: 'ok',
  data: detail(overrides),
  meta: {},
})

const failure = (type, options = {}) => ({
  ok: false,
  code: options.code === undefined ? 'TEST_ERROR' : options.code,
  message: 'test_error',
  data: null,
  meta: {},
  error: {
    type,
    retryable: Boolean(options.retryable),
    statusCode: options.statusCode || null,
  },
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
  getArticleDetail: (id) => {
    calls.push(id)
    if (!queue.length) throw new Error('fake_detail_service_queue_empty')
    const next = queue.shift()
    return typeof next === 'function' ? next(id) : next
  },
})

const createPageHarness = (service) => {
  const definition = createArticleDetailPageDefinition({ service })
  return {
    ...definition,
    data: { ...definition.data },
    _setDataCount: 0,
    setData(patch) {
      this._setDataCount += 1
      this.data = { ...this.data, ...patch }
    },
  }
}

const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8')

const detailStaticFixture = (overrides = {}) => ({
  'app.json': JSON.stringify({
    pages: ['pages/index/index', 'pages/discover/discover'],
    subPackages: [{
      root: 'packageContent',
      name: 'content',
      pages: ['pages/articles/articles', 'pages/article-detail/article-detail'],
    }],
    tabBar: { list: [{ pagePath: 'pages/index/index' }] },
  }),
  'packageContent/pages/article-detail/article-detail.js': "const { contentService } = require('../../../services/content')\nconst load = (id) => contentService.getArticleDetail(id)",
  'packageContent/pages/article-detail/article-detail.json': '{"usingComponents":{}}',
  'packageContent/pages/article-detail/article-detail.wxml': '<view><rich-text nodes="{{article.content}}"></rich-text></view>',
  'packageContent/pages/article-detail/article-detail.wxss': '.page{}',
  ...overrides,
})

const run = async () => {
  // Route / opaque id.
  await test('detail route stays inside packageContent', () => assert.strictEqual(ARTICLE_DETAIL_ROUTE, '/packageContent/pages/article-detail/article-detail'))
  await test('build route encodes simple opaque id', () => assert.strictEqual(buildArticleDetailRoute('article-1001'), `${ARTICLE_DETAIL_ROUTE}?id=article-1001`))
  await test('build route encodes Chinese id', () => assert(buildArticleDetailRoute('文章一').includes(encodeURIComponent('文章一'))))
  await test('build route encodes id containing spaces', () => assert(buildArticleDetailRoute('article 1001').endsWith(`id=${encodeURIComponent('article 1001')}`)))
  await test('build route encodes slash id', () => assert(buildArticleDetailRoute('section/article').endsWith(`id=${encodeURIComponent('section/article')}`)))
  await test('build route encodes query special characters', () => assert(buildArticleDetailRoute('a?b=1&c=2').endsWith(`id=${encodeURIComponent('a?b=1&c=2')}`)))
  await test('parse route decodes encoded opaque id once', () => assert.strictEqual(parseArticleDetailRoute({ id: encodeURIComponent('a/b 中文') }).id, 'a/b 中文'))
  await test('percent-like opaque id is not double encoded across build and parse', () => {
    const id = 'literal%20id'
    const encoded = buildArticleDetailRoute(id).split('?id=')[1]
    assert.strictEqual(parseArticleDetailRoute({ id: encoded }).id, id)
  })
  await test('plain platform-decoded id remains readable', () => assert.strictEqual(parseArticleDetailRoute({ id: 'article 1' }).id, 'article 1'))
  await test('undefined route id is invalid', () => assert.strictEqual(parseArticleDetailRoute({}).ok, false))
  await test('null route id is invalid', () => assert.strictEqual(parseArticleDetailRoute({ id: null }).ok, false))
  await test('whitespace route id is invalid', () => assert.strictEqual(parseArticleDetailRoute({ id: '   ' }).ok, false))
  await test('build route rejects invalid id', () => assert.throws(() => buildArticleDetailRoute('   '), /article_id_required/))

  // Detail ViewModel.
  await test('detail view model maps title', () => assert.strictEqual(toArticleDetailViewModel(detail()).title, contractFixtures.articleDetail.title))
  await test('detail view model maps category', () => assert.strictEqual(toArticleDetailViewModel(detail()).category, contractFixtures.articleDetail.category))
  await test('detail view model preserves optional author', () => assert.strictEqual(toArticleDetailViewModel(detail()).author, contractFixtures.articleDetail.author))
  await test('detail view model allows author to be absent', () => {
    const source = detail()
    delete source.author
    assert.strictEqual(Object.prototype.hasOwnProperty.call(toArticleDetailViewModel(source), 'author'), false)
  })
  await test('detail cover https is visible', () => assert.deepStrictEqual([toArticleDetailViewModel(detail()).hasCover, toArticleDetailViewModel(detail()).coverVisible], [true, true]))
  await test('detail cover null is hidden safely', () => assert.deepStrictEqual([toArticleDetailViewModel(detail({ cover: null })).hasCover, toArticleDetailViewModel(detail({ cover: null })).coverVisible], [false, false]))
  await test('detail publish time formats as YYYY-MM-DD', () => assert.strictEqual(toArticleDetailViewModel(detail()).displayPublishTime, '2026-10-01'))
  await test('detail content remains exact original string', () => {
    const content = '<p>  保留正文空白 </p>\n<p><strong>第二段</strong></p>'
    assert.strictEqual(toArticleDetailViewModel(detail({ content })).content, content)
  })
  await test('detail view model does not mutate service object', () => {
    const source = detail()
    const before = JSON.stringify(source)
    toArticleDetailViewModel(source)
    assert.strictEqual(JSON.stringify(source), before)
  })
  await test('empty detail content cannot enter success view model', () => assert.throws(() => toArticleDetailViewModel(detail({ content: '' })), /article_content_required/))
  await test('whitespace detail content cannot enter success view model', () => assert.throws(() => toArticleDetailViewModel(detail({ content: '   ' })), /article_content_required/))

  // Error mapping.
  await test('client disabled maps to unavailable without retry', () => assert.deepStrictEqual([getContentDetailErrorView(failure('client_disabled')).state, getContentDetailErrorView(failure('client_disabled')).retryable], ['unavailable', false]))
  await test('CONTENT_NOT_FOUND maps to not_found', () => assert.strictEqual(getContentDetailErrorView(failure('business', { code: 20004 })).state, 'not_found'))
  await test('CONTENT_NOT_FOUND is not retryable', () => assert.strictEqual(getContentDetailErrorView(failure('business', { code: 20004 })).retryable, false))
  await test('transport maps to retryable error', () => assert.deepStrictEqual([getContentDetailErrorView(failure('transport', { retryable: true })).state, getContentDetailErrorView(failure('transport', { retryable: true })).retryable], ['error', true]))
  await test('HTTP retryable is preserved', () => assert.strictEqual(getContentDetailErrorView(failure('http', { retryable: true, statusCode: 503 })).retryable, true))
  await test('HTTP non-retryable is preserved', () => assert.strictEqual(getContentDetailErrorView(failure('http', { retryable: false, statusCode: 404 })).retryable, false))
  await test('other business error is generic user-safe error', () => assert.strictEqual(getContentDetailErrorView(failure('business', { code: 20099 })).title, '内容加载失败'))
  await test('contract error is generic user-safe error', () => assert.strictEqual(getContentDetailErrorView(failure('contract')).description, '请稍后再试'))

  // Page lifecycle / loading / retry.
  await test('detail page factory rejects invalid service', () => assert.throws(() => createArticleDetailPageDefinition({ service: {} }), /content_service_get_article_detail_required/))
  await test('detail initial state is initial', () => assert.strictEqual(createPageHarness(createQueueService([success()])).data.status, 'initial'))
  await test('valid id calls Content Service with decoded opaque id', async () => {
    const calls = []
    const page = createPageHarness(createQueueService([success()], calls))
    await page.onLoad({ id: encodeURIComponent('opaque/中文 id') })
    assert.deepStrictEqual(calls, ['opaque/中文 id'])
  })
  await test('invalid id never calls Content Service', async () => {
    const calls = []
    const page = createPageHarness(createQueueService([], calls))
    await page.onLoad({ id: '   ' })
    assert.deepStrictEqual(calls, [])
    assert.strictEqual(page.data.status, 'invalid')
  })
  await test('loading state is visible while detail is pending', async () => {
    const pending = deferred()
    const page = createPageHarness(createQueueService([pending.promise]))
    const promise = page.onLoad({ id: 'a' })
    assert.deepStrictEqual([page.data.status, page.data.isLoading], ['loading', true])
    pending.resolve(success())
    await promise
  })
  await test('detail success enters success state', async () => {
    const page = createPageHarness(createQueueService([success()]))
    await page.onLoad({ id: 'a' })
    assert.strictEqual(page.data.status, 'success')
    assert.strictEqual(page.data.article.id, contractFixtures.articleDetail.id)
  })
  await test('client disabled enters unavailable', async () => {
    const page = createPageHarness(createQueueService([failure('client_disabled')]))
    await page.onLoad({ id: 'a' })
    assert.strictEqual(page.data.status, 'unavailable')
  })
  await test('CONTENT_NOT_FOUND enters not_found', async () => {
    const page = createPageHarness(createQueueService([failure('business', { code: 20004 })]))
    await page.onLoad({ id: 'a' })
    assert.strictEqual(page.data.status, 'not_found')
  })
  await test('transport error enters retryable error', async () => {
    const page = createPageHarness(createQueueService([failure('transport', { retryable: true })]))
    await page.onLoad({ id: 'a' })
    assert.deepStrictEqual([page.data.status, page.data.errorView.retryable], ['error', true])
  })
  await test('HTTP 503 error can retry', async () => {
    const page = createPageHarness(createQueueService([failure('http', { retryable: true, statusCode: 503 })]))
    await page.onLoad({ id: 'a' })
    assert.strictEqual(page.data.errorView.retryable, true)
  })
  await test('other business error stays generic error', async () => {
    const page = createPageHarness(createQueueService([failure('business', { code: 20099 })]))
    await page.onLoad({ id: 'a' })
    assert.strictEqual(page.data.status, 'error')
  })
  await test('contract error stays generic error', async () => {
    const page = createPageHarness(createQueueService([failure('contract')]))
    await page.onLoad({ id: 'a' })
    assert.strictEqual(page.data.status, 'error')
  })
  await test('thrown service error maps to retryable transport error', async () => {
    const page = createPageHarness({ getArticleDetail: async () => { throw new Error('private transport detail') } })
    await page.onLoad({ id: 'a' })
    assert.deepStrictEqual([page.data.status, page.data.errorView.retryable], ['error', true])
  })
  await test('retryable error reloads current article id', async () => {
    const calls = []
    const page = createPageHarness(createQueueService([failure('transport', { retryable: true }), success()], calls))
    await page.onLoad({ id: 'article-x' })
    await page.onRetry()
    assert.deepStrictEqual(calls, ['article-x', 'article-x'])
    assert.strictEqual(page.data.status, 'success')
  })
  await test('client disabled retry action does not issue request', async () => {
    const calls = []
    const page = createPageHarness(createQueueService([failure('client_disabled')], calls))
    await page.onLoad({ id: 'a' })
    await page.onRetry()
    assert.strictEqual(calls.length, 1)
  })
  await test('not found retry action does not issue request', async () => {
    const calls = []
    const page = createPageHarness(createQueueService([failure('business', { code: 20004 })], calls))
    await page.onLoad({ id: 'a' })
    await page.onRetry()
    assert.strictEqual(calls.length, 1)
  })
  await test('loading prevents duplicate retry request', async () => {
    const pending = deferred()
    const calls = []
    const page = createPageHarness(createQueueService([pending.promise], calls))
    const first = page.onLoad({ id: 'a' })
    await page.onRetry()
    assert.strictEqual(calls.length, 1)
    pending.resolve(success())
    await first
  })
  await test('newer detail load is not overwritten by stale request', async () => {
    const oldRequest = deferred()
    const newRequest = deferred()
    const page = createPageHarness(createQueueService([oldRequest.promise, newRequest.promise]))
    const oldPromise = page.onLoad({ id: 'a' })
    const newPromise = page.loadArticle({ force: true })
    newRequest.resolve(success({ title: '新结果' }))
    await newPromise
    oldRequest.resolve(success({ title: '旧结果' }))
    await oldPromise
    assert.strictEqual(page.data.article.title, '新结果')
  })
  await test('unload invalidates pending detail result', async () => {
    const pending = deferred()
    const page = createPageHarness(createQueueService([pending.promise]))
    const promise = page.onLoad({ id: 'a' })
    const countBeforeUnload = page._setDataCount
    page.onUnload()
    pending.resolve(success({ title: '迟到结果' }))
    await promise
    assert.strictEqual(page._setDataCount, countBeforeUnload)
  })
  await test('cover failure hides cover without removing article', async () => {
    const page = createPageHarness(createQueueService([success()]))
    await page.onLoad({ id: 'a' })
    page.onCoverError()
    assert.strictEqual(page.data.article.coverVisible, false)
    assert.strictEqual(page.data.article.title, contractFixtures.articleDetail.title)
  })
  await test('empty content response does not enter success state', async () => {
    const page = createPageHarness(createQueueService([success({ content: '' })]))
    await page.onLoad({ id: 'a' })
    assert.strictEqual(page.data.status, 'error')
  })
  await test('default Content Service remains unavailable with Remote disabled', async () => {
    const pageDefinition = createArticleDetailPageDefinition()
    const page = { ...pageDefinition, data: { ...pageDefinition.data }, setData(patch) { this.data = { ...this.data, ...patch } } }
    await page.onLoad({ id: 'article-1001' })
    assert.strictEqual(page.data.status, 'unavailable')
  })
  await test('development Remote remains false', () => assert.strictEqual(getEnvironment('development').remoteApiEnabled, false))
  await test('production Remote remains false', () => assert.strictEqual(getEnvironment('production').remoteApiEnabled, false))

  // List -> detail native navigation.
  await test('article card tap navigates to native detail route', () => {
    const definition = createArticlesPageDefinition({ service: { getArticles: async () => ({ ok: false, error: { type: 'client_disabled' } }) } })
    let captured = null
    const previousWx = global.wx
    global.wx = { navigateTo(options) { captured = options } }
    try {
      definition.onArticleTap({ currentTarget: { dataset: { id: 'opaque/中文 id' } } })
    } finally {
      if (previousWx === undefined) delete global.wx
      else global.wx = previousWx
    }
    assert(captured)
    assert.strictEqual(captured.url, buildArticleDetailRoute('opaque/中文 id'))
  })
  await test('list navigation route carries only id query', () => {
    const route = buildArticleDetailRoute('article-1')
    assert(/^\/packageContent\/pages\/article-detail\/article-detail\?id=[^&]+$/.test(route))
    assert(!/title=|content=|article=/.test(route))
  })
  await test('invalid list article id does not navigate', () => {
    const definition = createArticlesPageDefinition({ service: { getArticles: async () => ({ ok: false, error: { type: 'client_disabled' } }) } })
    let calls = 0
    const previousWx = global.wx
    global.wx = { navigateTo() { calls += 1 } }
    try {
      definition.onArticleTap({ currentTarget: { dataset: { id: '   ' } } })
    } finally {
      if (previousWx === undefined) delete global.wx
      else global.wx = previousWx
    }
    assert.strictEqual(calls, 0)
  })

  // Static rules / actual registration / security.
  await test('valid detail fixture passes static rules', () => assert.deepStrictEqual(validateContentDetailPageSources(detailStaticFixture()), []))
  await test('detail static rule rejects direct wx.request', () => assert(validateContentDetailPageSources(detailStaticFixture({ 'packageContent/pages/article-detail/article-detail.js': "const { contentService } = require('../../../services/content'); wx.request({})" })).some((item) => item.includes('网络请求'))))
  await test('detail static rule rejects fetch', () => assert(validateContentDetailPageSources(detailStaticFixture({ 'packageContent/pages/article-detail/article-detail.js': "const { contentService } = require('../../../services/content'); fetch('x')" })).some((item) => item.includes('网络请求'))))
  await test('detail static rule rejects Storage write', () => assert(validateContentDetailPageSources(detailStaticFixture({ 'packageContent/pages/article-detail/article-detail.js': "const { contentService } = require('../../../services/content'); wx.setStorageSync('x', 1)" })).some((item) => item.includes('Storage'))))
  await test('detail static rule rejects fixture import', () => assert(validateContentDetailPageSources(detailStaticFixture({ 'packageContent/pages/article-detail/article-detail.js': "const { contentService } = require('../../../services/content'); const f=require('../../../scripts/fixtures/x')" })).some((item) => item.includes('fixtures'))))
  await test('detail static rule rejects WordPress direct path', () => assert(validateContentDetailPageSources(detailStaticFixture({ 'packageContent/pages/article-detail/article-detail.js': "const { contentService } = require('../../../services/content'); const p='/wp-json/wp/v2/posts'" })).some((item) => item.includes('Provider'))))
  await test('detail static rule rejects full server URL', () => assert(validateContentDetailPageSources(detailStaticFixture({ 'packageContent/pages/article-detail/article-detail.js': "const { contentService } = require('../../../services/content'); const p='https://server.example.com/api/v1/content/articles/1'" })).some((item) => item.includes('Server'))))
  await test('detail static rule rejects API Client direct dependency', () => assert(validateContentDetailPageSources(detailStaticFixture({ 'packageContent/pages/article-detail/article-detail.js': "const { contentService } = require('../../../services/content'); const c=require('../../../utils/api-client')" })).some((item) => item.includes('API Client'))))
  await test('detail static rule rejects WebView', () => assert(validateContentDetailPageSources(detailStaticFixture({ 'packageContent/pages/article-detail/article-detail.wxml': '<web-view src="x" />' })).some((item) => item.includes('WebView'))))
  await test('detail static rule requires rich-text', () => assert(validateContentDetailPageSources(detailStaticFixture({ 'packageContent/pages/article-detail/article-detail.wxml': '<view>{{article.content}}</view>' })).some((item) => item.includes('rich-text'))))
  await test('detail static rule rejects eval', () => assert(validateContentDetailPageSources(detailStaticFixture({ 'packageContent/pages/article-detail/article-detail.js': "const { contentService } = require('../../../services/content'); eval('x')" })).some((item) => item.includes('eval'))))
  await test('detail static rule rejects new Function', () => assert(validateContentDetailPageSources(detailStaticFixture({ 'packageContent/pages/article-detail/article-detail.js': "const { contentService } = require('../../../services/content'); const x = new Function('return 1')" })).some((item) => item.includes('new Function'))))
  await test('detail static rule rejects HTML parser import', () => assert(validateContentDetailPageSources(detailStaticFixture({ 'packageContent/pages/article-detail/article-detail.js': "const { contentService } = require('../../../services/content'); const parser=require('sanitize-html')" })).some((item) => item.includes('HTML Parser'))))
  await test('detail static rule rejects missing app registration', () => assert(validateContentDetailPageSources(detailStaticFixture({ 'app.json': JSON.stringify({ subPackages: [{ root: 'packageContent', pages: ['pages/articles/articles'] }], tabBar: { list: [] } }) })).some((item) => item.includes('正确注册'))))
  await test('detail static rule rejects packageContent in TabBar', () => assert(validateContentDetailPageSources(detailStaticFixture({ 'app.json': JSON.stringify({ subPackages: [{ root: 'packageContent', pages: ['pages/articles/articles', 'pages/article-detail/article-detail'] }], tabBar: { list: [{ pagePath: 'packageContent/pages/article-detail/article-detail' }] } }) })).some((item) => item.includes('TabBar'))))
  await test('actual detail page four files exist', () => {
    ;['js', 'json', 'wxml', 'wxss'].forEach((extension) => assert(fs.existsSync(path.join(ROOT, `packageContent/pages/article-detail/article-detail.${extension}`))))
  })
  await test('actual app registers article detail inside packageContent', () => {
    const appConfig = JSON.parse(read('app.json'))
    const contentPackage = appConfig.subPackages.find((item) => item.root === 'packageContent')
    assert(contentPackage.pages.includes('pages/article-detail/article-detail'))
  })
  await test('actual registered page count is 36', () => {
    const appConfig = JSON.parse(read('app.json'))
    const count = appConfig.pages.length + appConfig.subPackages.reduce((sum, item) => sum + item.pages.length, 0)
    assert.strictEqual(count, 36)
  })
  await test('actual packageContent remains outside TabBar', () => {
    const appConfig = JSON.parse(read('app.json'))
    assert(!appConfig.tabBar.list.some((item) => String(item.pagePath).startsWith('packageContent/')))
  })
  await test('actual homepage still has no Content entry', () => assert(!/packageContent\//.test(`${read('pages/index/index.js')}\n${read('pages/index/index.wxml')}`)))
  await test('actual discover page still has no Content entry', () => assert(!/packageContent\//.test(`${read('pages/discover/discover.js')}\n${read('pages/discover/discover.wxml')}`)))
  await test('actual list card binds native detail navigation by id only', () => {
    const source = read('packageContent/pages/articles/articles.wxml')
    assert(/data-id="\{\{item\.id\}\}"/.test(source))
    assert(/bindtap="onArticleTap"/.test(source))
    assert(!/data-article=|data-content=/.test(source))
  })
  await test('actual detail uses rich-text and never web-view', () => {
    const source = read('packageContent/pages/article-detail/article-detail.wxml')
    assert(/<rich-text\b/.test(source))
    assert(/nodes="\{\{article\.content\}\}"/.test(source))
    assert(!/<web-view\b/i.test(source))
  })
  await test('actual detail JS has no direct network or Storage write', () => {
    const source = read('packageContent/pages/article-detail/article-detail.js')
    assert(!/wx\.request\s*\(|wx\.uploadFile\s*\(|\bfetch\s*\(|XMLHttpRequest|wx\.setStorage|wx\.removeStorage|wx\.clearStorage/.test(source))
  })
  await test('actual detail source has no fixture, provider URL, eval, Function, or share hook', () => {
    const source = `${read('packageContent/pages/article-detail/article-detail.js')}\n${read('packageContent/pages/article-detail/article-detail.wxml')}`
    assert(!/scripts\/fixtures\/|\/wp-json\/|wanluu\.com|api\.github\.com|\beval\s*\(|\bnew\s+Function\s*\(|onShareAppMessage|onShareTimeline/.test(source))
  })

  console.log(`Stage 5 Content Detail tests: PASS (${passed} cases)`)
}

run().catch((error) => {
  console.error(error.stack || error.message)
  process.exit(1)
})
