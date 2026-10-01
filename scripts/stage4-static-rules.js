const fs = require('fs')
const path = require('path')

const PUBLIC_APPID_PLACEHOLDER = 'wx0000000000000000'
const FORMAL_CATEGORIES = new Set(['image', 'calc', 'other'])
const PROHIBITED_TOOL_IDS = new Set(['wooden-fish', 'zodiac'])
const FORBIDDEN_STORAGE_KEY_PATTERNS = [
  /wl_discovery_/i,
  /wl_recommend_/i,
  /wl_profile_/i,
  /wl_search_/i,
  /wl_recent_/i,
]
const REMOTE_REQUEST_PATTERN = /wx\.(?:request|uploadFile|downloadFile|connectSocket)\s*\(|\bfetch\s*\(|XMLHttpRequest/g

const read = (file) => {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch (error) {
    return ''
  }
}

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    return null
  }
}

const normalizePath = (value) => String(value || '').replace(/\\/g, '/')

const isProductionPath = (relativePath) => {
  const value = normalizePath(relativePath)
  if (!value) return false
  if (value.startsWith('scripts/')) return false
  if (value.startsWith('.workbuddy/')) return false
  if (value.includes('/node_modules/') || value.startsWith('node_modules/')) return false
  if (value.includes('/miniprogram_npm/') || value.startsWith('miniprogram_npm/')) return false
  if (/\.md$/i.test(value)) return false
  return true
}

const hasCameraSource = (source) => /sourceType\s*:\s*\[[^\]]*['"]camera['"]/s.test(String(source || ''))

const findForbiddenStorageKeys = (source) => FORBIDDEN_STORAGE_KEY_PATTERNS
  .filter((pattern) => pattern.test(String(source || '')))
  .map((pattern) => pattern.source)

const validateCatalogTools = (tools, options = {}) => {
  const errors = []
  const source = Array.isArray(tools) ? tools : []
  const expectedCount = options.expectedCount === undefined ? 24 : options.expectedCount
  const existsPath = typeof options.existsPath === 'function' ? options.existsPath : () => true
  const seenIds = new Set()
  const seenPaths = new Set()

  if (source.length !== expectedCount) {
    errors.push(`正式工具数量发生变化：当前 ${source.length}，Stage 4 基线 ${expectedCount}；请确认是否为经过批准的产品变更`)
  }

  source.forEach((tool, index) => {
    if (!tool || typeof tool !== 'object') {
      errors.push(`tool-catalog 第 ${index + 1} 项不是有效对象`)
      return
    }

    const id = String(tool.id || '').trim()
    const name = String(tool.name || tool.title || '').trim()
    const category = String(tool.category || '').trim()
    const toolPath = String(tool.path || '').trim()

    if (!id) errors.push(`tool-catalog 第 ${index + 1} 项缺少 id`)
    else if (seenIds.has(id)) errors.push(`tool-catalog 存在重复 id：${id}`)
    else seenIds.add(id)

    if (PROHIBITED_TOOL_IDS.has(id)) errors.push(`禁止工具 ${id} 被恢复到正式 tool-catalog`)
    if (!name) errors.push(`tool-catalog ${id || `#${index + 1}`} 缺少 name/title`)
    if (!FORMAL_CATEGORIES.has(category)) errors.push(`tool-catalog ${id || `#${index + 1}`} category 非法：${category || '空'}`)

    if (!toolPath) {
      errors.push(`tool-catalog ${id || `#${index + 1}`} path 为空`)
    } else {
      if (seenPaths.has(toolPath)) errors.push(`tool-catalog 存在重复 path：${toolPath}`)
      else seenPaths.add(toolPath)
      if (!toolPath.startsWith('/packageTools/pages/')) errors.push(`tool-catalog ${id || `#${index + 1}`} path 不属于正式 packageTools：${toolPath}`)
      if (!existsPath(toolPath)) errors.push(`tool-catalog ${id || `#${index + 1}`} 指向不存在页面：${toolPath}`)
    }
  })

  return errors
}

const validateAppPrivacy = (appJson, productionSources = {}) => {
  const errors = []
  const permissionKeys = Object.keys((appJson && appJson.permission) || {})
  const forbiddenPermissions = ['scope.camera', 'scope.userLocation', 'scope.record', 'scope.microphone', 'scope.contacts']

  forbiddenPermissions.forEach((key) => {
    if (permissionKeys.includes(key)) errors.push(`app.json 不得声明隐私权限 ${key}`)
  })

  Object.entries(productionSources).forEach(([file, source]) => {
    if (hasCameraSource(source)) errors.push(`${file} 不得启用 camera 媒体来源`)
    if (/scope\.camera|scope\.userLocation|wx\.getLocation\s*\(|wx\.startRecord\s*\(|wx\.getRecorderManager\s*\(/.test(source)) {
      errors.push(`${file} 包含 Stage 4 禁止的额外隐私能力`)
    }
  })

  return errors
}

const validateDiscoverySources = (sources = {}) => {
  const errors = []
  const storageTokens = ['wx.getStorage', 'wx.setStorage', 'getStorageSync', 'setStorageSync', 'STORAGE_KEYS', 'services/storage']
  const fakeCopy = ['全网热门', '实时热门', '今日热榜', '今日已有', '用户推荐率', 'AI推荐', 'AI 推荐', '热门工具', '今日热门']

  Object.entries(sources).forEach(([file, source]) => {
    storageTokens.forEach((token) => {
      if (source.includes(token)) errors.push(`${file} Discovery 不得直接访问 Storage：${token}`)
    })
    if (file.endsWith('.wxml')) {
      fakeCopy.forEach((text) => {
        if (source.includes(text)) errors.push(`${file} 存在无真实数据支撑的发现页文案：${text}`)
      })
    }
  })

  return errors
}

const validateSearchSources = (sources = {}) => {
  const errors = []
  const toolSearch = sources['utils/tool-search.js'] || ''
  const pageSources = [sources['pages/index/index.js'] || '', sources['pages/tools/tools.js'] || '']

  ;['setStorage', 'getStorage', 'wl_search_'].forEach((token) => {
    Object.entries(sources).forEach(([file, source]) => {
      if (source.includes(token)) errors.push(`${file} 搜索不得持久化文本或搜索历史：${token}`)
    })
  })

  ;['services/favorites', 'services/history', 'services/tool-usage', 'useCount', 'Math.random('].forEach((token) => {
    if (toolSearch.includes(token)) errors.push(`utils/tool-search.js 不得读取个人行为数据改变文本搜索排名：${token}`)
  })

  pageSources.forEach((source, index) => {
    const file = index === 0 ? 'pages/index/index.js' : 'pages/tools/tools.js'
    if (!source.includes("utils/tool-search") && !source.includes("../../utils/tool-search")) {
      errors.push(`${file} 未接入统一 utils/tool-search.js`)
    }
    ;['name.includes(', 'keywords.some(', 'description.includes(', 'matchScore', '_score'].forEach((token) => {
      if (source.includes(token)) errors.push(`${file} 出现第二套文本搜索实现：${token}`)
    })
  })

  return errors
}

const validateUsageGuards = (guideSource, rulerSource) => {
  const errors = []
  if (/recordToolUse\s*\(/.test(String(guideSource || ''))) errors.push('guide 当前为说明页，不得调用 recordToolUse()')
  if (/recordToolUse\s*\(/.test(String(rulerSource || ''))) errors.push('ruler 当前无明确完成测量动作，不得调用 recordToolUse()')
  return errors
}

const validateProjectConfig = (projectConfig, gitignoreText = '') => {
  const errors = []
  if (!projectConfig || projectConfig.appid !== PUBLIC_APPID_PLACEHOLDER) {
    errors.push('project.config.json 必须使用公共占位 AppID')
  }
  if (!String(gitignoreText).split(/\r?\n/).includes('project.private.config.json')) {
    errors.push('project.private.config.json 必须被 .gitignore 明确忽略')
  }
  return errors
}

const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'miniprogram_npm', '.git', '.workbuddy'].includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

const runStage4StaticChecks = (root) => {
  const errors = []
  const warnings = []
  const rel = (file) => normalizePath(path.relative(root, file))
  const get = (relativePath) => read(path.join(root, relativePath))
  const appJson = readJson(path.join(root, 'app.json')) || {}
  const projectConfig = readJson(path.join(root, 'project.config.json')) || {}
  const gitignoreText = get('.gitignore')
  const catalogModule = require(path.join(root, 'utils/tool-catalog.js'))
  const tools = catalogModule.tools || []

  errors.push(...validateCatalogTools(tools, {
    expectedCount: 24,
    existsPath: (toolPath) => ['.js', '.json', '.wxml', '.wxss'].every((ext) => fs.existsSync(path.join(root, toolPath.replace(/^\//, '') + ext))),
  }))
  errors.push(...validateProjectConfig(projectConfig, gitignoreText))

  const discoverySources = {
    'pages/discover/discover.js': get('pages/discover/discover.js'),
    'pages/discover/discover.wxml': get('pages/discover/discover.wxml'),
    'services/discovery.js': get('services/discovery.js'),
    'utils/discovery-view-model.js': get('utils/discovery-view-model.js'),
  }
  errors.push(...validateDiscoverySources(discoverySources))

  const searchSources = {
    'utils/tool-search.js': get('utils/tool-search.js'),
    'pages/index/index.js': get('pages/index/index.js'),
    'pages/tools/tools.js': get('pages/tools/tools.js'),
  }
  errors.push(...validateSearchSources(searchSources))

  errors.push(...validateUsageGuards(
    get('packageTools/pages/guide/guide.js'),
    get('packageTools/pages/ruler/ruler.js'),
  ))

  const registeredPages = [
    ...(appJson.pages || []),
    ...(appJson.subPackages || []).flatMap((sub) => (sub.pages || []).map((page) => `${sub.root}/${page}`)),
  ]
  ;['packageTools/pages/wooden-fish/wooden-fish', 'packageTools/pages/zodiac/zodiac'].forEach((page) => {
    if (registeredPages.includes(page)) errors.push(`禁止工具被恢复为正式注册页面：${page}`)
  })

  const mainPageSources = ['pages/index/index.js', 'pages/tools/tools.js', 'pages/discover/discover.js']
    .map((file) => get(file)).join('\n')
  ;['packageAI', 'packageGithub', 'services/ai', 'services/github', 'services/content'].forEach((token) => {
    if (mainPageSources.includes(token)) errors.push(`未来模块被意外开放到正式主页面：${token}`)
  })

  const tabPaths = ((appJson.tabBar && appJson.tabBar.list) || []).map((item) => item.pagePath)
  if (tabPaths.some((page) => /^package(?:AI|Github)\//.test(page))) {
    errors.push('packageAI / packageGithub 不得加入当前正式 TabBar')
  }

  const productionFiles = walk(root).filter((file) => {
    const relative = rel(file)
    if (!isProductionPath(relative)) return false
    if (!/\.(js|json|wxml|wxss)$/i.test(relative)) return false
    if (relative.startsWith('packageTools/pages/wooden-fish/') || relative.startsWith('packageTools/pages/zodiac/')) return false
    return true
  })
  const productionSources = {}
  productionFiles.forEach((file) => { productionSources[rel(file)] = read(file) })

  errors.push(...validateAppPrivacy(appJson, productionSources))

  Object.entries(productionSources).forEach(([file, source]) => {
    findForbiddenStorageKeys(source).forEach((pattern) => errors.push(`${file} 新增了禁止的 Stage 4 Storage Key：${pattern}`))
  })

  const remoteScope = Object.entries(productionSources).filter(([file]) => {
    if (['services/ai.js', 'services/github.js', 'services/content.js', 'utils/image-moderation.js'].includes(file)) return false
    return file.startsWith('pages/')
      || file.startsWith('packageTools/pages/')
      || file === 'services/discovery.js'
      || file === 'utils/tool-search.js'
      || file === 'utils/discovery-view-model.js'
      || file.startsWith('utils/tool-logic/')
  })
  remoteScope.forEach(([file, source]) => {
    const clean = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
    if (REMOTE_REQUEST_PATTERN.test(clean)) errors.push(`${file} Stage 4 正式业务不得新增真实远程请求`)
    REMOTE_REQUEST_PATTERN.lastIndex = 0
  })

  ;['services/ai.js', 'services/github.js', 'services/content.js'].forEach((file) => {
    const source = get(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
    if (REMOTE_REQUEST_PATTERN.test(source)) errors.push(`${file} 未来服务骨架当前不得发起真实网络请求`)
    REMOTE_REQUEST_PATTERN.lastIndex = 0
  })

  return { errors, warnings }
}

module.exports = {
  PUBLIC_APPID_PLACEHOLDER,
  findForbiddenStorageKeys,
  hasCameraSource,
  isProductionPath,
  runStage4StaticChecks,
  validateAppPrivacy,
  validateCatalogTools,
  validateDiscoverySources,
  validateProjectConfig,
  validateSearchSources,
  validateUsageGuards,
}
