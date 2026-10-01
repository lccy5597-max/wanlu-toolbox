const {
  API_ENDPOINTS,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} = require('../config/api-endpoints')
const {
  API_ERROR_TYPES,
  createErrorResult,
} = require('../utils/api-contract')
const { apiClient: defaultApiClient } = require('../utils/api-client')
const { contentCache: defaultContentCache } = require('./content-cache')
const {
  normalizePageRequest,
  validateContentDetail,
  validateContentSummary,
  validatePagination,
} = require('../utils/api-schema')

const createContractError = (code, operation, validationErrors = []) => createErrorResult({
  code,
  message: String(code || 'CONTENT_CONTRACT_ERROR').toLowerCase(),
  meta: {
    operation,
    validationErrors: Array.isArray(validationErrors) ? validationErrors.slice() : [],
  },
  error: {
    type: API_ERROR_TYPES.CONTRACT,
    retryable: false,
  },
})

const normalizeCategory = (value) => {
  if (value === undefined || value === null) return { ok: true, value: undefined }
  if (typeof value !== 'string') return { ok: false }
  const normalized = value.trim()
  return { ok: true, value: normalized || undefined }
}

const normalizeSummary = (source) => {
  const article = {
    id: source.id,
    title: source.title,
    excerpt: source.excerpt,
    cover: source.cover,
    publishTime: source.publishTime,
    category: source.category,
  }
  if (source.author !== undefined) article.author = source.author
  return article
}

const normalizeDetail = (source) => {
  const article = {
    id: source.id,
    title: source.title,
    content: source.content,
    publishTime: source.publishTime,
    category: source.category,
  }
  if (source.author !== undefined) article.author = source.author
  if (source.cover !== undefined) article.cover = source.cover
  return article
}

const canFallbackToCache = (result) => {
  const error = result && result.error && typeof result.error === 'object' ? result.error : {}
  if (error.type === API_ERROR_TYPES.TRANSPORT) return true
  return error.type === API_ERROR_TYPES.HTTP && error.retryable === true
}

const addLocalSourceMetadata = (data, source, cachedAt = null) => ({
  ...data,
  source,
  isFallback: source === 'cache',
  cachedAt: Number.isFinite(cachedAt) ? cachedAt : null,
})

const createCacheSuccess = (data, cachedAt) => ({
  ok: true,
  code: 0,
  message: 'ok',
  data: addLocalSourceMetadata(data, 'cache', cachedAt),
  meta: {},
})

const createContentService = ({ apiClient = defaultApiClient, cache = defaultContentCache } = {}) => {
  if (!apiClient || typeof apiClient.get !== 'function') {
    throw new TypeError('content_api_client_get_required')
  }
  if (!cache
    || typeof cache.readList !== 'function'
    || typeof cache.writeList !== 'function'
    || typeof cache.readDetail !== 'function'
    || typeof cache.writeDetail !== 'function') {
    throw new TypeError('content_cache_required')
  }

  const getArticles = async (options = {}) => {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      return createContractError('INVALID_CONTENT_LIST_REQUEST', 'getArticles', ['options_not_object'])
    }

    let paginationRequest
    try {
      paginationRequest = normalizePageRequest(options, {
        defaultPageSize: DEFAULT_PAGE_SIZE,
        maxPageSize: MAX_PAGE_SIZE,
      })
    } catch (error) {
      return createContractError('INVALID_CONTENT_LIST_REQUEST', 'getArticles', [error.message])
    }

    const category = normalizeCategory(options.category)
    if (!category.ok) {
      return createContractError('INVALID_CONTENT_LIST_REQUEST', 'getArticles', ['invalid_category'])
    }

    const query = {
      page: paginationRequest.page,
      pageSize: paginationRequest.pageSize,
    }
    if (category.value !== undefined) query.category = category.value

    const apiResult = await apiClient.get(API_ENDPOINTS.content.articles, { query })
    if (!apiResult || apiResult.ok !== true) {
      if (!canFallbackToCache(apiResult)) return apiResult
      let cached
      try {
        cached = cache.readList(query)
      } catch (error) {
        cached = null
      }
      if (!cached || cached.ok !== true || !cached.hit) return apiResult
      return createCacheSuccess(cached.data, cached.cachedAt)
    }

    if (!apiResult.data || typeof apiResult.data !== 'object' || Array.isArray(apiResult.data) || !Array.isArray(apiResult.data.items)) {
      return createContractError('INVALID_CONTENT_LIST_RESPONSE', 'getArticles', ['invalid_items'])
    }

    const pagination = apiResult.meta && apiResult.meta.pagination
    const paginationValidation = validatePagination(pagination, { maxPageSize: MAX_PAGE_SIZE })
    if (!paginationValidation.ok) {
      return createContractError('INVALID_CONTENT_LIST_RESPONSE', 'getArticles', paginationValidation.errors)
    }

    const items = []
    for (const source of apiResult.data.items) {
      const validation = validateContentSummary(source)
      if (!validation.ok) {
        return createContractError('INVALID_CONTENT_LIST_RESPONSE', 'getArticles', validation.errors)
      }
      items.push(normalizeSummary(source))
    }

    const data = {
      items,
      pagination: { ...pagination },
    }
    try {
      cache.writeList(query, data)
    } catch (error) {
      // Cache is best-effort; a storage failure must not downgrade network success.
    }

    return {
      ok: true,
      code: apiResult.code,
      message: apiResult.message,
      data: addLocalSourceMetadata(data, 'network'),
      meta: apiResult.meta && typeof apiResult.meta === 'object' ? { ...apiResult.meta } : {},
    }
  }

  const getArticleDetail = async (id) => {
    if (typeof id !== 'string' || !id.trim()) {
      return createContractError('INVALID_ARTICLE_ID', 'getArticleDetail', ['article_id_required'])
    }

    const normalizedId = id.trim()
    const path = API_ENDPOINTS.content.articleDetail(normalizedId)
    const apiResult = await apiClient.get(path)
    if (!apiResult || apiResult.ok !== true) {
      if (!canFallbackToCache(apiResult)) return apiResult
      let cached
      try {
        cached = cache.readDetail(normalizedId)
      } catch (error) {
        cached = null
      }
      if (!cached || cached.ok !== true || !cached.hit) return apiResult
      return createCacheSuccess(cached.data, cached.cachedAt)
    }

    const validation = validateContentDetail(apiResult.data)
    if (!validation.ok) {
      return createContractError('INVALID_CONTENT_DETAIL_RESPONSE', 'getArticleDetail', validation.errors)
    }

    const data = normalizeDetail(apiResult.data)
    try {
      cache.writeDetail(normalizedId, data)
    } catch (error) {
      // Cache is best-effort; a storage failure must not downgrade network success.
    }

    return {
      ok: true,
      code: apiResult.code,
      message: apiResult.message,
      data: addLocalSourceMetadata(data, 'network'),
      meta: apiResult.meta && typeof apiResult.meta === 'object' ? { ...apiResult.meta } : {},
    }
  }

  return Object.freeze({
    getArticles,
    getArticleDetail,
  })
}

const contentService = createContentService()

module.exports = {
  contentService,
  createContentService,
  getArticles: (options) => contentService.getArticles(options),
  getArticleDetail: (id) => contentService.getArticleDetail(id),
}
