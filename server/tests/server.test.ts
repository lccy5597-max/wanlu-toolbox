import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import type { AddressInfo } from 'node:net'
import { request as httpRequest, type Server } from 'node:http'
import type { Express } from 'express'
import { createApp } from '../src/app'
import { loadServerConfig } from '../src/config/environment'
import { API_VERSION, BUSINESS_ERROR_CODES } from '../src/constants/api'
import type {
  ContentDetail,
  ContentProvider,
  ContentSummary,
  GithubProvider,
  GithubRankingItem,
} from '../src/providers/contracts'
import type { ContentListRequest, GithubRankingRequest } from '../src/schemas/requests'
import { normalizeArticleId } from '../src/schemas/requests'

const stage5Schema = require('../../utils/api-schema.js') as {
  validateApiResponse: (value: unknown) => { ok: boolean; errors: string[] }
  validateContentDetail: (value: unknown) => { ok: boolean; errors: string[] }
  validateContentSummary: (value: unknown) => { ok: boolean; errors: string[] }
  validateGithubRankingResponse: (
    data: unknown,
    pagination: unknown,
    options?: { period?: string },
  ) => { ok: boolean; errors: string[] }
  validateHealthData: (value: unknown) => { ok: boolean; errors: string[] }
  validatePagination: (value: unknown, options?: { maxPageSize?: number }) => { ok: boolean; errors: string[] }
}

const stage5Fixtures = require('../../scripts/fixtures/stage5-api-contract.js') as {
  articleSummary: ContentSummary
  articleDetail: ContentDetail
  githubItem: GithubRankingItem
  githubItemSecond: GithubRankingItem
}

const config = loadServerConfig({
  NODE_ENV: 'test',
  PORT: '3000',
  API_VERSION: 'v1',
  CONTENT_PROVIDER_ENABLED: 'false',
  GITHUB_PROVIDER_ENABLED: 'false',
  AI_PROVIDER_ENABLED: 'false',
  UPSTREAM_TIMEOUT_MS: '10000',
})

const contentListRequests: ContentListRequest[] = []
const contentDetailIds: string[] = []
const githubRequests: GithubRankingRequest[] = []

const fakeContentProvider: ContentProvider = {
  async listArticles(request) {
    contentListRequests.push(request)
    return { items: [stage5Fixtures.articleSummary], total: 1 }
  },
  async getArticleDetail(id) {
    contentDetailIds.push(id)
    if (id === 'missing') return null
    return { ...stage5Fixtures.articleDetail, id }
  },
}

const fakeGithubProvider: GithubProvider = {
  async getRankings(request) {
    githubRequests.push(request)
    return { items: [stage5Fixtures.githubItem, stage5Fixtures.githubItemSecond], total: 2 }
  },
}

const throwingContentProvider: ContentProvider = {
  async listArticles() {
    throw new Error('internal failure C:\\private\\server.env SECRET_VALUE=test-only-marker')
  },
  async getArticleDetail() {
    throw new Error('internal detail failure')
  },
}

const defaultApp = createApp(config)
const fakeApp = createApp(config, {
  contentProvider: fakeContentProvider,
  githubProvider: fakeGithubProvider,
})
const throwingApp = createApp(config, { contentProvider: throwingContentProvider })

interface RunningApp {
  readonly server: Server
  readonly baseUrl: string
}

const startApp = async (app: Express): Promise<RunningApp> => {
  const server = await new Promise<Server>((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
    instance.once('error', reject)
  })
  const address = server.address() as AddressInfo
  return { server, baseUrl: `http://127.0.0.1:${address.port}` }
}

const stopApp = async (server: Server): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

let defaultRunning: RunningApp
let fakeRunning: RunningApp
let throwingRunning: RunningApp
let externalNetworkAttempts = 0

before(async () => {
  defaultRunning = await startApp(defaultApp)
  fakeRunning = await startApp(fakeApp)
  throwingRunning = await startApp(throwingApp)
})

after(async () => {
  await Promise.all([
    stopApp(defaultRunning.server),
    stopApp(fakeRunning.server),
    stopApp(throwingRunning.server),
  ])
})

const getJson = async (
  baseUrl: string,
  path: string,
): Promise<{ status: number; body: Record<string, any>; contentType: string }> => {
  const url = new URL(`${baseUrl}${path}`)
  if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
    externalNetworkAttempts += 1
    throw new Error(`external_network_blocked:${url.hostname}`)
  }

  return new Promise((resolve, reject) => {
    const request = httpRequest(url, { method: 'GET' }, (response) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => chunks.push(chunk))
      response.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, any>
          resolve({
            status: response.statusCode || 0,
            body,
            contentType: String(response.headers['content-type'] || ''),
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

test('Express app can be created', () => {
  assert.equal(typeof defaultApp, 'function')
})

test('server can create an app without .env or secrets', () => {
  assert.equal(typeof createApp(loadServerConfig({})), 'function')
})

test('provider flags default to disabled', () => {
  const defaults = loadServerConfig({})
  assert.equal(defaults.contentProviderEnabled, false)
  assert.equal(defaults.githubProviderEnabled, false)
  assert.equal(defaults.aiProviderEnabled, false)
})

test('boolean environment parser handles true and false safely', () => {
  assert.equal(loadServerConfig({
    CONTENT_PROVIDER_ENABLED: 'true',
    WORDPRESS_BASE_URL: 'https://example.invalid',
  }).contentProviderEnabled, true)
  assert.equal(loadServerConfig({ CONTENT_PROVIDER_ENABLED: 'false' }).contentProviderEnabled, false)
})

test('invalid boolean environment values fail safe to false', () => {
  assert.equal(loadServerConfig({ CONTENT_PROVIDER_ENABLED: 'yes' }).contentProviderEnabled, false)
  assert.equal(loadServerConfig({ GITHUB_PROVIDER_ENABLED: '1' }).githubProviderEnabled, false)
})

test('API version is locked to v1', () => {
  assert.equal(API_VERSION, 'v1')
  assert.equal(loadServerConfig({}).apiVersion, 'v1')
  assert.throws(() => loadServerConfig({ API_VERSION: 'v2' }), /unsupported_api_version/)
})

test('port defaults to 3000 and accepts 65535', () => {
  assert.equal(loadServerConfig({}).port, 3000)
  assert.equal(loadServerConfig({ PORT: '65535' }).port, 65535)
})

for (const value of ['0', '-1', '65536', 'NaN']) {
  test(`invalid port ${value} is rejected`, () => {
    assert.throws(() => loadServerConfig({ PORT: value }), /invalid_port/)
  })
}

test('upstream timeout defaults safely and accepts positive integers', () => {
  assert.equal(loadServerConfig({}).upstreamTimeoutMs, 7000)
  assert.equal(loadServerConfig({ UPSTREAM_TIMEOUT_MS: '2500' }).upstreamTimeoutMs, 2500)
})

for (const value of ['0', '-1', 'NaN']) {
  test(`invalid upstream timeout ${value} is rejected`, () => {
    assert.throws(() => loadServerConfig({ UPSTREAM_TIMEOUT_MS: value }), /invalid_upstream_timeout_ms/)
  })
}

test('GET /api/v1/health returns frozen Stage 5 contract', async () => {
  const result = await getJson(defaultRunning.baseUrl, '/api/v1/health')
  assert.equal(result.status, 200)
  assert.equal(stage5Schema.validateApiResponse(result.body).ok, true)
  assert.equal(stage5Schema.validateHealthData(result.body.data).ok, true)
  assert.deepEqual(Object.keys(result.body).sort(), ['code', 'data', 'message', 'meta'])
  assert.equal(result.body.data.status, 'ok')
  assert.equal(result.body.data.apiVersion, 'v1')
})

test('content list success passes Stage 5 response validators', async () => {
  const result = await getJson(fakeRunning.baseUrl, '/api/v1/content/articles')
  assert.equal(result.status, 200)
  assert.equal(stage5Schema.validateApiResponse(result.body).ok, true)
  assert.equal(Array.isArray(result.body.data.items), true)
  assert.equal(result.body.data.items.every((item: unknown) => stage5Schema.validateContentSummary(item).ok), true)
  assert.equal(stage5Schema.validatePagination(result.body.meta.pagination, { maxPageSize: 20 }).ok, true)
  assert.deepEqual(result.body.meta.pagination, { page: 1, pageSize: 10, total: 1, hasMore: false })
})

test('content list defaults and category follow frozen request contract', async () => {
  await getJson(fakeRunning.baseUrl, '/api/v1/content/articles?category=%20AI%E6%95%99%E7%A8%8B%20')
  assert.deepEqual(contentListRequests.at(-1), { page: 1, pageSize: 10, category: 'AI教程' })
})

test('content list accepts minimum pageSize 1', async () => {
  const result = await getJson(fakeRunning.baseUrl, '/api/v1/content/articles?page=1&pageSize=1')
  assert.equal(result.status, 200)
  assert.deepEqual(contentListRequests.at(-1), { page: 1, pageSize: 1 })
})

test('content list accepts maximum pageSize 20', async () => {
  const result = await getJson(fakeRunning.baseUrl, '/api/v1/content/articles?page=2&pageSize=20')
  assert.equal(result.status, 200)
  assert.deepEqual(contentListRequests.at(-1), { page: 2, pageSize: 20 })
})

test('content detail success preserves opaque encoded ID and passes Stage 5 schema', async () => {
  const opaqueId = 'wp/100 1'
  const result = await getJson(fakeRunning.baseUrl, `/api/v1/content/articles/${encodeURIComponent(opaqueId)}`)
  assert.equal(result.status, 200)
  assert.equal(contentDetailIds.at(-1), opaqueId)
  assert.equal(result.body.data.id, opaqueId)
  assert.equal(stage5Schema.validateContentDetail(result.body.data).ok, true)
})

test('content detail null maps to frozen CONTENT_NOT_FOUND', async () => {
  const result = await getJson(fakeRunning.baseUrl, '/api/v1/content/articles/missing')
  assert.equal(result.status, 404)
  assert.deepEqual(result.body, {
    code: BUSINESS_ERROR_CODES.CONTENT_NOT_FOUND,
    message: 'content_not_found',
    data: null,
    meta: {},
  })
})

for (const period of ['daily', 'weekly', 'all'] as const) {
  test(`GitHub ${period} success passes Stage 5 ranking validator`, async () => {
    const result = await getJson(fakeRunning.baseUrl, `/api/v1/github/rankings?period=${period}`)
    assert.equal(result.status, 200)
    assert.equal(result.body.data.period, period)
    assert.equal(stage5Schema.validateGithubRankingResponse(
      result.body.data,
      result.body.meta.pagination,
      { period },
    ).ok, true)
    assert.deepEqual(githubRequests.at(-1), { period, page: 1, pageSize: 5 })
  })
}

test('GitHub pagination accepts minimum pageSize 1', async () => {
  const result = await getJson(fakeRunning.baseUrl, '/api/v1/github/rankings?period=daily&page=2&pageSize=1')
  assert.equal(result.status, 200)
  assert.deepEqual(githubRequests.at(-1), { period: 'daily', page: 2, pageSize: 1 })
})

test('GitHub pagination accepts maximum pageSize 10', async () => {
  const result = await getJson(fakeRunning.baseUrl, '/api/v1/github/rankings?period=daily&page=1&pageSize=10')
  assert.equal(result.status, 200)
  assert.deepEqual(githubRequests.at(-1), { period: 'daily', page: 1, pageSize: 10 })
})

test('GitHub period is required', async () => {
  const result = await getJson(fakeRunning.baseUrl, '/api/v1/github/rankings')
  assert.equal(result.status, 400)
  assert.equal(result.body.code, BUSINESS_ERROR_CODES.INVALID_REQUEST)
})

test('invalid content page maps to 400 / 10001', async () => {
  const result = await getJson(defaultRunning.baseUrl, '/api/v1/content/articles?page=0')
  assert.equal(result.status, 400)
  assert.equal(result.body.code, BUSINESS_ERROR_CODES.INVALID_REQUEST)
  assert.equal(result.body.message, 'invalid_request')
})

test('invalid content pageSize maps to 400 / 10001', async () => {
  const result = await getJson(defaultRunning.baseUrl, '/api/v1/content/articles?pageSize=21')
  assert.equal(result.status, 400)
  assert.equal(result.body.code, BUSINESS_ERROR_CODES.INVALID_REQUEST)
})

test('invalid GitHub period maps to 400 / 10001', async () => {
  const result = await getJson(defaultRunning.baseUrl, '/api/v1/github/rankings?period=monthly')
  assert.equal(result.status, 400)
  assert.equal(result.body.code, BUSINESS_ERROR_CODES.INVALID_REQUEST)
})

test('invalid GitHub page maps to 400 / 10001', async () => {
  const result = await getJson(defaultRunning.baseUrl, '/api/v1/github/rankings?period=daily&page=0')
  assert.equal(result.status, 400)
  assert.equal(result.body.code, BUSINESS_ERROR_CODES.INVALID_REQUEST)
})

test('invalid GitHub pageSize maps to 400 / 10001', async () => {
  const result = await getJson(defaultRunning.baseUrl, '/api/v1/github/rankings?period=daily&pageSize=11')
  assert.equal(result.status, 400)
  assert.equal(result.body.code, BUSINESS_ERROR_CODES.INVALID_REQUEST)
})

test('provider disabled maps to 503 / 10053', async () => {
  const content = await getJson(defaultRunning.baseUrl, '/api/v1/content/articles')
  const contentDetail = await getJson(defaultRunning.baseUrl, '/api/v1/content/articles/wp%3A1001')
  const github = await getJson(defaultRunning.baseUrl, '/api/v1/github/rankings?period=daily')
  for (const result of [content, contentDetail, github]) {
    assert.equal(result.status, 503)
    assert.equal(result.body.code, BUSINESS_ERROR_CODES.SERVICE_UNAVAILABLE)
    assert.equal(result.body.message, 'service_unavailable')
  }
})

test('unknown /api/v1 route maps to JSON 404 / 10004', async () => {
  const result = await getJson(defaultRunning.baseUrl, '/api/v1/does-not-exist')
  assert.equal(result.status, 404)
  assert.match(result.contentType, /application\/json/i)
  assert.deepEqual(result.body, {
    code: BUSINESS_ERROR_CODES.RESOURCE_NOT_FOUND,
    message: 'resource_not_found',
    data: null,
    meta: {},
  })
})

test('non-API unknown route is also JSON-only 404', async () => {
  const result = await getJson(defaultRunning.baseUrl, '/unknown')
  assert.equal(result.status, 404)
  assert.match(result.contentType, /application\/json/i)
  assert.equal(result.body.code, BUSINESS_ERROR_CODES.RESOURCE_NOT_FOUND)
})

test('unknown provider exception maps to safe 500 / 10054 without leakage', async () => {
  const result = await getJson(throwingRunning.baseUrl, '/api/v1/content/articles')
  const serialized = JSON.stringify(result.body)
  assert.equal(result.status, 500)
  assert.deepEqual(result.body, {
    code: BUSINESS_ERROR_CODES.UPSTREAM_ERROR,
    message: 'upstream_error',
    data: null,
    meta: {},
  })
  assert.doesNotMatch(serialized, /private|SECRET_VALUE|stack|server\.env/i)
})

test('article ID normalization remains opaque', () => {
  assert.equal(normalizeArticleId('wp/100 1'), 'wp/100 1')
  assert.equal(normalizeArticleId('article-A/B C'), 'article-A/B C')
})

test('test network guard observed zero external business requests', () => {
  assert.equal(externalNetworkAttempts, 0)
})
