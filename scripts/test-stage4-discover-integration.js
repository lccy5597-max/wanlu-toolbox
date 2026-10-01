const assert = require('assert')
const fs = require('fs')
const path = require('path')

const {
  DISCOVERY_MODE,
  MAX_TOOLS_PER_SECTION,
  buildDiscoveryViewModel,
  countBehaviorTools,
  isDisplayableTool,
} = require('../utils/discovery-view-model')

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

const tool = (id, overrides = {}) => ({
  id,
  name: id,
  description: `${id} desc`,
  category: 'image',
  path: `/packageTools/pages/${id}/${id}`,
  enabled: true,
  ...overrides,
})
const ids = (items) => items.map((item) => item.id)
const section = (vm, key) => vm.toolSections.find((item) => item.key === key)
const snapshot = (value) => JSON.stringify(value)
const allRenderedIds = (vm) => vm.toolSections.flatMap((item) => ids(item.tools))
const featured = [tool('featured-a'), tool('featured-b'), tool('featured-c'), tool('featured-d')]

// Mode thresholds and core sections.
test('empty mode with no behavior', () => assert.strictEqual(buildDiscoveryViewModel({ featured }).mode, DISCOVERY_MODE.EMPTY))
test('empty behavior count is zero', () => assert.strictEqual(buildDiscoveryViewModel({ featured }).behaviorCount, 0))
test('one behavior tool is light', () => assert.strictEqual(buildDiscoveryViewModel({ recent: [tool('a')] }).mode, DISCOVERY_MODE.LIGHT))
test('two behavior tools are light', () => assert.strictEqual(buildDiscoveryViewModel({ recent: [tool('a'), tool('b')] }).mode, DISCOVERY_MODE.LIGHT))
test('three behavior tools are rich', () => assert.strictEqual(buildDiscoveryViewModel({ recent: [tool('a'), tool('b'), tool('c')] }).mode, DISCOVERY_MODE.RICH))
test('more than three behavior tools remain rich', () => assert.strictEqual(buildDiscoveryViewModel({ recent: [tool('a'), tool('b'), tool('c'), tool('d')] }).mode, DISCOVERY_MODE.RICH))
test('behavior count deduplicates across frequent recent favorites', () => {
  assert.strictEqual(countBehaviorTools({ frequent: [tool('a')], recent: [tool('a')], favorites: [tool('b')] }), 2)
})
test('empty renders featured when available', () => assert(section(buildDiscoveryViewModel({ featured }), 'featured')))
test('empty never renders recommended', () => assert.strictEqual(section(buildDiscoveryViewModel({ featured, recommended: [tool('rec')] }), 'recommended'), undefined))
test('empty has no behavior sections', () => assert.deepStrictEqual(buildDiscoveryViewModel({ featured }).toolSections.map((item) => item.key), ['featured']))
test('category exploration always exists', () => assert.strictEqual(buildDiscoveryViewModel({}).categories.length, 3))
test('category exploration ids are image calc other', () => assert.deepStrictEqual(buildDiscoveryViewModel({}).categories.map((item) => item.id), ['image', 'calc', 'other']))

// LIGHT mode priority and dedupe.
test('light prioritizes recent', () => {
  const shared = tool('shared')
  const vm = buildDiscoveryViewModel({ frequent: [shared], recent: [shared], favorites: [shared], featured })
  assert.strictEqual(vm.toolSections[0].key, 'recent')
})
test('light falls back to favorite when recent absent', () => assert.strictEqual(buildDiscoveryViewModel({ favorites: [tool('v')], featured }).toolSections[0].key, 'favorites'))
test('light falls back to frequent when recent and favorites absent', () => assert.strictEqual(buildDiscoveryViewModel({ frequent: [tool('f')], featured }).toolSections[0].key, 'frequent'))
test('light exposes only one personalized section', () => {
  const vm = buildDiscoveryViewModel({ recent: [tool('a')], favorites: [tool('b')], featured })
  assert.strictEqual(vm.toolSections.filter((item) => ['recent', 'favorites', 'frequent'].includes(item.key)).length, 1)
})
test('light featured excludes primary duplicate', () => {
  const shared = tool('shared')
  const vm = buildDiscoveryViewModel({ recent: [shared], featured: [shared, tool('fresh')] })
  assert.deepStrictEqual(ids(section(vm, 'featured').tools), ['fresh'])
})
test('light hides featured when only duplicate remains', () => {
  const shared = tool('shared')
  assert.strictEqual(section(buildDiscoveryViewModel({ recent: [shared], featured: [shared] }), 'featured'), undefined)
})
test('light section order is primary then featured', () => assert.deepStrictEqual(buildDiscoveryViewModel({ recent: [tool('a')], featured: [tool('b')] }).toolSections.map((item) => item.key), ['recent', 'featured']))

// RICH mode.
test('rich renders frequent', () => assert(section(buildDiscoveryViewModel({ frequent: [tool('a'), tool('b'), tool('c')] }), 'frequent')))
test('rich renders recommendation when available', () => assert(section(buildDiscoveryViewModel({ frequent: [tool('a'), tool('b'), tool('c')], recommended: [tool('r')] }), 'recommended')))
test('rich renders favorites only when present', () => assert(section(buildDiscoveryViewModel({ frequent: [tool('a'), tool('b'), tool('c')], favorites: [tool('v')] }), 'favorites')))
test('rich omits favorites when absent', () => assert.strictEqual(section(buildDiscoveryViewModel({ frequent: [tool('a'), tool('b'), tool('c')] }), 'favorites'), undefined))
test('rich does not render recent separately', () => assert.strictEqual(section(buildDiscoveryViewModel({ recent: [tool('a'), tool('b'), tool('c')] }), 'recent'), undefined))
test('rich recommendation excludes frequent', () => {
  const vm = buildDiscoveryViewModel({ frequent: [tool('a'), tool('b'), tool('c')], recommended: [tool('a'), tool('r')] })
  assert.deepStrictEqual(ids(section(vm, 'recommended').tools), ['r'])
})
test('rich recommendation excludes favorites', () => {
  const vm = buildDiscoveryViewModel({ recent: [tool('a'), tool('b'), tool('c')], favorites: [tool('v')], recommended: [tool('v'), tool('r')] })
  assert.deepStrictEqual(ids(section(vm, 'recommended').tools), ['r'])
})
test('rich favorites exclude frequent duplicate', () => {
  const vm = buildDiscoveryViewModel({ frequent: [tool('a'), tool('b'), tool('c')], favorites: [tool('a'), tool('v')] })
  assert.deepStrictEqual(ids(section(vm, 'favorites').tools), ['v'])
})
test('rich section order is frequent recommended favorites', () => {
  const vm = buildDiscoveryViewModel({ frequent: [tool('a'), tool('b'), tool('c')], recommended: [tool('r')], favorites: [tool('v')] })
  assert.deepStrictEqual(vm.toolSections.map((item) => item.key), ['frequent', 'recommended', 'favorites'])
})

// Display limits and safety filters.
test('every tool section is capped at four', () => {
  const many = Array.from({ length: 8 }, (_, index) => tool(`t-${index}`))
  buildDiscoveryViewModel({ frequent: many, recommended: many.concat([tool('extra')]) }).toolSections.forEach((item) => assert(item.tools.length <= MAX_TOOLS_PER_SECTION))
})
test('featured uses real count without fake backfill', () => assert.strictEqual(section(buildDiscoveryViewModel({ featured: [tool('one'), tool('two')] }), 'featured').tools.length, 2))
test('duplicate ids within one source appear once', () => assert.deepStrictEqual(ids(section(buildDiscoveryViewModel({ featured: [tool('a'), tool('a'), tool('b')] }), 'featured').tools), ['a', 'b']))
test('light has no cross-section duplicate tools', () => {
  const shared = tool('shared')
  const rendered = allRenderedIds(buildDiscoveryViewModel({ recent: [shared], featured: [shared, tool('fresh')] }))
  assert.strictEqual(new Set(rendered).size, rendered.length)
})
test('rich has no cross-section duplicate tools', () => {
  const vm = buildDiscoveryViewModel({ frequent: [tool('a'), tool('b'), tool('c')], favorites: [tool('a'), tool('v')], recommended: [tool('a'), tool('v'), tool('r')] })
  const rendered = allRenderedIds(vm)
  assert.strictEqual(new Set(rendered).size, rendered.length)
})
test('disabled true is filtered', () => assert.strictEqual(isDisplayableTool(tool('x', { disabled: true })), false))
test('enabled false is filtered', () => assert.strictEqual(isDisplayableTool(tool('x', { enabled: false })), false))
test('wooden-fish is filtered', () => assert.strictEqual(isDisplayableTool(tool('wooden-fish')), false))
test('zodiac is filtered', () => assert.strictEqual(isDisplayableTool(tool('zodiac')), false))
test('invalid tool path is filtered', () => assert.strictEqual(isDisplayableTool(tool('bad', { path: '/pages/bad/bad' })), false))
test('missing id is filtered', () => assert.strictEqual(isDisplayableTool(tool('', { id: '' })), false))

// Stability and mutation.
test('same input produces same view model three times', () => {
  const input = { frequent: [tool('a'), tool('b'), tool('c')], favorites: [tool('v')], recommended: [tool('r')], featured }
  const first = buildDiscoveryViewModel(input)
  assert.deepStrictEqual(buildDiscoveryViewModel(input), first)
  assert.deepStrictEqual(buildDiscoveryViewModel(input), first)
})
test('view model does not mutate input arrays', () => {
  const input = { frequent: [tool('a'), tool('b'), tool('c')], featured: featured.slice() }
  const before = snapshot(input)
  buildDiscoveryViewModel(input)
  assert.strictEqual(snapshot(input), before)
})
test('view model does not mutate tool objects', () => {
  const sourceTool = tool('a')
  const before = snapshot(sourceTool)
  buildDiscoveryViewModel({ recent: [sourceTool], featured })
  assert.strictEqual(snapshot(sourceTool), before)
})
test('returned category mutation does not affect later calls', () => {
  const first = buildDiscoveryViewModel({})
  first.categories[0].name = 'changed'
  assert.strictEqual(buildDiscoveryViewModel({}).categories[0].name, '图片工具')
})
test('null input safely becomes empty mode', () => assert.strictEqual(buildDiscoveryViewModel(null).mode, DISCOVERY_MODE.EMPTY))
test('null lists safely behave as empty', () => assert.strictEqual(buildDiscoveryViewModel({ frequent: null, recent: null, favorites: null }).behaviorCount, 0))

// Fresh local data must immediately change the page model.
test('clear all behavior immediately restores empty mode', () => {
  assert.strictEqual(buildDiscoveryViewModel({ frequent: [tool('a'), tool('b'), tool('c')] }).mode, DISCOVERY_MODE.RICH)
  assert.strictEqual(buildDiscoveryViewModel({ featured }).mode, DISCOVERY_MODE.EMPTY)
})
test('recent clear is reflected when recent disappears', () => {
  assert.strictEqual(buildDiscoveryViewModel({ recent: [tool('a')] }).mode, DISCOVERY_MODE.LIGHT)
  assert.strictEqual(buildDiscoveryViewModel({ recent: [] }).mode, DISCOVERY_MODE.EMPTY)
})
test('favorite removal is reflected when favorite disappears', () => {
  assert.strictEqual(buildDiscoveryViewModel({ favorites: [tool('v')] }).mode, DISCOVERY_MODE.LIGHT)
  assert.strictEqual(buildDiscoveryViewModel({ favorites: [] }).mode, DISCOVERY_MODE.EMPTY)
})
test('frequent service order is preserved', () => {
  const source = [tool('c'), tool('a'), tool('b')]
  assert.deepStrictEqual(ids(section(buildDiscoveryViewModel({ frequent: source, recent: source }), 'frequent').tools), ['c', 'a', 'b'])
})
test('recommended service order is preserved after display dedupe', () => {
  const vm = buildDiscoveryViewModel({ frequent: [tool('a'), tool('b'), tool('c')], recommended: [tool('a'), tool('r2'), tool('r1')] })
  assert.deepStrictEqual(ids(section(vm, 'recommended').tools), ['r2', 'r1'])
})
test('recommendation subtitle explicitly states local-device basis', () => assert(section(buildDiscoveryViewModel({ frequent: [tool('a'), tool('b'), tool('c')], recommended: [tool('r')] }), 'recommended').subtitle.includes('本机')))
test('featured title is 精选工具 not 热门', () => assert.strictEqual(section(buildDiscoveryViewModel({ featured }), 'featured').title, '精选工具'))

// Static page integration checks.
const discoverJs = fs.readFileSync(path.join(__dirname, '../pages/discover/discover.js'), 'utf8')
const discoverWxml = fs.readFileSync(path.join(__dirname, '../pages/discover/discover.wxml'), 'utf8')
const discoverJson = fs.readFileSync(path.join(__dirname, '../pages/discover/discover.json'), 'utf8')

test('discover page imports Discovery Service', () => assert(discoverJs.includes("require('../../services/discovery')")))
test('discover page imports discovery view model', () => assert(discoverJs.includes("require('../../utils/discovery-view-model')")))
test('discover page refreshes from onShow', () => assert(/onShow\(\)\s*\{\s*this\.refreshDiscovery\(\)/.test(discoverJs)))
test('discover page reads all five service collections', () => {
  ;['getFrequentTools', 'getRecentDiscoveryTools', 'getFavoriteDiscoveryTools', 'getFeaturedTools', 'getRecommendedTools'].forEach((name) => assert(discoverJs.includes(`discovery.${name}`)))
})
test('discover page does not directly access Storage', () => {
  ;['wx.getStorage', 'wx.setStorage', 'getStorageSync', 'setStorageSync', 'STORAGE_KEYS', 'services/storage'].forEach((token) => assert.strictEqual(discoverJs.includes(token), false))
})
test('discover page never records Usage', () => assert.strictEqual(discoverJs.includes('recordToolUse'), false))
test('discover page has no remote service dependency', () => {
  ;['wx.request', 'fetch(', 'wanluu.com', 'services/content', 'services/github', 'services/ai'].forEach((token) => assert.strictEqual(discoverJs.includes(token), false))
})
test('discover page has no new privacy capability', () => {
  ;['camera', 'location', 'microphone', 'contacts'].forEach((token) => assert.strictEqual(discoverJs.includes(token), false))
})
test('discover WXML uses shared tool card', () => assert(discoverWxml.includes('<tool-card')))
test('discover WXML renders dynamic sections', () => assert(discoverWxml.includes('wx:for="{{toolSections}}"')))
test('discover WXML hides empty tool sections', () => assert(discoverWxml.includes('wx:if="{{section.tools.length}}"')))
test('discover WXML always exposes category exploration', () => assert(discoverWxml.includes('分类探索')))
test('discover WXML has no 热门 wording', () => assert.strictEqual(discoverWxml.includes('热门'), false))
test('discover WXML has no fake trend recommendation wording', () => {
  ;['今日已有', '全网最热门', '用户推荐', '实时排行榜', '今日趋势', '猜你喜欢', 'AI 推荐'].forEach((token) => assert.strictEqual(discoverWxml.includes(token), false))
})
test('discover WXML has no 开发中 or 敬请期待 placeholder', () => {
  assert.strictEqual(discoverWxml.includes('开发中'), false)
  assert.strictEqual(discoverWxml.includes('敬请期待'), false)
})
test('discover category navigation switches to tools tab', () => assert(discoverJs.includes("url: '/pages/tools/tools'")))
test('discover tool navigation uses formal tool.path', () => assert(discoverJs.includes('url: tool.path')))
test('discover page exposes retry for local read failures', () => {
  assert(discoverJs.includes('onRetry()'))
  assert(discoverWxml.includes('bindtap="onRetry"'))
})
test('discover page registers shared display components', () => {
  const config = JSON.parse(discoverJson)
  assert.strictEqual(config.usingComponents['tool-card'], '/components/tool-card/tool-card')
  assert.strictEqual(config.usingComponents['section-header'], '/components/section-header/section-header')
  assert.strictEqual(config.usingComponents['empty-state'], '/components/empty-state/empty-state')
})

console.log(`Stage 4 discover integration tests: PASS (${passed} cases)`)
