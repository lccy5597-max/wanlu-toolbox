const assert = require('assert')
const fs = require('fs')
const path = require('path')

const catalog = require('../utils/tool-catalog')

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

const repoRoot = path.join(__dirname, '..')
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
const pagePath = (tool) => `${tool.path.replace(/^\//, '')}.js`
const pageSource = (tool) => read(pagePath(tool))
const formalIds = catalog.tools.map((tool) => tool.id)

const expectedIds = [
  'image-compress', 'image-resize', 'qrcode', 'image-watermark', 'long-image', 'nine-grid', 'pindou', 'video-compress',
  'converter', 'date-diff', 'mortgage', 'salary', 'price-compare', 'compound', 'retirement-pension', 'retirement-age',
  'shelf-life', 'relationship', 'bmi', 'bmr', 'restaurant', 'ruler', 'choice-helper', 'guide',
]

// 24/24 formal page audit anchors.
test('formal catalog contains exactly 24 tools', () => assert.strictEqual(catalog.tools.length, 24))
test('formal tool ids match Stage 4 scope', () => assert.deepStrictEqual(formalIds, expectedIds))
test('wooden-fish is not formal', () => assert.strictEqual(formalIds.includes('wooden-fish'), false))
test('zodiac is not formal', () => assert.strictEqual(formalIds.includes('zodiac'), false))

catalog.tools.forEach((tool) => {
  test(`${tool.id} formal page exists and uses withToolPage`, () => {
    const source = pageSource(tool)
    assert(source.includes(`withToolPage('${tool.id}'`), `${tool.id} missing withToolPage`)
  })
})

// Usage success semantics.
test('guide does not record Usage', () => assert.strictEqual(pageSource(catalog.tools.find((tool) => tool.id === 'guide')).includes('recordToolUse('), false))
test('ruler does not misreport calibration saves as Usage', () => assert.strictEqual(pageSource(catalog.tools.find((tool) => tool.id === 'ruler')).includes('recordToolUse('), false))
test('relationship keeps silent intermediate calculations out of Usage', () => {
  const source = pageSource(catalog.tools.find((tool) => tool.id === 'relationship'))
  assert(source.includes('shouldRecordRelationshipUsage'))
  assert(source.includes('if (!silent) this.recordRelationshipUsage(true, true)'))
  assert(source.includes('this.onCalculate(true)'))
})
test('qrcode records Usage only after export preview success', () => {
  const source = pageSource(catalog.tools.find((tool) => tool.id === 'qrcode'))
  const exportIndex = source.indexOf('previewPath: filePath')
  const usageIndex = source.indexOf('this.recordToolUse()', exportIndex)
  assert(exportIndex >= 0 && usageIndex > exportIndex)
})

// Known async interaction protection.
test('qrcode has render reentry guard', () => assert(pageSource(catalog.tools.find((tool) => tool.id === 'qrcode')).includes('if (this.data.isRendering) return')))
test('qrcode has task generation token', () => assert(pageSource(catalog.tools.find((tool) => tool.id === 'qrcode')).includes('_renderTaskId')))
test('qrcode invalidates old task on unload', () => {
  const source = pageSource(catalog.tools.find((tool) => tool.id === 'qrcode'))
  assert(/onUnload\(\)[\s\S]*?_renderTaskId/.test(source))
})
test('pindou has image request token', () => assert(pageSource(catalog.tools.find((tool) => tool.id === 'pindou')).includes('_imageRequestId')))
test('pindou clears timer on unload', () => assert(/onUnload\(\)[\s\S]*?clearTimeout/.test(pageSource(catalog.tools.find((tool) => tool.id === 'pindou')))))
test('choice-helper blocks repeated pick', () => assert(pageSource(catalog.tools.find((tool) => tool.id === 'choice-helper')).includes('if (this.data.isPicking) return')))
test('choice-helper blocks option mutation while picking', () => {
  const source = pageSource(catalog.tools.find((tool) => tool.id === 'choice-helper'))
  assert(/onAddOption\(\)\s*\{\s*if \(this\.data\.isPicking\) return/.test(source))
})
test('choice-helper marks page inactive on unload', () => {
  const source = pageSource(catalog.tools.find((tool) => tool.id === 'choice-helper'))
  assert(source.includes('this._isPageActive = false'))
  assert(source.includes('this.clearPickTimer()'))
})
test('choice-helper async tail checks page activity', () => {
  const source = pageSource(catalog.tools.find((tool) => tool.id === 'choice-helper'))
  assert((source.match(/!this\._isPageActive/g) || []).length >= 3)
})

const mediaGuards = {
  'image-compress': 'isCompressing',
  'image-resize': 'isProcessing',
  qrcode: 'isRendering',
  'image-watermark': 'isProcessing',
  'long-image': 'isGenerating',
  'nine-grid': 'isGenerating',
  pindou: 'isGenerating',
  'video-compress': 'isCompressing',
}
Object.entries(mediaGuards).forEach(([id, flag]) => {
  test(`${id} has processing guard`, () => {
    const source = pageSource(catalog.tools.find((tool) => tool.id === id))
    assert(source.includes(flag))
    assert(source.includes(`recordToolUse()`))
  })
})

const savePages = ['image-compress', 'image-resize', 'qrcode', 'image-watermark', 'long-image', 'nine-grid', 'pindou', 'video-compress']
savePages.forEach((id) => {
  test(`${id} keeps save as separate interaction`, () => {
    const source = pageSource(catalog.tools.find((tool) => tool.id === id))
    assert(/onSave|onSaveAll/.test(source))
    assert(/isSaving/.test(source))
  })
})

// Closed Step 2 risk regressions.
test('converter finite validation remains in shared core', () => assert(read('utils/tool-logic/converter.js').includes('Number.isFinite')))
test('mortgage finite boundary validation remains in shared core', () => assert(read('utils/tool-logic/mortgage.js').includes('Number.isFinite')))
test('salary finite boundary validation remains in shared core', () => assert(read('utils/tool-logic/salary.js').includes('Number.isFinite')))
test('restaurant finite boundary validation remains in shared core', () => assert(read('utils/tool-logic/restaurant.js').includes('Number.isFinite')))
test('image-compress original option describes 4096 safety cap', () => assert(read('utils/tool-logic/image-compress.js').includes('最长边≤4096')))
test('image-resize custom size uses explicit validation core', () => {
  const source = read('utils/tool-logic/image-resize.js')
  assert(source.includes("fail('INVALID_SIZE'"))
  assert(source.includes("fail('SIZE_OUT_OF_RANGE'"))
})
test('nine-grid no longer forces 300px minimum tile', () => assert.strictEqual(read('utils/tool-logic/nine-grid.js').includes('Math.max(300'), false))
test('BMI UI explicitly limits interpretation to adults', () => assert(read('packageTools/pages/bmi/bmi.wxml').includes('成年人 BMI 参考范围')))
test('BMR core adult lower bound is 18', () => assert(read('utils/tool-logic/bmr.js').includes('ageValue < 18')))
test('guide no longer advertises 热门 semantics', () => {
  const source = read('packageTools/pages/guide/guide.js') + read('packageTools/pages/guide/guide.wxml')
  assert.strictEqual(source.includes('首页热门'), false)
  assert.strictEqual(source.includes('热门工具'), false)
})
test('guide no longer advertises zodiac', () => {
  const source = read('packageTools/pages/guide/guide.js') + read('packageTools/pages/guide/guide.wxml')
  assert.strictEqual(source.includes('星座计算器'), false)
  assert.strictEqual(source.includes('zodiac'), false)
})

// Static privacy/platform boundaries.
test('formal media pages do not request camera source', () => {
  const combined = savePages.map((id) => pageSource(catalog.tools.find((tool) => tool.id === id))).join('\n')
  assert.strictEqual(combined.includes("sourceType: ['camera']"), false)
  assert.strictEqual(combined.includes('scope.camera'), false)
})
test('app permissions do not include camera', () => {
  const appConfig = read('app.json')
  assert.strictEqual(appConfig.includes('scope.camera'), false)
})

console.log(`Stage 4 interaction tests: PASS (${passed} cases)`)
