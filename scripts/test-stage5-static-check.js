const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  PUBLIC_APPID_PLACEHOLDER,
  STAGE5_AUDIT_RULE_IDS,
  runStage5StaticChecks,
  validateContentDetailPageSources,
  validateGithubControlledSources,
  validateGithubPageSources,
  validateStage5AuditSources,
  validateStage5Sources,
} = require('./stage5-static-rules')
const { runStage4StaticChecks } = require('./stage4-static-rules')
const { getEnvironment, PLACEHOLDER_API_BASE_URL } = require('../config/environment')
const { API_ENDPOINTS, API_VERSION, isRelativeApiPath } = require('../config/api-endpoints')
const {
  CACHE_VERSION,
  CONTENT_CACHE_KEY,
  DETAIL_TTL_MS,
  LIST_TTL_MS,
  MAX_DETAIL_CONTENT_CHARS,
  MAX_DETAIL_ENTRIES,
  MAX_LIST_ENTRIES,
  MAX_STALE_MS,
} = require('../services/content-cache')
const { SCHEMA_VERSION, STORAGE_KEYS } = require('../utils/data-schema')

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
const cloneSources = (sources) => Object.fromEntries(Object.entries(sources).map(([key, value]) => [key, String(value)]))

const AUDIT_SOURCE_FILES = [
  'app.js',
  'app.json',
  'app.wxss',
  'project.config.json',
  '.gitignore',
  'package.json',
  'config/api.example.js',
  'config/app.js',
  'config/moderation.js',
  'config/environment.js',
  'config/api-endpoints.js',
  'utils/api-client.js',
  'utils/api-contract.js',
  'utils/api-transport.js',
  'utils/api-schema.js',
  'utils/image-picker.js',
  'utils/image-moderation.js',
  'utils/data-schema.js',
  'utils/content-list-view-model.js',
  'utils/content-detail-view-model.js',
  'utils/github-ranking-view-model.js',
  'services/content.js',
  'services/content-cache.js',
  'services/github.js',
  'services/ai.js',
  'packageContent/pages/articles/articles.js',
  'packageContent/pages/articles/articles.json',
  'packageContent/pages/articles/articles.wxml',
  'packageContent/pages/articles/articles.wxss',
  'packageContent/pages/article-detail/article-detail.js',
  'packageContent/pages/article-detail/article-detail.json',
  'packageContent/pages/article-detail/article-detail.wxml',
  'packageContent/pages/article-detail/article-detail.wxss',
  'packageGithub/pages/index/index.js',
  'packageGithub/pages/index/index.json',
  'packageGithub/pages/index/index.wxml',
  'packageGithub/pages/index/index.wxss',
  'packageAI/pages/index/index.js',
  'packageAI/pages/index/index.json',
  'packageAI/pages/index/index.wxml',
  'packageAI/pages/index/index.wxss',
  'pages/index/index.js',
  'pages/index/index.wxml',
  'pages/tools/tools.js',
  'pages/tools/tools.wxml',
  'pages/discover/discover.js',
  'pages/discover/discover.wxml',
  'pages/mine/mine.js',
  'pages/mine/mine.wxml',
]

const loadAuditSources = () => Object.fromEntries(AUDIT_SOURCE_FILES.map((file) => [file, read(file)]))

const mutate = (base, file, transform) => {
  const next = cloneSources(base)
  next[file] = transform(next[file])
  return next
}

const expectAuditError = (base, file, transform, fragment) => {
  const errors = validateStage5AuditSources(mutate(base, file, transform))
  assert(errors.some((item) => item.includes(fragment)), `expected audit error containing: ${fragment}\n${errors.join('\n')}`)
}

const run = async () => {
  const sources = loadAuditSources()

  // Positive current-project audit.
  await test('Stage 5 full static audit passes current project', () => assert.deepStrictEqual(runStage5StaticChecks(ROOT), { errors: [], warnings: [] }))
  await test('Stage 4 static audit still passes current project', () => assert.deepStrictEqual(runStage4StaticChecks(ROOT), { errors: [], warnings: [] }))
  await test('Stage 5 audit rule ids are non-empty and unique', () => assert.strictEqual(new Set(STAGE5_AUDIT_RULE_IDS).size, STAGE5_AUDIT_RULE_IDS.length))
  await test('Stage 5 audit rule count is 48', () => assert.strictEqual(STAGE5_AUDIT_RULE_IDS.length, 48))

  // Remote / endpoint / public config.
  await test('development Remote is false', () => assert.strictEqual(getEnvironment('development').remoteApiEnabled, false))
  await test('production Remote is false', () => assert.strictEqual(getEnvironment('production').remoteApiEnabled, false))
  await test('Base URL remains placeholder', () => assert.strictEqual(PLACEHOLDER_API_BASE_URL, 'https://api.example.com'))
  await test('API Version remains v1', () => assert.strictEqual(API_VERSION, 'v1'))
  await test('health endpoint is relative', () => assert.strictEqual(isRelativeApiPath(API_ENDPOINTS.health), true))
  await test('content list endpoint is relative', () => assert.strictEqual(isRelativeApiPath(API_ENDPOINTS.content.articles), true))
  await test('content detail endpoint is relative', () => assert.strictEqual(isRelativeApiPath(API_ENDPOINTS.content.articleDetail('opaque id')), true))
  await test('GitHub ranking endpoint is relative', () => assert.strictEqual(isRelativeApiPath(API_ENDPOINTS.github.rankings), true))
  await test('public AppID remains placeholder', () => assert.strictEqual(JSON.parse(sources['project.config.json']).appid, PUBLIC_APPID_PLACEHOLDER))
  await test('private project config remains ignored by pattern', () => assert(/(?:^|\n)project\.private\.config\.json(?:\r?$|\n)/m.test(sources['.gitignore'])))

  // Storage / permissions / product baseline.
  await test('Content Cache key is fixed', () => assert.strictEqual(CONTENT_CACHE_KEY, 'wl_content_cache_v1'))
  await test('Content Cache version is 1', () => assert.strictEqual(CACHE_VERSION, 1))
  await test('Content list TTL remains five minutes', () => assert.strictEqual(LIST_TTL_MS, 5 * 60 * 1000))
  await test('Content detail TTL remains thirty minutes', () => assert.strictEqual(DETAIL_TTL_MS, 30 * 60 * 1000))
  await test('Content max stale remains 24 hours', () => assert.strictEqual(MAX_STALE_MS, 24 * 60 * 60 * 1000))
  await test('Content list max entries remains 10', () => assert.strictEqual(MAX_LIST_ENTRIES, 10))
  await test('Content detail max entries remains 30', () => assert.strictEqual(MAX_DETAIL_ENTRIES, 30))
  await test('Content detail max chars remains 200000', () => assert.strictEqual(MAX_DETAIL_CONTENT_CHARS, 200000))
  await test('Stage 3 schema version remains 1', () => assert.strictEqual(SCHEMA_VERSION, 1))
  await test('Stage 3 storage keys remain exact', () => assert.deepStrictEqual(Object.values(STORAGE_KEYS).sort(), ['wl_favorites_v1', 'wl_history_v1', 'wl_meta_v1', 'wl_tool_state_v1', 'wl_tool_usage_v1'].sort()))
  await test('app permissions only contain writePhotosAlbum', () => assert.deepStrictEqual(Object.keys(JSON.parse(sources['app.json']).permission), ['scope.writePhotosAlbum']))
  await test('TabBar remains exact four main pages', () => assert.deepStrictEqual(JSON.parse(sources['app.json']).tabBar.list.map((item) => item.pagePath), ['pages/index/index', 'pages/tools/tools', 'pages/discover/discover', 'pages/mine/mine']))
  await test('registered page count remains 36', () => {
    const app = JSON.parse(sources['app.json'])
    assert.strictEqual(app.pages.length + app.subPackages.reduce((sum, item) => sum + item.pages.length, 0), 36)
  })
  await test('formal tool page count remains 24', () => {
    const pkg = JSON.parse(sources['app.json']).subPackages.find((item) => item.root === 'packageTools')
    assert.strictEqual(pkg.pages.length, 24)
  })
  await test('wooden-fish remains hidden', () => assert(!JSON.stringify(JSON.parse(sources['app.json']).subPackages).includes('wooden-fish')))
  await test('zodiac remains hidden', () => assert(!JSON.stringify(JSON.parse(sources['app.json']).subPackages).includes('zodiac')))
  await test('runtime dependency remains TDesign only', () => assert.deepStrictEqual(Object.keys(JSON.parse(sources['package.json']).dependencies || {}), ['tdesign-miniprogram']))

  // Architecture and security positives.
  await test('Content Detail still uses rich-text', () => assert(/<rich-text\b/.test(sources['packageContent/pages/article-detail/article-detail.wxml'])))
  await test('Content module has no WebView', () => assert(!/<web-view\b/i.test(`${sources['packageContent/pages/articles/articles.wxml']}\n${sources['packageContent/pages/article-detail/article-detail.wxml']}`)))
  await test('GitHub module has no WebView', () => assert(!/<web-view\b/i.test(sources['packageGithub/pages/index/index.wxml'])))
  await test('AI module has no WebView', () => assert(!/<web-view\b/i.test(sources['packageAI/pages/index/index.wxml'])))
  await test('Content Page does not import API Client', () => assert(!/utils\/api-(?:client|transport|schema)|config\/api-endpoints/.test(`${sources['packageContent/pages/articles/articles.js']}\n${sources['packageContent/pages/article-detail/article-detail.js']}`)))
  await test('GitHub Page does not import API Client', () => assert(!/utils\/api-(?:client|transport|schema)|config\/api-endpoints/.test(sources['packageGithub/pages/index/index.js'])))
  await test('AI page remains isolated from API infrastructure', () => assert(!/utils\/api-|services\/ai|api\./.test(sources['packageAI/pages/index/index.js'])))
  await test('Content Service does not import Transport', () => assert(!/api-transport/.test(sources['services/content.js'])))
  await test('GitHub Service does not import Transport', () => assert(!/api-transport/.test(sources['services/github.js'])))
  await test('AI Service does not import Transport', () => assert(!/api-transport/.test(sources['services/ai.js'])))
  await test('API Client has no default Authorization', () => assert(!/\bAuthorization\b|\bBearer\b/.test(sources['utils/api-client.js'])))
  await test('chooseMedia remains album-only', () => assert(/DEFAULT_SOURCE_TYPE\s*=\s*\['album'\]/.test(sources['utils/image-picker.js']) && !/['"]camera['"]/.test(sources['utils/image-picker.js'].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''))))
  await test('Content Cache does not reference Stage 3 keys', () => Object.values(STORAGE_KEYS).forEach((key) => assert(!sources['services/content-cache.js'].includes(key))))
  await test('GitHub has no Storage key', () => assert(!/\bwl_github_|wx\.(?:getStorage|setStorage|removeStorage|clearStorage)/.test(`${sources['services/github.js']}\n${sources['packageGithub/pages/index/index.js']}`)))
  await test('AI has no Storage key', () => assert(!/\bwl_ai_|wx\.(?:getStorage|setStorage|removeStorage|clearStorage)/.test(`${sources['services/ai.js']}\n${sources['packageAI/pages/index/index.js']}`)))
  await test('Stage 5 current audit sources have no public entry', () => assert.deepStrictEqual(validateStage5AuditSources(sources), []))

  // Import side effects: import must not invoke wx network/storage/timers.
  await test('api-client import has zero wx side effects', () => {
    let calls = 0
    const previousWx = global.wx
    global.wx = { request: () => { calls += 1 }, getStorageSync: () => { calls += 1 }, setStorageSync: () => { calls += 1 } }
    try {
      delete require.cache[require.resolve('../utils/api-client')]
      require('../utils/api-client')
      assert.strictEqual(calls, 0)
    } finally {
      if (previousWx === undefined) delete global.wx
      else global.wx = previousWx
    }
  })
  await test('api-transport import has zero wx side effects', () => {
    let calls = 0
    const previousWx = global.wx
    global.wx = { request: () => { calls += 1 } }
    try {
      delete require.cache[require.resolve('../utils/api-transport')]
      require('../utils/api-transport')
      assert.strictEqual(calls, 0)
    } finally {
      if (previousWx === undefined) delete global.wx
      else global.wx = previousWx
    }
  })
  await test('Content Service import has zero wx side effects', () => {
    let calls = 0
    const previousWx = global.wx
    global.wx = { request: () => { calls += 1 }, getStorageSync: () => { calls += 1 }, setStorageSync: () => { calls += 1 } }
    try {
      delete require.cache[require.resolve('../services/content')]
      require('../services/content')
      assert.strictEqual(calls, 0)
    } finally {
      if (previousWx === undefined) delete global.wx
      else global.wx = previousWx
    }
  })
  await test('GitHub Service import has zero wx side effects', () => {
    let calls = 0
    const previousWx = global.wx
    global.wx = { request: () => { calls += 1 }, getStorageSync: () => { calls += 1 }, setStorageSync: () => { calls += 1 } }
    try {
      delete require.cache[require.resolve('../services/github')]
      require('../services/github')
      assert.strictEqual(calls, 0)
    } finally {
      if (previousWx === undefined) delete global.wx
      else global.wx = previousWx
    }
  })
  await test('Content Cache import has zero wx side effects', () => {
    let calls = 0
    const previousWx = global.wx
    global.wx = { getStorageSync: () => { calls += 1 }, setStorageSync: () => { calls += 1 }, removeStorageSync: () => { calls += 1 } }
    try {
      delete require.cache[require.resolve('../services/content-cache')]
      require('../services/content-cache')
      assert.strictEqual(calls, 0)
    } finally {
      if (previousWx === undefined) delete global.wx
      else global.wx = previousWx
    }
  })

  // Negative static regression: mutate in-memory strings only; never touch production files.
  await test('static rejects Remote true', () => expectAuditError(sources, 'config/environment.js', (s) => s.replace('REMOTE_API_ENABLED = false', 'REMOTE_API_ENABLED = true'), 'REMOTE_API_ENABLED'))
  await test('static rejects process.env Remote override', () => expectAuditError(sources, 'config/environment.js', (s) => `${s}\nconst hiddenRemote = process.env.REMOTE_API_ENABLED`, '动态开启 Remote'))
  await test('static rejects real wanluu Base URL', () => expectAuditError(sources, 'config/environment.js', (s) => s.replace('https://api.example.com', 'https://api.wanluu.com'), 'Base URL'))
  await test('static rejects real server IP', () => expectAuditError(sources, 'config/environment.js', (s) => `${s}\nconst hiddenHost='https://192.0.2.10:443'`, '真实服务器地址'))
  await test('static rejects endpoint full URL', () => expectAuditError(sources, 'config/api-endpoints.js', (s) => `${s}\nconst bad='https://api.example.com/api/v1/test'`, '相对路径'))
  await test('static rejects API v2 regression', () => expectAuditError(sources, 'config/api-endpoints.js', (s) => s.replace("API_VERSION = 'v1'", "API_VERSION = 'v2'"), 'API Version'))
  await test('static rejects page wx.request', () => expectAuditError(sources, 'packageGithub/pages/index/index.js', (s) => `${s}\nwx.request({})`, 'wx.request'))
  await test('static rejects service wx.request', () => expectAuditError(sources, 'services/content.js', (s) => `${s}\nwx.request({})`, 'wx.request'))
  await test('static rejects new uploadFile outside dormant adapter', () => expectAuditError(sources, 'services/github.js', (s) => `${s}\nwx.uploadFile({})`, 'wx.uploadFile'))
  await test('static rejects fetch', () => expectAuditError(sources, 'services/github.js', (s) => `${s}\nfetch('x')`, 'fetch'))
  await test('static rejects XMLHttpRequest', () => expectAuditError(sources, 'services/github.js', (s) => `${s}\nnew XMLHttpRequest()`, 'XMLHttpRequest'))
  await test('static rejects GitHub Provider direct URL', () => expectAuditError(sources, 'services/github.js', (s) => `${s}\nconst provider='https://api.github.com/repos/x/y'`, '第三方 Provider'))
  await test('static rejects WordPress direct URL', () => expectAuditError(sources, 'services/content.js', (s) => `${s}\nconst provider='/wp-json/wp/v2/posts'`, '第三方 Provider'))
  await test('static rejects AI Provider direct URL', () => expectAuditError(sources, 'services/ai.js', (s) => `${s}\nconst provider='https://api.openai.com/v1/chat/completions'`, '第三方 Provider'))
  await test('static rejects hardcoded API key', () => expectAuditError(sources, 'services/ai.js', (s) => `${s}\nconst api_key='Abcd1234567890SecretValue'`, 'Secret'))
  await test('static rejects GitHub PAT', () => expectAuditError(sources, 'services/github.js', (s) => `${s}\nconst token='ghp_123456789012345678901234567890123456'`, 'Secret'))
  await test('static rejects Authorization Bearer material', () => expectAuditError(sources, 'services/content.js', (s) => `${s}\nconst Authorization='Bearer Abcd1234567890.Secret.Token'`, 'Secret'))
  await test('static rejects public real AppID', () => expectAuditError(sources, 'project.config.json', (s) => s.replace(PUBLIC_APPID_PLACEHOLDER, 'wx1234567890abcdef'), '公共 AppID'))
  await test('static rejects missing private config ignore', () => expectAuditError(sources, '.gitignore', (s) => s.replace(/\nproject\.private\.config\.json\s*\n?/, '\n'), '.gitignore'))
  await test('static rejects Content Page API Client dependency', () => expectAuditError(sources, 'packageContent/pages/articles/articles.js', (s) => `${s}\nrequire('../../../utils/api-client')`, '越层'))
  await test('static rejects GitHub Page API Client dependency', () => expectAuditError(sources, 'packageGithub/pages/index/index.js', (s) => `${s}\nrequire('../../../utils/api-client')`, '越层'))
  await test('static rejects Service Transport dependency', () => expectAuditError(sources, 'services/github.js', (s) => `${s}\nrequire('../utils/api-transport')`, 'API Transport'))
  await test('static rejects API Client reverse Storage dependency', () => expectAuditError(sources, 'utils/api-client.js', (s) => `${s}\nrequire('../services/storage')`, '反向依赖'))
  await test('static rejects Transport business coupling', () => expectAuditError(sources, 'utils/api-transport.js', (s) => `${s}\nconst period='daily'`, '业务语义'))
  await test('static rejects Content WebView', () => expectAuditError(sources, 'packageContent/pages/article-detail/article-detail.wxml', (s) => `${s}\n<web-view src="x"></web-view>`, 'WebView'))
  await test('static rejects GitHub WebView', () => expectAuditError(sources, 'packageGithub/pages/index/index.wxml', (s) => `${s}\n<web-view src="x"></web-view>`, 'WebView'))
  await test('static rejects eval', () => expectAuditError(sources, 'packageGithub/pages/index/index.js', (s) => `${s}\neval('x')`, 'eval'))
  await test('static rejects changed Content Cache key', () => expectAuditError(sources, 'services/content-cache.js', (s) => s.replace("CONTENT_CACHE_KEY = 'wl_content_cache_v1'", "CONTENT_CACHE_KEY = 'wl_content_cache_v2'"), 'Content Cache Key'))
  await test('static rejects Stage 3 key in Content Cache', () => expectAuditError(sources, 'services/content-cache.js', (s) => `${s}\nconst illegal='wl_history_v1'`, 'Stage 3 Key'))
  await test('static rejects GitHub Storage', () => expectAuditError(sources, 'packageGithub/pages/index/index.js', (s) => `${s}\nwx.setStorageSync('wl_github_cache_v1', {})`, 'GitHub Stage 5'))
  await test('static rejects AI Storage', () => expectAuditError(sources, 'packageAI/pages/index/index.js', (s) => `${s}\nwx.setStorageSync('wl_ai_history_v1', [])`, 'AI Stage 5'))
  await test('static rejects global clearStorage', () => expectAuditError(sources, 'services/content.js', (s) => `${s}\nwx.clearStorage()`, 'clearStorage'))
  await test('static rejects Stage 5 OpenID collection', () => expectAuditError(sources, 'services/github.js', (s) => `${s}\nconst openId='user'`, '身份数据'))
  await test('static rejects Stage 5 fingerprint field', () => expectAuditError(sources, 'services/content.js', (s) => `${s}\nconst fingerprint='abc'`, '身份数据'))
  await test('static rejects Analytics integration', () => expectAuditError(sources, 'packageGithub/pages/index/index.js', (s) => `${s}\nconst analytics=require('analytics-sdk')`, 'Analytics'))
  await test('static rejects camera permission', () => expectAuditError(sources, 'app.json', (s) => { const app = JSON.parse(s); app.permission['scope.camera'] = { desc: 'camera' }; return JSON.stringify(app) }, '不得新增权限'))
  await test('static rejects chooseMedia camera source', () => expectAuditError(sources, 'utils/image-picker.js', (s) => s.replace("DEFAULT_SOURCE_TYPE = ['album']", "DEFAULT_SOURCE_TYPE = ['camera']"), 'album-only'))
  await test('static rejects Content homepage entry', () => expectAuditError(sources, 'pages/index/index.js', (s) => `${s}\nconst target='/packageContent/pages/articles/articles'`, '正式入口'))
  await test('static rejects GitHub tools-page entry', () => expectAuditError(sources, 'pages/tools/tools.js', (s) => `${s}\nconst target='/packageGithub/pages/index/index'`, '正式入口'))
  await test('static rejects AI mine-page entry', () => expectAuditError(sources, 'pages/mine/mine.js', (s) => `${s}\nconst target='/packageAI/pages/index/index'`, '正式入口'))
  await test('static rejects enabled GitHub feature flag', () => expectAuditError(sources, 'config/app.js', (s) => s.replace('github: false', 'github: true'), 'feature github'))
  await test('static rejects GitHub TabBar entry', () => expectAuditError(sources, 'app.json', (s) => { const app = JSON.parse(s); app.tabBar.list.push({ pagePath: 'packageGithub/pages/index/index', text: 'GitHub' }); return JSON.stringify(app) }, 'TabBar'))
  await test('static rejects production Fixture import', () => expectAuditError(sources, 'services/github.js', (s) => `${s}\nrequire('../scripts/fixtures/stage5-api-contract')`, 'scripts/fixtures'))
  await test('GitHub controlled rule rejects production fake Repo', () => {
    const next = cloneSources(sources)
    next['packageGithub/pages/index/index.js'] += "\nconst fake={fullName:'example/fake',stars:123}"
    assert(validateGithubControlledSources(next).some((item) => item.includes('假 Repo')))
  })
  await test('GitHub controlled rule rejects client sorting', () => {
    const next = cloneSources(sources)
    next['services/github.js'] += '\nitems.sort(() => 0)'
    assert(validateGithubControlledSources(next).some((item) => item.includes('客户端排序')))
  })
  await test('GitHub page rule rejects ViewModel trending score', () => {
    const next = cloneSources(sources)
    next['utils/github-ranking-view-model.js'] += '\nconst trendingScore = 1'
    assert(validateGithubPageSources(next).some((item) => item.includes('Trending Score')))
  })
  await test('static rejects formal tool count regression', () => expectAuditError(sources, 'app.json', (s) => { const app = JSON.parse(s); app.subPackages.find((item) => item.root === 'packageTools').pages.pop(); return JSON.stringify(app) }, '正式工具'))
  await test('static rejects wooden-fish restored', () => expectAuditError(sources, 'app.json', (s) => { const app = JSON.parse(s); app.subPackages.find((item) => item.root === 'packageTools').pages.push('pages/wooden-fish/wooden-fish'); return JSON.stringify(app) }, 'wooden-fish'))
  await test('static rejects zodiac restored', () => expectAuditError(sources, 'app.json', (s) => { const app = JSON.parse(s); app.subPackages.find((item) => item.root === 'packageTools').pages.push('pages/zodiac/zodiac'); return JSON.stringify(app) }, 'zodiac'))
  await test('static rejects registered page count change', () => expectAuditError(sources, 'app.json', (s) => { const app = JSON.parse(s); app.subPackages.find((item) => item.root === 'packageAI').pages.push('pages/extra/extra'); return JSON.stringify(app) }, '注册页面'))
  await test('static rejects Stage 3 schema version change', () => expectAuditError(sources, 'utils/data-schema.js', (s) => s.replace('SCHEMA_VERSION = 1', 'SCHEMA_VERSION = 2'), 'SCHEMA_VERSION'))
  await test('static rejects new runtime dependency', () => expectAuditError(sources, 'package.json', (s) => { const pkg = JSON.parse(s); pkg.dependencies.axios = '^1.0.0'; return JSON.stringify(pkg) }, 'runtime dependency'))
  await test('static rejects moderation exception being enabled', () => expectAuditError(sources, 'config/moderation.js', (s) => s.replace('\n  enabled: false,', '\n  enabled: true,'), 'image-moderation'))
  await test('static rejects image-moderation expanding to fetch', () => expectAuditError(sources, 'utils/image-moderation.js', (s) => `${s}\nfetch('x')`, 'fetch'))

  // Existing detailed validators remain wired into the full audit.
  await test('Content detail validator still passes actual page', () => assert.deepStrictEqual(validateContentDetailPageSources(sources), []))
  await test('GitHub controlled validator still passes actual module', () => assert.deepStrictEqual(validateGithubControlledSources(sources), []))
  await test('GitHub page validator still passes actual page', () => assert.deepStrictEqual(validateGithubPageSources(sources), []))
  await test('Stage 5 base validator still passes actual sources', () => assert.deepStrictEqual(validateStage5Sources(sources), []))

  console.log(`Stage 5 Static/Security regression tests: PASS (${passed} cases)`)
}

run().catch((error) => {
  console.error(error.stack || error.message)
  process.exit(1)
})
