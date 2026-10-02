import type { ContentListRequest } from '../../schemas/requests'
import type { HtmlSanitizer } from '../../security/html-sanitizer'
import { HtmlSanitizationError, serverHtmlSanitizer } from '../../security/html-sanitizer'
import type { ContentDetail, ContentProvider, ContentSummary, ProviderListResult } from '../contracts'
import { ProviderError, providerInvalidPayload, providerUnavailable } from '../provider-error'
import type { WordPressContentAdapter } from './adapter'
import { createSanitizedContentDetail } from './detail-pipeline'
import { decodeWordPressArticleId } from './opaque-id'

export interface WordPressCategoryResolver {
  resolve(category: string): number | null
}

export class ProductionWordPressContentProvider implements ContentProvider {
  constructor(
    private readonly adapter: WordPressContentAdapter,
    private readonly sanitizer: HtmlSanitizer = serverHtmlSanitizer,
    private readonly categoryResolver: WordPressCategoryResolver | null = null,
  ) {}

  async listArticles(request: ContentListRequest): Promise<ProviderListResult<ContentSummary>> {
    let categoryId: number | undefined
    if (request.category !== undefined) {
      if (this.categoryResolver === null) throw providerUnavailable()
      const resolved = this.categoryResolver.resolve(request.category)
      if (!Number.isSafeInteger(resolved) || Number(resolved) < 1) throw providerInvalidPayload()
      categoryId = Number(resolved)
    }
    return this.adapter.listArticles({ page: request.page, pageSize: request.pageSize, categoryId })
  }

  async getArticleDetail(opaqueId: string): Promise<ContentDetail | null> {
    const { id } = decodeWordPressArticleId(opaqueId)
    try {
      const input = await this.adapter.getArticleDetail(id)
      return createSanitizedContentDetail(input, this.sanitizer)
    } catch (error) {
      if (error instanceof ProviderError && error.kind === 'http_error' && error.statusCode === 404) return null
      if (error instanceof HtmlSanitizationError) throw providerInvalidPayload()
      throw error
    }
  }
}
