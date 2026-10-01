/**
 * 未来本地/云端数据合并纯函数。Stage 3 不发任何网络请求。
 * usage 采用独立聚合统计模型，不使用 deletedAt/Tombstone。
 * Stage 3 不对跨设备 useCount 做简单覆盖或相加；这里只生成“待决议合并计划”，
 * 保留两端计数与可安全预聚合的时间字段，真实计数合并留到未来同步阶段。
 */
const {
  USAGE_SYNC_MODEL,
  normalizeMeta,
  normalizeFavorites,
  normalizeHistory,
  normalizeUsage,
} = require('./data-schema')

const latestRecord = (a, b) => {
  if (!a) return b
  if (!b) return a
  return Number(b.updatedAt || 0) >= Number(a.updatedAt || 0) ? b : a
}

const mergeFavorites = (local, remote) => {
  const left = normalizeFavorites(local)
  const right = normalizeFavorites(remote)
  const map = new Map()
  ;[...left.items, ...right.items].forEach((item) => {
    const key = `${item.entityType}:${item.entityId}`
    map.set(key, latestRecord(map.get(key), item))
  })
  return normalizeFavorites({ version: 1, items: Array.from(map.values()) })
}

const mergeHistory = (local, remote) => {
  const left = normalizeHistory(local)
  const right = normalizeHistory(remote)
  const map = new Map()

  ;[...left.items, ...right.items].forEach((item) => {
    const key = `${item.entityType}:${item.entityId}`
    const previous = map.get(key)
    if (!previous) {
      map.set(key, item)
      return
    }
    const newer = latestRecord(previous, item)
    map.set(key, {
      ...newer,
      firstViewedAt: Math.min(Number(previous.firstViewedAt || 0), Number(item.firstViewedAt || 0)) || newer.firstViewedAt,
      lastViewedAt: Math.max(Number(previous.lastViewedAt || 0), Number(item.lastViewedAt || 0)),
      viewCount: Math.max(Number(previous.viewCount || 0), Number(item.viewCount || 0)),
    })
  })

  return normalizeHistory({ version: 1, items: Array.from(map.values()) })
}

const minPositive = (...values) => {
  const candidates = values.map(Number).filter((value) => Number.isFinite(value) && value > 0)
  return candidates.length ? Math.min(...candidates) : 0
}

/**
 * usage 的跨设备计数合并在 Stage 3 明确保持未决状态。
 * 返回值不是 wl_tool_usage_v1，可用于未来同步层决策，但禁止直接持久化回 usage Storage。
 */
const createUsageMergePlan = (local, remote) => {
  const left = normalizeUsage(local)
  const right = normalizeUsage(remote)
  const toolIds = new Set([...Object.keys(left.tools), ...Object.keys(right.tools)])
  const tools = {}

  toolIds.forEach((toolId) => {
    const localRecord = left.tools[toolId] || null
    const remoteRecord = right.tools[toolId] || null
    tools[toolId] = {
      local: localRecord,
      remote: remoteRecord,
      firstUsedAt: minPositive(localRecord && localRecord.firstUsedAt, remoteRecord && remoteRecord.firstUsedAt),
      lastUsedAt: Math.max(Number(localRecord && localRecord.lastUsedAt) || 0, Number(remoteRecord && remoteRecord.lastUsedAt) || 0),
      lastSuccessAt: Math.max(Number(localRecord && localRecord.lastSuccessAt) || 0, Number(remoteRecord && remoteRecord.lastSuccessAt) || 0),
      createdAt: minPositive(localRecord && localRecord.createdAt, remoteRecord && remoteRecord.createdAt),
      updatedAt: Math.max(Number(localRecord && localRecord.updatedAt) || 0, Number(remoteRecord && remoteRecord.updatedAt) || 0),
      useCount: {
        local: localRecord ? localRecord.useCount : null,
        remote: remoteRecord ? remoteRecord.useCount : null,
      },
      requiresCountResolution: Boolean(localRecord && remoteRecord),
    }
  })

  return {
    model: USAGE_SYNC_MODEL,
    resolved: false,
    tools,
  }
}

const mergeMeta = (local, remote) => {
  const left = normalizeMeta(local)
  const right = normalizeMeta(remote)
  const newer = latestRecord(left, right)
  return {
    ...newer,
    createdAt: Math.min(Number(left.createdAt || 0), Number(right.createdAt || 0)) || newer.createdAt,
    recentClearedAt: Math.max(Number(left.recentClearedAt || 0), Number(right.recentClearedAt || 0)),
  }
}

module.exports = {
  mergeFavorites,
  mergeHistory,
  createUsageMergePlan,
  mergeMeta,
}
