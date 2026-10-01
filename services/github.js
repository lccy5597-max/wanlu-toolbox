const {
  API_ENDPOINTS,
  GITHUB_DEFAULT_PAGE_SIZE,
  GITHUB_MAX_PAGE_SIZE,
} = require('../config/api-endpoints')
const {
  API_ERROR_TYPES,
  createErrorResult,
} = require('../utils/api-contract')
const { apiClient: defaultApiClient } = require('../utils/api-client')
const {
  validateGithubPageRequest,
  validateGithubPeriod,
  validateGithubRankingResponse,
} = require('../utils/api-schema')

const createContractError = (code, validationErrors = []) => createErrorResult({
  code,
  message: String(code || 'GITHUB_CONTRACT_ERROR').toLowerCase(),
  meta: {
    operation: 'getRankings',
    validationErrors: Array.isArray(validationErrors) ? validationErrors.slice() : [],
  },
  error: {
    type: API_ERROR_TYPES.CONTRACT,
    retryable: false,
  },
})

const normalizeRepository = (source) => ({
  id: source.id,
  name: source.name,
  fullName: source.fullName,
  description: source.description,
  author: source.author,
  stars: source.stars,
  language: source.language,
  url: source.url,
  updatedAt: source.updatedAt,
})

const createGithubService = ({ apiClient = defaultApiClient } = {}) => {
  if (!apiClient || typeof apiClient.get !== 'function') {
    throw new TypeError('github_api_client_get_required')
  }

  const getRankings = async (period, options = {}) => {
    if (!validateGithubPeriod(period)) {
      return createContractError('INVALID_GITHUB_PERIOD', ['invalid_period'])
    }
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      return createContractError('INVALID_GITHUB_RANKING_REQUEST', ['options_not_object'])
    }

    let paginationRequest
    try {
      paginationRequest = validateGithubPageRequest(options)
    } catch (error) {
      return createContractError('INVALID_GITHUB_RANKING_REQUEST', [error.message])
    }

    const query = {
      period,
      page: paginationRequest.page,
      pageSize: paginationRequest.pageSize,
    }
    const apiResult = await apiClient.get(API_ENDPOINTS.github.rankings, { query })
    if (!apiResult || apiResult.ok !== true) return apiResult

    const pagination = apiResult.meta && apiResult.meta.pagination
    const validation = validateGithubRankingResponse(apiResult.data, pagination, { period })
    if (!validation.ok) {
      return createContractError('INVALID_GITHUB_RANKING_RESPONSE', validation.errors)
    }

    return {
      ok: true,
      code: apiResult.code,
      message: apiResult.message,
      data: {
        period: apiResult.data.period,
        items: apiResult.data.items.map((item) => normalizeRepository(item)),
        pagination: { ...pagination },
      },
      meta: apiResult.meta && typeof apiResult.meta === 'object' ? { ...apiResult.meta } : {},
    }
  }

  return Object.freeze({ getRankings })
}

const githubService = createGithubService()

module.exports = {
  GITHUB_DEFAULT_PAGE_SIZE,
  GITHUB_MAX_PAGE_SIZE,
  createGithubService,
  getRankings: (period, options) => githubService.getRankings(period, options),
  githubService,
}
