/**
 * Stage 3 本地数据 Schema。
 *
 * 重要：tool usage 是“聚合统计实体”，未来采用独立统计同步模型，不使用 Tombstone，
 * 因此 wl_tool_usage_v1 的单条统计记录明确不包含 deletedAt。
 * 收藏/浏览等可删除实体才使用 deletedAt 表示逻辑删除。
 */
const SCHEMA_VERSION = 1
const USAGE_SYNC_MODEL = 'aggregate-no-tombstone'

const STORAGE_KEYS = Object.freeze({
  META: 'wl_meta_v1',
  FAVORITES: 'wl_favorites_v1',
  HISTORY: 'wl_history_v1',
  USAGE: 'wl_tool_usage_v1',
  TOOL_STATE: 'wl_tool_state_v1',
})

const LIMITS = Object.freeze({
  FAVORITES: 200,
  HISTORY: 300,
})

const TOOL_STATE_WHITELIST = Object.freeze({
  'image-compress': ['qualityMode', 'maxWidth'],
  converter: ['activeCategory'],
  ruler: ['calibration'],
})

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const finiteNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback)
const safeTime = (value, fallback = 0) => {
  const n = finiteNumber(value, fallback)
  return n >= 0 ? n : fallback
}
const safeId = (value) => String(value == null ? '' : value).trim()

const createMeta = (now = Date.now()) => ({
  schemaVersion: SCHEMA_VERSION,
  createdAt: now,
  updatedAt: now,
  recentClearedAt: 0,
})

const createFavorites = () => ({ version: SCHEMA_VERSION, items: [] })
const createHistory = () => ({ version: SCHEMA_VERSION, items: [] })
const createUsage = () => ({ version: SCHEMA_VERSION, tools: {} })
const createToolState = () => ({ version: SCHEMA_VERSION, tools: {} })

const normalizeMeta = (raw, now = Date.now()) => {
  const source = isPlainObject(raw) ? raw : {}
  const createdAt = safeTime(source.createdAt, now)
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt,
    updatedAt: safeTime(source.updatedAt, createdAt),
    recentClearedAt: safeTime(source.recentClearedAt, 0),
  }
}

const normalizeFavoriteRecord = (raw, now = Date.now()) => {
  if (!isPlainObject(raw)) return null
  const entityType = safeId(raw.entityType) || 'tool'
  const entityId = safeId(raw.entityId)
  if (!entityId) return null
  const createdAt = safeTime(raw.createdAt, now)
  const updatedAt = safeTime(raw.updatedAt, createdAt)
  const deletedAt = raw.deletedAt === null || raw.deletedAt === undefined
    ? null
    : safeTime(raw.deletedAt, updatedAt)
  return { entityType, entityId, createdAt, updatedAt, deletedAt }
}

const normalizeFavorites = (raw, now = Date.now()) => {
  const source = Array.isArray(raw) ? { items: raw } : (isPlainObject(raw) ? raw : {})
  const records = Array.isArray(source.items) ? source.items : []
  const byKey = new Map()

  records.forEach((item) => {
    const record = normalizeFavoriteRecord(item, now)
    if (!record) return
    const key = `${record.entityType}:${record.entityId}`
    const previous = byKey.get(key)
    if (!previous || record.updatedAt >= previous.updatedAt) {
      byKey.set(key, record)
    }
  })

  const items = Array.from(byKey.values())
  const active = items.filter((item) => item.deletedAt === null)
    .sort((a, b) => b.updatedAt - a.updatedAt)
  const allowedActive = new Set(active.slice(0, LIMITS.FAVORITES).map((item) => `${item.entityType}:${item.entityId}`))

  return {
    version: SCHEMA_VERSION,
    items: items.filter((item) => item.deletedAt !== null || allowedActive.has(`${item.entityType}:${item.entityId}`)),
  }
}

const normalizeHistoryRecord = (raw, now = Date.now()) => {
  if (!isPlainObject(raw)) return null
  const entityType = safeId(raw.entityType) || 'tool'
  const entityId = safeId(raw.entityId)
  if (!entityId) return null
  const createdAt = safeTime(raw.createdAt, now)
  const firstViewedAt = safeTime(raw.firstViewedAt, createdAt)
  const lastViewedAt = safeTime(raw.lastViewedAt, firstViewedAt)
  const updatedAt = safeTime(raw.updatedAt, lastViewedAt)
  const deletedAt = raw.deletedAt === null || raw.deletedAt === undefined
    ? null
    : safeTime(raw.deletedAt, updatedAt)

  return {
    entityType,
    entityId,
    firstViewedAt,
    lastViewedAt,
    viewCount: Math.max(0, Math.floor(finiteNumber(raw.viewCount, 0))),
    createdAt,
    updatedAt,
    deletedAt,
  }
}

const normalizeHistory = (raw, now = Date.now()) => {
  const source = Array.isArray(raw) ? { items: raw } : (isPlainObject(raw) ? raw : {})
  const records = Array.isArray(source.items) ? source.items : []
  const byKey = new Map()

  records.forEach((item) => {
    const record = normalizeHistoryRecord(item, now)
    if (!record) return
    const key = `${record.entityType}:${record.entityId}`
    const previous = byKey.get(key)
    if (!previous || record.updatedAt >= previous.updatedAt) byKey.set(key, record)
  })

  const items = Array.from(byKey.values())
  const active = items.filter((item) => item.deletedAt === null)
    .sort((a, b) => b.lastViewedAt - a.lastViewedAt)
    .slice(0, LIMITS.HISTORY)
  const activeKeys = new Set(active.map((item) => `${item.entityType}:${item.entityId}`))

  return {
    version: SCHEMA_VERSION,
    items: items.filter((item) => item.deletedAt !== null || activeKeys.has(`${item.entityType}:${item.entityId}`)),
  }
}

const normalizeUsageRecord = (raw, now = Date.now()) => {
  if (!isPlainObject(raw)) return null
  const firstUsedAt = safeTime(raw.firstUsedAt, now)
  const lastUsedAt = safeTime(raw.lastUsedAt, firstUsedAt)
  const lastSuccessAt = safeTime(raw.lastSuccessAt, lastUsedAt)
  const createdAt = safeTime(raw.createdAt, firstUsedAt)
  return {
    firstUsedAt,
    lastUsedAt,
    lastSuccessAt,
    useCount: Math.max(0, Math.floor(finiteNumber(raw.useCount, 0))),
    createdAt,
    updatedAt: safeTime(raw.updatedAt, lastUsedAt),
  }
}

const normalizeUsage = (raw, now = Date.now()) => {
  const source = isPlainObject(raw) ? raw : {}
  const rawTools = isPlainObject(source.tools) ? source.tools : {}
  const tools = {}

  Object.keys(rawTools).forEach((toolId) => {
    const id = safeId(toolId)
    const record = normalizeUsageRecord(rawTools[toolId], now)
    if (id && record) tools[id] = record
  })

  return { version: SCHEMA_VERSION, tools }
}

const sanitizeCalibration = (value) => {
  if (!isPlainObject(value)) return null
  const pxPerMm = finiteNumber(value.pxPerMm, 0)
  if (!(pxPerMm > 0)) return null
  return {
    pxPerMm,
    standardId: safeId(value.standardId),
    standardLength: finiteNumber(value.standardLength, 0),
    customLengthInput: String(value.customLengthInput == null ? '' : value.customLengthInput).slice(0, 16),
    calibrationPx: finiteNumber(value.calibrationPx, 0),
    windowWidth: finiteNumber(value.windowWidth, 0),
    updatedAt: safeTime(value.updatedAt, Date.now()),
  }
}

const sanitizeToolStateValue = (toolId, raw) => {
  if (!isPlainObject(raw)) return {}
  const allowed = TOOL_STATE_WHITELIST[toolId] || []
  const result = {}

  allowed.forEach((key) => {
    const value = raw[key]
    if (key === 'qualityMode' && ['clear', 'balanced', 'small'].includes(value)) result[key] = value
    else if (key === 'maxWidth' && ['original', '1920', '1280', '800'].includes(String(value))) result[key] = String(value)
    else if (key === 'activeCategory' && ['length', 'area', 'weight', 'volume', 'temperature'].includes(value)) result[key] = value
    else if (key === 'calibration') {
      const calibration = sanitizeCalibration(value)
      if (calibration) result[key] = calibration
    }
  })

  return result
}

const normalizeToolState = (raw) => {
  const source = isPlainObject(raw) ? raw : {}
  const rawTools = isPlainObject(source.tools) ? source.tools : {}
  const tools = {}

  Object.keys(TOOL_STATE_WHITELIST).forEach((toolId) => {
    const value = sanitizeToolStateValue(toolId, rawTools[toolId])
    if (Object.keys(value).length) tools[toolId] = value
  })

  return { version: SCHEMA_VERSION, tools }
}

module.exports = {
  SCHEMA_VERSION,
  USAGE_SYNC_MODEL,
  STORAGE_KEYS,
  LIMITS,
  TOOL_STATE_WHITELIST,
  isPlainObject,
  createMeta,
  createFavorites,
  createHistory,
  createUsage,
  createToolState,
  normalizeMeta,
  normalizeFavorites,
  normalizeHistory,
  normalizeUsage,
  normalizeToolState,
  sanitizeToolStateValue,
}
