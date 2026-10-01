const {
  API_VERSION,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  GITHUB_DEFAULT_PAGE_SIZE,
  GITHUB_MAX_PAGE_SIZE,
  GITHUB_PERIODS,
  MAX_PAGE_SIZE,
} = require('../config/api-endpoints')

const RICH_CONTENT_FORMAT = 'sanitized_html'

const ERROR_CODE_RANGES = Object.freeze({
  COMMON: Object.freeze({ min: 10000, max: 19999 }),
  CONTENT: Object.freeze({ min: 20000, max: 29999 }),
  GITHUB: Object.freeze({ min: 30000, max: 39999 }),
  AI_RESERVED: Object.freeze({ min: 40000, max: 49999 }),
})

const BUSINESS_ERROR_CODES = Object.freeze({
  INVALID_REQUEST: 10001,
  RESOURCE_NOT_FOUND: 10004,
  RATE_LIMITED: 10029,
  SERVICE_UNAVAILABLE: 10053,
  UPSTREAM_ERROR: 10054,
  CONTENT_NOT_FOUND: 20004,
  GITHUB_UPSTREAM_ERROR: 30054,
})

const ISO_8601_WITH_TIMEZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/
const UNSAFE_RICH_CONTENT_PATTERN = /<(?:script|iframe|object|embed|form)\b|\son[a-z]+\s*=|javascript\s*:/i

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const result = (errors) => Object.freeze({ ok: errors.length === 0, errors: errors.slice() })

const isIso8601WithTimezone = (value) => typeof value === 'string'
  && ISO_8601_WITH_TIMEZONE.test(value)
  && Number.isFinite(Date.parse(value))

const isHttpsUrlOrEmpty = (value) => typeof value === 'string' && (value === '' || /^https:\/\//i.test(value))

const containsUnsafeRichContent = (value) => typeof value !== 'string' || UNSAFE_RICH_CONTENT_PATTERN.test(value)

const normalizePageRequest = (source = {}, options = {}) => {
  const defaultPageSize = Number.isInteger(options.defaultPageSize) ? options.defaultPageSize : DEFAULT_PAGE_SIZE
  const maxPageSize = Number.isInteger(options.maxPageSize) ? options.maxPageSize : MAX_PAGE_SIZE
  const page = source.page === undefined ? DEFAULT_PAGE : Number(source.page)
  const pageSize = source.pageSize === undefined ? defaultPageSize : Number(source.pageSize)

  if (!Number.isInteger(page) || page < 1) throw new Error('invalid_page')
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > maxPageSize) throw new Error('invalid_page_size')
  return { page, pageSize }
}

const validateApiResponse = (payload) => {
  const errors = []
  if (!isPlainObject(payload)) return result(['response_not_object'])
  if (!Number.isInteger(payload.code) || payload.code < 0) errors.push('invalid_code')
  if (typeof payload.message !== 'string' || !payload.message) errors.push('invalid_message')
  if (!Object.prototype.hasOwnProperty.call(payload, 'data')) errors.push('missing_data')
  if (payload.meta !== undefined && !isPlainObject(payload.meta)) errors.push('invalid_meta')
  if (payload.meta && payload.meta.requestId !== undefined && typeof payload.meta.requestId !== 'string') errors.push('invalid_request_id')
  if (payload.meta && payload.meta.retryAfter !== undefined && (!Number.isInteger(payload.meta.retryAfter) || payload.meta.retryAfter < 0)) errors.push('invalid_retry_after')
  return result(errors)
}

const validatePagination = (source, options = {}) => {
  const errors = []
  if (!isPlainObject(source)) return result(['pagination_not_object'])
  const maxPageSize = Number.isInteger(options.maxPageSize) ? options.maxPageSize : MAX_PAGE_SIZE
  if (!Number.isInteger(source.page) || source.page < 1) errors.push('invalid_page')
  if (!Number.isInteger(source.pageSize) || source.pageSize < 1 || source.pageSize > maxPageSize) errors.push('invalid_page_size')
  if (!Number.isInteger(source.total) || source.total < 0) errors.push('invalid_total')
  if (typeof source.hasMore !== 'boolean') errors.push('invalid_has_more')
  if (errors.length === 0) {
    const expected = source.page * source.pageSize < source.total
    if (source.hasMore !== expected) errors.push('inconsistent_has_more')
  }
  return result(errors)
}

const validateContentSummary = (article) => {
  const errors = []
  if (!isPlainObject(article)) return result(['content_summary_not_object'])
  if (typeof article.id !== 'string' || !article.id.trim()) errors.push('invalid_id')
  if (typeof article.title !== 'string' || !article.title.trim()) errors.push('invalid_title')
  if (typeof article.excerpt !== 'string') errors.push('invalid_excerpt')
  if (!isHttpsUrlOrEmpty(article.cover)) errors.push('invalid_cover')
  if (!isIso8601WithTimezone(article.publishTime)) errors.push('invalid_publish_time')
  if (typeof article.category !== 'string' || !article.category.trim()) errors.push('invalid_category')
  if (article.author !== undefined && typeof article.author !== 'string') errors.push('invalid_author')
  return result(errors)
}

const validateContentDetail = (article) => {
  const errors = []
  if (!isPlainObject(article)) return result(['content_detail_not_object'])
  if (typeof article.id !== 'string' || !article.id.trim()) errors.push('invalid_id')
  if (typeof article.title !== 'string' || !article.title.trim()) errors.push('invalid_title')
  if (typeof article.content !== 'string' || containsUnsafeRichContent(article.content)) errors.push('unsafe_content')
  if (!isIso8601WithTimezone(article.publishTime)) errors.push('invalid_publish_time')
  if (typeof article.category !== 'string' || !article.category.trim()) errors.push('invalid_category')
  if (article.cover !== undefined && !isHttpsUrlOrEmpty(article.cover)) errors.push('invalid_cover')
  if (article.author !== undefined && typeof article.author !== 'string') errors.push('invalid_author')
  return result(errors)
}

const validateGithubPeriod = (period) => typeof period === 'string' && GITHUB_PERIODS.includes(period)

const validateGithubRankingItem = (item) => {
  const errors = []
  if (!isPlainObject(item)) return result(['github_item_not_object'])
  ;['id', 'name', 'fullName', 'author'].forEach((field) => {
    if (typeof item[field] !== 'string' || !item[field].trim()) errors.push(`invalid_${field}`)
  })
  if (typeof item.description !== 'string') errors.push('invalid_description')
  if (!Number.isSafeInteger(item.stars) || item.stars < 0) errors.push('invalid_stars')
  if (typeof item.language !== 'string') errors.push('invalid_language')
  if (typeof item.url !== 'string' || !/^https:\/\//i.test(item.url)) errors.push('invalid_url')
  if (!isIso8601WithTimezone(item.updatedAt)) errors.push('invalid_updated_at')
  return result(errors)
}

const validateGithubRankingResponse = (data, pagination, options = {}) => {
  const errors = []
  if (!isPlainObject(data)) return result(['github_ranking_not_object'])
  if (!validateGithubPeriod(data.period)) errors.push('invalid_period')
  if (options.period !== undefined && data.period !== options.period) errors.push('period_mismatch')
  if (!Array.isArray(data.items)) {
    errors.push('invalid_items')
  } else {
    data.items.forEach((item, index) => {
      const validation = validateGithubRankingItem(item)
      validation.errors.forEach((error) => errors.push(`item_${index}_${error}`))
    })
  }
  const paginationValidation = validatePagination(pagination, { maxPageSize: GITHUB_MAX_PAGE_SIZE })
  paginationValidation.errors.forEach((error) => errors.push(`pagination_${error}`))
  return result(errors)
}

const validateHealthData = (data) => {
  const errors = []
  if (!isPlainObject(data)) return result(['health_not_object'])
  if (data.status !== 'ok') errors.push('invalid_status')
  if (data.apiVersion !== API_VERSION) errors.push('invalid_api_version')
  if (!isIso8601WithTimezone(data.serverTime)) errors.push('invalid_server_time')
  return result(errors)
}

const validateGithubPageRequest = (source = {}) => {
  if (!isPlainObject(source)) throw new Error('invalid_github_pagination')
  if (source.page !== undefined && (!Number.isSafeInteger(source.page) || source.page < 1)) throw new Error('invalid_page')
  if (source.pageSize !== undefined && (!Number.isSafeInteger(source.pageSize) || source.pageSize < 1 || source.pageSize > GITHUB_MAX_PAGE_SIZE)) {
    throw new Error('invalid_page_size')
  }
  return normalizePageRequest(source, {
    defaultPageSize: GITHUB_DEFAULT_PAGE_SIZE,
    maxPageSize: GITHUB_MAX_PAGE_SIZE,
  })
}

module.exports = {
  BUSINESS_ERROR_CODES,
  ERROR_CODE_RANGES,
  RICH_CONTENT_FORMAT,
  containsUnsafeRichContent,
  isHttpsUrlOrEmpty,
  isIso8601WithTimezone,
  normalizePageRequest,
  validateApiResponse,
  validateContentDetail,
  validateContentSummary,
  validateGithubPageRequest,
  validateGithubPeriod,
  validateGithubRankingItem,
  validateGithubRankingResponse,
  validateHealthData,
  validatePagination,
}
