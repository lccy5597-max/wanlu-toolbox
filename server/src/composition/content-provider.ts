import type { ServerConfig } from '../config/environment'
import type { ContentProvider } from '../providers/contracts'
import { NativeFetchHttpClient, type FetchLike } from '../providers/native-fetch-http-client'
import { WordPressContentAdapter } from '../providers/wordpress/adapter'
import type { WordPressCategoryResolver } from '../providers/wordpress/production-provider'
import { ProductionWordPressContentProvider } from '../providers/wordpress/production-provider'
import type { HtmlSanitizer } from '../security/html-sanitizer'

export interface ContentProviderCompositionDependencies {
  readonly fetchLike?: FetchLike
  readonly sanitizer?: HtmlSanitizer
  readonly categoryResolver?: WordPressCategoryResolver | null
}

const WORDPRESS_LIST_PATH = 'wp-json/wp/v2/posts'

export const createConfiguredContentProvider = (
  config: ServerConfig,
  dependencies: ContentProviderCompositionDependencies = {},
): ContentProvider | null => {
  if (!config.contentProviderEnabled) return null
  if (config.wordpressBaseUrl === null) throw new Error('missing_wordpress_base_url')

  const httpClient = new NativeFetchHttpClient({
    baseUrl: config.wordpressBaseUrl,
    timeoutMs: config.upstreamTimeoutMs,
    ...(dependencies.fetchLike === undefined ? {} : { fetchLike: dependencies.fetchLike }),
  })
  const adapter = new WordPressContentAdapter(httpClient, {
    listPath: WORDPRESS_LIST_PATH,
    detailPath: (wordpressId) => `${WORDPRESS_LIST_PATH}/${wordpressId}`,
  })
  return new ProductionWordPressContentProvider(
    adapter,
    dependencies.sanitizer,
    dependencies.categoryResolver ?? null,
  )
}
