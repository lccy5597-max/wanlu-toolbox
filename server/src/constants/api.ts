export const API_VERSION = 'v1' as const
export const API_PREFIX = `/api/${API_VERSION}` as const

export const BUSINESS_ERROR_CODES = Object.freeze({
  INVALID_REQUEST: 10001,
  RESOURCE_NOT_FOUND: 10004,
  RATE_LIMITED: 10029,
  SERVICE_UNAVAILABLE: 10053,
  UPSTREAM_ERROR: 10054,
  CONTENT_NOT_FOUND: 20004,
  GITHUB_UPSTREAM_ERROR: 30054,
})

export const CONTENT_PAGINATION = Object.freeze({
  defaultPage: 1,
  defaultPageSize: 10,
  maxPageSize: 20,
})

export const GITHUB_PAGINATION = Object.freeze({
  defaultPage: 1,
  defaultPageSize: 5,
  maxPageSize: 10,
})

export const GITHUB_PERIODS = Object.freeze(['daily', 'weekly', 'all'] as const)
export type GithubPeriod = (typeof GITHUB_PERIODS)[number]
