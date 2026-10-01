/** 正式工具浏览记录服务。浏览与“最近使用”语义严格分离。 */
const storage = require('./storage')
const {
  STORAGE_KEYS,
  createHistory,
  normalizeHistory,
} = require('../utils/data-schema')

const readDoc = () => normalizeHistory(storage.get(STORAGE_KEYS.HISTORY, createHistory()))
const saveDoc = (doc) => storage.set(STORAGE_KEYS.HISTORY, normalizeHistory(doc))
const recordKey = (entityType, entityId) => `${entityType}:${entityId}`

const recordView = (entityId, entityType = 'tool', at = Date.now()) => {
  const id = String(entityId || '').trim()
  if (!id) return { ok: false, reason: 'invalid_id' }
  const now = Number.isFinite(Number(at)) ? Number(at) : Date.now()
  const doc = readDoc()
  const key = recordKey(entityType, id)
  const index = doc.items.findIndex((item) => recordKey(item.entityType, item.entityId) === key)

  if (index >= 0) {
    const current = doc.items[index]
    const revived = current.deletedAt !== null
    doc.items[index] = {
      ...current,
      firstViewedAt: revived ? now : current.firstViewedAt,
      lastViewedAt: now,
      viewCount: revived ? 1 : Math.max(0, Number(current.viewCount) || 0) + 1,
      updatedAt: now,
      deletedAt: null,
    }
  } else {
    doc.items.push({
      entityType,
      entityId: id,
      firstViewedAt: now,
      lastViewedAt: now,
      viewCount: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
  }

  const saved = saveDoc(doc)
  return { ok: saved.ok, reason: saved.ok ? 'ok' : 'write_failed' }
}

const getHistory = () => readDoc().items
  .filter((item) => item.deletedAt === null)
  .sort((a, b) => b.lastViewedAt - a.lastViewedAt)

const removeHistory = (entityId, entityType = 'tool', at = Date.now()) => {
  const id = String(entityId || '').trim()
  if (!id) return { ok: false, reason: 'invalid_id' }
  const now = Number.isFinite(Number(at)) ? Number(at) : Date.now()
  const doc = readDoc()
  const key = recordKey(entityType, id)
  const index = doc.items.findIndex((item) => recordKey(item.entityType, item.entityId) === key)
  if (index < 0 || doc.items[index].deletedAt !== null) return { ok: true, changed: false }
  doc.items[index] = { ...doc.items[index], updatedAt: now, deletedAt: now }
  const saved = saveDoc(doc)
  return { ok: saved.ok, changed: saved.ok }
}

const clearHistory = (at = Date.now()) => {
  const now = Number.isFinite(Number(at)) ? Number(at) : Date.now()
  const doc = readDoc()
  let changed = false
  doc.items = doc.items.map((item) => {
    if (item.deletedAt !== null) return item
    changed = true
    return { ...item, updatedAt: now, deletedAt: now }
  })
  if (!changed) return { ok: true, changed: false }
  const saved = saveDoc(doc)
  return { ok: saved.ok, changed: saved.ok }
}

module.exports = {
  recordView,
  getHistory,
  removeHistory,
  clearHistory,
}
