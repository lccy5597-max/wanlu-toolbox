const assert = require('assert')
const path = require('path')
const catalog = require('../utils/tool-catalog')
const {
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
} = require('./stage4-static-rules')

let passed = 0
const test = (name, fn) => {
  try {
    fn()
    passed += 1
  } catch (error) {
    error.message = `${name}: ${error.message}`
    throw error
  }
}

const validTool = (id, overrides = {}) => ({
  id,
  name: id,
  category: 'calc',
  path: `/packageTools/pages/${id}/${id}`,
  ...overrides,
})
const validTools24 = () => Array.from({ length: 24 }, (_, index) => validTool(`tool-${index}`))

// 1. 当前项目必须通过 Stage 4 静态规则。
test('current project passes Stage 4 static rules', () => {
  const result = runStage4StaticChecks(path.resolve(__dirname, '..'))
  assert.deepStrictEqual(result.errors, [])
  assert.deepStrictEqual(result.warnings, [])
})

// 2-4. catalog 完整性。
test('duplicate catalog id is detected', () => {
  const tools = validTools24(); tools[1].id = tools[0].id
  assert(validateCatalogTools(tools).some((item) => item.includes('重复 id')))
})
test('invalid catalog category is detected', () => {
  const tools = validTools24(); tools[0].category = 'text'
  assert(validateCatalogTools(tools).some((item) => item.includes('category 非法')))
})
test('missing catalog page path is detected', () => {
  const tools = validTools24()
  assert(validateCatalogTools(tools, { existsPath: () => false }).some((item) => item.includes('不存在页面')))
})

// 5-6. 权限与媒体来源。
test('camera permission is detected', () => {
  const errors = validateAppPrivacy({ permission: { 'scope.camera': { desc: 'camera' } } })
  assert(errors.some((item) => item.includes('scope.camera')))
})
test('camera sourceType is detected', () => assert.strictEqual(hasCameraSource("sourceType: ['album', 'camera']"), true))

// 7-10. Discovery / Search / Storage。
test('Discovery direct Storage access is detected', () => {
  assert(validateDiscoverySources({ 'pages/discover/discover.js': 'wx.getStorageSync(\'x\')' }).length > 0)
})
test('Search Storage persistence is detected', () => {
  const errors = validateSearchSources({
    'utils/tool-search.js': "wx.setStorageSync('q', query)",
    'pages/index/index.js': "require('../../utils/tool-search')",
    'pages/tools/tools.js': "require('../../utils/tool-search')",
  })
  assert(errors.some((item) => item.includes('持久化')))
})
test('wl_search storage key is detected', () => assert(findForbiddenStorageKeys("const KEY='wl_search_v1'").length > 0))
test('wl_recent storage key is detected', () => assert(findForbiddenStorageKeys("const KEY='wl_recent_v1'").length > 0))

// 11-12. 禁止工具不得恢复。
test('wooden-fish in catalog is detected', () => {
  const tools = validTools24(); tools[0] = validTool('wooden-fish')
  assert(validateCatalogTools(tools).some((item) => item.includes('wooden-fish')))
})
test('zodiac in catalog is detected', () => {
  const tools = validTools24(); tools[0] = validTool('zodiac')
  assert(validateCatalogTools(tools).some((item) => item.includes('zodiac')))
})

// 13-14. Usage 语义。
test('guide recordToolUse regression is detected', () => assert(validateUsageGuards('recordToolUse()', '').some((item) => item.includes('guide'))))
test('ruler recordToolUse regression is detected', () => assert(validateUsageGuards('', 'recordToolUse()').some((item) => item.includes('ruler'))))

// 15. 公共 AppID。
test('real public AppID risk is detected', () => {
  const errors = validateProjectConfig({ appid: 'wx1234567890abcdef' }, 'project.private.config.json')
  assert(errors.some((item) => item.includes('占位 AppID')))
})

// 16-18. 测试和文档不得误报为生产代码。
test('test file camera text is excluded from production scope', () => assert.strictEqual(isProductionPath('scripts/test-camera.js'), false))
test('Markdown API Key text is excluded from production scope', () => assert.strictEqual(isProductionPath('Wanlu_Toolbox_Test.md'), false))
test('test wooden-fish fixture is excluded from production scope', () => assert.strictEqual(isProductionPath('scripts/test-wooden-fish.js'), false))

// 19-20. 合法 Search / Discovery 不误报。
test('valid unified Search sources pass', () => {
  const errors = validateSearchSources({
    'utils/tool-search.js': 'const searchTools = () => []',
    'pages/index/index.js': "const { searchTools } = require('../../utils/tool-search')",
    'pages/tools/tools.js': "const { searchTools } = require('../../utils/tool-search')",
  })
  assert.deepStrictEqual(errors, [])
})
test('valid Discovery Service sources pass', () => {
  const errors = validateDiscoverySources({
    'pages/discover/discover.js': "const discovery = require('../../services/discovery')",
    'pages/discover/discover.wxml': '<view>精选工具</view>',
    'services/discovery.js': 'const getRecommendedTools = () => []',
    'utils/discovery-view-model.js': 'const mode = \'empty\'',
  })
  assert.deepStrictEqual(errors, [])
})

assert.strictEqual(catalog.tools.length, 24)
assert.strictEqual(PUBLIC_APPID_PLACEHOLDER, 'wx0000000000000000')
console.log(`Stage 4 static check tests: PASS (${passed} cases)`)
