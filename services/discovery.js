/**
 * 本地工具发现聚合层。
 *
 * 只读取正式 tool-catalog 与 Stage 3 favorites / tool-usage Service，
 * 不直接访问 Storage，不持久化推荐结果，也不建立用户画像。
 */
const toolCatalog = require('../utils/tool-catalog')
const favorites = require('./favorites')
const toolUsage = require('./tool-usage')

const PROHIBITED_TOOL_IDS = new Set(['wooden-fish', 'zodiac'])
const TOOL_PAGE_ROOT = '/packageTools/pages/'

const normalizeId = (value) => String(value == null ? '' : value).trim()

const toFiniteNumber = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

const resolveLimit = (options) => {
  let value

  if (options === undefined || options === null) return null
  if (typeof options === 'number') value = options
  else if (typeof options === 'object' && !Array.isArray(options)) value = options.limit
  else return 0

  if (value === undefined || value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0
  return Math.floor(value)
}

const applyLimit = (list, options) => {
  const limit = resolveLimit(options)
  if (limit === null) return list.slice()
  if (limit <= 0) return []
  return list.slice(0, limit)
}

const isFormalTool = (tool) => {
  if (!tool || typeof tool !== 'object') return false
  if (tool.enabled === false || tool.disabled === true) return false

  const id = normalizeId(tool.id)
  const path = String(tool.path == null ? '' : tool.path).trim()

  if (!id || !path.startsWith(TOOL_PAGE_ROOT)) return false
  if (PROHIBITED_TOOL_IDS.has(id)) return false

  for (const prohibitedId of PROHIBITED_TOOL_IDS) {
    if (path.includes(`/${prohibitedId}/`) || path.endsWith(`/${prohibitedId}`)) return false
  }

  return true
}

const buildCatalogState = (catalog) => {
  const source = Array.isArray(catalog) ? catalog : []
  const list = []
  const map = new Map()

  source.forEach((tool, originalIndex) => {
    if (!isFormalTool(tool)) return
    const id = normalizeId(tool.id)
    if (map.has(id)) return

    const entry = { tool, originalIndex }
    list.push(entry)
    map.set(id, entry)
  })

  return { list, map }
}

const normalizeUsageEntry = (tool, originalIndex, usage) => {
  const useCount = Math.max(0, toFiniteNumber(usage && usage.useCount, 0))
  const lastUsedAt = Math.max(0, toFiniteNumber(usage && usage.lastUsedAt, 0))

  return {
    tool,
    originalIndex,
    useCount,
    lastUsedAt,
  }
}

const createDiscoveryService = ({
  catalog = [],
  favoritesService,
  toolUsageService,
} = {}) => {
  const getCatalogState = () => buildCatalogState(catalog)

  const getUsageEntries = () => {
    const state = getCatalogState()
    if (!toolUsageService || typeof toolUsageService.getToolUsage !== 'function') return []

    return state.list
      .map(({ tool, originalIndex }) => normalizeUsageEntry(
        tool,
        originalIndex,
        toolUsageService.getToolUsage(tool.id),
      ))
      .filter((entry) => entry.useCount > 0)
  }

  const getFrequentTools = (options) => {
    const entries = getUsageEntries()
      .slice()
      .sort((left, right) => (
        (right.useCount - left.useCount)
        || (right.lastUsedAt - left.lastUsedAt)
        || (left.originalIndex - right.originalIndex)
      ))

    return applyLimit(entries.map((entry) => entry.tool), options)
  }

  const getRecentDiscoveryTools = (options) => {
    if (!toolUsageService || typeof toolUsageService.getRecentTools !== 'function') return []

    const state = getCatalogState()
    const rows = toolUsageService.getRecentTools(0)
    const source = Array.isArray(rows) ? rows : []
    const seen = new Set()
    const result = []

    source.forEach((item) => {
      const id = normalizeId(item && item.toolId)
      if (!id || seen.has(id)) return
      const entry = state.map.get(id)
      if (!entry) return

      seen.add(id)
      result.push(entry.tool)
    })

    return applyLimit(result, options)
  }

  const getFavoriteDiscoveryTools = (options) => {
    if (!favoritesService || typeof favoritesService.getFavorites !== 'function') return []

    const state = getCatalogState()
    const rows = favoritesService.getFavorites()
    const source = Array.isArray(rows) ? rows : []
    const seen = new Set()
    const result = []

    source.forEach((item) => {
      if (!item || item.entityType !== 'tool' || item.deletedAt != null) return
      const id = normalizeId(item.entityId)
      if (!id || seen.has(id)) return
      const entry = state.map.get(id)
      if (!entry) return

      seen.add(id)
      result.push(entry.tool)
    })

    return applyLimit(result, options)
  }

  const getFeaturedTools = (options) => {
    const tools = getCatalogState().list
      .filter(({ tool }) => tool.isHot === true)
      .map(({ tool }) => tool)

    return applyLimit(tools, options)
  }

  const getDominantCategory = (usageEntries) => {
    const categories = new Map()

    usageEntries.forEach((entry) => {
      const category = String(entry.tool.category || '').trim()
      if (!category) return

      const current = categories.get(category) || {
        category,
        useCount: 0,
        lastUsedAt: 0,
        firstIndex: entry.originalIndex,
      }

      current.useCount += entry.useCount
      current.lastUsedAt = Math.max(current.lastUsedAt, entry.lastUsedAt)
      current.firstIndex = Math.min(current.firstIndex, entry.originalIndex)
      categories.set(category, current)
    })

    const ranked = Array.from(categories.values()).sort((left, right) => (
      (right.useCount - left.useCount)
      || (right.lastUsedAt - left.lastUsedAt)
      || (left.firstIndex - right.firstIndex)
    ))

    return ranked.length ? ranked[0].category : ''
  }

  const getRecommendedTools = (options) => {
    const state = getCatalogState()
    const usageEntries = getUsageEntries()
    const usageMap = new Map(usageEntries.map((entry) => [entry.tool.id, entry]))
    const favoriteTools = getFavoriteDiscoveryTools()
    const recentTools = getRecentDiscoveryTools()
    const featuredTools = getFeaturedTools()

    const favoriteRank = new Map(favoriteTools.map((tool, index) => [tool.id, index]))
    const recentRank = new Map(recentTools.map((tool, index) => [tool.id, index]))
    const featuredIds = new Set(featuredTools.map((tool) => tool.id))
    const hasBehaviorData = usageEntries.length > 0 || favoriteTools.length > 0 || recentTools.length > 0

    if (!hasBehaviorData) return applyLimit(featuredTools, options)

    const dominantCategory = getDominantCategory(usageEntries)
    const ranked = state.list
      .map(({ tool, originalIndex }) => {
        const usage = usageMap.get(tool.id)
        const useCount = usage ? usage.useCount : 0
        const lastUsedAt = usage ? usage.lastUsedAt : 0
        const isDominantCategory = Boolean(dominantCategory && tool.category === dominantCategory)
        const favoriteIndex = favoriteRank.has(tool.id) ? favoriteRank.get(tool.id) : -1
        const recentIndex = recentRank.has(tool.id) ? recentRank.get(tool.id) : -1
        const isFavorite = favoriteIndex >= 0
        const isRecent = recentIndex >= 0
        const isFeatured = featuredIds.has(tool.id)

        let score = 0
        if (useCount > 0) score += 400 + Math.min(useCount, 100)
        if (isDominantCategory) score += 200
        if (isFavorite) score += 150
        if (isRecent) score += 100
        if (isFeatured) score += 50

        return {
          tool,
          originalIndex,
          score,
          useCount,
          lastUsedAt,
          favoriteIndex,
          recentIndex,
        }
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => (
        (right.score - left.score)
        || (right.useCount - left.useCount)
        || (right.lastUsedAt - left.lastUsedAt)
        || ((left.favoriteIndex < 0 ? Number.MAX_SAFE_INTEGER : left.favoriteIndex)
          - (right.favoriteIndex < 0 ? Number.MAX_SAFE_INTEGER : right.favoriteIndex))
        || ((left.recentIndex < 0 ? Number.MAX_SAFE_INTEGER : left.recentIndex)
          - (right.recentIndex < 0 ? Number.MAX_SAFE_INTEGER : right.recentIndex))
        || (left.originalIndex - right.originalIndex)
      ))

    return applyLimit(ranked.map((entry) => entry.tool), options)
  }

  return {
    getFavoriteDiscoveryTools,
    getFeaturedTools,
    getFrequentTools,
    getRecentDiscoveryTools,
    getRecommendedTools,
  }
}

const defaultDiscovery = createDiscoveryService({
  catalog: toolCatalog.tools,
  favoritesService: favorites,
  toolUsageService: toolUsage,
})

module.exports = {
  PROHIBITED_TOOL_IDS,
  createDiscoveryService,
  isFormalTool,
  ...defaultDiscovery,
}
