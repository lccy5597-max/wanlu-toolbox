const DISCOVERY_MODE = Object.freeze({
  EMPTY: 'empty',
  LIGHT: 'light',
  RICH: 'rich',
})

const MAX_TOOLS_PER_SECTION = 4
const TOOL_PAGE_ROOT = '/packageTools/pages/'
const PROHIBITED_TOOL_IDS = new Set(['wooden-fish', 'zodiac'])

const DISCOVERY_CATEGORIES = Object.freeze([
  Object.freeze({ id: 'image', name: '图片工具', description: '图片与视频处理' }),
  Object.freeze({ id: 'calc', name: '计算工具', description: '日常计算与换算' }),
  Object.freeze({ id: 'other', name: '其他工具', description: '实用辅助工具' }),
])

const normalizeId = (value) => String(value == null ? '' : value).trim()

const isDisplayableTool = (tool) => {
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

const uniqueTools = (value) => {
  const source = Array.isArray(value) ? value : []
  const seen = new Set()
  const result = []

  source.forEach((tool) => {
    if (!isDisplayableTool(tool)) return
    const id = normalizeId(tool.id)
    if (seen.has(id)) return
    seen.add(id)
    result.push(tool)
  })

  return result
}

const takeTools = (tools, excludedIds = new Set()) => {
  const result = []

  for (const tool of uniqueTools(tools)) {
    if (excludedIds.has(tool.id)) continue
    result.push(tool)
    if (result.length >= MAX_TOOLS_PER_SECTION) break
  }

  return result
}

const countBehaviorTools = ({ frequent = [], recent = [], favorites = [] } = {}) => {
  const ids = new Set()

  ;[frequent, recent, favorites].forEach((list) => {
    uniqueTools(list).forEach((tool) => ids.add(tool.id))
  })

  return ids.size
}

const makeSection = (key, title, subtitle, tools) => ({ key, title, subtitle, tools })

const buildDiscoveryViewModel = (input = {}) => {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const {
    frequent = [],
    recent = [],
    favorites = [],
    featured = [],
    recommended = [],
  } = source
  const safeFrequent = uniqueTools(frequent)
  const safeRecent = uniqueTools(recent)
  const safeFavorites = uniqueTools(favorites)
  const safeFeatured = uniqueTools(featured)
  const safeRecommended = uniqueTools(recommended)
  const behaviorCount = countBehaviorTools({
    frequent: safeFrequent,
    recent: safeRecent,
    favorites: safeFavorites,
  })
  const mode = behaviorCount === 0
    ? DISCOVERY_MODE.EMPTY
    : (behaviorCount <= 2 ? DISCOVERY_MODE.LIGHT : DISCOVERY_MODE.RICH)
  const toolSections = []

  if (mode === DISCOVERY_MODE.EMPTY) {
    const featuredTools = takeTools(safeFeatured)
    if (featuredTools.length) {
      toolSections.push(makeSection('featured', '精选工具', '精选实用工具', featuredTools))
    }
  }

  if (mode === DISCOVERY_MODE.LIGHT) {
    let primaryKey = ''
    let primaryTitle = ''
    let primarySubtitle = ''
    let primarySource = []

    if (safeRecent.length) {
      primaryKey = 'recent'
      primaryTitle = '最近使用'
      primarySubtitle = '刚刚用过的工具'
      primarySource = safeRecent
    } else if (safeFavorites.length) {
      primaryKey = 'favorites'
      primaryTitle = '我的收藏'
      primarySubtitle = '你的本地收藏'
      primarySource = safeFavorites
    } else if (safeFrequent.length) {
      primaryKey = 'frequent'
      primaryTitle = '常用工具'
      primarySubtitle = '最近常用的工具'
      primarySource = safeFrequent
    }

    const primaryTools = takeTools(primarySource)
    const usedIds = new Set(primaryTools.map((tool) => tool.id))
    const featuredTools = takeTools(safeFeatured, usedIds)

    if (primaryTools.length) toolSections.push(makeSection(primaryKey, primaryTitle, primarySubtitle, primaryTools))
    if (featuredTools.length) toolSections.push(makeSection('featured', '精选工具', '精选实用工具', featuredTools))
  }

  if (mode === DISCOVERY_MODE.RICH) {
    const frequentTools = takeTools(safeFrequent)
    const frequentIds = new Set(frequentTools.map((tool) => tool.id))
    const allFavoriteIds = new Set(safeFavorites.map((tool) => tool.id))
    const favoriteTools = takeTools(safeFavorites, frequentIds)
    const recommendationExcludedIds = new Set([...frequentIds, ...allFavoriteIds])
    const recommendedTools = takeTools(safeRecommended, recommendationExcludedIds)

    if (frequentTools.length) toolSections.push(makeSection('frequent', '常用工具', '按本机使用情况排序', frequentTools))
    if (recommendedTools.length) toolSections.push(makeSection('recommended', '为你推荐', '根据本机使用情况推荐', recommendedTools))
    if (favoriteTools.length) toolSections.push(makeSection('favorites', '我的收藏', '你的本地收藏', favoriteTools))
  }

  return {
    mode,
    behaviorCount,
    toolSections,
    categories: DISCOVERY_CATEGORIES.map((item) => ({ ...item })),
  }
}

module.exports = {
  DISCOVERY_CATEGORIES,
  DISCOVERY_MODE,
  MAX_TOOLS_PER_SECTION,
  buildDiscoveryViewModel,
  countBehaviorTools,
  isDisplayableTool,
  uniqueTools,
}
