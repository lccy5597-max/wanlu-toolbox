import express, { type Express } from 'express'
import { API_PREFIX } from './constants/api'
import type { ServerConfig } from './config/environment'
import { assertUnsupportedProvidersDisabled, loadServerConfig } from './config/environment'
import { createConfiguredContentProvider } from './composition/content-provider'
import { errorHandler, notFoundHandler } from './middleware/error-middleware'
import { createApiRouter } from './routes/api-routes'
import { ContentService } from './services/content-service'
import { GithubService } from './services/github-service'
import type { ContentProvider, GithubProvider } from './providers/contracts'
import type { FetchLike } from './providers/native-fetch-http-client'
import type { WordPressCategoryResolver } from './providers/wordpress/production-provider'
import type { HtmlSanitizer } from './security/html-sanitizer'

export interface AppDependencies {
  readonly contentProvider?: ContentProvider | null
  readonly githubProvider?: GithubProvider | null
  readonly contentFetchLike?: FetchLike
  readonly contentSanitizer?: HtmlSanitizer
  readonly contentCategoryResolver?: WordPressCategoryResolver | null
}

export const createApp = (
  config: ServerConfig = loadServerConfig(),
  dependencies: AppDependencies = {},
): Express => {
  assertUnsupportedProvidersDisabled(config)

  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '64kb' }))

  const contentProvider = dependencies.contentProvider !== undefined
    ? dependencies.contentProvider
    : createConfiguredContentProvider(config, {
      ...(dependencies.contentFetchLike === undefined ? {} : { fetchLike: dependencies.contentFetchLike }),
      ...(dependencies.contentSanitizer === undefined ? {} : { sanitizer: dependencies.contentSanitizer }),
      ...(dependencies.contentCategoryResolver === undefined ? {} : { categoryResolver: dependencies.contentCategoryResolver }),
    })
  const contentService = new ContentService(contentProvider)
  const githubService = new GithubService(dependencies.githubProvider ?? null)

  app.use(API_PREFIX, createApiRouter({ contentService, githubService }))
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
