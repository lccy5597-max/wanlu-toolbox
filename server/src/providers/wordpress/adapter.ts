import type { ContentDetailSanitizerInput, ContentSummary, ProviderListResult } from '../contracts'
import type { HttpClient, HttpGetRequest } from '../http-client'
import { normalizeProviderError, providerHttpError, providerInvalidPayload } from '../provider-error'
import { mapWordPressDetailToSanitizerInput, mapWordPressSummary } from './mapper'
import { parseWordPressListPayload } from './validation'

export interface WordPressAdapterRoutes {
  readonly listPath: string
  readonly detailPath: (wordpressId: number) => string
}

export interface WordPressListRequest {
  readonly page: number
  readonly pageSize: number
  readonly categoryId?: number
}

const assertRequest = ({ page, pageSize, categoryId }: WordPressListRequest): void => {
  if (!Number.isSafeInteger(page) || page < 1) throw providerInvalidPayload()
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) throw providerInvalidPayload()
  if (categoryId !== undefined && (!Number.isSafeInteger(categoryId) || categoryId < 1)) throw providerInvalidPayload()
}

const assertSuccessStatus = (status: number): void => {
  if (!Number.isInteger(status) || status < 200 || status >= 300) throw providerHttpError(status)
}

const parseTotalHeader = (headers: Readonly<Record<string, string>> | undefined): number => {
  const value = Object.entries(headers || {}).find(([name]) => name.toLowerCase() === 'x-wp-total')?.[1]
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)$/.test(value)) throw providerInvalidPayload()
  const total = Number(value)
  if (!Number.isSafeInteger(total) || total < 0) throw providerInvalidPayload()
  return total
}

export class WordPressContentAdapter {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly routes: WordPressAdapterRoutes,
  ) {}

  async listArticles(request: WordPressListRequest): Promise<ProviderListResult<ContentSummary>> {
    assertRequest(request)
    const httpRequest: HttpGetRequest = {
      path: this.routes.listPath,
      query: {
        page: request.page,
        per_page: request.pageSize,
        _embed: true,
        _fields: 'id,date_gmt,title,excerpt,_links,_embedded',
        ...(request.categoryId === undefined ? {} : { categories: request.categoryId }),
      },
    }

    try {
      const response = await this.httpClient.get<unknown>(httpRequest)
      assertSuccessStatus(response.status)
      return {
        items: parseWordPressListPayload(response.data).map((item) => mapWordPressSummary(item)),
        total: parseTotalHeader(response.headers),
      }
    } catch (error) {
      throw normalizeProviderError(error)
    }
  }

  async getArticleDetail(wordpressId: number): Promise<ContentDetailSanitizerInput> {
    if (!Number.isSafeInteger(wordpressId) || wordpressId < 1) throw providerInvalidPayload()

    try {
      const response = await this.httpClient.get<unknown>({
        path: this.routes.detailPath(wordpressId),
        query: {
          _embed: true,
          _fields: 'id,date_gmt,title,excerpt,content,_embedded',
        },
      })
      assertSuccessStatus(response.status)
      return mapWordPressDetailToSanitizerInput(response.data)
    } catch (error) {
      throw normalizeProviderError(error)
    }
  }
}
