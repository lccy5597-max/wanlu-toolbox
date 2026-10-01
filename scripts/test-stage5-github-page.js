const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { getEnvironment } = require('../config/environment')
const {
  GITHUB_PERIOD_TABS,
  buildGithubRankingView,
  createGithubRankingItemViewModel,
  formatGithubStars,
  formatGithubUpdatedDate,
  getGithubPeriodTabs,
  isGithubPeriod,
  mapGithubRankingError,
} = require('../utils/github-ranking-view-model')
const {
  DEFAULT_PERIOD,
  PAGE,
  PAGE_SIZE,
  createGithubPageDefinition,
} = require('../packageGithub/pages/index/index')
const {
  validateGithubControlledSources,
  validateGithubPageSources,
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

const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8')
const clone = (value) => JSON.parse(JSON.stringify(value))

const repo = (id, overrides = {}) => ({
  id,
  name: `repo-${id}`,
  fullName: `example/repo-${id}`,
  description: `Repository ${id}`,
  author: 'example',
  stars: Number(id) || 0,
  language: 'JavaScript',
  url: `https://github.com/example/repo-${encodeURIComponent(id)}`,
  updatedAt: '2026-10-01T00:00:00Z',
  ...overrides,
})

const success = (period, items = [repo('1')], pagination = {}) => ({
  ok: true,
  code: 0,
  message: 'ok',
  data: {
    period,
    items,
    pagination: {
      page: 1,
      pageSize: PAGE_SIZE,
      total: pagination.total === undefined ? items.length : pagination.total,
      hasMore: Boolean(pagination.hasMore),
    },
  },
  meta: {},
})

const failure = (type, options = {}) => ({
  ok: false,
  code: options.code === undefined ? 'TEST_ERROR' : options.code,
  message: options.message || 'test_error',
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
  getRankings: (period, options) => {
    calls.push({ period, options: { ...options } })
    if (!queue.length) throw new Error('fake_github_service_queue_empty')
    const next = queue.shift()
    return typeof next === 'function' ? next(period, options) : next
  },
})

const createPageHarness = (service) => {
  const definition = createGithubPageDefinition({ service })
  return {
    ...definition,
    data: {
      ...definition.data,
      tabs: definition.data.tabs.map((item) => ({ ...item })),
      items: definition.data.items.slice(),
    },
    _setDataCount: 0,
    setData(patch) {
      this._setDataCount += 1
      this.data = { ...this.data, ...patch }
    },
  }
}

const periodEvent = (period) => ({ currentTarget: { dataset: { period } } })

const actualStaticSources = () => ({
  'app.json': read('app.json'),
  'services/github.js': read('services/github.js'),
  'utils/github-ranking-view-model.js': read('utils/github-ranking-view-model.js'),
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
  // ViewModel: periods.
  await test('period tabs are exactly three', () => assert.strictEqual(GITHUB_PERIOD_TABS.length, 3))
  await test('period values are daily weekly all', () => assert.deepStrictEqual(GITHUB_PERIOD_TABS.map((item) => item.value), ['daily', 'weekly', 'all']))
  await test('daily label is 今日', () => assert.strictEqual(GITHUB_PERIOD_TABS[0].label, '今日'))
  await test('weekly label is 本周', () => assert.strictEqual(GITHUB_PERIOD_TABS[1].label, '本周'))
  await test('all label is 总榜', () => assert.strictEqual(GITHUB_PERIOD_TABS[2].label, '总榜'))
  await test('getGithubPeriodTabs returns independent objects', () => {
    const first = getGithubPeriodTabs()
    first[0].label = 'changed'
    assert.strictEqual(getGithubPeriodTabs()[0].label, '今日')
  })
  for (const period of ['daily', 'weekly', 'all']) {
    await test(`${period} is accepted by ViewModel period guard`, () => assert.strictEqual(isGithubPeriod(period), true))
  }
  await test('today alias is rejected by ViewModel period guard', () => assert.strictEqual(isGithubPeriod('today'), false))
  await test('uppercase period is rejected by ViewModel period guard', () => assert.strictEqual(isGithubPeriod('DAILY'), false))

  // ViewModel: stars/date/optional fields.
  await test('stars 0 stays integer text', () => assert.strictEqual(formatGithubStars(0), '0'))
  await test('stars 999 stays integer text', () => assert.strictEqual(formatGithubStars(999), '999'))
  await test('stars 1000 becomes 1k', () => assert.strictEqual(formatGithubStars(1000), '1k'))
  await test('stars 1250 becomes 1.3k', () => assert.strictEqual(formatGithubStars(1250), '1.3k'))
  await test('stars 12000 becomes 12k', () => assert.strictEqual(formatGithubStars(12000), '12k'))
  await test('stars 12500 becomes 12.5k', () => assert.strictEqual(formatGithubStars(12500), '12.5k'))
  await test('stars 1000000 becomes 1m', () => assert.strictEqual(formatGithubStars(1000000), '1m'))
  await test('stars invalid value becomes empty text', () => assert.strictEqual(formatGithubStars(-1), ''))
  await test('updatedAt formats as YYYY-MM-DD', () => assert.strictEqual(formatGithubUpdatedDate('2026-10-01T08:30:00+08:00'), '2026-10-01'))
  await test('invalid updatedAt becomes empty text', () => assert.strictEqual(formatGithubUpdatedDate('not-a-date'), ''))
  await test('first item rank is 1', () => assert.strictEqual(createGithubRankingItemViewModel(repo('1'), 0).rank, 1))
  await test('fifth item rank is 5', () => assert.strictEqual(createGithubRankingItemViewModel(repo('5'), 4).rank, 5))
  await test('description string remains visible', () => assert.strictEqual(createGithubRankingItemViewModel(repo('1')).hasDescription, true))
  await test('description null is hidden', () => assert.strictEqual(createGithubRankingItemViewModel(repo('1', { description: null })).hasDescription, false))
  await test('language string remains visible', () => assert.strictEqual(createGithubRankingItemViewModel(repo('1')).hasLanguage, true))
  await test('language null is hidden', () => assert.strictEqual(createGithubRankingItemViewModel(repo('1', { language: null })).hasLanguage, false))
  await test('ViewModel keeps original stars value', () => assert.strictEqual(createGithubRankingItemViewModel(repo('1', { stars: 1250 })).stars, 1250))
  await test('ViewModel does not expose repository URL as UI field', () => assert.strictEqual(Object.prototype.hasOwnProperty.call(createGithubRankingItemViewModel(repo('1')), 'url'), false))
  await test('ranking view preserves server item order', () => {
    const items = [repo('a', { stars: 1 }), repo('b', { stars: 999999 })]
    assert.deepStrictEqual(buildGithubRankingView(items).map((item) => item.id), ['a', 'b'])
  })
  await test('ranking ViewModel does not mutate input', () => {
    const items = [repo('1')]
    const before = JSON.stringify(items)
    buildGithubRankingView(items)
    assert.strictEqual(JSON.stringify(items), before)
  })
  await test('ranking ViewModel returns new objects', () => {
    const source = repo('1')
    assert.notStrictEqual(buildGithubRankingView([source])[0], source)
  })
  await test('ranking ViewModel does not sort or calculate trending', () => assert(!/\.sort\s*\(|trending\s*score|trendingScore|trendScore/i.test(read('utils/github-ranking-view-model.js'))))
  await test('ranking ViewModel has no wx Storage or Service dependency', () => assert(!/\bwx\.|storage\.|services\/github|api\.github\.com/i.test(read('utils/github-ranking-view-model.js'))))

  // Error ViewModel.
  await test('client_disabled maps to unavailable state', () => assert.strictEqual(mapGithubRankingError(failure('client_disabled')).state, 'unavailable'))
  await test('client_disabled is not retryable', () => assert.strictEqual(mapGithubRankingError(failure('client_disabled', { retryable: true })).retryable, false))
  await test('transport retryable is preserved', () => assert.strictEqual(mapGithubRankingError(failure('transport', { retryable: true })).retryable, true))
  await test('HTTP retryable is preserved', () => assert.strictEqual(mapGithubRankingError(failure('http', { retryable: true, statusCode: 503 })).retryable, true))
  await test('GITHUB_UPSTREAM_ERROR maps to unavailable copy without exposing code', () => {
    const view = mapGithubRankingError(failure('business', { code: 30054 }))
    assert.strictEqual(view.title, '榜单暂不可用')
    assert(!JSON.stringify(view).includes('30054'))
  })
  await test('contract error is not retryable', () => assert.strictEqual(mapGithubRankingError(failure('contract', { retryable: true })).retryable, false))

  // Page construction / fixed first page.
  await test('createGithubPageDefinition accepts injected service', () => assert.strictEqual(typeof createGithubPageDefinition({ service: createQueueService([success('daily')]) }).loadPeriod, 'function'))
  await test('createGithubPageDefinition rejects invalid service', () => assert.throws(() => createGithubPageDefinition({ service: {} }), /github_service_get_rankings_required/))
  await test('default period is daily', () => assert.strictEqual(DEFAULT_PERIOD, 'daily'))
  await test('page is fixed to first page', () => assert.strictEqual(PAGE, 1))
  await test('page size is fixed to five', () => assert.strictEqual(PAGE_SIZE, 5))
  await test('page initial state is initial', () => assert.strictEqual(createPageHarness(createQueueService([success('daily')])).data.status, 'initial'))
  await test('page initial selected period is daily', () => assert.strictEqual(createPageHarness(createQueueService([success('daily')])).data.selectedPeriod, 'daily'))
  await test('page has exactly three tabs', () => assert.strictEqual(createPageHarness(createQueueService([success('daily')])).data.tabs.length, 3))
  await test('packageGithub index four files exist', () => {
    ;['index.js', 'index.json', 'index.wxml', 'index.wxss'].forEach((name) => assert(fs.existsSync(path.join(ROOT, 'packageGithub/pages/index', name))))
  })
  await test('packageGithub remains one registered page', () => {
    const app = JSON.parse(read('app.json'))
    const pkg = app.subPackages.find((item) => item.root === 'packageGithub')
    assert.deepStrictEqual(pkg.pages, ['pages/index/index'])
  })
  await test('registered page count remains 36', () => {
    const app = JSON.parse(read('app.json'))
    assert.strictEqual(app.pages.length + app.subPackages.reduce((sum, item) => sum + item.pages.length, 0), 36)
  })
  await test('onLoad requests daily page 1 pageSize 5', async () => {
    const calls = []
    const page = createPageHarness(createQueueService([success('daily')], calls))
    await page.onLoad()
    assert.deepStrictEqual(calls[0], { period: 'daily', options: { page: 1, pageSize: 5 } })
  })
  await test('loading state is visible while request is pending', async () => {
    const task = deferred()
    const page = createPageHarness(createQueueService([task.promise]))
    const pending = page.onLoad()
    assert.strictEqual(page.data.status, 'loading')
    assert.strictEqual(page.data.isLoading, true)
    task.resolve(success('daily'))
    await pending
  })
  await test('successful request enters success state', async () => {
    const page = createPageHarness(createQueueService([success('daily', [repo('1')])]))
    await page.onLoad()
    assert.deepStrictEqual([page.data.status, page.data.items.length], ['success', 1])
  })
  await test('empty ranking enters empty state', async () => {
    const page = createPageHarness(createQueueService([success('daily', [])]))
    await page.onLoad()
    assert.deepStrictEqual([page.data.status, page.data.items.length], ['empty', 0])
  })
  await test('client_disabled enters unavailable state', async () => {
    const page = createPageHarness(createQueueService([failure('client_disabled', { code: 'REMOTE_DISABLED' })]))
    await page.onLoad()
    assert.deepStrictEqual([page.data.status, page.data.errorView.retryable], ['unavailable', false])
  })
  await test('transport error enters error state', async () => {
    const page = createPageHarness(createQueueService([failure('transport', { retryable: true })]))
    await page.onLoad()
    assert.deepStrictEqual([page.data.status, page.data.errorView.retryable], ['error', true])
  })
  await test('GITHUB_UPSTREAM_ERROR enters error not empty', async () => {
    const page = createPageHarness(createQueueService([failure('business', { code: 30054 })]))
    await page.onLoad()
    assert.strictEqual(page.data.status, 'error')
    assert.strictEqual(page.data.errorView.title, '榜单暂不可用')
  })
  await test('contract error enters non-retryable error state', async () => {
    const page = createPageHarness(createQueueService([failure('contract', { retryable: true })]))
    await page.onLoad()
    assert.deepStrictEqual([page.data.status, page.data.errorView.retryable], ['error', false])
  })
  await test('thrown service error maps to retryable transport error', async () => {
    const page = createPageHarness({ getRankings: async () => { throw new Error('private detail') } })
    await page.onLoad()
    assert.deepStrictEqual([page.data.status, page.data.errorView.retryable], ['error', true])
  })
  await test('page displays at most first five returned repositories', async () => {
    const items = [1, 2, 3, 4, 5, 6].map((id) => repo(String(id)))
    const page = createPageHarness(createQueueService([success('daily', items, { total: 6, hasMore: true })]))
    await page.onLoad()
    assert.deepStrictEqual(page.data.items.map((item) => item.id), ['1', '2', '3', '4', '5'])
  })
  await test('page preserves service order even when stars differ', async () => {
    const items = [repo('low', { stars: 1 }), repo('high', { stars: 999999 })]
    const page = createPageHarness(createQueueService([success('daily', items)]))
    await page.onLoad()
    assert.deepStrictEqual(page.data.items.map((item) => item.id), ['low', 'high'])
  })

  // Tabs / retries / no second page.
  await test('daily switches to weekly using weekly service period', async () => {
    const calls = []
    const page = createPageHarness(createQueueService([success('daily'), success('weekly')], calls))
    await page.onLoad()
    await page.onPeriodTap(periodEvent('weekly'))
    assert.strictEqual(calls[1].period, 'weekly')
    assert.strictEqual(page.data.selectedPeriod, 'weekly')
  })
  await test('weekly switches to all', async () => {
    const page = createPageHarness(createQueueService([success('daily'), success('weekly'), success('all')]))
    await page.onLoad(); await page.onPeriodTap(periodEvent('weekly')); await page.onPeriodTap(periodEvent('all'))
    assert.strictEqual(page.data.selectedPeriod, 'all')
  })
  await test('all switches back to daily', async () => {
    const page = createPageHarness(createQueueService([success('daily'), success('all'), success('daily')]))
    await page.onLoad(); await page.onPeriodTap(periodEvent('all')); await page.onPeriodTap(periodEvent('daily'))
    assert.strictEqual(page.data.selectedPeriod, 'daily')
  })
  await test('invalid tab period is ignored', async () => {
    const calls = []
    const page = createPageHarness(createQueueService([success('daily')], calls))
    await page.onLoad(); await page.onPeriodTap(periodEvent('today'))
    assert.strictEqual(calls.length, 1)
  })
  await test('tapping already selected loaded tab does not duplicate request', async () => {
    const calls = []
    const page = createPageHarness(createQueueService([success('daily')], calls))
    await page.onLoad(); await page.onPeriodTap(periodEvent('daily'))
    assert.strictEqual(calls.length, 1)
  })
  await test('all page requests always use page 1', async () => {
    const calls = []
    const page = createPageHarness(createQueueService([success('daily'), success('weekly'), success('all')], calls))
    await page.onLoad(); await page.onPeriodTap(periodEvent('weekly')); await page.onPeriodTap(periodEvent('all'))
    assert(calls.every((call) => call.options.page === 1))
  })
  await test('all page requests always use pageSize 5', async () => {
    const calls = []
    const page = createPageHarness(createQueueService([success('daily'), success('weekly')], calls))
    await page.onLoad(); await page.onPeriodTap(periodEvent('weekly'))
    assert(calls.every((call) => call.options.pageSize === 5))
  })
  await test('page never requests page 2 even when hasMore true', async () => {
    const calls = []
    const page = createPageHarness(createQueueService([success('daily', [repo('1')], { total: 20, hasMore: true })], calls))
    await page.onLoad()
    assert.strictEqual(calls.length, 1)
    assert.strictEqual(calls[0].options.page, 1)
  })
  await test('retryable error can retry current period', async () => {
    const calls = []
    const page = createPageHarness(createQueueService([failure('transport', { retryable: true }), success('daily')], calls))
    await page.onLoad(); await page.onRetry()
    assert.strictEqual(calls.length, 2)
    assert.strictEqual(page.data.status, 'success')
  })
  await test('retry after weekly error requests weekly again', async () => {
    const calls = []
    const page = createPageHarness(createQueueService([success('daily'), failure('http', { retryable: true }), success('weekly')], calls))
    await page.onLoad(); await page.onPeriodTap(periodEvent('weekly')); await page.onRetry()
    assert.strictEqual(calls[2].period, 'weekly')
  })
  await test('client_disabled does not retry', async () => {
    const calls = []
    const page = createPageHarness(createQueueService([failure('client_disabled')], calls))
    await page.onLoad(); await page.onRetry()
    assert.strictEqual(calls.length, 1)
  })
  await test('contract error does not retry', async () => {
    const calls = []
    const page = createPageHarness(createQueueService([failure('contract')], calls))
    await page.onLoad(); await page.onRetry()
    assert.strictEqual(calls.length, 1)
  })
  await test('retry is ignored while loading', async () => {
    const task = deferred()
    const calls = []
    const page = createPageHarness(createQueueService([task.promise], calls))
    const pending = page.onLoad()
    page.data.errorView = { retryable: true }
    await page.onRetry()
    assert.strictEqual(calls.length, 1)
    task.resolve(success('daily'))
    await pending
  })

  // Async stale request / unload protection.
  await test('stale daily result cannot overwrite newer weekly tab', async () => {
    const daily = deferred()
    const weekly = deferred()
    const page = createPageHarness(createQueueService([daily.promise, weekly.promise]))
    const dailyPromise = page.onLoad()
    const weeklyPromise = page.onPeriodTap(periodEvent('weekly'))
    daily.resolve(success('daily', [repo('daily')]))
    await dailyPromise
    assert.strictEqual(page.data.selectedPeriod, 'weekly')
    assert.strictEqual(page.data.items.length, 0)
    weekly.resolve(success('weekly', [repo('weekly')]))
    await weeklyPromise
    assert.deepStrictEqual(page.data.items.map((item) => item.id), ['weekly'])
  })
  await test('rapid daily weekly all daily keeps last daily result', async () => {
    const tasks = [deferred(), deferred(), deferred(), deferred()]
    const page = createPageHarness(createQueueService(tasks.map((item) => item.promise)))
    const p1 = page.onLoad()
    const p2 = page.onPeriodTap(periodEvent('weekly'))
    const p3 = page.onPeriodTap(periodEvent('all'))
    const p4 = page.onPeriodTap(periodEvent('daily'))
    tasks[2].resolve(success('all', [repo('all-old')]))
    tasks[0].resolve(success('daily', [repo('daily-old')]))
    tasks[1].resolve(success('weekly', [repo('weekly-old')]))
    await Promise.all([p1, p2, p3])
    assert.strictEqual(page.data.selectedPeriod, 'daily')
    assert.strictEqual(page.data.items.length, 0)
    tasks[3].resolve(success('daily', [repo('daily-final')]))
    await p4
    assert.deepStrictEqual(page.data.items.map((item) => item.id), ['daily-final'])
  })
  await test('page unload prevents pending request state update', async () => {
    const task = deferred()
    const page = createPageHarness(createQueueService([task.promise]))
    const pending = page.onLoad()
    const beforeUnloadCount = page._setDataCount
    page.onUnload()
    task.resolve(success('daily', [repo('late')]))
    await pending
    assert.strictEqual(page._setDataCount, beforeUnloadCount)
  })

  // Security / static boundaries.
  await test('packageGithub page calls GitHub Service', () => assert(read('packageGithub/pages/index/index.js').includes("require('../../../services/github')")))
  await test('packageGithub page does not import API infrastructure', () => assert(!/utils\/api-(?:client|transport|schema)|config\/api-endpoints/.test(read('packageGithub/pages/index/index.js'))))
  await test('packageGithub page has no direct wx.request', () => assert(!/wx\.request\s*\(/.test(read('packageGithub/pages/index/index.js'))))
  await test('packageGithub page has no fetch or XMLHttpRequest', () => assert(!/\bfetch\s*\(|XMLHttpRequest/.test(read('packageGithub/pages/index/index.js'))))
  await test('packageGithub page has no api.github.com', () => assert(!/api\.github\.com/i.test(`${read('packageGithub/pages/index/index.js')}\n${read('packageGithub/pages/index/index.wxml')}`)))
  await test('packageGithub page has no GitHub token material', () => assert(!/github[_-]?(?:token|pat)|github_pat_|ghp_|Authorization\s*[:=]/i.test(read('packageGithub/pages/index/index.js'))))
  await test('packageGithub page has no Storage access', () => assert(!/wx\.(?:getStorage|setStorage|removeStorage|clearStorage)|\bstorage\.|wl_github_|wl_content_cache/.test(read('packageGithub/pages/index/index.js'))))
  await test('packageGithub page does not import fixture', () => assert(!/scripts\/fixtures|fixtures\/stage5/.test(read('packageGithub/pages/index/index.js'))))
  await test('packageGithub page does not use WebView', () => assert(!/<web-view\b/i.test(read('packageGithub/pages/index/index.wxml'))))
  await test('packageGithub page does not use Repo Avatar or remote image', () => assert(!/<image\b/i.test(read('packageGithub/pages/index/index.wxml'))))
  await test('packageGithub page does not bind repository card click', () => assert(!/repo-card[^>]*bind(?:tap|:tap)/i.test(read('packageGithub/pages/index/index.wxml'))))
  await test('packageGithub page does not expose URL copy/open actions', () => assert(!/setClipboardData|openEmbeddedMiniProgram|navigateToMiniProgram|data-url/i.test(`${read('packageGithub/pages/index/index.js')}\n${read('packageGithub/pages/index/index.wxml')}`)))
  await test('packageGithub page has no production fake repository array', () => assert(!/\bfullName\s*:\s*['"][^'"]+['"]|\bstars\s*:\s*\d+/.test(read('packageGithub/pages/index/index.js'))))
  await test('packageGithub page source has no client-side sort or trending score', () => assert(!/\.sort\s*\(|trending\s*score|trendingScore|trendScore/i.test(read('packageGithub/pages/index/index.js'))))
  await test('GitHub page no longer contains skeleton copy', () => assert(!/开发中|敬请期待|Skeleton|当前尚未开放榜单数据/.test(read('packageGithub/pages/index/index.wxml'))))
  await test('GitHub page title is GitHub 榜单', () => assert(read('packageGithub/pages/index/index.wxml').includes('title="GitHub 榜单"')))
  await test('homepage still has no GitHub entry', () => assert(!/packageGithub\/|services\/github/.test(`${read('pages/index/index.js')}\n${read('pages/index/index.wxml')}`)))
  await test('discover page still has no GitHub entry', () => assert(!/packageGithub\/|services\/github/.test(`${read('pages/discover/discover.js')}\n${read('pages/discover/discover.wxml')}`)))
  await test('TabBar still has no GitHub entry', () => {
    const app = JSON.parse(read('app.json'))
    assert(!app.tabBar.list.some((item) => String(item.pagePath || '').startsWith('packageGithub/')))
  })
  await test('development Remote remains false', () => assert.strictEqual(getEnvironment('development').remoteApiEnabled, false))
  await test('production Remote remains false', () => assert.strictEqual(getEnvironment('production').remoteApiEnabled, false))

  // Static rule coverage.
  await test('actual GitHub controlled sources pass', () => assert.deepStrictEqual(validateGithubControlledSources(actualStaticSources()), []))
  await test('actual GitHub page sources pass', () => assert.deepStrictEqual(validateGithubPageSources(actualStaticSources()), []))
  await test('static rejects direct page wx.request', () => {
    const sources = actualStaticSources(); sources['packageGithub/pages/index/index.js'] += '\nwx.request({})'
    assert(validateGithubControlledSources(sources).some((item) => item.includes('网络请求')))
  })
  await test('static rejects API Client dependency in page', () => {
    const sources = actualStaticSources(); sources['packageGithub/pages/index/index.js'] += "\nrequire('../../../utils/api-client')"
    assert(validateGithubControlledSources(sources).some((item) => item.includes('API Client')))
  })
  await test('static rejects Storage write in page', () => {
    const sources = actualStaticSources(); sources['packageGithub/pages/index/index.js'] += '\nwx.setStorageSync("x", 1)'
    assert(validateGithubControlledSources(sources).some((item) => item.includes('Storage')))
  })
  await test('static rejects fixture import in page', () => {
    const sources = actualStaticSources(); sources['packageGithub/pages/index/index.js'] += "\nrequire('../../../scripts/fixtures/stage5-api-contract')"
    assert(validateGithubControlledSources(sources).some((item) => item.includes('Fixture')))
  })
  await test('static rejects WebView in page', () => {
    const sources = actualStaticSources(); sources['packageGithub/pages/index/index.wxml'] += '<web-view src="x"></web-view>'
    assert(validateGithubControlledSources(sources).some((item) => item.includes('WebView')))
  })
  await test('static rejects Repo image in GitHub page', () => {
    const sources = actualStaticSources(); sources['packageGithub/pages/index/index.wxml'] += '<image src="{{item.avatar}}" />'
    assert(validateGithubPageSources(sources).some((item) => item.includes('Avatar')))
  })
  await test('static rejects hardcoded repository data', () => {
    const sources = actualStaticSources(); sources['packageGithub/pages/index/index.js'] += "\nconst x={fullName:'example/fake',stars:123}"
    assert(validateGithubControlledSources(sources).some((item) => item.includes('假 Repo')))
  })
  await test('static rejects ViewModel Service access', () => {
    const sources = actualStaticSources(); sources['utils/github-ranking-view-model.js'] += "\nrequire('../services/github')"
    assert(validateGithubPageSources(sources).some((item) => item.includes('纯展示逻辑')))
  })
  await test('static rejects ViewModel sorting', () => {
    const sources = actualStaticSources(); sources['utils/github-ranking-view-model.js'] += '\nitems.sort(() => 0)'
    assert(validateGithubPageSources(sources).some((item) => item.includes('重新排序')))
  })
  await test('static rejects homepage GitHub entry', () => {
    const sources = actualStaticSources(); sources['pages/index/index.js'] += "\nconst target='/packageGithub/pages/index/index'"
    assert(validateGithubControlledSources(sources).some((item) => item.includes('正式入口')))
  })
  await test('static rejects GitHub TabBar entry', () => {
    const sources = actualStaticSources(); const app = JSON.parse(sources['app.json']); app.tabBar.list.push({ pagePath: 'packageGithub/pages/index/index' }); sources['app.json'] = JSON.stringify(app)
    assert(validateGithubControlledSources(sources).some((item) => item.includes('TabBar')))
  })

  console.log(`Stage 5 GitHub Page tests: PASS (${passed} cases)`)
}

run().catch((error) => {
  console.error(error.stack || error.message)
  process.exit(1)
})
