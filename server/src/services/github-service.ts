import type { GithubProvider, GithubRankingItem } from '../providers/contracts'
import type { GithubRankingRequest } from '../schemas/requests'
import { serviceUnavailable } from '../errors/app-error'
import type { GithubPeriod } from '../constants/api'

export interface GithubRankingResult {
  readonly period: GithubPeriod
  readonly items: readonly GithubRankingItem[]
  readonly pagination: {
    readonly page: number
    readonly pageSize: number
    readonly total: number
    readonly hasMore: boolean
  }
}

export class GithubService {
  constructor(private readonly provider: GithubProvider | null = null) {}

  async getRankings(request: GithubRankingRequest): Promise<GithubRankingResult> {
    if (this.provider === null) throw serviceUnavailable()
    const providerResult = await this.provider.getRankings(request)
    return {
      period: request.period,
      items: [...providerResult.items],
      pagination: {
        page: request.page,
        pageSize: request.pageSize,
        total: providerResult.total,
        hasMore: request.page * request.pageSize < providerResult.total,
      },
    }
  }
}
