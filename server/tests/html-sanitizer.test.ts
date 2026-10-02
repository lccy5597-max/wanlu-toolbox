import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { HttpClient, HttpGetRequest, HttpResponse } from '../src/providers/http-client'
import { WordPressContentAdapter } from '../src/providers/wordpress/adapter'
import { createSanitizedContentDetail } from '../src/providers/wordpress/detail-pipeline'
import {
  ALLOWED_HTML_ATTRIBUTES,
  ALLOWED_HTML_TAGS,
  HtmlSanitizationError,
  MAX_RAW_HTML_BYTES,
  MAX_SANITIZED_HTML_BYTES,
  serverHtmlSanitizer,
} from '../src/security/html-sanitizer'
import { safeRichHtmlFixture } from './fixtures/safe-rich-html'
import { wordpressDetailPostFixture } from './fixtures/wordpress'

const stage5Schema = require('../../utils/api-schema.js') as {
  validateContentDetail: (value: unknown) => { ok: boolean; errors: string[] }
}

const sanitize = (html: string): string => serverHtmlSanitizer.sanitize(html)

test('sanitizer policy is explicit and excludes active-content tags and anchors', () => {
  for (const tag of ['script', 'iframe', 'object', 'embed', 'form', 'style', 'a']) {
    assert.equal(ALLOWED_HTML_TAGS.includes(tag), false, tag)
  }
  assert.deepEqual(ALLOWED_HTML_ATTRIBUTES.img, ['src', 'alt', 'title'])
})

for (const [name, input, expected] of [
  ['normal paragraph', '<p>Hello world.</p>', '<p>Hello world.</p>'],
  ['allowed heading', '<h2>Heading</h2>', '<h2>Heading</h2>'],
  ['strong and em', '<p><strong>Strong</strong> <em>Em</em></p>', '<p><strong>Strong</strong> <em>Em</em></p>'],
  ['list', '<ul><li>One</li><li>Two</li></ul>', '<ul><li>One</li><li>Two</li></ul>'],
] as const) {
  test(`safe rich HTML preserves ${name}`, () => {
    assert.equal(sanitize(input), expected)
  })
}

test('safe HTTPS image is preserved', () => {
  const output = sanitize('<img src="https://cdn.example.com/a.webp" alt="A" title="T">')
  assert.match(output, /<img\b/i)
  assert.match(output, /src="https:\/\/cdn\.example\.com\/a\.webp"/i)
})

test('safe figure and figcaption structure is preserved without extra attributes', () => {
  const output = sanitize('<figure><img src="https://example.invalid/a.jpg"><figcaption>Caption</figcaption></figure>')
  assert.equal(output, '<figure><img src="https://example.invalid/a.jpg" /><figcaption>Caption</figcaption></figure>')
})

test('figure and figcaption do not expand the attribute or active-content attack surface', () => {
  const output = sanitize('<figure class="wp-block-image" style="color:red" onclick="alert(1)"><img src="https://example.invalid/a.jpg" onerror="alert(2)"><figcaption class="caption" onclick="alert(3)">Caption<script>alert(4)</script><a href="javascript:alert(5)">link</a></figcaption></figure>')
  assert.match(output, /<figure><img src="https:\/\/example\.invalid\/a\.jpg" \/><figcaption>Captionlink<\/figcaption><\/figure>/)
  assert.doesNotMatch(output, /\s(?:class|style|onclick|onerror)=|<script\b|javascript:|<a\b|href=/i)
})

for (const [name, src] of [
  ['HTTP image', 'http://example.com/a.jpg'],
  ['javascript image', 'javascript:alert(1)'],
  ['data image', 'data:image/png;base64,AAAA'],
  ['file image', 'file:///tmp/a.png'],
  ['blob image', 'blob:https://example.com/id'],
  ['protocol-relative image', '//example.com/a.png'],
  ['relative image', '/a.png'],
  ['entity-obfuscated image scheme', 'javascript&#58;alert(1)'],
  ['URL-encoded dangerous image scheme', 'javascript%3Aalert(1)'],
] as const) {
  test(`${name} is removed`, () => {
    const output = sanitize(`<p>before<img src="${src}" alt="bad">after</p>`)
    assert.doesNotMatch(output, /<img\b/i)
    assert.match(output, /before/)
    assert.match(output, /after/)
  })
}

test('safe HTTPS anchor is converted to non-clickable text', () => {
  const output = sanitize('<p>Read <a href="https://example.com/x" title="x">source</a>.</p>')
  assert.doesNotMatch(output, /<a\b|href=/i)
  assert.match(output, /source/)
})

for (const href of [
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  'javascript&#58;alert(1)',
  'java\nscript:alert(1)',
  'java\tscript:alert(1)',
  'javascript%3Aalert(1)',
  'data:text/html,x',
  'file:///tmp/a',
] as const) {
  test(`unsafe/obfuscated anchor ${JSON.stringify(href)} is not clickable`, () => {
    const output = sanitize(`<a href="${href}">link</a>`)
    assert.doesNotMatch(output, /<a\b|href=|javascript:|data:|file:/i)
    assert.match(output, /link/)
  })
}

for (const tag of ['script', 'iframe', 'object', 'embed', 'form'] as const) {
  test(`${tag} tag is blocked`, () => {
    const output = sanitize(`<p>safe</p><${tag}>danger</${tag}><p>end</p>`)
    assert.doesNotMatch(output, new RegExp(`<\\/?${tag}\\b`, 'i'))
  })
}

for (const attribute of ['onclick', 'onerror', 'onload', 'ONMOUSEOVER'] as const) {
  test(`${attribute} event attribute is blocked`, () => {
    const output = sanitize(`<p ${attribute}="alert(1)">text<img src="https://example.com/a.jpg" ${attribute}="alert(2)"></p>`)
    assert.doesNotMatch(output, /\son[a-z]+\s*=/i)
  })
}

test('style and class attributes are removed', () => {
  const output = sanitize('<p style="background:url(javascript:alert(1))" class="wp-x">text</p>')
  assert.doesNotMatch(output, /\sstyle=|\sclass=/i)
})

test('nested malicious HTML is reduced to safe static HTML', () => {
  const output = sanitize('<div><p>safe<script><img src=x onerror=alert(1)></script><strong onclick="x()">bold</strong></p></div>')
  assert.match(output, /<div><p>safe/)
  assert.match(output, /<strong>bold<\/strong>/)
  assert.doesNotMatch(output, /script|onerror|onclick|javascript:/i)
})

test('malformed HTML is safely normalized without throwing', () => {
  const output = sanitize('<div><p>one<strong>two</div><img src="javascript:alert(1)">')
  assert.match(output, /one/)
  assert.match(output, /two/)
  assert.doesNotMatch(output, /javascript:|<img\b/i)
})

test('empty HTML is allowed by the frozen Stage 5 detail contract', () => {
  assert.equal(sanitize(''), '')
})

test('danger-only HTML sanitizes to empty content', () => {
  assert.equal(sanitize('<script>alert(1)</script>'), '')
})

test('raw input larger than 512 KiB is rejected before sanitization', () => {
  const input = 'a'.repeat(MAX_RAW_HTML_BYTES + 1)
  assert.throws(() => sanitize(input), (error: unknown) => (
    error instanceof HtmlSanitizationError && error.kind === 'input_too_large'
  ))
})

test('sanitized output larger than 256 KiB is rejected', () => {
  const input = `<p>${'a'.repeat(MAX_SANITIZED_HTML_BYTES + 1)}</p>`
  assert.throws(() => sanitize(input), (error: unknown) => (
    error instanceof HtmlSanitizationError && error.kind === 'output_too_large'
  ))
})

test('safe rich regression fixture remains structured and readable but link is non-clickable', () => {
  const output = sanitize(safeRichHtmlFixture)
  assert.match(output, /<h2>Fixture Article<\/h2>/)
  assert.match(output, /<strong>strong<\/strong>/)
  assert.match(output, /<ul><li>First item<\/li><li>Second item<\/li><\/ul>/)
  assert.match(output, /<img\b[^>]*https:\/\/cdn\.example\.com\/test\/article\.webp/i)
  assert.match(output, /the source article/)
  assert.doesNotMatch(output, /<a\b|href=/i)
})

test('WordPress fixture detail pipeline produces Stage 5-valid sanitized ContentDetail', async () => {
  const fakeHttpClient: HttpClient = {
    async get<T>(_request: HttpGetRequest): Promise<HttpResponse<T>> {
      return { status: 200, data: wordpressDetailPostFixture as T }
    },
  }
  const adapter = new WordPressContentAdapter(fakeHttpClient, {
    listPath: '/fixture/posts',
    detailPath: (wordpressId) => `/fixture/posts/${wordpressId}`,
  })
  const sanitizerInput = await adapter.getArticleDetail(1001)
  const detail = createSanitizedContentDetail(sanitizerInput)
  const validation = stage5Schema.validateContentDetail(detail)
  assert.equal(validation.ok, true, validation.errors.join(','))
  assert.equal(detail.id, 'wp:1001')
  assert.equal(detail.content, '<p>Raw <strong>WordPress</strong> HTML.</p>')
  assert.equal(Object.prototype.hasOwnProperty.call(detail, 'rawHtml'), false)
})

test('sanitizer errors contain no raw HTML payload', () => {
  const raw = `<p>${'secret-marker'.repeat(60000)}</p>`
  assert.throws(() => sanitize(raw), (error: unknown) => (
    error instanceof HtmlSanitizationError && !error.message.includes('secret-marker')
  ))
})
