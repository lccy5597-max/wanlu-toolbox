/**
 * 工具使用统计服务。
 *
 * 一致性说明：wl_tool_usage_v1 是“聚合统计实体”，未来采用独立统计同步模型，
 * 不使用 Tombstone，因此 usage 记录没有 deletedAt。clearUsage() 是用户明确发起的
 * 本地统计重置，不表示一条需要同步的逻辑删除记录。未来跨设备统计合并另按统计模型处理。
 */
const storage = require('./storage')
const {
  STORAGE_KEYS,
  createMeta,
  createUsage,
  normalizeMeta,
  normalizeUsage,
} = require('../utils/data-schema')

const readUsage = () => normalizeUsage(storage.get(STORAGE_KEYS.USAGE, createUsage()))
const saveUsage = (doc) => storage.set(STORAGE_KEYS.USAGE, normalizeUsage(doc))
const readMeta = () => normalizeMeta(storage.get(STORAGE_KEYS.META, createMeta()))

const recordToolUse = (toolId, at = Date.now()) => {
  const id = String(toolId || '').trim()
  if (!id) return { ok: false, reason: 'invalid_id' }
  const now = Number.isFinite(Number(at)) ? Number(at) : Date.now()
  const doc = readUsage()
  const current = doc.tools[id]

  doc.tools[id] = current ? {
    ...current,
    lastUsedAt: now,
    lastSuccessAt: now,
    useCount: Math.max(0, Number(current.useCount) || 0) + 1,
    updatedAt: now,
  } : {
    firstUsedAt: now,
    lastUsedAt: now,
    lastSuccessAt: now,
    useCount: 1,
    createdAt: now,
    updatedAt: now,
  }

  const saved = saveUsage(doc)
  return { ok: saved.ok, usage: saved.ok ? doc.tools[id] : null, reason: saved.ok ? 'ok' : 'write_failed' }
}

const getToolUsage = (toolId) => {
  const id = String(toolId || '').trim()
  return id ? (readUsage().tools[id] || null) : null
}

const getRecentTools = (limit = 20) => {
  const meta = readMeta()
  const clearedAt = Number(meta.recentClearedAt) || 0
  const list = Object.entries(readUsage().tools)
    .map(([toolId, usage]) => ({ toolId, ...usage }))
    .filter((item) => Number(item.lastUsedAt) > clearedAt)
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
  return Number(limit) > 0 ? list.slice(0, Number(limit)) : list
}

const clearRecent = (at = Date.now()) => {
  const now = Number.isFinite(Number(at)) ? Number(at) : Date.now()
  const meta = readMeta()
  const next = { ...meta, recentClearedAt: now, updatedAt: now }
  const saved = storage.set(STORAGE_KEYS.META, next)
  return { ok: saved.ok, recentClearedAt: saved.ok ? now : meta.recentClearedAt }
}

const clearUsage = () => {
  const saved = storage.set(STORAGE_KEYS.USAGE, createUsage())
  return { ok: saved.ok }
}

module.exports = {
  recordToolUse,
  getToolUsage,
  getRecentTools,
  clearRecent,
  clearUsage,
}
