import { Router } from 'express'
import { createContentDetailController, createContentListController } from '../controllers/content-controller'
import { createGithubRankingsController } from '../controllers/github-controller'
import { getHealth } from '../controllers/health-controller'
import type { ContentService } from '../services/content-service'
import type { GithubService } from '../services/github-service'

export interface ApiRouteDependencies {
  readonly contentService: ContentService
  readonly githubService: GithubService
}

export const createApiRouter = ({ contentService, githubService }: ApiRouteDependencies): Router => {
  const router = Router()

  router.get('/health', getHealth)
  router.get('/content/articles', createContentListController(contentService))
  router.get('/content/articles/:id', createContentDetailController(contentService))
  router.get('/github/rankings', createGithubRankingsController(githubService))

  return router
}
