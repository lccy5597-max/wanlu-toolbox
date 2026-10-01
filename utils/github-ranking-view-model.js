const GITHUB_PERIOD_TABS = Object.freeze([
  Object.freeze({ value: 'daily', label: '今日' }),
  Object.freeze({ value: 'weekly', label: '本周' }),
  Object.freeze({ value: 'all', label: '总榜' }),
])

const getGithubPeriodTabs = () => GITHUB_PERIOD_TABS.map((item) => ({ ...item }))

const isGithubPeriod = (period) => GITHUB_PERIOD_TABS.some((item) => item.value === period)

const formatCompactNumber = (value, divisor, suffix) => {
  const rounded = Math.round((value / divisor) * 10) / 10
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(/\.0$/, '')
  return `${text}${suffix}`
}

const formatGithubStars = (stars) => {
  if (!Number.isSafeInteger(stars) || stars < 0) return ''
  if (stars < 1000) return String(stars)
  if (stars < 1000000) return formatCompactNumber(stars, 1000, 'k')
  return formatCompactNumber(stars, 1000000, 'm')
}

const formatGithubUpdatedDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) return ''
  return value.slice(0, 10)
}

const normalizeOptionalText = (value) => (typeof value === 'string' ? value.trim() : '')

const createGithubRankingItemViewModel = (repo, index = 0) => {
  const source = repo && typeof repo === 'object' ? repo : {}
  const description = normalizeOptionalText(source.description)
  const language = normalizeOptionalText(source.language)

  return {
    id: source.id,
    name: source.name,
    fullName: source.fullName,
    author: source.author,
    rank: index + 1,
    stars: source.stars,
    displayStars: formatGithubStars(source.stars),
    description,
    hasDescription: Boolean(description),
    language,
    hasLanguage: Boolean(language),
    updatedAt: source.updatedAt,
    displayUpdatedAt: formatGithubUpdatedDate(source.updatedAt),
  }
}

const buildGithubRankingView = (items) => (Array.isArray(items)
  ? items.map((item, index) => createGithubRankingItemViewModel(item, index))
  : [])

const mapGithubRankingError = (result) => {
  const error = result && result.error && typeof result.error === 'object' ? result.error : {}
  const type = error.type || 'contract'

  if (type === 'client_disabled') {
    return {
      state: 'unavailable',
      title: 'GitHub 榜单服务暂未启用',
      description: '当前版本暂未开启远程榜单服务',
      retryable: false,
    }
  }

  if (type === 'business') {
    return {
      state: 'error',
      title: '榜单暂不可用',
      description: '服务暂不可用，请稍后再试',
      retryable: Boolean(error.retryable),
    }
  }

  if (type === 'transport') {
    return {
      state: 'error',
      title: 'GitHub 榜单加载失败',
      description: '网络连接异常，请稍后重试',
      retryable: Boolean(error.retryable),
    }
  }

  if (type === 'http') {
    return {
      state: 'error',
      title: 'GitHub 榜单加载失败',
      description: '服务暂不可用，请稍后重试',
      retryable: Boolean(error.retryable),
    }
  }

  return {
    state: 'error',
    title: 'GitHub 榜单加载失败',
    description: '榜单数据暂时无法显示',
    retryable: false,
  }
}

module.exports = {
  GITHUB_PERIOD_TABS,
  buildGithubRankingView,
  createGithubRankingItemViewModel,
  formatGithubStars,
  formatGithubUpdatedDate,
  getGithubPeriodTabs,
  isGithubPeriod,
  mapGithubRankingError,
}
