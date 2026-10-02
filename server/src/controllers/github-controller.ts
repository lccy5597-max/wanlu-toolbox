import type { RequestHandler } from 'express'
import type { GithubService } from '../services/github-service'
import { parseGithubRankingRequest } from '../schemas/requests'
import { successEnvelope } from '../utils/envelope'

export const createGithubRankingsController = (service: GithubService): RequestHandler => async (req, res, next) => {
  try {
    const request = parseGithubRankingRequest(req.query as Record<string, unknown>)
    const result = await service.getRankings(request)
    res.status(200).json(successEnvelope(
      { period: result.period, items: result.items },
      { pagination: result.pagination },
    ))
  } catch (error) {
    next(error)
  }
}
