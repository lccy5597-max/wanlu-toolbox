import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { HttpClient, HttpGetRequest, HttpResponse } from '../src/providers/http-client'
import { ProviderError, providerTimeout } from '../src/providers/provider-error'
import { WordPressContentAdapter } from '../src/providers/wordpress/adapter'
import { mapWordPressDetailToSanitizerInput, mapWordPressSummary } from '../src/providers/wordpress/mapper'
import { createWordPressArticleId } from '../src/providers/wordpress/normalizers'
import { parseWordPressDetailPost, parseWordPressListPayload, parseWordPressListPost } from '../src/providers/wordpress/validation'
import {
  wordpressDetailPostFixture,
  wordpressListPostFixture,
  wordpressMissingCoverFixture,
} from './fixtures/wordpress'

const stage5Schema = require('../../utils/api-schema.js') as {
  validateContentDetail: (value: unknown) => { ok: boolean; errors: string[] }
  validateContentSummary: (value: unknown) => { ok: boolean; errors: string[] }
}

interface Capture {
  request?: HttpGetRequest
}

const fakeHttpClient = (responseOrFactory: HttpResponse<unknown> | ((request: HttpGetRequest) => Promise<HttpResponse<unknown>>), capture: Capture = {}): HttpClient => ({
  async get<T>(request: HttpGetRequest): Promise<HttpResponse<T>> {
    capture.request = request
    const response = typeof responseOrFactory === 'function'
      ? await responseOrFactory(request)
      : responseOrFactory
    return response as HttpResponse<T>
  },
})

const routes = Object.freeze({
  listPath: '/fixture/posts',
  detailPath: (wordpressId: number) => `/fixture/posts/${wordpressId}`,
})

test('WordPress raw list payload validation accepts fixture data', () => {
  const parsed = parseWordPressListPayload([wordpressListPostFixture])
  assert.equal(parsed.length, 1)
  assert.equal(parsed[0]?.id, 1001)
})

test('WordPress raw detail validation accepts fixture data', () => {
  assert.equal(parseWordPressDetailPost(wordpressDetailPostFixture).content.rendered.includes('Raw'), true)
})

test('raw validation rejects missing title', () => {
  const source = { ...wordpressListPostFixture } as Record<string, unknown>
  delete source.title
  assert.throws(() => parseWordPressListPost(source), (error: unknown) => error instanceof ProviderError && error.kind === 'invalid_payload')
})

test('raw validation rejects invalid WordPress id', () => {
  assert.throws(() => parseWordPressListPost({ ...wordpressListPostFixture, id: 0 }), /provider_invalid_payload/)
})

test('raw validation rejects invalid publish date', () => {
  assert.throws(() => parseWordPressListPost({ ...wordpressListPostFixture, date_gmt: '2026/10/01' }), /provider_invalid_payload/)
})

test('raw validation rejects unsafe cover URL', () => {
  const source = {
    ...wordpressListPostFixture,
    _embedded: {
      ...wordpressListPostFixture._embedded,
      'wp:featuredmedia': [{ source_url: 'http://example.com/unsafe.jpg' }],
    },
  }
  assert.throws(() => parseWordPressListPost(source), /provider_invalid_payload/)
})

test('Content Summary mapper passes frozen Stage 5 schema', () => {
  const summary = mapWordPressSummary(wordpressListPostFixture)
  assert.equal(stage5Schema.validateContentSummary(summary).ok, true)
  assert.deepEqual(summary, {
    id: 'wp:1001',
    title: 'Test & Article',
    excerpt: 'Fixture summary text.',
    cover: 'https://cdn.example.com/test/article-1001.webp',
    publishTime: '2026-10-01T00:30:00Z',
    category: 'AI & Tools',
  })
})

test('Article ID strategy produces a stable opaque string', () => {
  assert.equal(createWordPressArticleId(1001), 'wp:1001')
  assert.equal(typeof mapWordPressSummary(wordpressListPostFixture).id, 'string')
})

test('title HTML entity decoding produces plain text', () => {
  assert.equal(mapWordPressSummary(wordpressListPostFixture).title, 'Test & Article')
})

test('excerpt HTML is normalized to plain summary text', () => {
  assert.equal(mapWordPressSummary(wordpressListPostFixture).excerpt, 'Fixture summary text.')
})

test('WordPress GMT field is normalized to timezone-aware ISO 8601', () => {
  assert.equal(mapWordPressSummary(wordpressListPostFixture).publishTime, '2026-10-01T00:30:00Z')
})

test('HTTPS cover is accepted', () => {
  assert.equal(mapWordPressSummary(wordpressListPostFixture).cover.startsWith('https://'), true)
})

test('missing optional cover maps to frozen summary empty-string form', () => {
  const summary = mapWordPressSummary(wordpressMissingCoverFixture)
  assert.equal(summary.cover, '')
  assert.equal(stage5Schema.validateContentSummary(summary).ok, true)
})

test('WordPress-specific raw fields do not leak into normalized summary', () => {
  const serialized = JSON.stringify(mapWordPressSummary(wordpressListPostFixture))
  assert.doesNotMatch(serialized, /_embedded|rendered|guid|yoast_head|categories/)
})

test('detail mapper creates sanitizer input and does not claim raw HTML is content', () => {
  const detail = mapWordPressDetailToSanitizerInput(wordpressDetailPostFixture)
  assert.equal(detail.rawHtml, wordpressDetailPostFixture.content.rendered)
  assert.equal(Object.prototype.hasOwnProperty.call(detail, 'content'), false)
  assert.doesNotMatch(JSON.stringify(detail), /_embedded|rendered|guid|yoast_head/)
})

test('detail mapping can form Stage 5 shape only with test-only sanitized output', () => {
  const input = mapWordPressDetailToSanitizerInput(wordpressDetailPostFixture)
  const testOnlySanitizedDetail = {
    id: input.id,
    title: input.title,
    content: '<p>Sanitized test output.</p>',
    publishTime: input.publishTime,
    category: input.category,
    ...(input.cover === undefined ? {} : { cover: input.cover }),
  }
  assert.equal(stage5Schema.validateContentDetail(testOnlySanitizedDetail).ok, true)
})

test('adapter uses injected fake HTTP client only', async () => {
  const capture: Capture = {}
  const adapter = new WordPressContentAdapter(fakeHttpClient({
    status: 200,
    data: [wordpressListPostFixture],
    headers: { 'X-WP-Total': '42' },
  }, capture), routes)
  const result = await adapter.listArticles({ page: 2, pageSize: 10 })
  assert.equal(result.items.length, 1)
  assert.equal(result.total, 42)
  assert.deepEqual(capture.request, {
    path: '/fixture/posts',
    query: {
      page: 2,
      per_page: 10,
      _embed: true,
      _fields: 'id,date_gmt,title,excerpt,_links,_embedded',
    },
  })
})

test('adapter detail mapping keeps raw HTML behind sanitizer boundary', async () => {
  const capture: Capture = {}
  const adapter = new WordPressContentAdapter(fakeHttpClient({ status: 200, data: wordpressDetailPostFixture }, capture), routes)
  const detail = await adapter.getArticleDetail(1001)
  assert.equal(detail.id, 'wp:1001')
  assert.equal(Object.prototype.hasOwnProperty.call(detail, 'content'), false)
  assert.equal(capture.request?.path, '/fixture/posts/1001')
})

test('adapter converts invalid provider payload to ProviderError boundary', async () => {
  const adapter = new WordPressContentAdapter(fakeHttpClient({ status: 200, data: [{ ...wordpressListPostFixture, title: null }] }), routes)
  await assert.rejects(adapter.listArticles({ page: 1, pageSize: 10 }), (error: unknown) => error instanceof ProviderError && error.kind === 'invalid_payload')
})

test('adapter preserves provider timeout boundary without leaking raw error data', async () => {
  const adapter = new WordPressContentAdapter(fakeHttpClient(async () => { throw providerTimeout() }), routes)
  await assert.rejects(adapter.listArticles({ page: 1, pageSize: 10 }), (error: unknown) => error instanceof ProviderError && error.kind === 'timeout')
})

test('adapter converts unknown source failures to generic provider unavailable boundary', async () => {
  const adapter = new WordPressContentAdapter(fakeHttpClient(async () => { throw new Error('private upstream detail') }), routes)
  await assert.rejects(adapter.listArticles({ page: 1, pageSize: 10 }), (error: unknown) => (
    error instanceof ProviderError
    && error.kind === 'unavailable'
    && error.message === 'provider_unavailable'
    && !error.message.includes('private upstream detail')
  ))
})

test('adapter maps non-success HTTP status to provider HTTP error boundary', async () => {
  const adapter = new WordPressContentAdapter(fakeHttpClient({ status: 503, data: { internal: 'fixture' } }), routes)
  await assert.rejects(adapter.listArticles({ page: 1, pageSize: 10 }), (error: unknown) => (
    error instanceof ProviderError && error.kind === 'http_error' && error.statusCode === 503
  ))
})
