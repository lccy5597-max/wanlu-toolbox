import assert from 'node:assert/strict'
import { request as httpRequest, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'
import type { Express } from 'express'
import { createApp } from '../src/app'
import { createConfiguredContentProvider } from '../src/composition/content-provider'
import { loadServerConfig, normalizeWordPressBaseUrl } from '../src/config/environment'
import { BUSINESS_ERROR_CODES } from '../src/constants/api'
import { NativeFetchHttpClient, MAX_UPSTREAM_RESPONSE_BYTES, type FetchLike } from '../src/providers/native-fetch-http-client'
import { ProviderError } from '../src/providers/provider-error'
import { WordPressContentAdapter } from '../src/providers/wordpress/adapter'
import { decodeWordPressArticleId } from '../src/providers/wordpress/opaque-id'
import { ProductionWordPressContentProvider } from '../src/providers/wordpress/production-provider'
import { ContentService } from '../src/services/content-service'
import { wordpressDetailPostFixture, wordpressListPostFixture } from './fixtures/wordpress'

const stage5Schema = require('../../utils/api-schema.js') as {
  validateApiResponse: (value: unknown) => { ok: boolean; errors: string[] }
  validateContentDetail: (value: unknown) => { ok: boolean; errors: string[] }
  validateContentSummary: (value: unknown) => { ok: boolean; errors: string[] }
  validatePagination: (value: unknown, options?: { maxPageSize?: number }) => { ok: boolean; errors: string[] }
}

interface FetchCapture {
  calls: Array<{ url: string; init: RequestInit | undefined }>
}

const jsonResponse = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=UTF-8',
    ...headers,
  },
})

const createFakeFetch = (
  handler: (url: URL, init: RequestInit | undefined) => Response | Promise<Response>,
  capture: FetchCapture = { calls: [] },
): { fetchLike: FetchLike; capture: FetchCapture } => ({
  capture,
  fetchLike: async (input, init) => {
    const url = new URL(String(input))
    capture.calls.push({ url: url.toString(), init })
    return handler(url, init)
  },
})

const createProductionAdapter = (fetchLike: FetchLike, baseUrl = 'https://example.invalid'): WordPressContentAdapter => {
  const httpClient = new NativeFetchHttpClient({ baseUrl, timeoutMs: 100, fetchLike })
  return new WordPressContentAdapter(httpClient, {
    listPath: 'wp-json/wp/v2/posts',
    detailPath: (wordpressId) => `wp-json/wp/v2/posts/${wordpressId}`,
  })
}

const getJson = async (
  baseUrl: string,
  path: string,
): Promise<{ status: number; body: Record<string, any> }> => {
  const url = new URL(`${baseUrl}${path}`)
  assert.equal(url.hostname, '127.0.0.1')
  return new Promise((resolve, reject) => {
    const request = httpRequest(url, { method: 'GET' }, (response) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => chunks.push(chunk))
      response.on('end', () => {
        try {
          resolve({
            status: response.statusCode || 0,
            body: JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, any>,
          })
        } catch (error) {
          reject(error)
        }
      })
    })
    request.once('error', reject)
    request.end()
  })
}

const startApp = async (app: Express): Promise<{ server: Server; baseUrl: string }> => {
  const server = await new Promise<Server>((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
    instance.once('error', reject)
  })
  const address = server.address() as AddressInfo
  return { server, baseUrl: `http://127.0.0.1:${address.port}` }
}

const stopApp = async (server: Server): Promise<void> => {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
}

test('WordPress base URL accepts HTTPS root and fixed subpath', () => {
  assert.equal(normalizeWordPressBaseUrl('https://example.invalid'), 'https://example.invalid/')
  assert.equal(normalizeWordPressBaseUrl('https://example.invalid/blog/'), 'https://example.invalid/blog')
})

for (const value of [
  'http://example.invalid',
  'https://localhost',
  'https://127.0.0.1',
  'https://0.0.0.0',
  'https://[::1]',
  'https://10.0.0.1',
  'https://172.16.0.1',
  'https://192.168.1.1',
  'https://169.254.1.1',
  'file:///',
  'data:text/plain,x',
  'javascript:alert(1)',
  'https://user:pass@example.invalid',
  'https://example.invalid?x=1',
  'https://example.invalid#fragment',
  'not a url',
] as const) {
  test(`WordPress base URL rejects ${value}`, () => {
    assert.throws(() => normalizeWordPressBaseUrl(value), /invalid_wordpress_base_url/)
  })
}

test('disabled Content Provider permits an empty WordPress base URL', () => {
  const config = loadServerConfig({ CONTENT_PROVIDER_ENABLED: 'false' })
  assert.equal(config.wordpressBaseUrl, null)
  assert.equal(createConfiguredContentProvider(config), null)
})

test('enabled Content Provider fails fast when WordPress base URL is missing', () => {
  assert.throws(() => loadServerConfig({ CONTENT_PROVIDER_ENABLED: 'true' }), /missing_wordpress_base_url/)
})

for (const value of ['http://example.invalid', 'https://localhost', 'https://10.0.0.1', 'not a url'] as const) {
  test(`enabled Content Provider fails fast for invalid WordPress base URL ${value}`, () => {
    assert.throws(() => loadServerConfig({
      CONTENT_PROVIDER_ENABLED: 'true',
      WORDPRESS_BASE_URL: value,
    }), /invalid_wordpress_base_url/)
  })
}

test('NativeFetchHttpClient constructs HTTPS GET with JSON accept, timeout signal, blocked redirects, query and subpath', async () => {
  const fake = createFakeFetch(() => jsonResponse({ ok: true }, 200, { 'X-WP-Total': '42' }))
  const client = new NativeFetchHttpClient({
    baseUrl: 'https://example.invalid/blog',
    timeoutMs: 100,
    fetchLike: fake.fetchLike,
  })
  const response = await client.get<{ ok: boolean }>({
    path: 'wp-json/wp/v2/posts',
    query: { page: 2, per_page: 10, _embed: true },
  })
  assert.equal(response.status, 200)
  assert.deepEqual(response.data, { ok: true })
  assert.equal(response.headers?.['x-wp-total'], '42')
  assert.equal(fake.capture.calls.length, 1)
  const captured = fake.capture.calls[0]
  assert.ok(captured)
  const url = new URL(captured.url)
  assert.equal(url.protocol, 'https:')
  assert.equal(url.pathname, '/blog/wp-json/wp/v2/posts')
  assert.equal(url.searchParams.get('page'), '2')
  assert.equal(url.searchParams.get('per_page'), '10')
  assert.equal(url.searchParams.get('_embed'), 'true')
  assert.equal(captured.init?.method, 'GET')
  assert.deepEqual(captured.init?.headers, { Accept: 'application/json' })
  assert.equal(captured.init?.redirect, 'error')
  assert.ok(captured.init?.signal instanceof AbortSignal)
})

test('NativeFetchHttpClient accepts application/json with charset', async () => {
  const fake = createFakeFetch(() => new Response('{"ok":true}', {
    status: 200,
    headers: { 'content-type': 'application/json; charset=UTF-8' },
  }))
  const client = new NativeFetchHttpClient({ baseUrl: 'https://example.invalid', timeoutMs: 100, fetchLike: fake.fetchLike })
  assert.deepEqual((await client.get({ path: 'wp-json' })).data, { ok: true })
})

test('NativeFetchHttpClient rejects non-JSON content type', async () => {
  const fake = createFakeFetch(() => new Response('<html>bad</html>', {
    status: 200,
    headers: { 'content-type': 'text/html' },
  }))
  const client = new NativeFetchHttpClient({ baseUrl: 'https://example.invalid', timeoutMs: 100, fetchLike: fake.fetchLike })
  await assert.rejects(client.get({ path: 'wp-json' }), (error: unknown) => error instanceof ProviderError && error.kind === 'invalid_payload')
})

test('NativeFetchHttpClient rejects invalid JSON', async () => {
  const fake = createFakeFetch(() => new Response('{bad', {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }))
  const client = new NativeFetchHttpClient({ baseUrl: 'https://example.invalid', timeoutMs: 100, fetchLike: fake.fetchLike })
  await assert.rejects(client.get({ path: 'wp-json' }), (error: unknown) => error instanceof ProviderError && error.kind === 'invalid_payload')
})

for (const status of [400, 401, 403, 404, 429, 500] as const) {
  test(`NativeFetchHttpClient preserves upstream HTTP status ${status} for provider mapping`, async () => {
    const fake = createFakeFetch(() => jsonResponse({ code: 'upstream' }, status))
    const client = new NativeFetchHttpClient({ baseUrl: 'https://example.invalid', timeoutMs: 100, fetchLike: fake.fetchLike })
    assert.equal((await client.get({ path: 'wp-json' })).status, status)
  })
}

test('NativeFetchHttpClient timeout abort maps to Provider timeout', async () => {
  const fake = createFakeFetch((_url, init) => new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal
    assert.ok(signal)
    signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
  }))
  const client = new NativeFetchHttpClient({ baseUrl: 'https://example.invalid', timeoutMs: 5, fetchLike: fake.fetchLike })
  await assert.rejects(client.get({ path: 'wp-json' }), (error: unknown) => error instanceof ProviderError && error.kind === 'timeout')
})

test('NativeFetchHttpClient network failure maps to Provider unavailable', async () => {
  const fake = createFakeFetch(async () => { throw new TypeError('dns-like failure') })
  const client = new NativeFetchHttpClient({ baseUrl: 'https://example.invalid', timeoutMs: 100, fetchLike: fake.fetchLike })
  await assert.rejects(client.get({ path: 'wp-json' }), (error: unknown) => error instanceof ProviderError && error.kind === 'unavailable')
})

test('NativeFetchHttpClient rejects oversized response using Content-Length before body processing', async () => {
  const fake = createFakeFetch(() => jsonResponse({ ok: true }, 200, {
    'content-length': String(MAX_UPSTREAM_RESPONSE_BYTES + 1),
  }))
  const client = new NativeFetchHttpClient({ baseUrl: 'https://example.invalid', timeoutMs: 100, fetchLike: fake.fetchLike })
  await assert.rejects(client.get({ path: 'wp-json' }), (error: unknown) => error instanceof ProviderError && error.kind === 'invalid_payload')
})

test('NativeFetchHttpClient rejects oversized body even without Content-Length', async () => {
  const fake = createFakeFetch(() => jsonResponse({ value: 'x'.repeat(128) }))
  const client = new NativeFetchHttpClient({
    baseUrl: 'https://example.invalid',
    timeoutMs: 100,
    fetchLike: fake.fetchLike,
    maxResponseBytes: 64,
  })
  await assert.rejects(client.get({ path: 'wp-json' }), (error: unknown) => error instanceof ProviderError && error.kind === 'invalid_payload')
})

test('WordPress adapter converts an unexpected 3xx response to Provider HTTP error', async () => {
  const fake = createFakeFetch(() => jsonResponse({ redirect: true }, 302))
  await assert.rejects(
    createProductionAdapter(fake.fetchLike).listArticles({ page: 1, pageSize: 10 }),
    (error: unknown) => error instanceof ProviderError && error.kind === 'http_error' && error.statusCode === 302,
  )
})

test('opaque WordPress article ID decoder returns server-side provider namespace and numeric ID', () => {
  assert.deepEqual(decodeWordPressArticleId('wp:1001'), { provider: 'wordpress', id: 1001 })
})

for (const opaqueId of ['wp:0', 'wp:-1', 'wp:abc', 'wordpress:1', '1', 'wp:1/../../', 'wp:01', 'wp:999999999999999999999'] as const) {
  test(`opaque WordPress article ID rejects ${opaqueId}`, () => {
    assert.throws(() => decodeWordPressArticleId(opaqueId), /provider_invalid_payload/)
  })
}

test('WordPress adapter reads X-WP-Total case-insensitively and never substitutes items.length', async () => {
  const fake = createFakeFetch(() => jsonResponse([wordpressListPostFixture], 200, { 'X-WP-Total': '42' }))
  const result = await createProductionAdapter(fake.fetchLike).listArticles({ page: 1, pageSize: 10 })
  assert.equal(result.items.length, 1)
  assert.equal(result.total, 42)
})

for (const header of [undefined, 'abc', '-1', '1.5'] as const) {
  test(`WordPress adapter rejects malformed X-WP-Total ${String(header)}`, async () => {
    const headers = header === undefined ? {} : { 'X-WP-Total': header }
    const fake = createFakeFetch(() => jsonResponse([wordpressListPostFixture], 200, headers))
    await assert.rejects(
      createProductionAdapter(fake.fetchLike).listArticles({ page: 1, pageSize: 10 }),
      (error: unknown) => error instanceof ProviderError && error.kind === 'invalid_payload',
    )
  })
}

test('WordPress list request maps Wanlu page/pageSize to controlled WordPress query fields', async () => {
  const fake = createFakeFetch(() => jsonResponse([wordpressListPostFixture], 200, { 'X-WP-Total': '42' }))
  const result = await createProductionAdapter(fake.fetchLike).listArticles({ page: 2, pageSize: 20 })
  assert.equal(result.total, 42)
  const url = new URL(fake.capture.calls[0]?.url || '')
  assert.equal(url.searchParams.get('page'), '2')
  assert.equal(url.searchParams.get('per_page'), '20')
  assert.equal(url.searchParams.get('_embed'), 'true')
  assert.equal(url.searchParams.get('_fields'), 'id,date_gmt,title,excerpt,_links,_embedded')
  assert.equal(url.searchParams.has('category'), false)
  assert.equal(url.searchParams.has('categories'), false)
})

test('unresolved Wanlu category boundary fails before HTTP instead of guessing a WordPress category ID', async () => {
  const fake = createFakeFetch(() => jsonResponse([wordpressListPostFixture], 200, { 'X-WP-Total': '1' }))
  const provider = new ProductionWordPressContentProvider(createProductionAdapter(fake.fetchLike))
  await assert.rejects(
    provider.listArticles({ page: 1, pageSize: 10, category: 'AI教程' }),
    (error: unknown) => error instanceof ProviderError && error.kind === 'unavailable',
  )
  assert.equal(fake.capture.calls.length, 0)
})

test('injected category resolver maps category to controlled numeric WordPress categories query', async () => {
  const fake = createFakeFetch(() => jsonResponse([wordpressListPostFixture], 200, { 'X-WP-Total': '1' }))
  const provider = new ProductionWordPressContentProvider(
    createProductionAdapter(fake.fetchLike),
    undefined,
    { resolve: (category) => category === 'AI教程' ? 7 : null },
  )
  const result = await provider.listArticles({ page: 1, pageSize: 10, category: 'AI教程' })
  assert.equal(result.total, 1)
  const url = new URL(fake.capture.calls[0]?.url || '')
  assert.equal(url.searchParams.get('categories'), '7')
})

test('invalid opaque detail ID fails before any HTTP call', async () => {
  const fake = createFakeFetch(() => jsonResponse(wordpressDetailPostFixture))
  const provider = new ProductionWordPressContentProvider(createProductionAdapter(fake.fetchLike))
  await assert.rejects(provider.getArticleDetail('wp:1/../../'), /provider_invalid_payload/)
  assert.equal(fake.capture.calls.length, 0)
})

test('Production Provider detail maps upstream 404 to Content Not Found null boundary', async () => {
  const fake = createFakeFetch(() => jsonResponse({ code: 'rest_post_invalid_id' }, 404))
  const provider = new ProductionWordPressContentProvider(createProductionAdapter(fake.fetchLike))
  assert.equal(await provider.getArticleDetail('wp:1001'), null)
})

test('Content Service maps upstream 429 and 5xx to frozen service unavailable contract', async () => {
  for (const status of [429, 500] as const) {
    const fake = createFakeFetch(() => jsonResponse({ code: 'upstream' }, status, { 'X-WP-Total': '0' }))
    const service = new ContentService(new ProductionWordPressContentProvider(createProductionAdapter(fake.fetchLike)))
    await assert.rejects(service.listArticles({ page: 1, pageSize: 10 }), (error: any) => (
      error?.statusCode === 503
      && error?.code === BUSINESS_ERROR_CODES.SERVICE_UNAVAILABLE
      && error?.publicMessage === 'service_unavailable'
    ))
  }
})

test('Content Service maps invalid upstream payload to frozen upstream_error contract', async () => {
  const fake = createFakeFetch(() => jsonResponse([{ ...wordpressListPostFixture, title: null }], 200, { 'X-WP-Total': '1' }))
  const service = new ContentService(new ProductionWordPressContentProvider(createProductionAdapter(fake.fetchLike)))
  await assert.rejects(service.listArticles({ page: 1, pageSize: 10 }), (error: any) => (
    error?.statusCode === 500
    && error?.code === BUSINESS_ERROR_CODES.UPSTREAM_ERROR
    && error?.publicMessage === 'upstream_error'
  ))
})

test('enabled production composition with Fake Fetch returns Stage 5-valid list and true WordPress total', async () => {
  const fake = createFakeFetch(() => jsonResponse([wordpressListPostFixture], 200, { 'X-WP-Total': '42' }))
  const config = loadServerConfig({
    NODE_ENV: 'test',
    API_VERSION: 'v1',
    CONTENT_PROVIDER_ENABLED: 'true',
    WORDPRESS_BASE_URL: 'https://example.invalid/blog',
    UPSTREAM_TIMEOUT_MS: '100',
  })
  const app = createApp(config, { contentFetchLike: fake.fetchLike })
  const running = await startApp(app)
  try {
    const result = await getJson(running.baseUrl, '/api/v1/content/articles?page=2&pageSize=10')
    assert.equal(result.status, 200)
    assert.equal(stage5Schema.validateApiResponse(result.body).ok, true)
    assert.equal(result.body.data.items.every((item: unknown) => stage5Schema.validateContentSummary(item).ok), true)
    assert.equal(stage5Schema.validatePagination(result.body.meta.pagination, { maxPageSize: 20 }).ok, true)
    assert.deepEqual(result.body.meta.pagination, { page: 2, pageSize: 10, total: 42, hasMore: true })
    const upstreamUrl = new URL(fake.capture.calls[0]?.url || '')
    assert.equal(upstreamUrl.pathname, '/blog/wp-json/wp/v2/posts')
    assert.equal(upstreamUrl.searchParams.get('page'), '2')
    assert.equal(upstreamUrl.searchParams.get('per_page'), '10')
  } finally {
    await stopApp(running.server)
  }
})

test('production detail composition sanitizes malicious WordPress HTML before Controller response', async () => {
  const maliciousDetail = {
    ...wordpressDetailPostFixture,
    content: {
      rendered: '<h2>Safe</h2><script>alert(1)</script><p onclick="x()">Body<img src="http://unsafe.invalid/a.jpg" onerror="x()"></p>',
    },
  }
  const fake = createFakeFetch(() => jsonResponse(maliciousDetail))
  const config = loadServerConfig({
    NODE_ENV: 'test',
    CONTENT_PROVIDER_ENABLED: 'true',
    WORDPRESS_BASE_URL: 'https://example.invalid',
    UPSTREAM_TIMEOUT_MS: '100',
  })
  const app = createApp(config, { contentFetchLike: fake.fetchLike })
  const running = await startApp(app)
  try {
    const result = await getJson(running.baseUrl, '/api/v1/content/articles/wp%3A1001')
    assert.equal(result.status, 200)
    const validation = stage5Schema.validateContentDetail(result.body.data)
    assert.equal(validation.ok, true, validation.errors.join(','))
    assert.match(result.body.data.content, /<h2>Safe<\/h2>/)
    assert.doesNotMatch(result.body.data.content, /<script|onclick=|onerror=|http:\/\/unsafe/i)
    assert.equal(Object.prototype.hasOwnProperty.call(result.body.data, 'rawHtml'), false)
    assert.equal(fake.capture.calls.length, 1)
  } finally {
    await stopApp(running.server)
  }
})

test('production detail composition maps WordPress 404 to frozen content_not_found', async () => {
  const fake = createFakeFetch(() => jsonResponse({ code: 'rest_post_invalid_id' }, 404))
  const config = loadServerConfig({
    NODE_ENV: 'test',
    CONTENT_PROVIDER_ENABLED: 'true',
    WORDPRESS_BASE_URL: 'https://example.invalid',
    UPSTREAM_TIMEOUT_MS: '100',
  })
  const running = await startApp(createApp(config, { contentFetchLike: fake.fetchLike }))
  try {
    const result = await getJson(running.baseUrl, '/api/v1/content/articles/wp%3A999')
    assert.equal(result.status, 404)
    assert.equal(result.body.code, BUSINESS_ERROR_CODES.CONTENT_NOT_FOUND)
    assert.equal(result.body.message, 'content_not_found')
  } finally {
    await stopApp(running.server)
  }
})

test('production composition maps timeout to frozen service_unavailable without AbortError leakage', async () => {
  const fake = createFakeFetch((_url, init) => new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal
    assert.ok(signal)
    signal.addEventListener('abort', () => reject(new DOMException('private abort detail', 'AbortError')), { once: true })
  }))
  const config = loadServerConfig({
    NODE_ENV: 'test',
    CONTENT_PROVIDER_ENABLED: 'true',
    WORDPRESS_BASE_URL: 'https://example.invalid',
    UPSTREAM_TIMEOUT_MS: '5',
  })
  const running = await startApp(createApp(config, { contentFetchLike: fake.fetchLike }))
  try {
    const result = await getJson(running.baseUrl, '/api/v1/content/articles')
    assert.equal(result.status, 503)
    assert.equal(result.body.code, BUSINESS_ERROR_CODES.SERVICE_UNAVAILABLE)
    assert.equal(result.body.message, 'service_unavailable')
    assert.doesNotMatch(JSON.stringify(result.body), /AbortError|private abort detail/i)
  } finally {
    await stopApp(running.server)
  }
})

test('production composition maps network failure to frozen service_unavailable without internal leakage', async () => {
  const fake = createFakeFetch(async () => { throw new TypeError('private dns failure') })
  const config = loadServerConfig({
    NODE_ENV: 'test',
    CONTENT_PROVIDER_ENABLED: 'true',
    WORDPRESS_BASE_URL: 'https://example.invalid',
    UPSTREAM_TIMEOUT_MS: '100',
  })
  const running = await startApp(createApp(config, { contentFetchLike: fake.fetchLike }))
  try {
    const result = await getJson(running.baseUrl, '/api/v1/content/articles')
    assert.equal(result.status, 503)
    assert.equal(result.body.code, BUSINESS_ERROR_CODES.SERVICE_UNAVAILABLE)
    assert.doesNotMatch(JSON.stringify(result.body), /private dns failure/i)
  } finally {
    await stopApp(running.server)
  }
})

for (const baseUrl of [
  'https://example.invalid',
  'https://example.invalid/',
  'https://example.invalid/blog',
  'https://example.invalid/blog/',
] as const) {
  test(`WordPress site-base URL preserves root/subpath semantics for ${baseUrl}`, async () => {
    const fake = createFakeFetch(() => jsonResponse([wordpressListPostFixture], 200, { 'X-WP-Total': '1' }))
    const config = loadServerConfig({
      NODE_ENV: 'test',
      CONTENT_PROVIDER_ENABLED: 'true',
      WORDPRESS_BASE_URL: baseUrl,
      UPSTREAM_TIMEOUT_MS: '100',
    })
    const provider = createConfiguredContentProvider(config, { fetchLike: fake.fetchLike })
    assert.ok(provider)
    await provider.listArticles({ page: 1, pageSize: 10 })
    const url = new URL(fake.capture.calls[0]?.url || '')
    const expectedPrefix = baseUrl.includes('/blog') ? '/blog' : ''
    assert.equal(url.pathname, `${expectedPrefix}/wp-json/wp/v2/posts`)
    assert.doesNotMatch(url.pathname, /\/wp-json\/wp\/v2\/wp-json\//)
  })
}

test('client query fields cannot replace or override the configured upstream host', async () => {
  const fake = createFakeFetch(() => jsonResponse([wordpressListPostFixture], 200, { 'X-WP-Total': '1' }))
  const config = loadServerConfig({
    NODE_ENV: 'test',
    CONTENT_PROVIDER_ENABLED: 'true',
    WORDPRESS_BASE_URL: 'https://example.invalid/blog',
    UPSTREAM_TIMEOUT_MS: '100',
  })
  const running = await startApp(createApp(config, { contentFetchLike: fake.fetchLike }))
  try {
    const result = await getJson(running.baseUrl, '/api/v1/content/articles?host=attacker.invalid&url=https%3A%2F%2Fevil.invalid&domain=evil.invalid&endpoint=%2Fother&per_page=999')
    assert.equal(result.status, 200)
    const upstream = new URL(fake.capture.calls[0]?.url || '')
    assert.equal(upstream.hostname, 'example.invalid')
    assert.equal(upstream.pathname, '/blog/wp-json/wp/v2/posts')
    for (const key of ['host', 'url', 'domain', 'endpoint']) assert.equal(upstream.searchParams.has(key), false)
    assert.equal(upstream.searchParams.get('per_page'), '10')
  } finally {
    await stopApp(running.server)
  }
})

for (const validId of ['wp:1', 'wp:999', `wp:${Number.MAX_SAFE_INTEGER}`] as const) {
  test(`opaque WordPress article ID accepts canonical ${validId}`, () => {
    assert.equal(decodeWordPressArticleId(validId).id, Number(validId.slice(3)))
  })
}

for (const invalidId of [
  'wp:+1',
  'wp:1.0',
  'wp:1e3',
  'wp:1/../2',
  'wp:%31',
  `wp:${Number.MAX_SAFE_INTEGER + 1}`,
  `wp:${'9'.repeat(80)}`,
] as const) {
  test(`opaque WordPress article ID rejects non-canonical ${invalidId}`, async () => {
    const fake = createFakeFetch(() => jsonResponse(wordpressDetailPostFixture))
    const provider = new ProductionWordPressContentProvider(createProductionAdapter(fake.fetchLike))
    await assert.rejects(provider.getArticleDetail(invalidId), /provider_invalid_payload/)
    assert.equal(fake.capture.calls.length, 0)
  })
}

for (const resolverCase of [
  ['null', () => null],
  ['zero', () => 0],
  ['negative', () => -1],
  ['decimal', () => 1.5],
  ['unsafe integer', () => Number.MAX_SAFE_INTEGER + 1],
  ['throws', () => { throw new Error('resolver-private-error') }],
] as const) {
  test(`category resolver fails safe for ${resolverCase[0]}`, async () => {
    const fake = createFakeFetch(() => jsonResponse([wordpressListPostFixture], 200, { 'X-WP-Total': '1' }))
    const provider = new ProductionWordPressContentProvider(
      createProductionAdapter(fake.fetchLike),
      undefined,
      { resolve: resolverCase[1] },
    )
    await assert.rejects(provider.listArticles({ page: 1, pageSize: 10, category: 'AI教程' }))
    assert.equal(fake.capture.calls.length, 0)
  })
}

for (const header of ['', '12abc', '+1', ' 42 '] as const) {
  test(`raw X-WP-Total boundary rejects non-canonical value ${JSON.stringify(header)}`, async () => {
    const adapter = new WordPressContentAdapter({
      async get<T>() {
        return { status: 200, data: [wordpressListPostFixture] as T, headers: { 'X-WP-Total': header } }
      },
    }, { listPath: 'wp-json/wp/v2/posts', detailPath: (id) => `wp-json/wp/v2/posts/${id}` })
    await assert.rejects(adapter.listArticles({ page: 1, pageSize: 10 }), (error: unknown) => (
      error instanceof ProviderError && error.kind === 'invalid_payload'
    ))
  })
}

test('HTTP Headers normalization trims standard X-WP-Total optional whitespace before strict adapter validation', async () => {
  const fake = createFakeFetch(() => jsonResponse([wordpressListPostFixture], 200, { 'X-WP-Total': ' 42 ' }))
  const result = await createProductionAdapter(fake.fetchLike).listArticles({ page: 1, pageSize: 10 })
  assert.equal(result.total, 42)
})

test('empty WordPress list with X-WP-Total 0 is a valid success result', async () => {
  const fake = createFakeFetch(() => jsonResponse([], 200, { 'X-WP-Total': '0' }))
  const result = await createProductionAdapter(fake.fetchLike).listArticles({ page: 1, pageSize: 10 })
  assert.deepEqual(result, { items: [], total: 0 })
})

test('empty WordPress page does not overwrite a nonzero X-WP-Total', async () => {
  const fake = createFakeFetch(() => jsonResponse([], 200, { 'X-WP-Total': '100' }))
  const result = await createProductionAdapter(fake.fetchLike).listArticles({ page: 10, pageSize: 10 })
  assert.equal(result.items.length, 0)
  assert.equal(result.total, 100)
})

for (const status of [401, 403] as const) {
  test(`upstream ${status} maps to frozen upstream_error and never content_not_found`, async () => {
    const fake = createFakeFetch(() => jsonResponse({ privateMarker: 'UPSTREAM-PRIVATE-BODY' }, status))
    const config = loadServerConfig({
      NODE_ENV: 'test', CONTENT_PROVIDER_ENABLED: 'true', WORDPRESS_BASE_URL: 'https://example.invalid', UPSTREAM_TIMEOUT_MS: '100',
    })
    const running = await startApp(createApp(config, { contentFetchLike: fake.fetchLike }))
    try {
      const result = await getJson(running.baseUrl, '/api/v1/content/articles/wp%3A1001')
      assert.equal(result.status, 500)
      assert.equal(result.body.code, BUSINESS_ERROR_CODES.UPSTREAM_ERROR)
      assert.equal(result.body.message, 'upstream_error')
      assert.doesNotMatch(JSON.stringify(result.body), /UPSTREAM-PRIVATE-BODY|privateMarker/)
    } finally {
      await stopApp(running.server)
    }
  })
}

for (const contentType of [
  'application/json',
  'application/json; charset=UTF-8',
  'Application/Json',
  'APPLICATION/JSON; charset=utf-8',
] as const) {
  test(`JSON Content-Type accepts case/charset variant ${contentType}`, async () => {
    const fake = createFakeFetch(() => new Response('{"ok":true}', { status: 200, headers: { 'content-type': contentType } }))
    const client = new NativeFetchHttpClient({ baseUrl: 'https://example.invalid', timeoutMs: 100, fetchLike: fake.fetchLike })
    assert.deepEqual((await client.get({ path: 'wp-json' })).data, { ok: true })
  })
}

for (const contentType of ['text/json', 'application/javascript', 'text/html'] as const) {
  test(`non-standard JSON Content-Type is rejected: ${contentType}`, async () => {
    const fake = createFakeFetch(() => new Response('{"ok":true}', { status: 200, headers: { 'content-type': contentType } }))
    const client = new NativeFetchHttpClient({ baseUrl: 'https://example.invalid', timeoutMs: 100, fetchLike: fake.fetchLike })
    await assert.rejects(client.get({ path: 'wp-json' }), (error: unknown) => error instanceof ProviderError && error.kind === 'invalid_payload')
  })
}

test('missing Content-Length is allowed because actual body bytes are still enforced', async () => {
  const fake = createFakeFetch(() => new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }))
  const client = new NativeFetchHttpClient({ baseUrl: 'https://example.invalid', timeoutMs: 100, fetchLike: fake.fetchLike })
  assert.deepEqual((await client.get({ path: 'wp-json' })).data, { ok: true })
})

test('valid Content-Length is accepted and actual bytes are still parsed normally', async () => {
  const body = '{"ok":true}'
  const fake = createFakeFetch(() => new Response(body, {
    status: 200,
    headers: { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(body, 'utf8')) },
  }))
  const client = new NativeFetchHttpClient({ baseUrl: 'https://example.invalid', timeoutMs: 100, fetchLike: fake.fetchLike })
  assert.deepEqual((await client.get({ path: 'wp-json' })).data, { ok: true })
})

for (const value of ['abc', '-1', '1.5'] as const) {
  test(`invalid Content-Length is rejected: ${value}`, async () => {
    const fake = createFakeFetch(() => new Response('{"ok":true}', {
      status: 200,
      headers: { 'content-type': 'application/json', 'content-length': value },
    }))
    const client = new NativeFetchHttpClient({ baseUrl: 'https://example.invalid', timeoutMs: 100, fetchLike: fake.fetchLike })
    await assert.rejects(client.get({ path: 'wp-json' }), (error: unknown) => error instanceof ProviderError && error.kind === 'invalid_payload')
  })
}

for (const status of [301, 302, 307, 308] as const) {
  test(`redirect status ${status} is rejected by the provider boundary`, async () => {
    const fake = createFakeFetch(() => jsonResponse({ redirect: true }, status))
    await assert.rejects(
      createProductionAdapter(fake.fetchLike).listArticles({ page: 1, pageSize: 10 }),
      (error: unknown) => error instanceof ProviderError && error.kind === 'http_error' && error.statusCode === status,
    )
  })
}

test('WordPress list _fields includes _links so _embed can retain embedded resources', async () => {
  const capture: { request?: HttpGetRequest } = {}
  const adapter = new WordPressContentAdapter({
    async get<T>(request: HttpGetRequest): Promise<HttpResponse<T>> {
      capture.request = request
      return {
        status: 200,
        data: [wordpressListPostFixture] as T,
        headers: { 'x-wp-total': '1' },
      }
    },
  }, {
    listPath: 'wp-json/wp/v2/posts',
    detailPath: (id) => `wp-json/wp/v2/posts/${id}`,
  })
  await adapter.listArticles({ page: 1, pageSize: 1 })
  assert.equal(capture.request?.query?._embed, true)
  assert.equal(capture.request?.query?._fields, 'id,date_gmt,title,excerpt,_links,_embedded')
})

test('production list/detail request fields match the raw validator and sanitizer-input needs', async () => {
  const fake = createFakeFetch((url) => url.pathname.endsWith('/1001')
    ? jsonResponse(wordpressDetailPostFixture)
    : jsonResponse([wordpressListPostFixture], 200, { 'X-WP-Total': '1' }))
  const provider = new ProductionWordPressContentProvider(createProductionAdapter(fake.fetchLike))
  await provider.listArticles({ page: 1, pageSize: 10 })
  await provider.getArticleDetail('wp:1001')
  const listUrl = new URL(fake.capture.calls[0]?.url || '')
  const detailUrl = new URL(fake.capture.calls[1]?.url || '')
  assert.equal(listUrl.searchParams.get('_embed'), 'true')
  assert.equal(listUrl.searchParams.get('_fields'), 'id,date_gmt,title,excerpt,_links,_embedded')
  assert.equal(detailUrl.pathname, '/wp-json/wp/v2/posts/1001')
  assert.equal(detailUrl.searchParams.get('_embed'), 'true')
  assert.equal(detailUrl.searchParams.get('_fields'), 'id,date_gmt,title,excerpt,content,_embedded')
})

test('enabled provider composition and server startup have zero upstream side effects until a Content request arrives', async () => {
  const fake = createFakeFetch(() => jsonResponse([wordpressListPostFixture], 200, { 'X-WP-Total': '1' }))
  const config = loadServerConfig({
    NODE_ENV: 'test', CONTENT_PROVIDER_ENABLED: 'true', WORDPRESS_BASE_URL: 'https://example.invalid', UPSTREAM_TIMEOUT_MS: '100',
  })
  const app = createApp(config, { contentFetchLike: fake.fetchLike })
  assert.equal(fake.capture.calls.length, 0)
  const running = await startApp(app)
  try {
    assert.equal(fake.capture.calls.length, 0)
    const health = await getJson(running.baseUrl, '/api/v1/health')
    assert.equal(health.status, 200)
    assert.equal(health.body.data.status, 'ok')
    assert.equal(fake.capture.calls.length, 0)
  } finally {
    await stopApp(running.server)
  }
})

test('disabled provider list/detail requests never invoke an injected upstream transport', async () => {
  const fake = createFakeFetch(() => { throw new Error('must_not_be_called') })
  const config = loadServerConfig({ CONTENT_PROVIDER_ENABLED: 'false' })
  const running = await startApp(createApp(config, { contentFetchLike: fake.fetchLike }))
  try {
    for (const path of ['/api/v1/content/articles', '/api/v1/content/articles/wp%3A1001']) {
      const result = await getJson(running.baseUrl, path)
      assert.equal(result.status, 503)
      assert.equal(result.body.code, BUSINESS_ERROR_CODES.SERVICE_UNAVAILABLE)
    }
    assert.equal(fake.capture.calls.length, 0)
  } finally {
    await stopApp(running.server)
  }
})

test('invalid JSON response body marker is not leaked to the Content API client', async () => {
  const marker = 'PRIVATE-UPSTREAM-BODY-MARKER'
  const fake = createFakeFetch(() => new Response(`{not-json:${marker}`, {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }))
  const config = loadServerConfig({
    NODE_ENV: 'test', CONTENT_PROVIDER_ENABLED: 'true', WORDPRESS_BASE_URL: 'https://example.invalid', UPSTREAM_TIMEOUT_MS: '100',
  })
  const running = await startApp(createApp(config, { contentFetchLike: fake.fetchLike }))
  try {
    const result = await getJson(running.baseUrl, '/api/v1/content/articles')
    assert.equal(result.status, 500)
    assert.equal(result.body.code, BUSINESS_ERROR_CODES.UPSTREAM_ERROR)
    assert.doesNotMatch(JSON.stringify(result.body), new RegExp(marker))
  } finally {
    await stopApp(running.server)
  }
})
