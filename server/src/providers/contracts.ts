import type { ContentListRequest, GithubRankingRequest } from '../schemas/requests'

export interface ContentSummary {
  readonly id: string
  readonly title: string
  readonly excerpt: string
  readonly cover: string
  readonly publishTime: string
  readonly category: string
  readonly author?: string
}

export interface ContentDetail {
  readonly id: string
  readonly title: string
  readonly content: string
  readonly publishTime: string
  readonly category: string
  readonly author?: string
  readonly cover?: string
}

export interface ContentDetailSanitizerInput {
  readonly id: string
  readonly title: string
  readonly rawHtml: string
  readonly publishTime: string
  readonly category: string
  readonly author?: string
  readonly cover?: string
}

export interface GithubRankingItem {
  readonly id: string
  readonly name: string
  readonly fullName: string
  readonly description: string
  readonly author: string
  readonly stars: number
  readonly language: string
  readonly url: string
  readonly updatedAt: string
}

export interface ProviderListResult<T> {
  readonly items: readonly T[]
  readonly total: number
}

export interface ContentProvider {
  listArticles(request: ContentListRequest): Promise<ProviderListResult<ContentSummary>>
  getArticleDetail(id: string): Promise<ContentDetail | null>
}

export interface GithubProvider {
  getRankings(request: GithubRankingRequest): Promise<ProviderListResult<GithubRankingItem>>
}
