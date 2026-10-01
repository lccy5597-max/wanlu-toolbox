const assert = require('assert')
const fs = require('fs')
const path = require('path')

const toolCatalog = require('../utils/tool-catalog')
const {
  createDiscoveryService,
  isFormalTool,
} = require('../services/discovery')

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

const snapshot = (value) => JSON.stringify(value)
const ids = (tools) => tools.map((tool) => tool.id)
const tool = (id, overrides = {}) => ({
  id,
  name: id,
  description: `${id} description`,
  category: 'calc',
  path: `/packageTools/pages/${id}/${id}`,
  enabled: true,
  isHot: false,
  ...overrides,
})

const baseCatalog = () => [
  tool('image-a', { category: 'image', isHot: true }),
  tool('image-b', { category: 'image' }),
  tool('calc-a', { category: 'calc', isHot: true }),
  tool('calc-b', { category: 'calc' }),
  tool('other-a', { category: 'other', isHot: true }),
  tool('other-b', { category: 'other' }),
]

const createState = () => ({
  usage: {},
  recentClearedAt: 0,
  favorites: [],
})

const createServices = (state) => ({
  toolUsageService: {
    getToolUsage(toolId) {
      return state.usage[toolId] || null
    },
    getRecentTools(limit = 20) {
      const list = Object.entries(state.usage)
        .map(([toolId, usage]) => ({ toolId, ...usage }))
        .filter((item) => Number(item.lastUsedAt) > Number(state.recentClearedAt || 0))
        .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
      return Number(limit) > 0 ? list.slice(0, Number(limit)) : list
    },
  },
  favoritesService: {
    getFavorites() {
      return state.favorites
        .filter((item) => item.deletedAt == null)
        .slice()
        .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
    },
  },
})

const makeService = (state = createState(), catalog = baseCatalog()) => {
  const deps = createServices(state)
  return {
    state,
    catalog,
    service: createDiscoveryService({ catalog, ...deps }),
  }
}

// Formal-tool legality
test('discovery accepts valid formal tool', () => assert.strictEqual(isFormalTool(tool('valid')), true))
test('discovery rejects enabled false tool', () => assert.strictEqual(isFormalTool(tool('disabled', { enabled: false })), false))
test('discovery rejects disabled true tool', () => assert.strictEqual(isFormalTool(tool('disabled-flag', { disabled: true })), false))
test('discovery rejects missing id', () => assert.strictEqual(isFormalTool(tool('', { id: '' })), false))
test('discovery rejects invalid path', () => assert.strictEqual(isFormalTool(tool('bad-path', { path: '/pages/bad-path' })), false))
test('discovery rejects wooden-fish', () => assert.strictEqual(isFormalTool(tool('wooden-fish')), false))
test('discovery rejects zodiac', () => assert.strictEqual(isFormalTool(tool('zodiac')), false))

// New user / featured fallback
test('new user frequent is empty', () => assert.deepStrictEqual(makeService().service.getFrequentTools(), []))
test('new user recent is empty', () => assert.deepStrictEqual(makeService().service.getRecentDiscoveryTools(), []))
test('new user favorites is empty', () => assert.deepStrictEqual(makeService().service.getFavoriteDiscoveryTools(), []))
test('featured uses isHot and catalog order', () => {
  const { service } = makeService()
  assert.deepStrictEqual(ids(service.getFeaturedTools()), ['image-a', 'calc-a', 'other-a'])
})
test('new user recommendation falls back to featured', () => {
  const { service } = makeService()
  assert.deepStrictEqual(ids(service.getRecommendedTools()), ids(service.getFeaturedTools()))
})
test('empty featured catalog returns empty recommendation for new user', () => {
  const catalog = baseCatalog().map((item) => ({ ...item, isHot: false }))
  const { service } = makeService(createState(), catalog)
  assert.deepStrictEqual(service.getFeaturedTools(), [])
  assert.deepStrictEqual(service.getRecommendedTools(), [])
})

// Frequent usage semantics
test('frequent uses useCount descending', () => {
  const state = createState()
  state.usage['image-a'] = { useCount: 2, lastUsedAt: 20 }
  state.usage['calc-a'] = { useCount: 5, lastUsedAt: 10 }
  assert.deepStrictEqual(ids(makeService(state).service.getFrequentTools()), ['calc-a', 'image-a'])
})
test('frequent uses lastUsedAt as tie-break', () => {
  const state = createState()
  state.usage['image-a'] = { useCount: 2, lastUsedAt: 10 }
  state.usage['calc-a'] = { useCount: 2, lastUsedAt: 20 }
  assert.deepStrictEqual(ids(makeService(state).service.getFrequentTools()), ['calc-a', 'image-a'])
})
test('frequent uses catalog order as final tie-break', () => {
  const state = createState()
  state.usage['image-a'] = { useCount: 2, lastUsedAt: 10 }
  state.usage['calc-a'] = { useCount: 2, lastUsedAt: 10 }
  assert.deepStrictEqual(ids(makeService(state).service.getFrequentTools()), ['image-a', 'calc-a'])
})
test('frequent filters zero and invalid counts', () => {
  const state = createState()
  state.usage['image-a'] = { useCount: 0, lastUsedAt: 10 }
  state.usage['calc-a'] = { useCount: NaN, lastUsedAt: 20 }
  assert.deepStrictEqual(makeService(state).service.getFrequentTools(), [])
})
test('frequent ignores unknown old usage id', () => {
  const state = createState()
  state.usage['removed-tool'] = { useCount: 999, lastUsedAt: 999 }
  assert.deepStrictEqual(makeService(state).service.getFrequentTools(), [])
})

// Recent semantics, including recentClearedAt
test('recent uses Stage 3 getRecentTools ordering', () => {
  const state = createState()
  state.usage['image-a'] = { useCount: 1, lastUsedAt: 10 }
  state.usage['calc-a'] = { useCount: 1, lastUsedAt: 20 }
  assert.deepStrictEqual(ids(makeService(state).service.getRecentDiscoveryTools()), ['calc-a', 'image-a'])
})
test('recentClearedAt removes old recent without clearing frequent', () => {
  const state = createState()
  state.usage['image-a'] = { useCount: 10, lastUsedAt: 100 }
  state.recentClearedAt = 200
  const { service } = makeService(state)
  assert.deepStrictEqual(service.getRecentDiscoveryTools(), [])
  assert.deepStrictEqual(ids(service.getFrequentTools()), ['image-a'])
})
test('recent returns use after clear when lastUsedAt is newer', () => {
  const state = createState()
  state.recentClearedAt = 200
  state.usage['image-a'] = { useCount: 10, lastUsedAt: 201 }
  assert.deepStrictEqual(ids(makeService(state).service.getRecentDiscoveryTools()), ['image-a'])
})
test('recent ignores unknown old id', () => {
  const state = createState()
  state.usage['removed-tool'] = { useCount: 1, lastUsedAt: 100 }
  assert.deepStrictEqual(makeService(state).service.getRecentDiscoveryTools(), [])
})

// Favorite tombstone semantics
test('active favorite appears in discovery favorites', () => {
  const state = createState()
  state.favorites.push({ entityType: 'tool', entityId: 'calc-b', updatedAt: 10, deletedAt: null })
  assert.deepStrictEqual(ids(makeService(state).service.getFavoriteDiscoveryTools()), ['calc-b'])
})
test('favorite tombstone disappears immediately', () => {
  const state = createState()
  state.favorites.push({ entityType: 'tool', entityId: 'calc-b', updatedAt: 10, deletedAt: null })
  const { service } = makeService(state)
  assert.deepStrictEqual(ids(service.getFavoriteDiscoveryTools()), ['calc-b'])
  state.favorites[0].deletedAt = 20
  state.favorites[0].updatedAt = 20
  assert.deepStrictEqual(service.getFavoriteDiscoveryTools(), [])
})
test('non-tool favorite is ignored', () => {
  const state = createState()
  state.favorites.push({ entityType: 'article', entityId: 'calc-b', updatedAt: 10, deletedAt: null })
  assert.deepStrictEqual(makeService(state).service.getFavoriteDiscoveryTools(), [])
})
test('favorite unknown old id is ignored', () => {
  const state = createState()
  state.favorites.push({ entityType: 'tool', entityId: 'removed-tool', updatedAt: 10, deletedAt: null })
  assert.deepStrictEqual(makeService(state).service.getFavoriteDiscoveryTools(), [])
})

// Recommendation rules
test('usage creates deterministic personalized recommendation', () => {
  const state = createState()
  state.usage['calc-a'] = { useCount: 5, lastUsedAt: 50 }
  const result = ids(makeService(state).service.getRecommendedTools())
  assert.strictEqual(result[0], 'calc-a')
  assert(result.indexOf('calc-b') >= 0)
})
test('dominant category follows aggregate usage count', () => {
  const state = createState()
  state.usage['image-a'] = { useCount: 2, lastUsedAt: 60 }
  state.usage['calc-a'] = { useCount: 5, lastUsedAt: 50 }
  const result = ids(makeService(state).service.getRecommendedTools())
  assert(result.indexOf('calc-b') < result.indexOf('other-a'))
})
test('dominant category tie uses latest category usage', () => {
  const state = createState()
  state.usage['image-a'] = { useCount: 2, lastUsedAt: 100 }
  state.usage['calc-a'] = { useCount: 2, lastUsedAt: 200 }
  const result = ids(makeService(state).service.getRecommendedTools())
  assert(result.includes('calc-b'))
  assert.strictEqual(result.includes('image-b'), false)
})
test('favorite signal raises non-featured tool into recommendation', () => {
  const state = createState()
  state.favorites.push({ entityType: 'tool', entityId: 'other-b', updatedAt: 10, deletedAt: null })
  const result = ids(makeService(state).service.getRecommendedTools())
  assert.strictEqual(result[0], 'other-b')
})
test('removing favorite removes favorite-only recommendation weight', () => {
  const state = createState()
  state.favorites.push({ entityType: 'tool', entityId: 'other-b', updatedAt: 10, deletedAt: null })
  const { service } = makeService(state)
  assert.strictEqual(ids(service.getRecommendedTools())[0], 'other-b')
  state.favorites[0].deletedAt = 20
  state.favorites[0].updatedAt = 20
  assert.deepStrictEqual(ids(service.getRecommendedTools()), ids(service.getFeaturedTools()))
})
test('recent signal participates in recommendation without duplicate tool', () => {
  const state = createState()
  state.usage['image-a'] = { useCount: 1, lastUsedAt: 100 }
  state.favorites.push({ entityType: 'tool', entityId: 'image-a', updatedAt: 100, deletedAt: null })
  const result = ids(makeService(state).service.getRecommendedTools())
  assert.strictEqual(result.filter((id) => id === 'image-a').length, 1)
})
test('recommendation is stable across three identical calls', () => {
  const state = createState()
  state.usage['calc-a'] = { useCount: 5, lastUsedAt: 50 }
  state.favorites.push({ entityType: 'tool', entityId: 'other-b', updatedAt: 60, deletedAt: null })
  const service = makeService(state).service
  const first = ids(service.getRecommendedTools())
  assert.deepStrictEqual(ids(service.getRecommendedTools()), first)
  assert.deepStrictEqual(ids(service.getRecommendedTools()), first)
})
test('clearing all behavior immediately restores featured fallback', () => {
  const state = createState()
  state.usage['calc-a'] = { useCount: 5, lastUsedAt: 50 }
  state.favorites.push({ entityType: 'tool', entityId: 'other-b', updatedAt: 60, deletedAt: null })
  const { service } = makeService(state)
  assert.notDeepStrictEqual(ids(service.getRecommendedTools()), ids(service.getFeaturedTools()))
  state.usage = {}
  state.favorites = []
  state.recentClearedAt = 0
  assert.deepStrictEqual(ids(service.getRecommendedTools()), ids(service.getFeaturedTools()))
})

// Disabled, removed and prohibited tools must stay excluded from all collections
test('disabled tool never appears in any discovery collection', () => {
  const catalog = [...baseCatalog(), tool('disabled-hot', { enabled: false, isHot: true })]
  const state = createState()
  state.usage['disabled-hot'] = { useCount: 999, lastUsedAt: 999 }
  state.favorites.push({ entityType: 'tool', entityId: 'disabled-hot', updatedAt: 999, deletedAt: null })
  const { service } = makeService(state, catalog)
  ;[
    service.getFrequentTools(),
    service.getRecentDiscoveryTools(),
    service.getFavoriteDiscoveryTools(),
    service.getFeaturedTools(),
    service.getRecommendedTools(),
  ].forEach((list) => assert.strictEqual(ids(list).includes('disabled-hot'), false))
})
test('disabled true tool never appears in recommendation', () => {
  const catalog = [...baseCatalog(), tool('disabled-true', { disabled: true, isHot: true })]
  const state = createState()
  state.usage['disabled-true'] = { useCount: 999, lastUsedAt: 999 }
  assert.strictEqual(ids(makeService(state, catalog).service.getRecommendedTools()).includes('disabled-true'), false)
})
test('wooden-fish old behavior cannot restore formal discovery entry', () => {
  const catalog = [...baseCatalog(), tool('wooden-fish', { isHot: true })]
  const state = createState()
  state.usage['wooden-fish'] = { useCount: 999, lastUsedAt: 999 }
  state.favorites.push({ entityType: 'tool', entityId: 'wooden-fish', updatedAt: 999, deletedAt: null })
  const { service } = makeService(state, catalog)
  ;[
    service.getFrequentTools(), service.getRecentDiscoveryTools(), service.getFavoriteDiscoveryTools(),
    service.getFeaturedTools(), service.getRecommendedTools(),
  ].forEach((list) => assert.strictEqual(ids(list).includes('wooden-fish'), false))
})
test('zodiac old behavior cannot restore formal discovery entry', () => {
  const catalog = [...baseCatalog(), tool('zodiac', { isHot: true })]
  const state = createState()
  state.usage.zodiac = { useCount: 999, lastUsedAt: 999 }
  const { service } = makeService(state, catalog)
  assert.strictEqual(ids(service.getRecommendedTools()).includes('zodiac'), false)
})
test('invalid-path old tool cannot appear', () => {
  const catalog = [...baseCatalog(), tool('bad-path', { path: '/pages/bad-path', isHot: true })]
  const state = createState()
  state.usage['bad-path'] = { useCount: 999, lastUsedAt: 999 }
  assert.strictEqual(ids(makeService(state, catalog).service.getRecommendedTools()).includes('bad-path'), false)
})

// Limit behavior
test('positive limit truncates frequent results', () => {
  const state = createState()
  state.usage['image-a'] = { useCount: 2, lastUsedAt: 10 }
  state.usage['calc-a'] = { useCount: 1, lastUsedAt: 20 }
  assert.strictEqual(makeService(state).service.getFrequentTools({ limit: 1 }).length, 1)
})
test('limit zero returns empty list', () => assert.deepStrictEqual(makeService().service.getFeaturedTools({ limit: 0 }), []))
test('negative limit returns empty list', () => assert.deepStrictEqual(makeService().service.getFeaturedTools({ limit: -1 }), []))
test('NaN limit returns empty list', () => assert.deepStrictEqual(makeService().service.getFeaturedTools({ limit: NaN }), []))
test('Infinity limit returns empty list', () => assert.deepStrictEqual(makeService().service.getFeaturedTools({ limit: Infinity }), []))
test('string limit returns empty list', () => assert.deepStrictEqual(makeService().service.getFeaturedTools({ limit: '2' }), []))
test('undefined limit returns full valid list', () => assert.strictEqual(makeService().service.getFeaturedTools().length, 3))
test('null options returns full valid list', () => assert.strictEqual(makeService().service.getFeaturedTools(null).length, 3))
test('recommendation limit is applied after stable ranking', () => {
  const state = createState()
  state.usage['calc-a'] = { useCount: 5, lastUsedAt: 50 }
  const service = makeService(state).service
  assert.deepStrictEqual(ids(service.getRecommendedTools({ limit: 2 })), ids(service.getRecommendedTools()).slice(0, 2))
})

// Mutation / read-only guarantees
test('discovery does not mutate catalog', () => {
  const catalog = baseCatalog()
  const state = createState()
  state.usage['calc-a'] = { useCount: 5, lastUsedAt: 50 }
  const before = snapshot(catalog)
  makeService(state, catalog).service.getRecommendedTools()
  assert.strictEqual(snapshot(catalog), before)
})
test('discovery does not mutate favorites state', () => {
  const state = createState()
  state.favorites.push({ entityType: 'tool', entityId: 'other-b', updatedAt: 10, deletedAt: null })
  const before = snapshot(state.favorites)
  makeService(state).service.getRecommendedTools()
  assert.strictEqual(snapshot(state.favorites), before)
})
test('discovery does not mutate usage or recentClearedAt', () => {
  const state = createState()
  state.usage['calc-a'] = { useCount: 5, lastUsedAt: 50 }
  state.recentClearedAt = 40
  const before = snapshot(state)
  makeService(state).service.getRecommendedTools()
  assert.strictEqual(snapshot(state), before)
})
test('featured does not depend on usage or favorites services', () => {
  const service = createDiscoveryService({
    catalog: baseCatalog(),
    favoritesService: { getFavorites() { throw new Error('should not read favorites') } },
    toolUsageService: {
      getToolUsage() { throw new Error('should not read usage') },
      getRecentTools() { throw new Error('should not read recent') },
    },
  })
  assert.deepStrictEqual(ids(service.getFeaturedTools()), ['image-a', 'calc-a', 'other-a'])
})

// Real catalog regression
test('real catalog featured results are formal catalog tools only', () => {
  const state = createState()
  const service = makeService(state, toolCatalog.tools).service
  const formalIds = new Set(toolCatalog.tools.map((item) => item.id))
  service.getFeaturedTools().forEach((item) => assert(formalIds.has(item.id)))
})
test('real catalog discovery never exposes wooden-fish or zodiac', () => {
  const service = makeService(createState(), toolCatalog.tools).service
  const result = ids(service.getRecommendedTools())
  assert.strictEqual(result.includes('wooden-fish'), false)
  assert.strictEqual(result.includes('zodiac'), false)
})

// Static boundary: Discovery itself cannot bypass Stage 3 Service or become remote/profile persistence.
test('discovery source has no direct Storage, network, UI or profile persistence dependency', () => {
  const source = fs.readFileSync(path.join(__dirname, '../services/discovery.js'), 'utf8')
  ;[
    "require('./storage')", 'wx.getStorage', 'wx.setStorage', 'getStorageSync', 'setStorageSync',
    'wx.request', 'fetch(', 'http://', 'https://', 'Page(', 'setData', 'navigateTo', 'switchTab',
    'wl_discovery_', 'wl_recommend_', 'wl_profile_', 'wl_recent_', 'Math.random(',
  ].forEach((token) => assert.strictEqual(source.includes(token), false, `unexpected token ${token}`))
})
test('discovery production dependencies are formal services', () => {
  const source = fs.readFileSync(path.join(__dirname, '../services/discovery.js'), 'utf8')
  assert(source.includes("require('../utils/tool-catalog')"))
  assert(source.includes("require('./favorites')"))
  assert(source.includes("require('./tool-usage')"))
})

test('discovery default API exposes required methods', () => {
  const discovery = require('../services/discovery')
  ;['getFrequentTools', 'getRecentDiscoveryTools', 'getFavoriteDiscoveryTools', 'getFeaturedTools', 'getRecommendedTools']
    .forEach((name) => assert.strictEqual(typeof discovery[name], 'function'))
})

console.log(`Stage 4 discovery tests: PASS (${passed} cases)`)
