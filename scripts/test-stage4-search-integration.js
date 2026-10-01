const assert = require('assert')
const fs = require('fs')
const path = require('path')

const { tools: formalTools } = require('../utils/tool-catalog')
const { normalizeSearchText, searchTools } = require('../utils/tool-search')

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

const ids = (items) => items.map((item) => item.id)
const homeVisibleTools = (queryValue, tools = formalTools) => {
  const query = normalizeSearchText(queryValue)
  return query ? searchTools(tools, query) : []
}
const toolsPageVisibleTools = (category, queryValue, tools = formalTools) => {
  const categoryTools = !category || category === 'all'
    ? tools
    : tools.filter((tool) => tool.category === category)
  return searchTools(categoryTools, normalizeSearchText(queryValue))
}

// 首页：空查询退出搜索模式，非空查询直接复用统一搜索模块。
test('integration home empty query returns no search-mode list', () => assert.deepStrictEqual(homeVisibleTools(''), []))
test('integration home whitespace query returns no search-mode list', () => assert.deepStrictEqual(homeVisibleTools('   '), []))
test('integration home 压缩 uses unified ranking', () => assert.strictEqual(homeVisibleTools('压缩')[0].id, 'image-compress'))
test('integration home 图片 uses unified ranking', () => assert(homeVisibleTools('图片').length > 0))
test('integration home 二维码 finds qrcode', () => assert.strictEqual(homeVisibleTools('二维码')[0].id, 'qrcode'))
test('integration home 工资 finds salary', () => assert.strictEqual(homeVisibleTools('工资')[0].id, 'salary'))
test('integration home 退休 finds retirement tools', () => {
  const result = ids(homeVisibleTools('退休'))
  assert(result.includes('retirement-age'))
  assert(result.includes('retirement-pension'))
})
test('integration home 价格 finds price compare', () => assert.strictEqual(homeVisibleTools('价格')[0].id, 'price-compare'))
test('integration home BMI is case insensitive', () => assert.deepStrictEqual(ids(homeVisibleTools('BMI')), ids(homeVisibleTools('bmi'))))
test('integration home BMR is case insensitive', () => assert.deepStrictEqual(ids(homeVisibleTools('BMR')), ids(homeVisibleTools('bmr'))))
test('integration home impossible query has no result', () => assert.deepStrictEqual(homeVisibleTools('zzzzzz_invalid'), []))

// 工具页：分类是硬约束，搜索只在当前允许集合中排序。
test('integration tools all empty query returns all formal tools', () => assert.strictEqual(toolsPageVisibleTools('all', '').length, 24))
test('integration tools all 压缩 matches home order', () => assert.deepStrictEqual(ids(toolsPageVisibleTools('all', '压缩')), ids(homeVisibleTools('压缩'))))
test('integration tools all 退休 matches home order', () => assert.deepStrictEqual(ids(toolsPageVisibleTools('all', '退休')), ids(homeVisibleTools('退休'))))
test('integration tools all 价格 matches home order', () => assert.deepStrictEqual(ids(toolsPageVisibleTools('all', '价格')), ids(homeVisibleTools('价格'))))
test('integration tools image 压缩 never leaks calc or other', () => assert(toolsPageVisibleTools('image', '压缩').every((tool) => tool.category === 'image')))
test('integration tools calc 退休 never leaks image or other', () => assert(toolsPageVisibleTools('calc', '退休').every((tool) => tool.category === 'calc')))
test('integration tools other 指南 only returns other category', () => {
  const result = toolsPageVisibleTools('other', '指南')
  assert(result.length > 0)
  assert(result.every((tool) => tool.category === 'other'))
})
test('integration category switch recomputes from current query', () => {
  const all = toolsPageVisibleTools('all', '退休')
  const calc = toolsPageVisibleTools('calc', '退休')
  const image = toolsPageVisibleTools('image', '退休')
  assert.deepStrictEqual(ids(calc), ids(all.filter((tool) => tool.category === 'calc')))
  assert.deepStrictEqual(image, [])
})
test('integration clearing search in calc returns all calc tools', () => {
  const result = toolsPageVisibleTools('calc', '')
  assert(result.length > 0)
  assert(result.every((tool) => tool.category === 'calc'))
})
test('integration image search then all restores all-category ranking', () => {
  const image = toolsPageVisibleTools('image', '压缩')
  const all = toolsPageVisibleTools('all', '压缩')
  assert(image.every((tool) => tool.category === 'image'))
  assert.deepStrictEqual(ids(all), ids(homeVisibleTools('压缩')))
})

// disabled / prohibited 工具即使被误注入页面候选也不能恢复。
test('integration disabled tool cannot appear', () => {
  const injected = { id: 'disabled-test', name: '测试工具', description: '', category: 'other', path: '/packageTools/pages/disabled-test/disabled-test', enabled: false, keywords: ['测试'] }
  assert.strictEqual(homeVisibleTools('测试', [...formalTools, injected]).some((tool) => tool.id === injected.id), false)
})
test('integration wooden-fish cannot appear', () => {
  const injected = { id: 'wooden-fish', name: '木鱼', description: '', category: 'other', path: '/packageTools/pages/wooden-fish/wooden-fish', enabled: true, keywords: ['木鱼'] }
  assert.deepStrictEqual(homeVisibleTools('木鱼', [...formalTools, injected]), [])
})
test('integration zodiac cannot appear', () => {
  const injected = { id: 'zodiac', name: '星座', description: '', category: 'other', path: '/packageTools/pages/zodiac/zodiac', enabled: true, keywords: ['星座'] }
  assert.deepStrictEqual(toolsPageVisibleTools('all', '星座', [...formalTools, injected]), [])
})
test('integration same query order stays stable across three executions', () => {
  const first = ids(toolsPageVisibleTools('all', '退休'))
  assert.deepStrictEqual(ids(toolsPageVisibleTools('all', '退休')), first)
  assert.deepStrictEqual(ids(toolsPageVisibleTools('all', '退休')), first)
})

// 页面接入静态回归：锁定统一模块调用并防止第二套匹配算法回流。
test('integration index page imports and calls unified search module', () => {
  const source = fs.readFileSync(path.join(__dirname, '../pages/index/index.js'), 'utf8')
  assert(source.includes("require('../../utils/tool-search')"))
  assert(source.includes('searchTools(formalTools, searchKeyword)'))
  assert(source.includes('searchKeyword ? searchTools(formalTools, searchKeyword) : []'))
})
test('integration index page binds change clear and submit search events', () => {
  const source = fs.readFileSync(path.join(__dirname, '../pages/index/index.wxml'), 'utf8')
  assert(source.includes('bind:change="onSearchInput"'))
  assert(source.includes('bind:clear="onSearchClear"'))
  assert(source.includes('bind:submit="onSearchSubmit"'))
  assert(source.includes('wx:if="{{isSearching}}"'))
})
test('integration tools page imports and calls unified search module', () => {
  const source = fs.readFileSync(path.join(__dirname, '../pages/tools/tools.js'), 'utf8')
  assert(source.includes("require('../../utils/tool-search')"))
  assert(source.includes('searchTools(categoryTools, keyword)'))
})
test('integration pages do not contain a second text matching implementation', () => {
  const sources = [
    fs.readFileSync(path.join(__dirname, '../pages/index/index.js'), 'utf8'),
    fs.readFileSync(path.join(__dirname, '../pages/tools/tools.js'), 'utf8'),
  ]
  const forbidden = ['name.includes(', 'keywords.some(', '.toLowerCase()', 'indexOf(query)', 'matchScore', '_score']
  sources.forEach((source) => forbidden.forEach((token) => assert.strictEqual(source.includes(token), false, token)))
})
test('integration pages do not persist search text or use personal ranking data', () => {
  const source = [
    fs.readFileSync(path.join(__dirname, '../pages/index/index.js'), 'utf8'),
    fs.readFileSync(path.join(__dirname, '../pages/tools/tools.js'), 'utf8'),
  ].join('\n')
  ;['setStorage', 'getStorage', 'wl_search_', 'favorites', 'history', 'recent', 'useCount', 'wx.request']
    .forEach((token) => assert.strictEqual(source.includes(token), false, token))
})

console.log(`Stage 4 search integration tests: PASS (${passed} cases)`)
