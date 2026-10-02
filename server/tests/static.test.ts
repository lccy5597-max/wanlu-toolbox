import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { API_PREFIX, API_VERSION } from '../src/constants/api'
import { loadServerConfig } from '../src/config/environment'

const SERVER_ROOT = path.resolve(__dirname, '..')
const SOURCE_ROOT = path.join(SERVER_ROOT, 'src')

const listRuntimeFiles = (directory: string): string[] => fs.readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return listRuntimeFiles(fullPath)
    return entry.isFile() && entry.name.endsWith('.ts') ? [fullPath] : []
  })

const runtimeFiles = listRuntimeFiles(SOURCE_ROOT)
const runtimeSource = runtimeFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n')

test('runtime source contains no hard-coded real provider domains', () => {
  for (const marker of ['api.github.com', 'wanluu.com', 'api.openai.com', 'deepseek', 'gemini', 'doubao']) {
    assert.equal(runtimeSource.toLowerCase().includes(marker.toLowerCase()), false, marker)
  }
})

test('native fetch is isolated to the production HTTP client', () => {
  const filesWithFetch = runtimeFiles
    .filter((file) => /\bglobalThis\.fetch\b|\bfetch\s*\(/.test(fs.readFileSync(file, 'utf8')))
    .map((file) => path.relative(SOURCE_ROOT, file).replace(/\\/g, '/'))
  assert.deepEqual(filesWithFetch, ['providers/native-fetch-http-client.ts'])
  assert.doesNotMatch(runtimeSource, /\baxios\b|XMLHttpRequest/)
})

test('client-controlled request fields cannot become an upstream base URL or host source', () => {
  const configSource = fs.readFileSync(path.join(SOURCE_ROOT, 'config', 'environment.ts'), 'utf8')
  const compositionSource = fs.readFileSync(path.join(SOURCE_ROOT, 'composition', 'content-provider.ts'), 'utf8')
  const requestSource = fs.readFileSync(path.join(SOURCE_ROOT, 'schemas', 'requests.ts'), 'utf8')
  assert.match(compositionSource, /baseUrl:\s*config\.wordpressBaseUrl/)
  assert.match(configSource, /WORDPRESS_BASE_URL/)
  assert.doesNotMatch(requestSource, /wordpressBaseUrl|WORDPRESS_BASE_URL/)
})

test('timeout timer cleanup remains in a finally block', () => {
  const source = fs.readFileSync(path.join(SOURCE_ROOT, 'providers', 'native-fetch-http-client.ts'), 'utf8')
  assert.match(source, /finally\s*\{\s*clearTimeout\(timer\)\s*\}/s)
})

test('runtime source contains no database connection string', () => {
  assert.doesNotMatch(runtimeSource, /(?:mysql|postgres(?:ql)?|mongodb|redis):\/\//i)
})

test('runtime source contains no dynamic code execution', () => {
  assert.doesNotMatch(runtimeSource, /\beval\s*\(|\bnew\s+Function\b/)
})

test('runtime source contains no high-confidence real credential material', () => {
  assert.doesNotMatch(runtimeSource, /ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA )?PRIVATE KEY-----/)
})

test('production server source does not depend on mini program runtime contract files', () => {
  assert.doesNotMatch(runtimeSource, /utils\/api-schema|utils\/api-contract|config\/api-endpoints/)
})

test('production runtime contains no test fixture markers', () => {
  assert.doesNotMatch(runtimeSource, /Test Article|example-repo|stage5-api-contract/i)
  assert.doesNotMatch(runtimeSource, /tests[\\/]fixtures|fixtures[\\/]wordpress/i)
})

test('production runtime contains no raw HTML to ContentDetail content bypass', () => {
  assert.doesNotMatch(runtimeSource, /content\s*:\s*(?:input\.)?rawHtml\b/)
})

test('production start command runs compiled JavaScript without TypeScript runtime', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(SERVER_ROOT, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>
  }
  assert.equal(packageJson.scripts?.start, 'node dist/server.js')
  assert.doesNotMatch(packageJson.scripts?.start || '', /tsx|ts-node|typescript/i)
})

test('server entrypoint binds configured loopback host and closes on SIGTERM or SIGINT', () => {
  const source = fs.readFileSync(path.join(SOURCE_ROOT, 'server.ts'), 'utf8')
  assert.match(source, /app\.listen\(config\.port,\s*config\.host/)
  assert.match(source, /process\.once\('SIGTERM'/)
  assert.match(source, /process\.once\('SIGINT'/)
  assert.match(source, /server\.close\(/)
  assert.doesNotMatch(source, /process\.exit\(0\)/)
})

test('TypeScript build emits dist runtime without source maps enabled', () => {
  const tsconfig = JSON.parse(fs.readFileSync(path.join(SERVER_ROOT, 'tsconfig.json'), 'utf8')) as {
    compilerOptions?: Record<string, unknown>
  }
  assert.equal(tsconfig.compilerOptions?.outDir, 'dist')
  assert.notEqual(tsconfig.compilerOptions?.sourceMap, true)
})

test('server .env is absent and .env.example exists', () => {
  assert.equal(fs.existsSync(path.join(SERVER_ROOT, '.env')), false)
  assert.equal(fs.existsSync(path.join(SERVER_ROOT, '.env.example')), true)
})

test('.env.example keeps providers disabled and API version frozen', () => {
  const template = fs.readFileSync(path.join(SERVER_ROOT, '.env.example'), 'utf8')
  assert.match(template, /^API_VERSION=v1$/m)
  assert.match(template, /^CONTENT_PROVIDER_ENABLED=false$/m)
  assert.match(template, /^GITHUB_PROVIDER_ENABLED=false$/m)
  assert.match(template, /^AI_PROVIDER_ENABLED=false$/m)
  assert.match(template, /^WORDPRESS_BASE_URL=$/m)
  assert.match(template, /^UPSTREAM_TIMEOUT_MS=7000$/m)
})

test('server .gitignore protects local runtime artifacts', () => {
  const ignore = fs.readFileSync(path.join(SERVER_ROOT, '.gitignore'), 'utf8')
  assert.match(ignore, /^node_modules\/$/m)
  assert.match(ignore, /^\.env$/m)
  assert.match(ignore, /^dist\/$/m)
  assert.match(ignore, /^coverage\/$/m)
})

test('provider defaults are disabled in production config loader', () => {
  const config = loadServerConfig({})
  assert.equal(config.contentProviderEnabled, false)
  assert.equal(config.githubProviderEnabled, false)
  assert.equal(config.aiProviderEnabled, false)
})

test('API version and route prefix are frozen to v1', () => {
  assert.equal(API_VERSION, 'v1')
  assert.equal(API_PREFIX, '/api/v1')
  assert.equal(loadServerConfig({}).apiVersion, 'v1')
})
