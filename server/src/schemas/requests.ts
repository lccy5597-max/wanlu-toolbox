import {
  CONTENT_PAGINATION,
  GITHUB_PAGINATION,
  GITHUB_PERIODS,
  type GithubPeriod,
} from '../constants/api'
import { invalidRequest } from '../errors/app-error'

export interface ContentListRequest {
  readonly page: number
  readonly pageSize: number
  readonly category?: string
}

export interface GithubRankingRequest {
  readonly period: GithubPeriod
  readonly page: number
  readonly pageSize: number
}

const parseIntegerQuery = (
  value: unknown,
  defaultValue: number,
  maxValue: number,
): number => {
  if (value === undefined) return defaultValue
  if (typeof value !== 'string' || value.trim() === '') throw invalidRequest()
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maxValue) throw invalidRequest()
  return parsed
}

export const parseContentListRequest = (query: Record<string, unknown>): ContentListRequest => {
  const page = parseIntegerQuery(query.page, CONTENT_PAGINATION.defaultPage, Number.MAX_SAFE_INTEGER)
  const pageSize = parseIntegerQuery(query.pageSize, CONTENT_PAGINATION.defaultPageSize, CONTENT_PAGINATION.maxPageSize)

  if (query.category === undefined) return { page, pageSize }
  if (typeof query.category !== 'string') throw invalidRequest()
  const category = query.category.trim()
  return category ? { page, pageSize, category } : { page, pageSize }
}

export const parseGithubRankingRequest = (query: Record<string, unknown>): GithubRankingRequest => {
  if (typeof query.period !== 'string' || !GITHUB_PERIODS.includes(query.period as GithubPeriod)) {
    throw invalidRequest()
  }

  return {
    period: query.period as GithubPeriod,
    page: parseIntegerQuery(query.page, GITHUB_PAGINATION.defaultPage, Number.MAX_SAFE_INTEGER),
    pageSize: parseIntegerQuery(query.pageSize, GITHUB_PAGINATION.defaultPageSize, GITHUB_PAGINATION.maxPageSize),
  }
}

export const normalizeArticleId = (value: unknown): string => {
  if (typeof value !== 'string') throw invalidRequest()
  const id = value.trim()
  if (!id) throw invalidRequest()
  return id
}
