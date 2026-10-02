import { isIP } from 'node:net'
import { API_VERSION } from '../constants/api'

const DEFAULT_PORT = 3000
export const DEFAULT_UPSTREAM_TIMEOUT_MS = 7000
const MAX_PORT = 65535

const parseBoolean = (value: string | undefined): boolean => value === 'true'

const parsePositiveInteger = (
  value: string | undefined,
  fallback: number,
  name: string,
  maxValue: number = Number.MAX_SAFE_INTEGER,
): number => {
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maxValue) throw new Error(`invalid_${name}`)
  return parsed
}

const normalizeIpLiteral = (hostname: string): string => (
  hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname
)

const isBlockedIpLiteral = (hostname: string): boolean => {
  const host = normalizeIpLiteral(hostname).toLowerCase()
  const version = isIP(host)
  if (version === 4) {
    const octets = host.split('.').map(Number)
    const a = octets[0] ?? -1
    const b = octets[1] ?? -1
    return a === 0
      || a === 10
      || a === 127
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
  }
  if (version === 6) {
    return host === '::'
      || host === '::1'
      || host.startsWith('fc')
      || host.startsWith('fd')
      || /^fe[89ab]/.test(host)
  }
  return false
}

export const normalizeWordPressBaseUrl = (value: string): string => {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('invalid_wordpress_base_url')
  }

  const hostname = parsed.hostname.toLowerCase()
  if (parsed.protocol !== 'https:') throw new Error('invalid_wordpress_base_url')
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) throw new Error('invalid_wordpress_base_url')
  if (isBlockedIpLiteral(hostname)) throw new Error('invalid_wordpress_base_url')
  if (parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('invalid_wordpress_base_url')

  parsed.pathname = parsed.pathname === '/' ? '/' : parsed.pathname.replace(/\/+$/, '')
  return parsed.toString()
}

export interface ServerConfig {
  readonly nodeEnv: string
  readonly host: '127.0.0.1'
  readonly port: number
  readonly apiVersion: typeof API_VERSION
  readonly contentProviderEnabled: boolean
  readonly githubProviderEnabled: boolean
  readonly aiProviderEnabled: boolean
  readonly upstreamTimeoutMs: number
  readonly wordpressBaseUrl: string | null
}

export const loadServerConfig = (env: NodeJS.ProcessEnv = process.env): ServerConfig => {
  const apiVersion = env.API_VERSION ?? API_VERSION
  if (apiVersion !== API_VERSION) throw new Error('unsupported_api_version')

  const contentProviderEnabled = parseBoolean(env.CONTENT_PROVIDER_ENABLED)
  const rawWordPressBaseUrl = (env.WORDPRESS_BASE_URL || '').trim()
  const wordpressBaseUrl = rawWordPressBaseUrl ? normalizeWordPressBaseUrl(rawWordPressBaseUrl) : null
  if (contentProviderEnabled && wordpressBaseUrl === null) throw new Error('missing_wordpress_base_url')

  return Object.freeze({
    nodeEnv: env.NODE_ENV || 'development',
    host: '127.0.0.1',
    port: parsePositiveInteger(env.PORT, DEFAULT_PORT, 'port', MAX_PORT),
    apiVersion: API_VERSION,
    contentProviderEnabled,
    githubProviderEnabled: parseBoolean(env.GITHUB_PROVIDER_ENABLED),
    aiProviderEnabled: parseBoolean(env.AI_PROVIDER_ENABLED),
    upstreamTimeoutMs: parsePositiveInteger(env.UPSTREAM_TIMEOUT_MS, DEFAULT_UPSTREAM_TIMEOUT_MS, 'upstream_timeout_ms'),
    wordpressBaseUrl,
  })
}

export const assertUnsupportedProvidersDisabled = (config: ServerConfig): void => {
  if (config.githubProviderEnabled || config.aiProviderEnabled) {
    throw new Error('stage6_unsupported_provider_enabled')
  }
}
