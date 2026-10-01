const fs = require('fs')
const path = require('path')

const WECHAT_TRANSPORT_FILE = 'utils/api-transport.js'
const BASELINE_DORMANT_UPLOAD_ADAPTER = 'utils/image-moderation.js'
const CONTENT_SERVICE_FILE = 'services/content.js'
const CONTENT_CACHE_FILE = 'services/content-cache.js'
const CONTENT_CACHE_KEY = 'wl_content_cache_v1'
const GITHUB_SERVICE_FILE = 'services/github.js'
const GITHUB_PAGE_JS = 'packageGithub/pages/index/index.js'
const GITHUB_PAGE_JSON = 'packageGithub/pages/index/index.json'
const GITHUB_PAGE_WXML = 'packageGithub/pages/index/index.wxml'
const GITHUB_PAGE_WXSS = 'packageGithub/pages/index/index.wxss'
const GITHUB_VIEW_MODEL_FILE = 'utils/github-ranking-view-model.js'
const WX_REQUEST_PATTERN = /wx\.request\s*\(/g
const OTHER_NETWORK_PATTERN = /wx\.(?:uploadFile|downloadFile|connectSocket)\s*\(|\bfetch\s*\(|XMLHttpRequest/g
const SECRET_ASSIGNMENT_PATTERN = /(?:api[_-]?key|appsecret|client[_-]?secret|access[_-]?token|session[_-]?key|private[_-]?key|password)\s*[:=]\s*['"]([^'"]{8,})['"]/ig
const THIRD_PARTY_DIRECT_PATTERN = /api\.github\.com|\/wp-json\/|api\.openai\.com|api\.deepseek\.com|generativelanguage\.googleapis\.com|ark\.cn-beijing\.volces\.com/ig
const FULL_URL_PATTERN = /https?:\/\//ig
const STORAGE_WRITE_PATTERN = /wx\.(?:setStorage|setStorageSync|removeStorage|removeStorageSync|clearStorage|clearStorageSync)\s*\(|\bstorage\.(?:set|remove|clear)\s*\(/g
const STORAGE_ACCESS_PATTERN = /wx\.(?:getStorage|getStorageSync|setStorage|setStorageSync|removeStorage|removeStorageSync|clearStorage|clearStorageSync)\s*\(|\bstorage\.(?:get|readRaw|set|remove|update|clear)\s*\(/g
const DIRECT_WX_STORAGE_PATTERN = /wx\.(?:getStorage|getStorageSync|setStorage|setStorageSync|removeStorage|removeStorageSync|clearStorage|clearStorageSync)\s*\(/g
const FIXTURE_IMPORT_PATTERN = /(?:require|import)[\s\S]{0,80}scripts\/fixtures\//g
const CONTENT_PAGE_JS = 'packageContent/pages/articles/articles.js'
const CONTENT_PAGE_JSON = 'packageContent/pages/articles/articles.json'
const CONTENT_PAGE_WXML = 'packageContent/pages/articles/articles.wxml'
const CONTENT_PAGE_WXSS = 'packageContent/pages/articles/articles.wxss'
const CONTENT_DETAIL_PAGE_JS = 'packageContent/pages/article-detail/article-detail.js'
const CONTENT_DETAIL_PAGE_JSON = 'packageContent/pages/article-detail/article-detail.json'
const CONTENT_DETAIL_PAGE_WXML = 'packageContent/pages/article-detail/article-detail.wxml'
const CONTENT_DETAIL_PAGE_WXSS = 'packageContent/pages/article-detail/article-detail.wxss'
const CONTENT_FAKE_COPY_PATTERN = /示例文章1|AI最新资讯|今日热门文章/g
const WEBVIEW_PATTERN = /<web-view\b/ig
const RICH_TEXT_PATTERN = /<rich-text\b/ig
const UNSAFE_RUNTIME_PATTERN = /\beval\s*\(|\bnew\s+Function\s*\(/g
const HTML_PARSER_IMPORT_PATTERN = /(?:require\s*\(\s*['"][^'"]*(?:cheerio|sanitize-html|dompurify|htmlparser|html-parser)[^'"]*['"]\s*\)|from\s+['"][^'"]*(?:cheerio|sanitize-html|dompurify|htmlparser|html-parser)[^'"]*['"])/ig
const CONTENT_STORAGE_KEY_PATTERN = /\bwl_content_[a-z0-9_]+\b/ig
const CONTENT_PROFILE_PATTERN = /wl_content_(?:history|profile|recommend)|\b(?:openId|unionId|userId|deviceId|fingerprint|authorization|accessToken|sessionKey)\b/ig
const GITHUB_FAKE_DATA_PATTERN = /今日热榜示例|本周热榜示例|总榜示例|fake\s+github|stars?\s*[:=]\s*\d+/ig
const GITHUB_SECRET_PATTERN = /\b(?:github[_-]?(?:token|pat)|github_pat_[a-z0-9_]+|ghp_[a-z0-9]+)\b|\bAuthorization\s*[:=]/ig
const GITHUB_HARDCODED_REPO_PATTERN = /\b(?:fullName|updatedAt)\s*:\s*['"][^'"]+['"]|\bstars\s*:\s*\d+/ig
const GITHUB_EXTERNAL_ACTION_PATTERN = /\b(?:setClipboardData|openEmbeddedMiniProgram|navigateToMiniProgram)\s*\(|\bwx\.navigateTo\s*\(/ig
const PUBLIC_APPID_PLACEHOLDER = 'wx0000000000000000'
const STAGE3_STORAGE_KEYS = Object.freeze([
  'wl_meta_v1',
  'wl_favorites_v1',
  'wl_history_v1',
  'wl_tool_usage_v1',
  'wl_tool_state_v1',
])
const MAIN_TAB_PATHS = Object.freeze([
  'pages/index/index',
  'pages/tools/tools',
  'pages/discover/discover',
  'pages/mine/mine',
])
const STAGE5_PUBLIC_ENTRY_PATTERN = /package(?:Content|Github|AI)\/|services\/(?:content|github|ai)/i
const REAL_SERVER_TARGET_PATTERN = /\bwanluu\.com\b|https?:\/\/(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?/i
const REMOTE_OVERRIDE_PATTERN = /process\.env|wx\.(?:getStorage|getStorageSync|getLaunchOptionsSync|getEnterOptionsSync)\s*\(|REMOTE_API_ENABLED\s*=\s*(?!false\b)/i
const IDENTITY_PATTERN = /\b(?:openId|openid|unionId|unionid|deviceId|fingerprint|advertisingId|imei)\b/i
const ANALYTICS_PATTERN = /(?:require|import)[\s\S]{0,80}(?:analytics|tracking|sentry|mixpanel|amplitude)|\b(?:analytics|tracking)\.(?:track|event|identify)\s*\(/i
const SERVICE_TRANSPORT_IMPORT_PATTERN = /require\s*\(\s*['"][^'"]*api-transport['"]\s*\)|from\s+['"][^'"]*api-transport['"]/i
const API_CLIENT_REVERSE_DEP_PATTERN = /require\s*\(\s*['"][^'"]*(?:services\/|package(?:Content|Github|AI)\/|pages\/|storage|discovery|tool-logic)[^'"]*['"]\s*\)/i
const TRANSPORT_BUSINESS_PATTERN = /\b(?:content|github|article|repository|repo|period|discovery|toolLogic|tool-logic)\b/i
const STAGE5_AUDIT_RULE_IDS = Object.freeze([
  'remote-development-false',
  'remote-production-false',
  'placeholder-base-url',
  'no-runtime-remote-override',
  'api-v1-relative-endpoints',
  'wx-request-transport-only',
  'image-moderation-upload-exception-only',
  'no-fetch',
  'no-xmlhttprequest',
  'no-provider-direct-access',
  'no-real-server-target',
  'no-real-secret',
  'public-appid-placeholder',
  'private-config-ignore',
  'content-page-service-only',
  'github-page-service-only',
  'ai-remains-isolated',
  'service-no-transport-import',
  'api-client-no-business-dependency',
  'transport-business-agnostic',
  'content-rich-text-only',
  'stage5-no-webview',
  'stage5-no-eval',
  'content-cache-key-fixed',
  'content-cache-policy-fixed',
  'content-cache-stage3-isolation',
  'github-storage-zero',
  'ai-storage-zero',
  'no-global-clear-storage',
  'no-stage5-identity-collection',
  'no-stage5-analytics',
  'permissions-fixed',
  'choose-media-album-only',
  'content-no-public-entry',
  'github-no-public-entry',
  'ai-no-public-entry',
  'tabbar-four-fixed',
  'production-fixture-isolation',
  'no-production-fake-data',
  'github-no-client-sort',
  'github-no-trending-score',
  'formal-tools-24',
  'wooden-fish-hidden',
  'zodiac-hidden',
  'registered-pages-36',
  'stage3-schema-version-fixed',
  'stage3-storage-keys-fixed',
  'no-new-runtime-dependency',
])

const read = (file) => {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch (error) {
    return ''
  }
}

const stripComments = (source) => String(source || '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1')

const hasPattern = (pattern, source) => {
  pattern.lastIndex = 0
  const hit = pattern.test(source)
  pattern.lastIndex = 0
  return hit
}

const hasHardcodedSecret = (source) => {
  SECRET_ASSIGNMENT_PATTERN.lastIndex = 0
  let match
  while ((match = SECRET_ASSIGNMENT_PATTERN.exec(source))) {
    const value = String(match[1] || '')
    if (value.startsWith('wl_')) continue
    if (/[0-9]/.test(value) || /[A-Z]/.test(value) || value.length >= 24) {
      SECRET_ASSIGNMENT_PATTERN.lastIndex = 0
      return true
    }
  }
  SECRET_ASSIGNMENT_PATTERN.lastIndex = 0
  return false
}

const hasRealSecretMaterial = (source) => {
  const clean = stripComments(source)
  if (/\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,})\b/.test(clean)) return true
  if (/\bAuthorization\s*[:=]\s*['"`]\s*Bearer\s+[A-Za-z0-9._~+\/-]{12,}/i.test(clean)) return true

  const assignment = /(?:api[_-]?key|appsecret|client[_-]?secret|access[_-]?token|session[_-]?key|private[_-]?key|password|passwd|secret)\s*[:=]\s*['"`]([^'"`]{8,})['"`]/ig
  let match
  while ((match = assignment.exec(clean))) {
    const value = String(match[1] || '').trim()
    if (!value) continue
    if (/^(?:wl_|YOUR_|example|placeholder|disabled|none|not_implemented)/i.test(value)) continue
    if (value === 'service_not_connected') continue
    if (/[0-9]/.test(value) || /[A-Z]/.test(value) || value.length >= 24) return true
  }
  return false
}

const validateStage5Sources = (sources = {}) => {
  const errors = []
  const environment = sources['config/environment.js'] || ''
  const apiClient = sources['utils/api-client.js'] || ''
  const apiContract = sources['utils/api-contract.js'] || ''
  const apiTransport = sources[WECHAT_TRANSPORT_FILE] || ''
  const apiEndpoints = sources['config/api-endpoints.js'] || ''
  const apiSchema = sources['utils/api-schema.js'] || ''
  const contentService = sources[CONTENT_SERVICE_FILE] || ''

  if (!environment) errors.push('缺少 Stage 5 环境配置：config/environment.js')
  if (!apiClient) errors.push('缺少 Stage 5 API Client：utils/api-client.js')
  if (!apiContract) errors.push('缺少 Stage 5 API 契约：utils/api-contract.js')
  if (!apiTransport) errors.push(`缺少 Stage 5 WeChat Transport：${WECHAT_TRANSPORT_FILE}`)
  if (!apiEndpoints) errors.push('缺少 Stage 5 API Endpoint 规范：config/api-endpoints.js')
  if (!apiSchema) errors.push('缺少 Stage 5 API Schema：utils/api-schema.js')
  if (!contentService) errors.push(`缺少 Stage 5 Content Service：${CONTENT_SERVICE_FILE}`)

  if (environment) {
    if (!environment.includes("DEVELOPMENT: 'development'") || !environment.includes("PRODUCTION: 'production'")) {
      errors.push('Stage 5 环境配置必须同时支持 development / production')
    }
    if (!/REMOTE_API_ENABLED\s*=\s*false/.test(environment)) {
      errors.push('Stage 5 默认远程开关必须为 false')
    }
    if (!environment.includes('https://api.example.com')) {
      errors.push('Stage 5 API Base URL 必须保持 example.com 占位地址')
    }
  }

  if (apiEndpoints) {
    const clean = stripComments(apiEndpoints)
    if (!clean.includes("API_VERSION = 'v1'") || !clean.includes('/api/')) {
      errors.push('Stage 5 Endpoint 必须固定明确的 /api/v1 版本前缀')
    }
    if (hasPattern(FULL_URL_PATTERN, clean)) {
      errors.push('config/api-endpoints.js 只能保存相对 API Path，不得保存完整服务器 URL')
    }
  }

  const noNetworkInfrastructure = {
    'config/environment.js': environment,
    'config/api-endpoints.js': apiEndpoints,
    'utils/api-client.js': apiClient,
    'utils/api-contract.js': apiContract,
    'utils/api-schema.js': apiSchema,
  }
  Object.entries(noNetworkInfrastructure).forEach(([file, source]) => {
    const clean = stripComments(source)
    if (hasPattern(WX_REQUEST_PATTERN, clean) || hasPattern(OTHER_NETWORK_PATTERN, clean)) {
      errors.push(`${file} 不得直接实现网络 Transport`)
    }
  })

  if (apiTransport) {
    const clean = stripComments(apiTransport)
    if (!hasPattern(WX_REQUEST_PATTERN, clean)) errors.push(`${WECHAT_TRANSPORT_FILE} 必须是唯一 wx.request Adapter`)
    if (hasPattern(OTHER_NETWORK_PATTERN, clean)) {
      errors.push(`${WECHAT_TRANSPORT_FILE} 当前只允许普通 wx.request，不得实现 upload/download/socket/fetch/XMLHttpRequest`)
    }
  }

  if (contentService) {
    const clean = stripComments(contentService)
    if (!clean.includes("require('../config/api-endpoints')")) {
      errors.push(`${CONTENT_SERVICE_FILE} 必须复用 config/api-endpoints.js`)
    }
    if (!clean.includes("require('../utils/api-schema')")) {
      errors.push(`${CONTENT_SERVICE_FILE} 必须复用 utils/api-schema.js`)
    }
    if (hasPattern(FULL_URL_PATTERN, clean)) {
      errors.push(`${CONTENT_SERVICE_FILE} 不得硬编码完整 Server URL`)
    }
    if (/\/api\/v1\//.test(clean)) {
      errors.push(`${CONTENT_SERVICE_FILE} 不得散落硬编码 /api/v1 Endpoint`)
    }
    if (hasPattern(STORAGE_WRITE_PATTERN, clean)) {
      errors.push(`${CONTENT_SERVICE_FILE} 不得直接写 Storage，必须通过 Content Cache Service`)
    }
    if (hasPattern(FIXTURE_IMPORT_PATTERN, clean)) {
      errors.push(`${CONTENT_SERVICE_FILE} 不得导入 scripts/fixtures 测试数据`)
    }
    if (/\btitle\s*:\s*['"][^'"]+['"]/.test(clean) && /\bexcerpt\s*:\s*['"][^'"]*['"]/.test(clean)) {
      errors.push(`${CONTENT_SERVICE_FILE} 不得返回硬编码假文章`)
    }
  }

  Object.entries(sources).forEach(([file, source]) => {
    const clean = stripComments(source)
    if (hasHardcodedSecret(clean)) errors.push(`${file} 不得硬编码 Secret / Token / Password`)

    if (!file.endsWith('.js') || file === WECHAT_TRANSPORT_FILE) return
    if (hasPattern(WX_REQUEST_PATTERN, clean)) {
      errors.push(`${file} 不得直接调用 wx.request，必须经过统一 WeChat Transport`)
    }
    if (file !== BASELINE_DORMANT_UPLOAD_ADAPTER && hasPattern(OTHER_NETWORK_PATTERN, clean)) {
      errors.push(`${file} 当前不得新增 fetch / XMLHttpRequest / upload / download / socket 网络实现`)
    }
    if (hasPattern(THIRD_PARTY_DIRECT_PATTERN, clean)) {
      errors.push(`${file} 不得直连 GitHub / WordPress / AI Provider，必须经过挽鹿服务端标准化层`)
    }
  })

  return errors
}

const validateContentPageSources = (sources = {}) => {
  const errors = []
  const pageJs = sources[CONTENT_PAGE_JS] || ''
  const pageJson = sources[CONTENT_PAGE_JSON] || ''
  const pageWxml = sources[CONTENT_PAGE_WXML] || ''
  const pageWxss = sources[CONTENT_PAGE_WXSS] || ''
  const appJsonSource = sources['app.json'] || ''

  if (!pageJs) errors.push(`缺少原生文章列表页：${CONTENT_PAGE_JS}`)
  if (!pageJson) errors.push(`缺少原生文章列表页配置：${CONTENT_PAGE_JSON}`)
  if (!pageWxml) errors.push(`缺少原生文章列表页模板：${CONTENT_PAGE_WXML}`)
  if (!pageWxss) errors.push(`缺少原生文章列表页样式：${CONTENT_PAGE_WXSS}`)

  if (pageJs) {
    const clean = stripComments(pageJs)
    if (!clean.includes("require('../../../services/content')")) {
      errors.push(`${CONTENT_PAGE_JS} 必须只通过 Content Service 获取文章业务数据`)
    }
    if (hasPattern(WX_REQUEST_PATTERN, clean) || hasPattern(OTHER_NETWORK_PATTERN, clean)) {
      errors.push(`${CONTENT_PAGE_JS} 不得直接实现任何网络请求`)
    }
    if (hasPattern(STORAGE_ACCESS_PATTERN, clean)) {
      errors.push(`${CONTENT_PAGE_JS} 不得直接访问 Storage 或 Content Cache`)
    }
    if (hasPattern(FIXTURE_IMPORT_PATTERN, clean)) {
      errors.push(`${CONTENT_PAGE_JS} 不得导入 scripts/fixtures 测试数据`)
    }
    if (hasPattern(THIRD_PARTY_DIRECT_PATTERN, clean) || /\bwanluu\.com\b/i.test(clean)) {
      errors.push(`${CONTENT_PAGE_JS} 不得直连 WordPress / wanluu.com / 第三方 Provider`)
    }
    if (hasPattern(CONTENT_FAKE_COPY_PATTERN, clean)) {
      errors.push(`${CONTENT_PAGE_JS} 不得硬编码生产假文章`)
    }
    if (/\bwl_content_|content_articles_cache/i.test(clean)) {
      errors.push(`${CONTENT_PAGE_JS} Step 5 不得新增 Content Storage Key`)
    }
  }

  if (pageWxml) {
    if (hasPattern(WEBVIEW_PATTERN, pageWxml)) errors.push(`${CONTENT_PAGE_WXML} 不得使用 WebView`)
    if (hasPattern(RICH_TEXT_PATTERN, pageWxml)) errors.push(`${CONTENT_PAGE_WXML} 列表页不得渲染 Detail Rich Text`)
    if (/\{\{\s*item\.content\s*\}\}/.test(pageWxml)) errors.push(`${CONTENT_PAGE_WXML} 列表页不得展示完整文章 content`)
    if (hasPattern(CONTENT_FAKE_COPY_PATTERN, pageWxml)) errors.push(`${CONTENT_PAGE_WXML} 不得展示硬编码生产假文章`)
  }

  if (appJsonSource) {
    try {
      const appConfig = JSON.parse(appJsonSource)
      const packages = Array.isArray(appConfig.subPackages) ? appConfig.subPackages : []
      const contentPackage = packages.find((item) => item && item.root === 'packageContent')
      if (!contentPackage || !Array.isArray(contentPackage.pages) || !contentPackage.pages.includes('pages/articles/articles')) {
        errors.push('app.json 必须正确注册 packageContent/pages/articles/articles')
      }
      const tabItems = appConfig.tabBar && Array.isArray(appConfig.tabBar.list) ? appConfig.tabBar.list : []
      if (tabItems.some((item) => item && String(item.pagePath || '').startsWith('packageContent/'))) {
        errors.push('packageContent 当前不得加入 TabBar')
      }
    } catch (error) {
      errors.push('app.json 无法解析，无法验证 packageContent 注册')
    }
  } else {
    errors.push('缺少 app.json，无法验证 packageContent 注册')
  }

  ;['pages/index/index.js', 'pages/index/index.wxml', 'pages/discover/discover.js', 'pages/discover/discover.wxml'].forEach((file) => {
    const source = sources[file] || ''
    if (/packageContent\/|packageContent\/pages\/articles/i.test(source)) {
      errors.push(`${file} Step 5 不得开放文章列表正式入口`)
    }
  })

  return errors
}

const validateContentDetailPageSources = (sources = {}) => {
  const errors = []
  const pageJs = sources[CONTENT_DETAIL_PAGE_JS] || ''
  const pageJson = sources[CONTENT_DETAIL_PAGE_JSON] || ''
  const pageWxml = sources[CONTENT_DETAIL_PAGE_WXML] || ''
  const pageWxss = sources[CONTENT_DETAIL_PAGE_WXSS] || ''
  const appJsonSource = sources['app.json'] || ''

  if (!pageJs) errors.push(`缺少原生文章详情页：${CONTENT_DETAIL_PAGE_JS}`)
  if (!pageJson) errors.push(`缺少原生文章详情页配置：${CONTENT_DETAIL_PAGE_JSON}`)
  if (!pageWxml) errors.push(`缺少原生文章详情页模板：${CONTENT_DETAIL_PAGE_WXML}`)
  if (!pageWxss) errors.push(`缺少原生文章详情页样式：${CONTENT_DETAIL_PAGE_WXSS}`)

  if (pageJs) {
    const clean = stripComments(pageJs)
    if (!clean.includes("require('../../../services/content')")) {
      errors.push(`${CONTENT_DETAIL_PAGE_JS} 必须只通过 Content Service 获取文章详情`)
    }
    if (/utils\/api-(?:client|transport)|config\/api-endpoints/.test(clean)) {
      errors.push(`${CONTENT_DETAIL_PAGE_JS} 不得直接依赖 API Client / Transport / Endpoint`)
    }
    if (hasPattern(WX_REQUEST_PATTERN, clean) || hasPattern(OTHER_NETWORK_PATTERN, clean)) {
      errors.push(`${CONTENT_DETAIL_PAGE_JS} 不得直接实现任何网络请求`)
    }
    if (hasPattern(STORAGE_ACCESS_PATTERN, clean)) {
      errors.push(`${CONTENT_DETAIL_PAGE_JS} 不得直接访问 Storage、History、Favorites 或 Content Cache`)
    }
    if (hasPattern(FIXTURE_IMPORT_PATTERN, clean)) {
      errors.push(`${CONTENT_DETAIL_PAGE_JS} 不得导入 scripts/fixtures 测试数据`)
    }
    if (hasPattern(THIRD_PARTY_DIRECT_PATTERN, clean) || /\bwanluu\.com\b/i.test(clean) || hasPattern(FULL_URL_PATTERN, clean)) {
      errors.push(`${CONTENT_DETAIL_PAGE_JS} 不得直连 Server / WordPress / wanluu.com / 第三方 Provider`)
    }
    if (hasPattern(UNSAFE_RUNTIME_PATTERN, clean)) {
      errors.push(`${CONTENT_DETAIL_PAGE_JS} 不得使用 eval / new Function`)
    }
    if (hasPattern(HTML_PARSER_IMPORT_PATTERN, clean)) {
      errors.push(`${CONTENT_DETAIL_PAGE_JS} 不得引入客户端 HTML Parser / Sanitizer`)
    }
    if (/onShareAppMessage|onShareTimeline/.test(clean)) {
      errors.push(`${CONTENT_DETAIL_PAGE_JS} Step 6 不得主动新增分享能力`)
    }
    if (hasPattern(CONTENT_FAKE_COPY_PATTERN, clean)) {
      errors.push(`${CONTENT_DETAIL_PAGE_JS} 不得硬编码生产假文章详情`)
    }
  }

  if (pageWxml) {
    if (hasPattern(WEBVIEW_PATTERN, pageWxml)) errors.push(`${CONTENT_DETAIL_PAGE_WXML} 不得使用 WebView`)
    if (!hasPattern(RICH_TEXT_PATTERN, pageWxml)) errors.push(`${CONTENT_DETAIL_PAGE_WXML} 必须使用原生 rich-text 渲染安全正文`)
    if (!/nodes\s*=\s*["']\{\{\s*article\.content\s*\}\}["']/.test(pageWxml)) {
      errors.push(`${CONTENT_DETAIL_PAGE_WXML} rich-text 必须消费 Detail ViewModel 的 article.content`)
    }
    if (/<web-view\b|\beval\s*\(|\bnew\s+Function\s*\(/i.test(pageWxml)) {
      errors.push(`${CONTENT_DETAIL_PAGE_WXML} 不得使用 WebView 或动态 JS Runtime`)
    }
  }

  if (appJsonSource) {
    try {
      const appConfig = JSON.parse(appJsonSource)
      const packages = Array.isArray(appConfig.subPackages) ? appConfig.subPackages : []
      const contentPackage = packages.find((item) => item && item.root === 'packageContent')
      if (!contentPackage || !Array.isArray(contentPackage.pages) || !contentPackage.pages.includes('pages/article-detail/article-detail')) {
        errors.push('app.json 必须正确注册 packageContent/pages/article-detail/article-detail')
      }
      const tabItems = appConfig.tabBar && Array.isArray(appConfig.tabBar.list) ? appConfig.tabBar.list : []
      if (tabItems.some((item) => item && String(item.pagePath || '').startsWith('packageContent/'))) {
        errors.push('packageContent 当前不得加入 TabBar')
      }
    } catch (error) {
      errors.push('app.json 无法解析，无法验证文章详情页注册')
    }
  } else {
    errors.push('缺少 app.json，无法验证文章详情页注册')
  }

  return errors
}

const validateContentCacheSources = (sources = {}) => {
  const errors = []
  const cacheSource = sources[CONTENT_CACHE_FILE] || ''
  const contentService = sources[CONTENT_SERVICE_FILE] || ''

  if (!cacheSource) return [`缺少 Content Cache：${CONTENT_CACHE_FILE}`]
  const clean = stripComments(cacheSource)

  if (!clean.includes(`'${CONTENT_CACHE_KEY}'`) && !clean.includes(`"${CONTENT_CACHE_KEY}"`)) {
    errors.push(`${CONTENT_CACHE_FILE} 必须使用独立 Storage Key ${CONTENT_CACHE_KEY}`)
  }
  const keys = clean.match(CONTENT_STORAGE_KEY_PATTERN) || []
  keys.forEach((key) => {
    if (key !== CONTENT_CACHE_KEY) errors.push(`${CONTENT_CACHE_FILE} 出现未批准 Content Storage Key：${key}`)
  })
  ;['wl_meta_v1', 'wl_favorites_v1', 'wl_history_v1', 'wl_tool_usage_v1', 'wl_tool_state_v1'].forEach((key) => {
    if (clean.includes(key)) errors.push(`${CONTENT_CACHE_FILE} 不得读写 Stage 3 Storage Key：${key}`)
  })
  if (!clean.includes("require('./storage')")) errors.push(`${CONTENT_CACHE_FILE} 必须复用统一 services/storage.js Adapter`)
  if (hasPattern(DIRECT_WX_STORAGE_PATTERN, clean)) errors.push(`${CONTENT_CACHE_FILE} 不得直接调用 wx.*Storage，必须经 Storage Adapter`)
  if (/wx\.clearStorage(?:Sync)?\s*\(/.test(clean)) errors.push(`${CONTENT_CACHE_FILE} 严禁全局 clearStorage`)
  if (!/clearContentCache/.test(clean) || !/remove\s*\(\s*CONTENT_CACHE_KEY\s*\)/.test(clean)) {
    errors.push(`${CONTENT_CACHE_FILE} clearContentCache 必须只删除 Content Cache Key`)
  }
  if (hasPattern(CONTENT_PROFILE_PATTERN, clean)) errors.push(`${CONTENT_CACHE_FILE} 不得记录用户画像、身份、Token 或 Authorization`)
  if (hasHardcodedSecret(clean)) errors.push(`${CONTENT_CACHE_FILE} 不得硬编码 Secret / Token / Password`)
  if (!contentService.includes("require('./content-cache')")) errors.push(`${CONTENT_SERVICE_FILE} 必须通过 Content Cache Service 集成缓存`)

  ;[CONTENT_PAGE_JS, CONTENT_DETAIL_PAGE_JS].forEach((file) => {
    const source = stripComments(sources[file] || '')
    if (source.includes(CONTENT_CACHE_KEY) || /services\/content-cache/.test(source) || hasPattern(STORAGE_ACCESS_PATTERN, source)) {
      errors.push(`${file} 不得直接访问 Content Cache 或 Storage`)
    }
  })

  return errors
}

const validateGithubControlledSources = (sources = {}) => {
  const errors = []
  const pageJs = sources[GITHUB_PAGE_JS] || ''
  const pageJson = sources[GITHUB_PAGE_JSON] || ''
  const pageWxml = sources[GITHUB_PAGE_WXML] || ''
  const pageWxss = sources[GITHUB_PAGE_WXSS] || ''
  const githubService = sources[GITHUB_SERVICE_FILE] || ''
  const appJsonSource = sources['app.json'] || ''

  if (!pageJs || !pageJson || !pageWxml || !pageWxss) errors.push('packageGithub 受控开发骨架四文件必须保持完整')
  if (!githubService) errors.push(`缺少 GitHub Service：${GITHUB_SERVICE_FILE}`)

  const githubPageSource = stripComments(`${pageJs}\n${pageWxml}`)
  const cleanPageJs = stripComments(pageJs)
  if (!cleanPageJs.includes("require('../../../services/github')")) {
    errors.push('packageGithub Step 9 页面必须只通过 GitHub Service 获取榜单数据')
  }
  if (/utils\/api-(?:client|transport|schema)|config\/api-endpoints/.test(cleanPageJs)) {
    errors.push('packageGithub Step 9 页面不得直接依赖 API Client / Transport / Endpoint / Schema')
  }
  if (hasPattern(WX_REQUEST_PATTERN, githubPageSource) || hasPattern(OTHER_NETWORK_PATTERN, githubPageSource)) {
    errors.push('packageGithub 当前不得直接发起任何网络请求')
  }
  if (hasPattern(THIRD_PARTY_DIRECT_PATTERN, githubPageSource) || /api\.github\.com/i.test(githubPageSource)) {
    errors.push('packageGithub 当前不得直连 GitHub Provider')
  }
  if (hasPattern(FULL_URL_PATTERN, githubPageSource) || hasPattern(GITHUB_EXTERNAL_ACTION_PATTERN, githubPageSource) || hasPattern(WEBVIEW_PATTERN, pageWxml)) {
    errors.push('packageGithub Step 9 不得主动打开、复制或 WebView 承载 Repository URL')
  }
  if (hasPattern(GITHUB_FAKE_DATA_PATTERN, githubPageSource) || hasPattern(GITHUB_HARDCODED_REPO_PATTERN, cleanPageJs)) {
    errors.push('packageGithub Step 9 不得硬编码假榜单、假 Repo 或假 Stars')
  }
  if (hasHardcodedSecret(githubPageSource) || hasPattern(GITHUB_SECRET_PATTERN, githubPageSource)) errors.push('packageGithub 不得硬编码 GitHub Token / Secret')
  if (hasPattern(STORAGE_ACCESS_PATTERN, githubPageSource) || hasPattern(FIXTURE_IMPORT_PATTERN, githubPageSource) || /\bwl_(?:github|content)_/.test(githubPageSource)) {
    errors.push('packageGithub Step 9 不得直接访问 Storage、Cache 或测试 Fixture')
  }

  if (githubService) {
    const cleanService = stripComments(githubService)
    if (!cleanService.includes("require('../config/api-endpoints')")) errors.push('services/github.js 必须复用 config/api-endpoints.js')
    if (!cleanService.includes("require('../utils/api-client')")) errors.push('services/github.js 必须复用统一 API Client')
    if (!cleanService.includes("require('../utils/api-schema')")) errors.push('services/github.js 必须复用 utils/api-schema.js')
    if (hasPattern(WX_REQUEST_PATTERN, cleanService) || hasPattern(OTHER_NETWORK_PATTERN, cleanService) || /api\.github\.com/i.test(cleanService)) {
      errors.push('services/github.js 不得直接实现 GitHub Provider 网络请求')
    }
    if (hasPattern(FULL_URL_PATTERN, cleanService) || /\/api\/v1\/github\/rankings/.test(cleanService)) {
      errors.push('services/github.js 不得硬编码完整 Server URL 或 GitHub Endpoint')
    }
    if (hasPattern(STORAGE_ACCESS_PATTERN, cleanService) || /content-cache|wl_github_|wl_content_cache/.test(cleanService)) {
      errors.push('services/github.js Step 8 不得读写 Storage 或实现 GitHub Cache')
    }
    if (hasPattern(FIXTURE_IMPORT_PATTERN, cleanService)) errors.push('services/github.js 不得导入测试 Fixture')
    if (hasPattern(GITHUB_SECRET_PATTERN, cleanService) || hasHardcodedSecret(cleanService)) errors.push('services/github.js 不得包含 GitHub Token / Authorization Secret')
    if (hasPattern(GITHUB_FAKE_DATA_PATTERN, cleanService)) errors.push('services/github.js 不得硬编码生产假榜单')
    if (/\.sort\s*\(|trending\s*score|trendingScore|trendScore/i.test(cleanService)) errors.push('services/github.js 不得客户端排序或计算 Trending Score')
  }

  try {
    const appConfig = JSON.parse(appJsonSource)
    const packages = Array.isArray(appConfig.subPackages) ? appConfig.subPackages : []
    const githubPackage = packages.find((item) => item && item.root === 'packageGithub')
    if (!githubPackage || !Array.isArray(githubPackage.pages) || githubPackage.pages.length !== 1 || githubPackage.pages[0] !== 'pages/index/index') {
      errors.push('packageGithub Step 9 必须继续仅使用现有 pages/index/index 页面')
    }
    const tabItems = appConfig.tabBar && Array.isArray(appConfig.tabBar.list) ? appConfig.tabBar.list : []
    if (tabItems.some((item) => item && String(item.pagePath || '').startsWith('packageGithub/'))) {
      errors.push('packageGithub Step 9 不得加入 TabBar')
    }
  } catch (error) {
    errors.push('app.json 无法解析，无法验证 packageGithub 受控边界')
  }

  ;['pages/index/index.js', 'pages/index/index.wxml', 'pages/discover/discover.js', 'pages/discover/discover.wxml'].forEach((file) => {
    const source = sources[file] || ''
    if (/packageGithub\/|services\/github/.test(source)) errors.push(`${file} Step 9 不得开放 GitHub 正式入口`)
  })

  return errors
}

const validateGithubPageSources = (sources = {}) => {
  const errors = []
  const pageJs = sources[GITHUB_PAGE_JS] || ''
  const pageWxml = sources[GITHUB_PAGE_WXML] || ''
  const viewModel = sources[GITHUB_VIEW_MODEL_FILE] || ''

  if (!viewModel) errors.push(`缺少 GitHub Ranking ViewModel：${GITHUB_VIEW_MODEL_FILE}`)

  const cleanPage = stripComments(pageJs)
  const cleanViewModel = stripComments(viewModel)
  if (pageJs && !cleanPage.includes("require('../../../utils/github-ranking-view-model')")) {
    errors.push(`${GITHUB_PAGE_JS} 必须复用 GitHub Ranking ViewModel`)
  }
  if (!/DEFAULT_PERIOD\s*=\s*['"]daily['"]/.test(cleanPage) || !/PAGE\s*=\s*1\b/.test(cleanPage) || !/PAGE_SIZE\s*=\s*5\b/.test(cleanPage)) {
    errors.push(`${GITHUB_PAGE_JS} 必须固定默认 daily、page=1、pageSize=5`)
  }
  if (/\bpage\s*:\s*2\b/.test(cleanPage)) errors.push(`${GITHUB_PAGE_JS} 第一版不得请求第 2 页`)
  if (/<image\b/i.test(pageWxml)) errors.push(`${GITHUB_PAGE_WXML} 第一版不得引入 Repo Avatar / 远程图片`)
  if (/开发中|敬请期待|Skeleton|当前尚未开放榜单数据/.test(pageWxml)) errors.push(`${GITHUB_PAGE_WXML} Step 9 不得保留 Skeleton 占位文案`)

  if (viewModel) {
    if (hasPattern(WX_REQUEST_PATTERN, cleanViewModel) || hasPattern(OTHER_NETWORK_PATTERN, cleanViewModel)
      || hasPattern(STORAGE_ACCESS_PATTERN, cleanViewModel) || /services\/github|api\.github\.com/i.test(cleanViewModel)) {
      errors.push(`${GITHUB_VIEW_MODEL_FILE} 必须保持纯展示逻辑，不得访问网络、Storage 或 Service`)
    }
    if (/\.sort\s*\(|trending\s*score|trendingScore|trendScore/i.test(cleanViewModel)) {
      errors.push(`${GITHUB_VIEW_MODEL_FILE} 不得重新排序或计算 Trending Score`)
    }
    ;[['daily', '今日'], ['weekly', '本周'], ['all', '总榜']].forEach(([period, label]) => {
      if (!cleanViewModel.includes(`value: '${period}'`) || !cleanViewModel.includes(`label: '${label}'`)) {
        errors.push(`${GITHUB_VIEW_MODEL_FILE} 必须固定 ${period} → ${label} 映射`)
      }
    })
  }

  return errors
}

const validateStage5AuditSources = (sources = {}) => {
  const errors = []
  const environment = stripComments(sources['config/environment.js'] || '')
  const apiEndpoints = stripComments(sources['config/api-endpoints.js'] || '')
  const apiExample = stripComments(sources['config/api.example.js'] || '')
  const appConfigSource = stripComments(sources['config/app.js'] || '')
  const moderationConfig = stripComments(sources['config/moderation.js'] || '')
  const apiClient = stripComments(sources['utils/api-client.js'] || '')
  const apiTransport = stripComments(sources[WECHAT_TRANSPORT_FILE] || '')
  const apiSchema = stripComments(sources['utils/api-schema.js'] || '')
  const apiContract = stripComments(sources['utils/api-contract.js'] || '')
  const contentService = stripComments(sources[CONTENT_SERVICE_FILE] || '')
  const githubService = stripComments(sources[GITHUB_SERVICE_FILE] || '')
  const aiService = stripComments(sources['services/ai.js'] || '')
  const contentCache = stripComments(sources[CONTENT_CACHE_FILE] || '')
  const imageModeration = stripComments(sources[BASELINE_DORMANT_UPLOAD_ADAPTER] || '')
  const imagePicker = stripComments(sources['utils/image-picker.js'] || '')
  const dataSchema = stripComments(sources['utils/data-schema.js'] || '')
  const packageAiJs = stripComments(sources['packageAI/pages/index/index.js'] || '')
  const packageAiWxml = sources['packageAI/pages/index/index.wxml'] || ''

  if (!/const\s+REMOTE_API_ENABLED\s*=\s*false\b/.test(environment)) {
    errors.push('Stage 5 Remote 总审计：REMOTE_API_ENABLED 必须保持 false')
  }
  const remoteBindings = environment.match(/remoteApiEnabled\s*:\s*REMOTE_API_ENABLED\b/g) || []
  if (remoteBindings.length !== 2) errors.push('Stage 5 Remote 总审计：development / production 必须共同绑定关闭的 REMOTE_API_ENABLED')
  if (hasPattern(REMOTE_OVERRIDE_PATTERN, environment.replace(/const\s+REMOTE_API_ENABLED\s*=\s*false\b/, ''))) {
    errors.push('Stage 5 Remote 总审计：不得通过环境变量、Storage、启动参数或隐藏逻辑动态开启 Remote')
  }
  const environmentUrls = environment.match(/https?:\/\/[^'"`\s]+/g) || []
  if (environmentUrls.length !== 1 || environmentUrls[0] !== 'https://api.example.com') {
    errors.push('Stage 5 Base URL 必须唯一保持 https://api.example.com 占位地址')
  }

  if (apiExample) {
    if (hasPattern(REAL_SERVER_TARGET_PATTERN, apiExample) || hasRealSecretMaterial(apiExample)) {
      errors.push('config/api.example.js 只能包含无 Secret 的占位配置，不得包含真实服务地址')
    }
    if (!apiExample.includes('YOUR_TEST_HOST') || !apiExample.includes('YOUR_PRODUCTION_DOMAIN')) {
      errors.push('config/api.example.js 必须保持显式 placeholder 示例')
    }
  }

  if (!apiEndpoints.includes("API_VERSION = 'v1'") || !apiEndpoints.includes("API_PREFIX = `/api/${API_VERSION}`")) {
    errors.push('Stage 5 API Version 必须固定为 /api/v1')
  }
  if (hasPattern(FULL_URL_PATTERN, apiEndpoints)) errors.push('Stage 5 API Endpoint 必须全部为相对路径')

  const productionJs = Object.entries(sources).filter(([file]) => file.endsWith('.js') && !file.startsWith('scripts/'))
  productionJs.forEach(([file, rawSource]) => {
    const clean = stripComments(rawSource)
    if (file !== WECHAT_TRANSPORT_FILE && /wx\.request\s*\(/.test(clean)) {
      errors.push(`${file} Stage 5 总审计：wx.request 只能存在于 ${WECHAT_TRANSPORT_FILE}`)
    }
    if (file !== BASELINE_DORMANT_UPLOAD_ADAPTER && /wx\.uploadFile\s*\(/.test(clean)) {
      errors.push(`${file} Stage 5 总审计：不得新增 wx.uploadFile`)
    }
    if (/\bfetch\s*\(|XMLHttpRequest/.test(clean)) errors.push(`${file} Stage 5 总审计：不得使用 fetch / XMLHttpRequest`)
    if (hasPattern(THIRD_PARTY_DIRECT_PATTERN, clean)) errors.push(`${file} Stage 5 总审计：不得直连第三方 Provider`)
    if (hasPattern(REAL_SERVER_TARGET_PATTERN, clean)) errors.push(`${file} Stage 5 总审计：不得硬编码真实服务器地址或 IP`)
    if (hasRealSecretMaterial(clean)) errors.push(`${file} Stage 5 总审计：发现疑似真实 Secret / Token / Password`)
    if (hasPattern(FIXTURE_IMPORT_PATTERN, clean)) errors.push(`${file} Stage 5 总审计：生产代码不得导入 scripts/fixtures`)
    if (/wx\.clearStorage(?:Sync)?\s*\(/.test(clean)) errors.push(`${file} Stage 5 总审计：禁止全局 wx.clearStorage`)
  })

  if (!moderationConfig || !/enabled\s*:\s*false\b/.test(moderationConfig) || !/provider\s*:\s*['"]none['"]/.test(moderationConfig)) {
    errors.push('Stage 4 既有 image-moderation 例外必须继续默认关闭且 provider=none')
  }
  if (imageModeration) {
    const uploadCalls = imageModeration.match(/wx\.uploadFile\s*\(/g) || []
    if (uploadCalls.length !== 1) errors.push('utils/image-moderation.js 必须保持唯一 dormant wx.uploadFile 例外')
    if (/wx\.request\s*\(|\bfetch\s*\(|XMLHttpRequest/.test(imageModeration)) {
      errors.push('utils/image-moderation.js 既有例外不得扩展为其他网络栈')
    }
    if (hasRealSecretMaterial(imageModeration)) errors.push('utils/image-moderation.js 不得包含真实 Secret')
  }

  ;[
    [CONTENT_SERVICE_FILE, contentService],
    [GITHUB_SERVICE_FILE, githubService],
    ['services/ai.js', aiService],
  ].forEach(([file, clean]) => {
    if (SERVICE_TRANSPORT_IMPORT_PATTERN.test(clean)) errors.push(`${file} 不得越层直接依赖 API Transport`)
    if (/wx\.request\s*\(/.test(clean)) errors.push(`${file} 不得直接调用 wx.request`)
  })

  if (API_CLIENT_REVERSE_DEP_PATTERN.test(apiClient)) errors.push('utils/api-client.js 不得反向依赖业务 Service / Page / Storage / Discovery / Tool Logic')
  if (/\bAuthorization\b|\bBearer\b/.test(apiClient)) errors.push('utils/api-client.js 当前不得默认注入 Authorization / Bearer')
  if (TRANSPORT_BUSINESS_PATTERN.test(apiTransport)) errors.push('utils/api-transport.js 不得理解 Content / GitHub / Repo / period 等业务语义')

  const stage5PageJs = [
    CONTENT_PAGE_JS,
    CONTENT_DETAIL_PAGE_JS,
    GITHUB_PAGE_JS,
    'packageAI/pages/index/index.js',
  ]
  stage5PageJs.forEach((file) => {
    const clean = stripComments(sources[file] || '')
    if (/utils\/api-(?:client|transport|schema)|config\/api-endpoints/.test(clean)) errors.push(`${file} Stage 5 Page 不得越层调用 API 基础设施`)
  })

  const stage5RuntimeSources = [
    CONTENT_PAGE_JS,
    CONTENT_DETAIL_PAGE_JS,
    GITHUB_PAGE_JS,
    'packageAI/pages/index/index.js',
    CONTENT_SERVICE_FILE,
    GITHUB_SERVICE_FILE,
    'services/ai.js',
    'utils/content-list-view-model.js',
    'utils/content-detail-view-model.js',
    GITHUB_VIEW_MODEL_FILE,
  ]
  stage5RuntimeSources.forEach((file) => {
    const clean = stripComments(sources[file] || '')
    if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(clean)) errors.push(`${file} Stage 5 不得使用 eval / new Function`)
    if (IDENTITY_PATTERN.test(clean)) errors.push(`${file} Stage 5 不得收集 OpenID / UnionID / Device ID / Fingerprint 等身份数据`)
    if (ANALYTICS_PATTERN.test(clean)) errors.push(`${file} Stage 5 不得新增 Analytics / Tracking`)
  })

  ;[CONTENT_PAGE_WXML, CONTENT_DETAIL_PAGE_WXML, GITHUB_PAGE_WXML, 'packageAI/pages/index/index.wxml'].forEach((file) => {
    if (/<web-view\b/i.test(sources[file] || '')) errors.push(`${file} Stage 5 当前不得使用 WebView`)
  })
  if (!/<rich-text\b/i.test(sources[CONTENT_DETAIL_PAGE_WXML] || '')) errors.push('Content Detail 必须继续使用原生 rich-text')
  if (!apiSchema.includes("RICH_CONTENT_FORMAT = 'sanitized_html'") || !apiSchema.includes('isHttpsUrlOrEmpty') || !apiSchema.includes('https:')) {
    errors.push('Stage 5 Schema 必须继续固化 sanitized HTML 与 HTTPS URL 边界')
  }
  if (!/API_ERROR_TYPES/.test(apiContract) || !/normalizeEnvelope/.test(apiContract)) errors.push('Stage 5 必须继续复用唯一 API Contract / Envelope')

  if (!contentCache.includes("CONTENT_CACHE_KEY = 'wl_content_cache_v1'")) errors.push('Content Cache Key 必须固定 wl_content_cache_v1')
  ;[
    'CACHE_VERSION = 1',
    'LIST_TTL_MS = 5 * 60 * 1000',
    'DETAIL_TTL_MS = 30 * 60 * 1000',
    'MAX_STALE_MS = 24 * 60 * 60 * 1000',
    'MAX_LIST_ENTRIES = 10',
    'MAX_DETAIL_ENTRIES = 30',
    'MAX_DETAIL_CONTENT_CHARS = 200000',
  ].forEach((token) => {
    if (!contentCache.includes(token)) errors.push(`Content Cache 防回退规则缺失：${token}`)
  })
  STAGE3_STORAGE_KEYS.forEach((key) => {
    if (contentCache.includes(key)) errors.push(`Content Cache 不得读写 Stage 3 Key：${key}`)
  })

  const githubStorageScope = [GITHUB_PAGE_JS, GITHUB_SERVICE_FILE, GITHUB_VIEW_MODEL_FILE]
    .map((file) => stripComments(sources[file] || '')).join('\n')
  if (/\bwl_github_|wx\.(?:getStorage|setStorage|removeStorage|clearStorage)|\bstorage\.(?:get|set|remove|clear)/.test(githubStorageScope)) {
    errors.push('GitHub Stage 5 必须保持 Storage Key = 0')
  }
  const aiStorageScope = [packageAiJs, aiService].join('\n')
  if (/\bwl_ai_|wx\.(?:getStorage|setStorage|removeStorage|clearStorage)|\bstorage\.(?:get|set|remove|clear)/.test(aiStorageScope)) {
    errors.push('AI Stage 5 必须保持 Storage Key = 0')
  }
  if (/wx\.request\s*\(|\bfetch\s*\(|XMLHttpRequest|api\.openai\.com|api\.deepseek\.com|generativelanguage\.googleapis\.com|ark\.cn-beijing\.volces\.com/i.test(`${packageAiJs}\n${aiService}\n${packageAiWxml}`)) {
    errors.push('packageAI / services/ai.js 必须继续保持离线 Skeleton，不得直连 AI Provider')
  }

  if (!/DEFAULT_SOURCE_TYPE\s*=\s*\['album'\]/.test(imagePicker) || /['"]camera['"]/.test(imagePicker)) {
    errors.push('wx.chooseMedia 必须继续强制 album-only，不得恢复 camera')
  }

  const publicEntryScope = [
    'pages/index/index.js', 'pages/index/index.wxml',
    'pages/tools/tools.js', 'pages/tools/tools.wxml',
    'pages/discover/discover.js', 'pages/discover/discover.wxml',
    'pages/mine/mine.js', 'pages/mine/mine.wxml',
  ]
  publicEntryScope.forEach((file) => {
    if (STAGE5_PUBLIC_ENTRY_PATTERN.test(sources[file] || '')) errors.push(`${file} 当前不得开放 Content / GitHub / AI 正式入口`)
  })
  ;['ai', 'github', 'content'].forEach((feature) => {
    if (!new RegExp(`${feature}\\s*:\\s*false\\b`).test(appConfigSource)) errors.push(`config/app.js feature ${feature} 必须继续关闭`)
  })

  try {
    const appConfig = JSON.parse(sources['app.json'] || '{}')
    const tabs = appConfig.tabBar && Array.isArray(appConfig.tabBar.list) ? appConfig.tabBar.list.map((item) => item.pagePath) : []
    if (JSON.stringify(tabs) !== JSON.stringify(MAIN_TAB_PATHS)) errors.push('TabBar 必须继续保持：首页 / 工具 / 发现 / 我的')
    const permissions = Object.keys(appConfig.permission || {})
    if (permissions.length !== 1 || permissions[0] !== 'scope.writePhotosAlbum') errors.push('Stage 5 不得新增权限，当前只允许 scope.writePhotosAlbum')
    const packages = Array.isArray(appConfig.subPackages) ? appConfig.subPackages : []
    const toolPackage = packages.find((item) => item && item.root === 'packageTools')
    const toolPages = toolPackage && Array.isArray(toolPackage.pages) ? toolPackage.pages : []
    if (toolPages.length !== 24) errors.push('正式工具注册数量必须继续保持 24')
    if (toolPages.some((page) => /wooden-fish|zodiac/.test(String(page)))) errors.push('wooden-fish / zodiac 必须继续隐藏，不得恢复正式注册')
    const pageCount = (Array.isArray(appConfig.pages) ? appConfig.pages.length : 0)
      + packages.reduce((sum, item) => sum + (Array.isArray(item.pages) ? item.pages.length : 0), 0)
    if (pageCount !== 36) errors.push(`Stage 5 注册页面总数必须保持 36，当前为 ${pageCount}`)
  } catch (error) {
    errors.push('app.json 无法解析，Stage 5 总审计失败')
  }

  try {
    const projectConfig = JSON.parse(sources['project.config.json'] || '{}')
    if (projectConfig.appid !== PUBLIC_APPID_PLACEHOLDER) errors.push('project.config.json 公共 AppID 必须保持 placeholder')
  } catch (error) {
    errors.push('project.config.json 无法解析')
  }
  if (!/(?:^|\n)project\.private\.config\.json(?:\r?$|\n)/m.test(sources['.gitignore'] || '')) {
    errors.push('.gitignore 必须继续忽略 project.private.config.json')
  }

  if (!/SCHEMA_VERSION\s*=\s*1\b/.test(dataSchema)) errors.push('Stage 3 SCHEMA_VERSION 必须继续保持 1')
  STAGE3_STORAGE_KEYS.forEach((key) => {
    if (!dataSchema.includes(`'${key}'`)) errors.push(`Stage 3 Storage Key 防回退缺失：${key}`)
  })

  try {
    const packageConfig = JSON.parse(sources['package.json'] || '{}')
    const dependencies = Object.keys(packageConfig.dependencies || {}).sort()
    if (JSON.stringify(dependencies) !== JSON.stringify(['tdesign-miniprogram'])) {
      errors.push('Stage 5 不得新增 axios / lodash / schema / HTML 等 runtime dependency')
    }
  } catch (error) {
    errors.push('package.json 无法解析，无法完成 dependency audit')
  }

  return errors
}

const walkJs = (root, relativeRoot, out) => {
  const absolute = path.join(root, relativeRoot)
  if (!fs.existsSync(absolute)) return
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    if (['node_modules', 'miniprogram_npm', '.git', '.workbuddy'].includes(entry.name)) continue
    const relative = `${relativeRoot}/${entry.name}`.replace(/\\/g, '/')
    if (entry.isDirectory()) walkJs(root, relative, out)
    else if (entry.name.endsWith('.js')) out[relative] = read(path.join(root, relative))
  }
}

const runStage5StaticChecks = (root) => {
  const sources = {
    'app.js': read(path.join(root, 'app.js')),
    'app.json': read(path.join(root, 'app.json')),
    'app.wxss': read(path.join(root, 'app.wxss')),
    'project.config.json': read(path.join(root, 'project.config.json')),
    '.gitignore': read(path.join(root, '.gitignore')),
    'package.json': read(path.join(root, 'package.json')),
    'config/api.example.js': read(path.join(root, 'config/api.example.js')),
    'config/app.js': read(path.join(root, 'config/app.js')),
    'config/moderation.js': read(path.join(root, 'config/moderation.js')),
    'config/environment.js': read(path.join(root, 'config/environment.js')),
    'config/api-endpoints.js': read(path.join(root, 'config/api-endpoints.js')),
    'utils/api-client.js': read(path.join(root, 'utils/api-client.js')),
    'utils/api-contract.js': read(path.join(root, 'utils/api-contract.js')),
    'utils/api-schema.js': read(path.join(root, 'utils/api-schema.js')),
    'utils/image-picker.js': read(path.join(root, 'utils/image-picker.js')),
    'utils/data-schema.js': read(path.join(root, 'utils/data-schema.js')),
    [BASELINE_DORMANT_UPLOAD_ADAPTER]: read(path.join(root, BASELINE_DORMANT_UPLOAD_ADAPTER)),
    [CONTENT_SERVICE_FILE]: read(path.join(root, CONTENT_SERVICE_FILE)),
    [CONTENT_CACHE_FILE]: read(path.join(root, CONTENT_CACHE_FILE)),
    [GITHUB_SERVICE_FILE]: read(path.join(root, GITHUB_SERVICE_FILE)),
    'services/ai.js': read(path.join(root, 'services/ai.js')),
    [WECHAT_TRANSPORT_FILE]: read(path.join(root, WECHAT_TRANSPORT_FILE)),
    [CONTENT_PAGE_JS]: read(path.join(root, CONTENT_PAGE_JS)),
    [CONTENT_PAGE_JSON]: read(path.join(root, CONTENT_PAGE_JSON)),
    [CONTENT_PAGE_WXML]: read(path.join(root, CONTENT_PAGE_WXML)),
    [CONTENT_PAGE_WXSS]: read(path.join(root, CONTENT_PAGE_WXSS)),
    [CONTENT_DETAIL_PAGE_JS]: read(path.join(root, CONTENT_DETAIL_PAGE_JS)),
    [CONTENT_DETAIL_PAGE_JSON]: read(path.join(root, CONTENT_DETAIL_PAGE_JSON)),
    [CONTENT_DETAIL_PAGE_WXML]: read(path.join(root, CONTENT_DETAIL_PAGE_WXML)),
    [CONTENT_DETAIL_PAGE_WXSS]: read(path.join(root, CONTENT_DETAIL_PAGE_WXSS)),
    [GITHUB_PAGE_JS]: read(path.join(root, GITHUB_PAGE_JS)),
    [GITHUB_PAGE_JSON]: read(path.join(root, GITHUB_PAGE_JSON)),
    [GITHUB_PAGE_WXML]: read(path.join(root, GITHUB_PAGE_WXML)),
    [GITHUB_PAGE_WXSS]: read(path.join(root, GITHUB_PAGE_WXSS)),
    [GITHUB_VIEW_MODEL_FILE]: read(path.join(root, GITHUB_VIEW_MODEL_FILE)),
    'utils/content-list-view-model.js': read(path.join(root, 'utils/content-list-view-model.js')),
    'utils/content-detail-view-model.js': read(path.join(root, 'utils/content-detail-view-model.js')),
    'packageAI/pages/index/index.js': read(path.join(root, 'packageAI/pages/index/index.js')),
    'packageAI/pages/index/index.json': read(path.join(root, 'packageAI/pages/index/index.json')),
    'packageAI/pages/index/index.wxml': read(path.join(root, 'packageAI/pages/index/index.wxml')),
    'packageAI/pages/index/index.wxss': read(path.join(root, 'packageAI/pages/index/index.wxss')),
    'pages/index/index.js': read(path.join(root, 'pages/index/index.js')),
    'pages/index/index.wxml': read(path.join(root, 'pages/index/index.wxml')),
    'pages/tools/tools.js': read(path.join(root, 'pages/tools/tools.js')),
    'pages/tools/tools.wxml': read(path.join(root, 'pages/tools/tools.wxml')),
    'pages/discover/discover.js': read(path.join(root, 'pages/discover/discover.js')),
    'pages/discover/discover.wxml': read(path.join(root, 'pages/discover/discover.wxml')),
    'pages/mine/mine.js': read(path.join(root, 'pages/mine/mine.js')),
    'pages/mine/mine.wxml': read(path.join(root, 'pages/mine/mine.wxml')),
  }
  ;[
    'pages',
    'packageTools/pages',
    'packageUser/pages',
    'packageAI/pages',
    'packageGithub/pages',
    'packageContent/pages',
    'services',
    'utils',
  ].forEach((relativeRoot) => walkJs(root, relativeRoot, sources))

  return {
    errors: [
      ...validateStage5Sources(sources),
      ...validateContentPageSources(sources),
      ...validateContentDetailPageSources(sources),
      ...validateContentCacheSources(sources),
      ...validateGithubControlledSources(sources),
      ...validateGithubPageSources(sources),
      ...validateStage5AuditSources(sources),
    ],
    warnings: [],
  }
}

module.exports = {
  BASELINE_DORMANT_UPLOAD_ADAPTER,
  CONTENT_PAGE_JS,
  CONTENT_PAGE_JSON,
  CONTENT_PAGE_WXML,
  CONTENT_PAGE_WXSS,
  CONTENT_DETAIL_PAGE_JS,
  CONTENT_DETAIL_PAGE_JSON,
  CONTENT_DETAIL_PAGE_WXML,
  CONTENT_DETAIL_PAGE_WXSS,
  CONTENT_CACHE_FILE,
  CONTENT_CACHE_KEY,
  GITHUB_SERVICE_FILE,
  GITHUB_PAGE_JS,
  GITHUB_PAGE_JSON,
  GITHUB_PAGE_WXML,
  GITHUB_PAGE_WXSS,
  GITHUB_VIEW_MODEL_FILE,
  PUBLIC_APPID_PLACEHOLDER,
  STAGE5_AUDIT_RULE_IDS,
  CONTENT_SERVICE_FILE,
  WECHAT_TRANSPORT_FILE,
  runStage5StaticChecks,
  validateContentDetailPageSources,
  validateContentCacheSources,
  validateGithubControlledSources,
  validateGithubPageSources,
  validateStage5AuditSources,
  validateContentPageSources,
  validateStage5Sources,
}
