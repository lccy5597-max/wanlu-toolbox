import type { RequestHandler } from 'express'
import type { ContentService } from '../services/content-service'
import { normalizeArticleId, parseContentListRequest } from '../schemas/requests'
import { successEnvelope } from '../utils/envelope'

export const createContentListController = (service: ContentService): RequestHandler => async (req, res, next) => {
  try {
    const request = parseContentListRequest(req.query as Record<string, unknown>)
    const result = await service.listArticles(request)
    res.status(200).json(successEnvelope(
      { items: result.items },
      { pagination: result.pagination },
    ))
  } catch (error) {
    next(error)
  }
}

export const createContentDetailController = (service: ContentService): RequestHandler => async (req, res, next) => {
  try {
    const id = normalizeArticleId(req.params.id)
    const article = await service.getArticleDetail(id)
    res.status(200).json(successEnvelope(article))
  } catch (error) {
    next(error)
  }
}
