const assert = require('assert')

const memory = new Map()
let failNextSetKey = ''
global.wx = {
  getStorageSync(key) {
    return memory.has(key) ? memory.get(key) : ''
  },
  setStorageSync(key, value) {
    if (key === failNextSetKey) {
      failNextSetKey = ''
      throw new Error(`simulated write failure: ${key}`)
    }
    memory.set(key, value)
  },
  removeStorageSync(key) {
    memory.delete(key)
  },
}

const schema = require('../utils/data-schema')
const userData = require('../services/user-data')
const favorites = require('../services/favorites')
const history = require('../services/history')
const usage = require('../services/tool-usage')
const toolState = require('../services/tool-state')
const merge = require('../utils/data-merge')
const migrations = require('../utils/data-migrations')

const init = userData.initialize()
assert.strictEqual(init.ok, true, 'initialize should succeed')
Object.values(schema.STORAGE_KEYS).forEach((key) => {
  assert.strictEqual(memory.has(key), true, `${key} should be initialized`)
})

assert.strictEqual(schema.USAGE_SYNC_MODEL, 'aggregate-no-tombstone')

// 阶段2尺子旧键通过 migration 迁入统一 wl_tool_state_v1，并移除旧键。
memory.set('rulerCalibrationV1', {
  pxPerMm: 3.5,
  standardId: 'card-long',
  standardLength: 85.6,
  customLengthInput: '',
  calibrationPx: 300,
  windowWidth: 390,
  updatedAt: 90,
})
memory.set(schema.STORAGE_KEYS.TOOL_STATE, schema.createToolState())
assert.strictEqual(userData.initialize().ok, true)
assert.strictEqual(userData.toolState.getToolState('ruler').calibration.pxPerMm, 3.5)
assert.strictEqual(memory.has('rulerCalibrationV1'), false)

// migration 幂等：稳定 v1 数据再次初始化不应改写内容或更新时间。
const stableBefore = JSON.stringify(Object.values(schema.STORAGE_KEYS).map((key) => [key, memory.get(key)]))
const secondInit = migrations.initializeStorage(Date.now() + 1000)
assert.strictEqual(secondInit.ok, true)
assert.strictEqual(secondInit.migrated, false)
const stableAfter = JSON.stringify(Object.values(schema.STORAGE_KEYS).map((key) => [key, memory.get(key)]))
assert.strictEqual(stableAfter, stableBefore)

// migration 中途写失败必须回滚已经写过的分区，旧数据与旧 meta 均保留。
const legacyFavorites = [{ entityType: 'tool', entityId: 'legacy-favorite', createdAt: 1, updatedAt: 1, deletedAt: null }]
const legacyHistory = [{ entityType: 'tool', entityId: 'legacy-history', firstViewedAt: 1, lastViewedAt: 1, viewCount: 1, createdAt: 1, updatedAt: 1, deletedAt: null }]
const legacyMeta = { schemaVersion: 0, createdAt: 1, updatedAt: 1, recentClearedAt: 0 }
memory.set(schema.STORAGE_KEYS.FAVORITES, legacyFavorites)
memory.set(schema.STORAGE_KEYS.HISTORY, legacyHistory)
memory.set(schema.STORAGE_KEYS.META, legacyMeta)
failNextSetKey = schema.STORAGE_KEYS.HISTORY
const failedMigration = migrations.initializeStorage(500)
assert.strictEqual(failedMigration.ok, false)
assert.strictEqual(failedMigration.rollbackOk, true)
assert.deepStrictEqual(memory.get(schema.STORAGE_KEYS.FAVORITES), legacyFavorites)
assert.deepStrictEqual(memory.get(schema.STORAGE_KEYS.HISTORY), legacyHistory)
assert.deepStrictEqual(memory.get(schema.STORAGE_KEYS.META), legacyMeta)
assert.strictEqual(migrations.initializeStorage(600).ok, true)
assert.strictEqual(userData.clearAllLocalData().ok, true)

// 收藏：同一 toolId 永远只有一条记录；取消/重新收藏只切换 tombstone。
assert.strictEqual(favorites.addFavorite('qrcode', 'tool', 100).ok, true)
assert.strictEqual(favorites.addFavorite('qrcode', 'tool', 110).ok, true)
let favoriteDoc = memory.get(schema.STORAGE_KEYS.FAVORITES)
assert.strictEqual(favoriteDoc.items.length, 1)
assert.strictEqual(favoriteDoc.items[0].deletedAt, null)
assert.strictEqual(favorites.removeFavorite('qrcode', 'tool', 120).ok, true)
favoriteDoc = memory.get(schema.STORAGE_KEYS.FAVORITES)
assert.strictEqual(favoriteDoc.items.length, 1)
assert.strictEqual(favoriteDoc.items[0].deletedAt, 120)
assert.strictEqual(favorites.addFavorite('qrcode', 'tool', 130).ok, true)
favoriteDoc = memory.get(schema.STORAGE_KEYS.FAVORITES)
assert.strictEqual(favoriteDoc.items.length, 1)
assert.strictEqual(favoriteDoc.items[0].deletedAt, null)
assert.strictEqual(favoriteDoc.items[0].updatedAt, 130)

// 浏览：同一工具更新同一条记录，不无限新增。
assert.strictEqual(history.recordView('qrcode', 'tool', 200).ok, true)
assert.strictEqual(history.recordView('qrcode', 'tool', 220).ok, true)
let historyDoc = memory.get(schema.STORAGE_KEYS.HISTORY)
assert.strictEqual(historyDoc.items.length, 1)
assert.strictEqual(historyDoc.items[0].viewCount, 2)
assert.strictEqual(historyDoc.items[0].lastViewedAt, 220)
assert.strictEqual(history.clearHistory(230).ok, true)
assert.strictEqual(history.getHistory().length, 0)
assert.strictEqual(history.recordView('qrcode', 'tool', 240).ok, true)
historyDoc = memory.get(schema.STORAGE_KEYS.HISTORY)
assert.strictEqual(historyDoc.items.length, 1)
assert.strictEqual(historyDoc.items[0].firstViewedAt, 240)
assert.strictEqual(historyDoc.items[0].lastViewedAt, 240)
assert.strictEqual(historyDoc.items[0].viewCount, 1)
assert.strictEqual(historyDoc.items[0].deletedAt, null)

// 最近使用：由 usage 派生；clearRecent 不清除 useCount。
assert.strictEqual(usage.recordToolUse('qrcode', 300).ok, true)
assert.strictEqual(usage.recordToolUse('qrcode', 310).ok, true)
assert.strictEqual(usage.getToolUsage('qrcode').useCount, 2)
assert.strictEqual(usage.getRecentTools().length, 1)
assert.strictEqual(usage.clearRecent(320).ok, true)
assert.strictEqual(usage.getRecentTools().length, 0)
assert.strictEqual(usage.getToolUsage('qrcode').useCount, 2)
assert.strictEqual(usage.recordToolUse('qrcode', 330).ok, true)
assert.strictEqual(usage.getRecentTools()[0].toolId, 'qrcode')
assert.strictEqual(usage.getToolUsage('qrcode').useCount, 3)

// Usage 明确采用独立统计模型，不含 deletedAt。
assert.strictEqual(Object.prototype.hasOwnProperty.call(usage.getToolUsage('qrcode'), 'deletedAt'), false)

// 安全偏好白名单：允许字段保留，敏感/未知字段丢弃。
assert.strictEqual(toolState.setToolState('image-compress', {
  qualityMode: 'clear',
  maxWidth: '1920',
  originalPath: '/tmp/private.jpg',
}).ok, true)
const safeState = toolState.getToolState('image-compress')
assert.deepStrictEqual(safeState, { qualityMode: 'clear', maxWidth: '1920' })

// 损坏数据恢复：初始化会把错误结构归一化，不影响其他分区。
memory.set(schema.STORAGE_KEYS.HISTORY, { version: 999, items: 'broken' })
const repaired = userData.initialize()
assert.strictEqual(repaired.ok, true)
assert.deepStrictEqual(memory.get(schema.STORAGE_KEYS.HISTORY).items, [])
assert.strictEqual(favorites.isFavorite('qrcode'), true)

// 合并：收藏较新的 tombstone 获胜；recentClearedAt 取较新；usage 只生成待决议计划，不覆盖/相加 useCount。
const mergedFavorites = merge.mergeFavorites(
  { version: 1, items: [{ entityType: 'tool', entityId: 'converter', createdAt: 1, updatedAt: 10, deletedAt: null }] },
  { version: 1, items: [{ entityType: 'tool', entityId: 'converter', createdAt: 1, updatedAt: 20, deletedAt: 20 }] },
)
assert.strictEqual(mergedFavorites.items.length, 1)
assert.strictEqual(mergedFavorites.items[0].deletedAt, 20)
const mergedMeta = merge.mergeMeta(
  { schemaVersion: 1, createdAt: 1, updatedAt: 10, recentClearedAt: 5 },
  { schemaVersion: 1, createdAt: 2, updatedAt: 20, recentClearedAt: 15 },
)
assert.strictEqual(mergedMeta.recentClearedAt, 15)
const usageMergePlan = merge.createUsageMergePlan(
  { version: 1, tools: { qrcode: { firstUsedAt: 1, lastUsedAt: 10, lastSuccessAt: 10, useCount: 2, createdAt: 1, updatedAt: 10 } } },
  { version: 1, tools: { qrcode: { firstUsedAt: 1, lastUsedAt: 20, lastSuccessAt: 20, useCount: 3, createdAt: 1, updatedAt: 20 } } },
)
assert.strictEqual(usageMergePlan.model, schema.USAGE_SYNC_MODEL)
assert.strictEqual(usageMergePlan.resolved, false)
assert.strictEqual(usageMergePlan.tools.qrcode.lastUsedAt, 20)
assert.deepStrictEqual(usageMergePlan.tools.qrcode.useCount, { local: 2, remote: 3 })
assert.strictEqual(usageMergePlan.tools.qrcode.requiresCountResolution, true)

// 容量控制：有效收藏最多 200；浏览记录自动只保留最新 300 条。
assert.strictEqual(favorites.clearFavorites(400).ok, true)
for (let index = 0; index < schema.LIMITS.FAVORITES; index += 1) {
  assert.strictEqual(favorites.addFavorite(`capacity-favorite-${index}`, 'tool', 500 + index).ok, true)
}
assert.strictEqual(favorites.getFavorites().length, schema.LIMITS.FAVORITES)
assert.strictEqual(favorites.addFavorite('capacity-overflow', 'tool', 999).reason, 'limit_reached')
assert.strictEqual(favorites.addFavorite('qrcode', 'tool', 999).reason, 'limit_reached')
assert.strictEqual(favorites.clearFavorites(1000).ok, true)

assert.strictEqual(history.clearHistory(1000).ok, true)
for (let index = 0; index < schema.LIMITS.HISTORY + 5; index += 1) {
  assert.strictEqual(history.recordView(`capacity-history-${index}`, 'tool', 1100 + index).ok, true)
}
assert.strictEqual(history.getHistory().length, schema.LIMITS.HISTORY)

// clearUsage 才真正重置使用统计。
assert.strictEqual(usage.clearUsage().ok, true)
assert.strictEqual(usage.getToolUsage('qrcode'), null)

// 清空全部数据后必须重建 meta/schema。
assert.strictEqual(userData.clearAllLocalData().ok, true)
assert.strictEqual(memory.get(schema.STORAGE_KEYS.META).schemaVersion, 1)
assert.strictEqual(memory.get(schema.STORAGE_KEYS.META).recentClearedAt, 0)

console.log('Stage 3 data-layer tests: PASS')
