/** 收藏服务：同一 entityType + entityId 永远只保留一条记录。 */
const storage = require('./storage')
const {
  STORAGE_KEYS,
  LIMITS,
  createFavorites,
  normalizeFavorites,
} = require('../utils/data-schema')

const nowTime = (value) => (Number.isFinite(Number(value)) ? Number(value) : Date.now())
const readDoc = () => normalizeFavorites(storage.get(STORAGE_KEYS.FAVORITES, createFavorites()))
const saveDoc = (doc) => storage.set(STORAGE_KEYS.FAVORITES, normalizeFavorites(doc))
const recordKey = (entityType, entityId) => `${entityType}:${entityId}`

const getFavorites = () => readDoc().items
  .filter((item) => item.deletedAt === null)
  .sort((a, b) => b.updatedAt - a.updatedAt)

const isFavorite = (entityId, entityType = 'tool') => {
  const id = String(entityId || '').trim()
  if (!id) return false
  return readDoc().items.some((item) => item.entityType === entityType && item.entityId === id && item.deletedAt === null)
}

const addFavorite = (entityId, entityType = 'tool', at) => {
  const id = String(entityId || '').trim()
  if (!id) return { ok: false, reason: 'invalid_id' }
  const now = nowTime(at)
  const doc = readDoc()
  const key = recordKey(entityType, id)
  const index = doc.items.findIndex((item) => recordKey(item.entityType, item.entityId) === key)
  const activeCount = doc.items.filter((item) => item.deletedAt === null).length
  const alreadyActive = index >= 0 && doc.items[index].deletedAt === null

  if (!alreadyActive && activeCount >= LIMITS.FAVORITES) {
    return { ok: false, reason: 'limit_reached' }
  }

  if (index >= 0) {
    doc.items[index] = {
      ...doc.items[index],
      updatedAt: now,
      deletedAt: null,
    }
  } else {
    doc.items.push({
      entityType,
      entityId: id,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
  }

  const saved = saveDoc(doc)
  return { ok: saved.ok, favorite: saved.ok, reason: saved.ok ? 'ok' : 'write_failed' }
}

const removeFavorite = (entityId, entityType = 'tool', at) => {
  const id = String(entityId || '').trim()
  if (!id) return { ok: false, reason: 'invalid_id' }
  const now = nowTime(at)
  const doc = readDoc()
  const key = recordKey(entityType, id)
  const index = doc.items.findIndex((item) => recordKey(item.entityType, item.entityId) === key)

  if (index < 0 || doc.items[index].deletedAt !== null) {
    return { ok: true, favorite: false, reason: 'already_removed' }
  }

  doc.items[index] = {
    ...doc.items[index],
    updatedAt: now,
    deletedAt: now,
  }
  const saved = saveDoc(doc)
  return { ok: saved.ok, favorite: false, reason: saved.ok ? 'ok' : 'write_failed' }
}

const toggleFavorite = (entityId, entityType = 'tool', at) => (
  isFavorite(entityId, entityType)
    ? removeFavorite(entityId, entityType, at)
    : addFavorite(entityId, entityType, at)
)

const clearFavorites = (at) => {
  const now = nowTime(at)
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
  getFavorites,
  isFavorite,
  addFavorite,
  removeFavorite,
  toggleFavorite,
  clearFavorites,
}
