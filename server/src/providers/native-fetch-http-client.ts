import type { HttpClient, HttpGetRequest, HttpResponse } from './http-client'
import { ProviderError, providerInvalidPayload, providerTimeout, providerUnavailable } from './provider-error'

export const MAX_UPSTREAM_RESPONSE_BYTES = 2 * 1024 * 1024

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export interface NativeFetchHttpClientOptions {
  readonly baseUrl: string
  readonly timeoutMs: number
  readonly fetchLike?: FetchLike
  readonly maxResponseBytes?: number
}

const normalizeHeaders = (headers: Headers): Readonly<Record<string, string>> => {
  const output: Record<string, string> = {}
  headers.forEach((value, name) => {
    output[name.toLowerCase()] = value
  })
  return Object.freeze(output)
}

const assertJsonContentType = (headers: Headers): void => {
  const contentType = headers.get('content-type') || ''
  const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase()
  if (mediaType !== 'application/json') throw providerInvalidPayload()
}

const assertContentLength = (headers: Headers, maxBytes: number): void => {
  const value = headers.get('content-length')
  if (value === null) return
  if (!/^(?:0|[1-9]\d*)$/.test(value)) throw providerInvalidPayload()
  const bytes = Number(value)
  if (!Number.isSafeInteger(bytes) || bytes > maxBytes) throw providerInvalidPayload()
}

const buildRequestUrl = (baseUrl: string, request: HttpGetRequest): URL => {
  if (!request.path || request.path.includes('?') || request.path.includes('#')) throw providerInvalidPayload()
  const pathSegments = request.path.replace(/^\/+/, '').split('/')
  if (pathSegments.some((segment) => segment === '..')) throw providerInvalidPayload()

  const url = new URL(baseUrl)
  const basePath = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`
  url.pathname = `${basePath}${pathSegments.join('/')}`.replace(/\/{2,}/g, '/')
  url.search = ''
  url.hash = ''
  for (const [name, value] of Object.entries(request.query || {})) {
    url.searchParams.set(name, String(value))
  }
  return url
}

export class NativeFetchHttpClient implements HttpClient {
  private readonly baseUrl: string
  private readonly timeoutMs: number
  private readonly fetchLike: FetchLike
  private readonly maxResponseBytes: number

  constructor(options: NativeFetchHttpClientOptions) {
    this.baseUrl = options.baseUrl
    this.timeoutMs = options.timeoutMs
    this.fetchLike = options.fetchLike ?? globalThis.fetch
    this.maxResponseBytes = options.maxResponseBytes ?? MAX_UPSTREAM_RESPONSE_BYTES
  }

  async get<T>(request: HttpGetRequest): Promise<HttpResponse<T>> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await this.fetchLike(buildRequestUrl(this.baseUrl, request), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        redirect: 'error',
        signal: controller.signal,
      })
      assertJsonContentType(response.headers)
      assertContentLength(response.headers, this.maxResponseBytes)

      const text = await response.text()
      if (Buffer.byteLength(text, 'utf8') > this.maxResponseBytes) throw providerInvalidPayload()

      let data: unknown
      try {
        data = JSON.parse(text)
      } catch {
        throw providerInvalidPayload()
      }

      return {
        status: response.status,
        data: data as T,
        headers: normalizeHeaders(response.headers),
      }
    } catch (error) {
      if (error instanceof ProviderError) throw error
      if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) throw providerTimeout()
      throw providerUnavailable()
    } finally {
      clearTimeout(timer)
    }
  }
}
