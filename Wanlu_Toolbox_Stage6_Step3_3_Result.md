# Wanlu Toolbox Stage 6 Step 3.3 Result

## Stage

Stage 6 Step 3.3 - Production Content Provider Composition + Production HTTP Client Foundation

## Status

PASS

Stage 6 Step 3.4 was not entered.

## Baseline

- Branch: `main`
- HEAD: `8f7f4d7df9bc6c8d96d96d8e526cb2aa79023263`
- origin/main ahead: 0
- origin/main behind: 0
- Tracked Mini Program diff: 0
- Staged: 0
- Stage 6 changes remain uncommitted by design

## Production HTTP Client

Implemented `server/src/providers/native-fetch-http-client.ts` using Node.js 24 native `fetch`.

Properties:

- GET only.
- Production default transport is `globalThis.fetch`.
- Transport remains injectable through `FetchLike` for tests.
- Sends only `Accept: application/json`.
- Does not send Cookie, Authorization, Referer, user identity, device data, or credentials.
- Uses `redirect: 'error'`.
- Uses `AbortController` for timeout.
- Default upstream timeout is 7000 ms, intentionally below the Stage 5 client's 10000 ms overall timeout budget.
- Requires `application/json`, including normal charset variants such as `application/json; charset=UTF-8`.
- Invalid JSON maps to the Provider invalid-payload boundary.
- Network failures map to Provider unavailable.
- Timeout/abort maps to Provider timeout.
- Response headers are normalized to lowercase for case-insensitive access.

No HTTP runtime dependency was added. Existing runtime dependencies remain `express` and `sanitize-html`.

## Response Size Boundary

`MAX_UPSTREAM_RESPONSE_BYTES = 2 MiB`.

The production HTTP client checks:

1. `Content-Length` when present.
2. Actual UTF-8 response-body byte length after reading.

Oversized responses map to Provider invalid payload. The limit is intentionally separate from the Step 3.2 HTML sanitizer limits because the upstream WordPress JSON response contains JSON wrapper data in addition to article HTML.

## WordPress Base URL / URL Security

Configuration key:

`WORDPRESS_BASE_URL`

Semantic:

- WordPress site base URL, not the REST root.
- Root URL is supported.
- A fixed installation subpath such as `/blog` is supported.
- The production composition appends the controlled REST path `wp-json/wp/v2/posts`.

Validation:

- HTTPS required.
- HTTP rejected.
- Credentials in URL rejected.
- Query rejected.
- Hash rejected.
- `localhost` and `.localhost` rejected.
- IPv4 loopback / unspecified / private / link-local literals rejected, including 0/8, 10/8, 127/8, 169.254/16, 172.16/12, 192.168/16.
- IPv6 unspecified/loopback, ULA and link-local literals rejected.
- `file:`, `data:`, `javascript:` and malformed URLs rejected.

This is basic SSRF configuration protection only. DNS rebinding and a hostname resolving to a private IP are not claimed to be fully solved in Step 3.3; that remains a deployment/network-security item.

When `CONTENT_PROVIDER_ENABLED=false`, `WORDPRESS_BASE_URL` may be empty and the Server starts normally.

When `CONTENT_PROVIDER_ENABLED=true`, a valid `WORDPRESS_BASE_URL` is mandatory; missing/invalid configuration fails fast.

## WordPress URL Builder

The production HTTP client uses the standard `URL` API rather than string-concatenating untrusted client input.

List path:

`wp-json/wp/v2/posts`

Controlled list query:

- `page`
- `per_page`
- `_embed=true`
- `_fields=id,date_gmt,title,excerpt,_embedded`
- `categories=<numeric-id>` only when an injected category resolver returns a validated positive integer

Detail path:

`wp-json/wp/v2/posts/<validated-wordpress-id>`

Controlled detail query:

- `_embed=true`
- `_fields=id,date_gmt,title,excerpt,content,_embedded`

No Mini Program query value is allowed to become an arbitrary upstream path or arbitrary WordPress query parameter.

## Opaque Article ID Decoder

Implemented `server/src/providers/wordpress/opaque-id.ts`.

Current server implementation format:

`wp:<positive-safe-integer>`

Example:

`wp:1001 -> { provider: 'wordpress', id: 1001 }`

Rejected before HTTP:

- `wp:0`
- `wp:-1`
- `wp:abc`
- `wordpress:1`
- `1`
- traversal-like values
- leading-zero form `wp:01`
- values beyond JavaScript safe integer range

The Mini Program Contract remains opaque-string based and contains no `wp:` parsing logic.

## X-WP-Total / Pagination

`HttpResponse<T>` was minimally extended with an optional normalized headers boundary.

WordPress list responses must provide a valid `X-WP-Total` header.

Validation is strict and case-insensitive:

- `"123"` -> accepted.
- `"0"` -> accepted.
- missing -> rejected.
- `"abc"` -> rejected.
- `"-1"` -> rejected.
- `"1.5"` -> rejected.

The provider never substitutes `items.length` for `total`.

## Category Query Boundary

The Wanlu category string to WordPress numeric category mapping remains intentionally unresolved by default.

Production behavior without a resolver:

- A request with no category proceeds normally.
- A request containing a category fails before HTTP with Provider unavailable rather than guessing a WordPress category ID.

An explicit `WordPressCategoryResolver` dependency boundary exists and is test-covered. When injected, only a validated positive integer can become WordPress `categories=<id>`.

## Production Content Provider Composition

Implemented composition root:

`server/src/composition/content-provider.ts`

Disabled default path:

`CONTENT_PROVIDER_ENABLED=false -> contentProvider=null -> Content API 503 / 10053`

Enabled + valid configuration path:

`NativeFetchHttpClient`
`-> WordPressContentAdapter`
`-> ProductionWordPressContentProvider`
`-> ContentService`
`-> Content Controller`

All enabled-path automated tests inject Fake Fetch. Real business network requests remain zero.

## Content Detail Sanitizer Integration

Detail production code path is structurally fixed as:

`Opaque ID Decoder`
`-> WordPress HTTP request`
`-> Raw Validation`
`-> Mapper`
`-> ContentDetailSanitizerInput.rawHtml`
`-> ServerHtmlSanitizer`
`-> ContentDetail.content`
`-> ContentService`
`-> Controller`

Raw WordPress HTML cannot directly become `ContentDetail.content`.

An integration test returns malicious WordPress HTML containing `script`, event attributes, and an unsafe HTTP image. The final API response passes the Stage 5 Content Detail Validator and contains none of those unsafe constructs.

## Provider / Error Mapping

Frozen Wanlu client codes were preserved; no new client error code was invented.

- WordPress Detail 404 -> provider returns `null` -> `404 / 20004 / content_not_found`.
- Provider timeout -> `503 / 10053 / service_unavailable`.
- Network unavailable -> `503 / 10053 / service_unavailable`.
- Upstream 429 -> `503 / 10053 / service_unavailable`.
- Upstream 5xx -> `503 / 10053 / service_unavailable`.
- Invalid upstream payload / invalid JSON / invalid content type / oversize response -> `500 / 10054 / upstream_error` through Content Service.
- Internal Provider details, AbortError details and upstream bodies are not returned to clients.

## Redirect Policy

Native Fetch is configured with:

`redirect: 'error'`

Unexpected 3xx responses are also rejected at the WordPress Adapter HTTP-status boundary when encountered by injected tests.

## Static / Security Verification

Final Runtime checks confirm:

- `wanluu.com` hardcode: 0
- `api.github.com` hardcode: 0
- OpenAI / DeepSeek / Gemini / Doubao endpoint markers: 0
- `fetch` usage outside `providers/native-fetch-http-client.ts`: 0
- Runtime Fixture imports: 0
- Database connection strings: 0
- Dynamic `eval`: 0
- `new Function`: 0
- High-confidence real credential material: 0
- Direct rawHtml -> ContentDetail.content bypass: 0

GitHub production integration was not modified.
AI remains unimplemented/disabled.
Database, Auth and Server Cache remain unimplemented.

## Environment Template

Safe `.env.example` values:

- `CONTENT_PROVIDER_ENABLED=false`
- `GITHUB_PROVIDER_ENABLED=false`
- `AI_PROVIDER_ENABLED=false`
- `WORDPRESS_BASE_URL=`
- `UPSTREAM_TIMEOUT_MS=7000`

No real `.env` file was created.
No real WordPress domain or credential was added.

## Dependencies

No new Step 3.3 HTTP runtime dependency was added.

Current direct runtime dependencies:

- `express@5.2.1`
- `sanitize-html@2.18.0`

Production HTTP uses Node.js 24 native `fetch`.

## Validation

### npm audit

PASS

- High: 0
- Critical: 0
- Total vulnerabilities: 0

### npm ci

PASS

- 102 packages installed
- 103 packages audited
- 0 vulnerabilities

### Server Build

PASS

`npm run build`

TypeScript `strict=true` remains enabled.

### Server Test

PASS

`177 / 177 PASS`

- fail: 0
- cancelled: 0
- skipped: 0
- todo: 0

The test suite includes Production HttpClient, URL security, SSRF basic validation, timeout/abort, redirect policy, JSON/content-type handling, response-size limits, opaque IDs, X-WP-Total, category boundary, production composition, sanitizer integration, error mapping, and Fake Fetch integration.

## Root Regression

- `npm run test-stage5`: PASS - 813 / 813
- `npm run test:stage4`: PASS - 733 / 733
- `npm run test:stage4:static`: PASS - 20 / 20
- `npm run test:stage3`: PASS
- `npm run check`: PASS
- ERROR = 0
- WARNING = 0

## Real Business Network

- Real WordPress Request: 0
- Real wanluu.com Request: 0
- Real GitHub Request: 0
- Real AI Request: 0

Fake Fetch and local loopback API test traffic are test-only and are not real business-provider requests.

## Runtime Cleanup

- Remaining WebCodex jobs: 0
- Port 3000 listeners: 0
- No test-created Server process remains running

## Remote / Provider Defaults

- development Remote: false
- production Remote: false
- `REMOTE_API_ENABLED=false`
- Production Content Provider default: disabled
- Production Fake Data: 0

## Git

- HEAD unchanged: `8f7f4d7df9bc6c8d96d96d8e526cb2aa79023263`
- Tracked Mini Program diff: 0
- Staged: 0
- `git add`: not executed
- `git commit`: not executed
- `git push`: not executed

## Stop Point

Stage 6 Step 3.3: PASS

Stage 6 Step 3.4: NOT ENTERED
