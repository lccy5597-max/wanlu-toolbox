import type { ContentDetail, ContentProvider, ContentSummary } from '../providers/contracts'
import type { ContentListRequest } from '../schemas/requests'
import { contentNotFound, serviceUnavailable, upstreamError } from '../errors/app-error'
import { ProviderError } from '../providers/provider-error'

export interface PaginationResult {
  readonly page: number
  readonly pageSize: number
  readonly total: number
  readonly hasMore: boolean
}

export interface ContentListResult {
  readonly items: readonly ContentSummary[]
  readonly pagination: PaginationResult
}

const mapProviderError = (error: unknown): Error => {
  if (!(error instanceof ProviderError)) return error instanceof Error ? error : upstreamError()
  if (error.kind === 'timeout' || error.kind === 'unavailable') return serviceUnavailable()
  if (error.kind === 'http_error' && (error.statusCode === 429 || (error.statusCode !== null && error.statusCode >= 500))) {
    return serviceUnavailable()
  }
  return upstreamError()
}

export class ContentService {
  constructor(private readonly provider: ContentProvider | null = null) {}

  async listArticles(request: ContentListRequest): Promise<ContentListResult> {
    if (this.provider === null) throw serviceUnavailable()
    let providerResult
    try {
      providerResult = await this.provider.listArticles(request)
    } catch (error) {
      throw mapProviderError(error)
    }
    return {
      items: [...providerResult.items],
      pagination: {
        page: request.page,
        pageSize: request.pageSize,
        total: providerResult.total,
        hasMore: request.page * request.pageSize < providerResult.total,
      },
    }
  }

  async getArticleDetail(id: string): Promise<ContentDetail> {
    if (this.provider === null) throw serviceUnavailable()
    let article
    try {
      article = await this.provider.getArticleDetail(id)
    } catch (error) {
      throw mapProviderError(error)
    }
    if (article === null) throw contentNotFound()
    return article
  }
}
