const storage = require('./storage')
const {
  validateContentDetail,
  validateContentSummary,
  validatePagination,
} = require('../utils/api-schema')
const { MAX_PAGE_SIZE } = require('../config/api-endpoints')

const CONTENT_CACHE_KEY = 'wl_content_cache_v1'
const CACHE_VERSION = 1
const LIST_TTL_MS = 5 * 60 * 1000
const DETAIL_TTL_MS = 30 * 60 * 1000
const MAX_STALE_MS = 24 * 60 * 60 * 1000
const MAX_LIST_ENTRIES = 10
const MAX_DETAIL_ENTRIES = 30
const MAX_DETAIL_CONTENT_CHARS = 200000

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const cloneJsonValue = (value) => {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map((item) => cloneJsonValue(item))
  if (isPlainObject(value)) {
    const out = {}
    Object.keys(value).forEach((key) => {
      const next = cloneJsonValue(value[key])
      if (next !== undefined) out[key] = next
    })
    return out
  }
  if (['string', 'number', 'boolean'].includes(typeof value)) return value
  return undefined
}

const createEmptyRoot = () => ({ version: CACHE_VERSION, entries: {} })

const normalizeNow = (nowProvider) => {
  const value = Number(nowProvider())
  return Number.isFinite(value) && value >= 0 ? value : Date.now()
}

const normalizeCategoryToken = (category) => {
  if (category === undefined || category === null) return '-'
  const value = String(category).trim()
  return value ? encodeURIComponent(value) : '-'
}

const buildListCacheKey = ({ page, pageSize, category } = {}) => {
  if (!Number.isInteger(page) || page < 1) throw new Error('invalid_cache_page')
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error('invalid_cache_page_size')
  return `list:page=${page}:pageSize=${pageSize}:category=${normalizeCategoryToken(category)}`
}

const buildDetailCacheKey = (id) => {
  const value = typeof id === 'string' ? id.trim() : ''
  if (!value) throw new Error('invalid_cache_article_id')
  return `detail:id=${encodeURIComponent(value)}`
}

const getCacheFreshness = (entry, now) => {
  if (!entry || !Number.isFinite(entry.expiresAt)) return 'invalid'
  if (now <= entry.expiresAt) return 'fresh'
  if (now <= entry.expiresAt + MAX_STALE_MS) return 'stale'
  return 'expired'
}

const validateListData = (data) => {
  if (!isPlainObject(data) || !Array.isArray(data.items)) return false
  if (!validatePagination(data.pagination, { maxPageSize: MAX_PAGE_SIZE }).ok) return false
  return data.items.every((item) => validateContentSummary(item).ok)
}

const validateDetailData = (data) => validateContentDetail(data).ok

const isValidRoot = (root) => isPlainObject(root)
  && root.version === CACHE_VERSION
  && isPlainObject(root.entries)

const isValidEntry = (entry, type, key) => isPlainObject(entry)
  && entry.type === type
  && entry.key === key
  && Number.isFinite(entry.cachedAt)
  && entry.cachedAt >= 0
  && Number.isFinite(entry.expiresAt)
  && entry.expiresAt >= entry.cachedAt
  && Object.prototype.hasOwnProperty.call(entry, 'data')

const createContentCache = ({ storage: storageAdapter = storage, nowProvider = Date.now } = {}) => {
  if (!storageAdapter
    || typeof storageAdapter.readRaw !== 'function'
    || typeof storageAdapter.set !== 'function'
    || typeof storageAdapter.remove !== 'function') {
    throw new TypeError('content_cache_storage_adapter_required')
  }
  if (typeof nowProvider !== 'function') throw new TypeError('content_cache_now_provider_required')

  const removeRootSafely = () => {
    try {
      storageAdapter.remove(CONTENT_CACHE_KEY)
    } catch (error) {
      // Cache cleanup is best-effort and must never affect content requests.
    }
  }

  const loadRoot = () => {
    let result
    try {
      result = storageAdapter.readRaw(CONTENT_CACHE_KEY)
    } catch (error) {
      return { ok: false, found: false, error }
    }
    if (!result || result.ok !== true) return { ok: false, found: false, error: result && result.error }
    if (!result.found) return { ok: true, found: false, root: createEmptyRoot() }
    if (!isValidRoot(result.value)) {
      removeRootSafely()
      return { ok: true, found: false, root: createEmptyRoot(), repaired: true }
    }
    return { ok: true, found: true, root: cloneJsonValue(result.value) }
  }

  const saveRoot = (root) => {
    try {
      const saved = storageAdapter.set(CONTENT_CACHE_KEY, cloneJsonValue(root))
      return Boolean(saved && saved.ok === true)
    } catch (error) {
      return false
    }
  }

  const removeEntrySafely = (root, key) => {
    if (!root || !root.entries || !Object.prototype.hasOwnProperty.call(root.entries, key)) return
    delete root.entries[key]
    saveRoot(root)
  }

  const readEntry = ({ type, key, validateData }) => {
    const loaded = loadRoot()
    if (!loaded.ok) return { ok: false, hit: false, reason: 'storage_read_failed' }
    if (!loaded.found) return { ok: true, hit: false, reason: 'miss' }

    const entry = loaded.root.entries[key]
    if (!isValidEntry(entry, type, key)) {
      if (entry !== undefined) removeEntrySafely(loaded.root, key)
      return { ok: true, hit: false, reason: 'invalid_entry' }
    }
    if (!validateData(entry.data)) {
      removeEntrySafely(loaded.root, key)
      return { ok: true, hit: false, reason: 'invalid_schema' }
    }

    const now = normalizeNow(nowProvider)
    const freshness = getCacheFreshness(entry, now)
    if (freshness === 'expired' || freshness === 'invalid') {
      removeEntrySafely(loaded.root, key)
      return { ok: true, hit: false, reason: 'expired' }
    }

    return {
      ok: true,
      hit: true,
      freshness,
      cachedAt: entry.cachedAt,
      data: cloneJsonValue(entry.data),
    }
  }

  const evictOldest = (root, type, maxEntries) => {
    const entries = Object.values(root.entries)
      .filter((entry) => isPlainObject(entry) && entry.type === type && typeof entry.key === 'string')
      .sort((a, b) => (a.cachedAt - b.cachedAt) || a.key.localeCompare(b.key))
    while (entries.length > maxEntries) {
      const oldest = entries.shift()
      delete root.entries[oldest.key]
    }
  }

  const writeEntry = ({ type, key, ttlMs, maxEntries, data }) => {
    const loaded = loadRoot()
    if (!loaded.ok) return { ok: false, cached: false, reason: 'storage_read_failed' }
    const root = loaded.root || createEmptyRoot()
    const now = normalizeNow(nowProvider)
    root.entries[key] = {
      type,
      key,
      cachedAt: now,
      expiresAt: now + ttlMs,
      data: cloneJsonValue(data),
    }
    evictOldest(root, type, maxEntries)
    return saveRoot(root)
      ? { ok: true, cached: true, cachedAt: now }
      : { ok: false, cached: false, reason: 'storage_write_failed' }
  }

  const readList = (query) => {
    let key
    try {
      key = buildListCacheKey(query)
    } catch (error) {
      return { ok: true, hit: false, reason: 'invalid_key' }
    }
    return readEntry({ type: 'list', key, validateData: validateListData })
  }

  const writeList = (query, data) => {
    if (!validateListData(data)) return { ok: false, cached: false, reason: 'invalid_data' }
    let key
    try {
      key = buildListCacheKey(query)
    } catch (error) {
      return { ok: false, cached: false, reason: 'invalid_key' }
    }
    return writeEntry({
      type: 'list',
      key,
      ttlMs: LIST_TTL_MS,
      maxEntries: MAX_LIST_ENTRIES,
      data,
    })
  }

  const readDetail = (id) => {
    let key
    try {
      key = buildDetailCacheKey(id)
    } catch (error) {
      return { ok: true, hit: false, reason: 'invalid_key' }
    }
    return readEntry({ type: 'detail', key, validateData: validateDetailData })
  }

  const writeDetail = (id, data) => {
    if (!validateDetailData(data)) return { ok: false, cached: false, reason: 'invalid_data' }
    if (data.content.length > MAX_DETAIL_CONTENT_CHARS) {
      return { ok: true, cached: false, reason: 'oversize' }
    }
    let key
    try {
      key = buildDetailCacheKey(id)
    } catch (error) {
      return { ok: false, cached: false, reason: 'invalid_key' }
    }
    return writeEntry({
      type: 'detail',
      key,
      ttlMs: DETAIL_TTL_MS,
      maxEntries: MAX_DETAIL_ENTRIES,
      data,
    })
  }

  const clearContentCache = () => {
    try {
      const result = storageAdapter.remove(CONTENT_CACHE_KEY)
      return { ok: Boolean(result && result.ok === true) }
    } catch (error) {
      return { ok: false, error }
    }
  }

  return Object.freeze({
    readList,
    writeList,
    readDetail,
    writeDetail,
    clearContentCache,
  })
}

const contentCache = createContentCache()

module.exports = {
  CACHE_VERSION,
  CONTENT_CACHE_KEY,
  DETAIL_TTL_MS,
  LIST_TTL_MS,
  MAX_DETAIL_CONTENT_CHARS,
  MAX_DETAIL_ENTRIES,
  MAX_LIST_ENTRIES,
  MAX_STALE_MS,
  buildDetailCacheKey,
  buildListCacheKey,
  cloneJsonValue,
  contentCache,
  createContentCache,
  getCacheFreshness,
  validateDetailData,
  validateListData,
}
