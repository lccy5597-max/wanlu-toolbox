const MATCH_SCORE = Object.freeze({
  NAME_EXACT: 600,
  NAME_PREFIX: 500,
  NAME_CONTAINS: 400,
  KEYWORD: 300,
  DESCRIPTION: 200,
  CATEGORY: 100,
})

const PROHIBITED_TOOL_IDS = new Set(['wooden-fish', 'zodiac'])

const CATEGORY_ALIASES = Object.freeze({
  image: Object.freeze(['image', '图片']),
  calc: Object.freeze(['calc', '计算']),
  other: Object.freeze(['other', '其他']),
})

const normalizeSearchText = (value) => String(value == null ? '' : value)
  .trim()
  .replace(/\s+/g, ' ')
  .toLowerCase()

const normalizeList = (value) => {
  const source = Array.isArray(value) ? value : (value == null ? [] : [value])
  return source.map(normalizeSearchText).filter(Boolean)
}

const getNameScore = (tool, query) => {
  const names = normalizeList([tool && tool.name, tool && tool.title])
  let score = 0

  names.forEach((name) => {
    if (name === query) score = Math.max(score, MATCH_SCORE.NAME_EXACT)
    else if (name.startsWith(query)) score = Math.max(score, MATCH_SCORE.NAME_PREFIX)
    else if (name.includes(query)) score = Math.max(score, MATCH_SCORE.NAME_CONTAINS)
  })

  return score
}

const matchesCategory = (categoryValue, query) => {
  const category = normalizeSearchText(categoryValue)
  if (!category) return false
  if (category === query) return true

  const aliases = CATEGORY_ALIASES[category]
  return Array.isArray(aliases) && aliases.some((alias) => normalizeSearchText(alias) === query)
}

const isSearchableTool = (tool) => {
  if (!tool || typeof tool !== 'object') return false
  if (tool.enabled === false || tool.disabled === true) return false

  const id = normalizeSearchText(tool.id)
  const name = normalizeSearchText(tool.name || tool.title)
  const toolPath = normalizeSearchText(tool.path)

  if (!id || !name || !toolPath) return false
  if (!toolPath.startsWith('/packagetools/pages/')) return false
  if (PROHIBITED_TOOL_IDS.has(id)) return false

  for (const prohibitedId of PROHIBITED_TOOL_IDS) {
    if (toolPath.includes(`/${prohibitedId}/`) || toolPath.endsWith(`/${prohibitedId}`)) return false
  }

  return true
}

const scoreToolMatch = (tool, queryValue) => {
  if (!isSearchableTool(tool)) return 0

  const query = normalizeSearchText(queryValue)
  if (!query) return 0

  const nameScore = getNameScore(tool, query)
  if (nameScore) return nameScore

  const keywords = normalizeList(tool.keywords)
  if (keywords.some((keyword) => keyword.includes(query))) return MATCH_SCORE.KEYWORD

  const descriptions = normalizeList([tool.description, tool.desc])
  if (descriptions.some((description) => description.includes(query))) return MATCH_SCORE.DESCRIPTION

  if (matchesCategory(tool.category, query)) return MATCH_SCORE.CATEGORY

  return 0
}

const searchTools = (tools, queryValue) => {
  if (!Array.isArray(tools)) return []

  const query = normalizeSearchText(queryValue)
  const candidatesById = new Map()

  tools.forEach((tool, originalIndex) => {
    if (!isSearchableTool(tool)) return

    const score = query ? scoreToolMatch(tool, query) : 0
    if (query && score <= 0) return

    const id = normalizeSearchText(tool.id)
    const current = candidatesById.get(id)
    const candidate = { tool, score, originalIndex }

    if (!current || score > current.score) {
      candidatesById.set(id, candidate)
    }
  })

  const candidates = Array.from(candidatesById.values())

  if (query) {
    candidates.sort((left, right) => (
      (right.score - left.score)
      || (left.originalIndex - right.originalIndex)
    ))
  } else {
    candidates.sort((left, right) => left.originalIndex - right.originalIndex)
  }

  return candidates.map((item) => item.tool)
}

module.exports = {
  CATEGORY_ALIASES,
  MATCH_SCORE,
  PROHIBITED_TOOL_IDS,
  isSearchableTool,
  normalizeSearchText,
  scoreToolMatch,
  searchTools,
}
