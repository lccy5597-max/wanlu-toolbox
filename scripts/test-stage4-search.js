const assert = require('assert')
const fs = require('fs')
const path = require('path')

const toolCatalog = require('../utils/tool-catalog')
const {
  MATCH_SCORE,
  normalizeSearchText,
  scoreToolMatch,
  searchTools,
} = require('../utils/tool-search')

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
const ids = (items) => items.map((item) => item.id)
const fakeTool = (id, overrides = {}) => ({
  id,
  name: id,
  description: '',
  category: 'other',
  path: `/packageTools/pages/${id}/${id}`,
  keywords: [],
  enabled: true,
  ...overrides,
})

// normalizeSearchText
test('search normalize null to empty string', () => assert.strictEqual(normalizeSearchText(null), ''))
test('search normalize undefined to empty string', () => assert.strictEqual(normalizeSearchText(undefined), ''))
test('search normalize trims collapses spaces and lowercases English', () => assert.strictEqual(normalizeSearchText('  BMI   Test  '), 'bmi test'))
test('search normalize preserves Chinese text', () => assert.strictEqual(normalizeSearchText('  图片 压缩  '), '图片 压缩'))
test('search normalize supports numeric query', () => assert.strictEqual(normalizeSearchText(123), '123'))

// scoring hierarchy
test('search score constants preserve required priority', () => {
  assert(MATCH_SCORE.NAME_EXACT > MATCH_SCORE.NAME_PREFIX)
  assert(MATCH_SCORE.NAME_PREFIX > MATCH_SCORE.NAME_CONTAINS)
  assert(MATCH_SCORE.NAME_CONTAINS > MATCH_SCORE.KEYWORD)
  assert(MATCH_SCORE.KEYWORD > MATCH_SCORE.DESCRIPTION)
  assert(MATCH_SCORE.DESCRIPTION > MATCH_SCORE.CATEGORY)
})
test('search ranks exact prefix contains keyword description category in order', () => {
  const tools = [
    fakeTool('category-match', { name: 'Foxtrot', category: 'alpha' }),
    fakeTool('description-match', { name: 'Echo', description: 'use alpha here' }),
    fakeTool('keyword-match', { name: 'Delta', keywords: ['alpha'] }),
    fakeTool('contains-match', { name: 'My alpha helper' }),
    fakeTool('prefix-match', { name: 'Alpha helper' }),
    fakeTool('exact-match', { name: 'Alpha' }),
  ]
  assert.deepStrictEqual(ids(searchTools(tools, 'alpha')), [
    'exact-match',
    'prefix-match',
    'contains-match',
    'keyword-match',
    'description-match',
    'category-match',
  ])
})
test('search exact name outranks ordinary contains', () => {
  const exact = fakeTool('exact', { name: '压缩' })
  const contains = fakeTool('contains', { name: '图片压缩工具' })
  assert.deepStrictEqual(ids(searchTools([contains, exact], '压缩')), ['exact', 'contains'])
})
test('search name prefix outranks ordinary contains', () => {
  const prefix = fakeTool('prefix', { name: '工资助手' })
  const contains = fakeTool('contains', { name: '我的工资助手' })
  assert.deepStrictEqual(ids(searchTools([contains, prefix], '工资')), ['prefix', 'contains'])
})
test('search keyword outranks description', () => {
  const keyword = fakeTool('keyword', { keywords: ['退休'] })
  const description = fakeTool('description', { description: '用于退休测算' })
  assert.deepStrictEqual(ids(searchTools([description, keyword], '退休')), ['keyword', 'description'])
})
test('search description outranks category', () => {
  const description = fakeTool('description', { description: '图片相关能力', category: 'other' })
  const category = fakeTool('category', { category: 'image' })
  assert.deepStrictEqual(ids(searchTools([category, description], '图片')), ['description', 'category'])
})
test('scoreToolMatch returns zero when nothing matches', () => assert.strictEqual(scoreToolMatch(fakeTool('none'), 'unmatched'), 0))

// empty-query semantics
test('search empty query returns valid tools in original stable order', () => {
  const tools = [fakeTool('b'), fakeTool('a'), fakeTool('c')]
  assert.deepStrictEqual(ids(searchTools(tools, '')), ['b', 'a', 'c'])
})
test('search null query uses empty-query semantics', () => {
  const tools = [fakeTool('b'), fakeTool('a')]
  assert.deepStrictEqual(ids(searchTools(tools, null)), ['b', 'a'])
})
test('search undefined query uses empty-query semantics', () => {
  const tools = [fakeTool('b'), fakeTool('a')]
  assert.deepStrictEqual(ids(searchTools(tools, undefined)), ['b', 'a'])
})
test('search whitespace query uses empty-query semantics', () => {
  const tools = [fakeTool('b'), fakeTool('a')]
  assert.deepStrictEqual(ids(searchTools(tools, '   ')), ['b', 'a'])
})
test('search impossible query returns empty array', () => assert.deepStrictEqual(searchTools(toolCatalog.tools, 'zzzzzzzz_invalid_query'), []))
test('search non-array tools input returns empty array', () => assert.deepStrictEqual(searchTools(null, '工资'), []))

// real catalog Chinese/English regression
test('real catalog search 压缩 puts 图片压缩 first', () => assert.strictEqual(searchTools(toolCatalog.tools, '压缩')[0].id, 'image-compress'))
test('real catalog search 图片 returns only image category tools', () => assert(searchTools(toolCatalog.tools, '图片').every((tool) => tool.category === 'image')))
test('real catalog search 尺寸 puts image-resize first', () => assert.strictEqual(searchTools(toolCatalog.tools, '尺寸')[0].id, 'image-resize'))
test('real catalog search 二维码 puts qrcode first', () => assert.strictEqual(searchTools(toolCatalog.tools, '二维码')[0].id, 'qrcode'))
test('real catalog search 工资 puts salary first', () => assert.strictEqual(searchTools(toolCatalog.tools, '工资')[0].id, 'salary'))
test('real catalog search 退休 finds retirement tools', () => {
  const resultIds = ids(searchTools(toolCatalog.tools, '退休'))
  assert(resultIds.includes('retirement-age'))
  assert(resultIds.includes('retirement-pension'))
})
test('real catalog search 养老金 puts pension tool first', () => assert.strictEqual(searchTools(toolCatalog.tools, '养老金')[0].id, 'retirement-pension'))
test('real catalog search 日期 puts date tool first', () => assert.strictEqual(searchTools(toolCatalog.tools, '日期')[0].id, 'date-diff'))
test('real catalog search BMI is case insensitive', () => {
  assert.deepStrictEqual(ids(searchTools(toolCatalog.tools, 'bmi')), ids(searchTools(toolCatalog.tools, 'BMI')))
  assert.deepStrictEqual(ids(searchTools(toolCatalog.tools, 'Bmi')), ids(searchTools(toolCatalog.tools, 'BMI')))
  assert.strictEqual(searchTools(toolCatalog.tools, 'BMI')[0].id, 'bmi')
})
test('real catalog search BMR is case insensitive', () => {
  assert.deepStrictEqual(ids(searchTools(toolCatalog.tools, 'bmr')), ids(searchTools(toolCatalog.tools, 'BMR')))
  assert.strictEqual(searchTools(toolCatalog.tools, 'BMR')[0].id, 'bmr')
})
test('real catalog mixed Chinese English query matches BMI tool', () => assert.strictEqual(searchTools(toolCatalog.tools, 'BMI 计算')[0].id, 'bmi'))
test('real catalog search 餐饮 finds restaurant', () => assert.strictEqual(searchTools(toolCatalog.tools, '餐饮')[0].id, 'restaurant'))
test('real catalog search 价格 finds price compare', () => assert.strictEqual(searchTools(toolCatalog.tools, '价格')[0].id, 'price-compare'))
test('real catalog search 复利 finds compound', () => assert.strictEqual(searchTools(toolCatalog.tools, '复利')[0].id, 'compound'))
test('real catalog category alias 计算 returns calc tools only', () => assert(searchTools(toolCatalog.tools, '计算').every((tool) => tool.category === 'calc')))
test('real catalog category alias 其他 returns other tools only', () => assert(searchTools(toolCatalog.tools, '其他').every((tool) => tool.category === 'other')))

// filtering and deduplication
test('search filters enabled false tool even on exact name match', () => {
  const tool = fakeTool('disabled-enabled-flag', { name: 'Exact', enabled: false })
  assert.deepStrictEqual(searchTools([tool], 'Exact'), [])
})
test('search filters disabled true tool even on exact name match', () => {
  const tool = fakeTool('disabled-flag', { name: 'Exact', disabled: true })
  assert.deepStrictEqual(searchTools([tool], 'Exact'), [])
})
test('search deduplicates same tool id', () => {
  const tools = [
    fakeTool('same', { name: 'Alpha' }),
    fakeTool('same', { name: 'Alpha second', keywords: ['alpha'] }),
  ]
  assert.strictEqual(searchTools(tools, 'alpha').length, 1)
})
test('search filters tool without id', () => assert.deepStrictEqual(searchTools([{ name: '工资', path: '/packageTools/pages/x/x' }], '工资'), []))
test('search filters tool without formal packageTools path', () => assert.deepStrictEqual(searchTools([fakeTool('bad-path', { path: '' })], ''), []))
test('search filters wooden-fish even if injected into caller list', () => {
  const injected = fakeTool('wooden-fish', { name: '木鱼' })
  assert.deepStrictEqual(searchTools([...toolCatalog.tools, injected], '木鱼'), [])
})
test('search filters zodiac even if injected into caller list', () => {
  const injected = fakeTool('zodiac', { name: '星座计算器' })
  assert.deepStrictEqual(searchTools([...toolCatalog.tools, injected], '星座'), [])
})
test('real catalog search cannot discover wooden-fish from project directories', () => assert.deepStrictEqual(searchTools(toolCatalog.tools, 'wooden-fish'), []))
test('real catalog search cannot discover zodiac from project directories', () => assert.deepStrictEqual(searchTools(toolCatalog.tools, 'zodiac'), []))

// stability and mutation
test('search same query is stable across three executions', () => {
  const first = ids(searchTools(toolCatalog.tools, '图片'))
  const second = ids(searchTools(toolCatalog.tools, '图片'))
  const third = ids(searchTools(toolCatalog.tools, '图片'))
  assert.deepStrictEqual(second, first)
  assert.deepStrictEqual(third, first)
})
test('search score ties keep original catalog order', () => {
  const tools = [fakeTool('first', { keywords: ['same'] }), fakeTool('second', { keywords: ['same'] })]
  assert.deepStrictEqual(ids(searchTools(tools, 'same')), ['first', 'second'])
})
test('search does not mutate input array order', () => {
  const tools = [fakeTool('b', { name: 'Alpha B' }), fakeTool('a', { name: 'Alpha A' })]
  const before = snapshot(tools)
  searchTools(tools, 'alpha')
  assert.strictEqual(snapshot(tools), before)
})
test('search does not write temporary score fields to tool objects', () => {
  const tools = [fakeTool('a', { name: 'Alpha' })]
  const before = snapshot(tools[0])
  searchTools(tools, 'alpha')
  assert.strictEqual(snapshot(tools[0]), before)
  assert.strictEqual(Object.prototype.hasOwnProperty.call(tools[0], '_score'), false)
  assert.strictEqual(Object.prototype.hasOwnProperty.call(tools[0], 'matchScore'), false)
})

// real catalog integrity
test('real catalog remains 24 formal tools after search', () => {
  const before = toolCatalog.tools.length
  searchTools(toolCatalog.tools, '图片')
  assert.strictEqual(before, 24)
  assert.strictEqual(toolCatalog.tools.length, 24)
})
test('real catalog empty search preserves exact formal catalog order', () => assert.deepStrictEqual(ids(searchTools(toolCatalog.tools, '')), ids(toolCatalog.tools)))
test('real catalog result paths always come from the supplied catalog', () => {
  const allowedPaths = new Set(toolCatalog.tools.map((tool) => tool.path))
  searchTools(toolCatalog.tools, '计算').forEach((tool) => assert(allowedPaths.has(tool.path)))
})
test('real catalog has no wooden-fish or zodiac formal ids', () => {
  const formalIds = new Set(ids(toolCatalog.tools))
  assert.strictEqual(formalIds.has('wooden-fish'), false)
  assert.strictEqual(formalIds.has('zodiac'), false)
})

// privacy / platform boundary static check
test('tool-search module has no UI storage network or privacy API dependency', () => {
  const source = fs.readFileSync(path.join(__dirname, '../utils/tool-search.js'), 'utf8')
  ;['wx.', 'setData', 'Page(', 'Component(', 'setStorage', 'getStorage', 'Storage', 'fetch(', 'request(', 'http://', 'https://', 'camera', 'location', 'microphone']
    .forEach((token) => assert.strictEqual(source.includes(token), false, `unexpected token ${token}`))
})

test('scoreToolMatch does not mutate tool object', () => {
  const tool = fakeTool('alpha', { name: 'Alpha', keywords: ['alpha'] })
  const before = snapshot(tool)
  scoreToolMatch(tool, 'alpha')
  assert.strictEqual(snapshot(tool), before)
})

console.log(`Stage 4 search tests: PASS (${passed} cases)`)
