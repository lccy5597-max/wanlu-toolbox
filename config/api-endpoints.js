const API_VERSION = 'v1'
const API_PREFIX = `/api/${API_VERSION}`

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 20
const GITHUB_DEFAULT_PAGE_SIZE = 5
const GITHUB_MAX_PAGE_SIZE = 10
const GITHUB_PERIODS = Object.freeze(['daily', 'weekly', 'all'])

const buildArticleDetailPath = (id) => {
  const value = String(id === undefined || id === null ? '' : id).trim()
  if (!value) throw new Error('article_id_required')
  return `${API_PREFIX}/content/articles/${encodeURIComponent(value)}`
}

const API_ENDPOINTS = Object.freeze({
  health: `${API_PREFIX}/health`,
  content: Object.freeze({
    articles: `${API_PREFIX}/content/articles`,
    articleDetail: buildArticleDetailPath,
  }),
  github: Object.freeze({
    rankings: `${API_PREFIX}/github/rankings`,
  }),
})

const isRelativeApiPath = (value) => {
  const path = String(value || '')
  return path.startsWith(`${API_PREFIX}/`) && !/^https?:\/\//i.test(path)
}

module.exports = {
  API_ENDPOINTS,
  API_PREFIX,
  API_VERSION,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  GITHUB_DEFAULT_PAGE_SIZE,
  GITHUB_MAX_PAGE_SIZE,
  GITHUB_PERIODS,
  MAX_PAGE_SIZE,
  buildArticleDetailPath,
  isRelativeApiPath,
}
