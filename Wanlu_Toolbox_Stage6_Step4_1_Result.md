# Wanlu Toolbox Stage 6 Step 4.1 Result

## Stage

Stage 6 Step 4.1 - Real WordPress Read-only Discovery + Contract Verification

## Status

PASS

Stage 6 Step 4.2 was not entered.
Server deployment was not executed.
Mini Program Remote was not enabled.

## Baseline

- Branch: `main`
- HEAD: `8f7f4d7df9bc6c8d96d96d8e526cb2aa79023263`
- origin/main ahead: 0
- origin/main behind: 0
- Tracked Mini Program diff before/after: 0
- Staged: 0
- Stage 6 work remains uncommitted by design

## WordPress REST Discovery

Canonical Site Base verified for this integration:

`https://wanluu.com`

Discovery result:

- Site root HEAD: HTTP 200, `text/html; charset=UTF-8`
- REST root HEAD: HTTP 200, `application/json; charset=UTF-8`
- REST root GET: HTTP 200, `application/json; charset=UTF-8`
- Site root redirect: none observed
- `/wp-json/` redirect: none observed
- WordPress REST namespaces observed: 6
- `wp/v2`: present
- Public REST access for tested endpoints: no authentication required

No WordPress login, admin page, application password, token, cookie credential, user enumeration, plugin enumeration, theme enumeration, security scan, directory brute force, or port scan was performed.

## Real List Endpoint

Endpoint family:

`GET /wp-json/wp/v2/posts`

Low-volume pagination verified with `page=1`, `per_page=1` and `per_page=2`.

Observed:

- HTTP 200
- Content-Type: `application/json; charset=UTF-8`
- `X-WP-Total`: `172`
- `X-WP-TotalPages`: `86` for the `per_page=2` verification request
- `X-WP-Total` is a valid non-negative integer
- normal pagination behavior confirmed

The totals above are a point-in-time observation during Step 4.1 and are not persisted as application configuration.

## Real List Raw Shape

The first real post verified the Adapter-required base fields:

- `id`: number
- `date_gmt`: string
- `title.rendered`: string
- `excerpt.rendered`: string
- `_embedded`: object when requested without the restrictive `_fields` combination

No real title/excerpt text was copied into this Result.

## Real `_embed` / `_fields` Finding

A real WordPress compatibility difference was found and classified as a small Query/Adapter issue.

Before the fix, the List Builder used:

`_embed=true`

with:

`_fields=id,date_gmt,title,excerpt,_embedded`

The live List endpoint returned HTTP 200 and correct pagination headers, but `_embedded` was omitted. This caused the current real List payload to fail the existing Adapter because category/media information was unavailable.

A single targeted read-only diagnostic GET verified that adding `_links` restores the embed contract:

`_fields=id,date_gmt,title,excerpt,_links,_embedded`

With that field set, the live response contained:

- `_links`
- `_embedded`
- `wp:featuredmedia`
- `wp:term`

This was classified as the instruction-defined `_fields / _embed Query` compatibility difference. It does not change the frozen Stage 5 client Contract.

## Minimal Runtime Fix

Modified:

- `server/src/providers/wordpress/adapter.ts`

List `_fields` changed from:

`id,date_gmt,title,excerpt,_embedded`

to:

`id,date_gmt,title,excerpt,_links,_embedded`

No other Production Runtime behavior was changed.

Synthetic regression coverage was updated/added in:

- `server/tests/wordpress-adapter.test.ts`
- `server/tests/production-content-provider.test.ts`

No real article content was copied into tests.

## Real Detail Endpoint

A real Post ID returned by the List endpoint was used only in memory.

Detail endpoint family:

`GET /wp-json/wp/v2/posts/<id>`

Observed:

- HTTP 200
- `id`: number
- `date_gmt`: string
- `title.rendered`: string
- `excerpt.rendered`: string
- `content.rendered`: string
- `_embedded`: object

The selected real detail `content.rendered` was not copied into this Result or any fixture.

Observed raw detail HTML size for the selected post:

- 14,622 UTF-8 bytes

Sanitized output size:

- 13,766 UTF-8 bytes

## Featured Media Shape

Real embedded featured-media data was observed in the small sample.

Observed compatibility:

- `wp:featuredmedia`: array
- `source_url`: string
- observed featured-media `source_url`: HTTPS
- observed unsafe/non-HTTPS featured-media URL count: 0

The media URL itself is not copied into this Result.

## Category Term Shape

Real `wp:term` data was observed.

Category terms were identified by:

`taxonomy = category`

Observed category-term metadata shape needed for future mapping:

- `id`: integer
- `name`: string
- `slug`: string
- `taxonomy`: `category`

The implementation does not assume the first term group is the category group; taxonomy is used to distinguish it.

## Real Category Discovery

A small read-only request was made to:

`GET /wp-json/wp/v2/categories`

with a small `per_page=5` field-limited query.

Observed:

- HTTP 200
- `X-WP-Total`: `18`
- returned sample item count: 5
- each sampled item exposed valid `id / name / slug` structure

No category was created or modified.

Real category metadata confirms that a future server-side Wanlu category string -> WordPress numeric category-ID resolver is feasible.

Actual mapping configuration is intentionally not hard-coded in Step 4.1 and remains follow-up integration/configuration work.

## Date Compatibility

Real `date_gmt` was a string compatible with the existing `normalizeWordPressPublishTime()` rule.

The sampled value normalized successfully to a Stage 5 timezone-aware ISO 8601 UTC value.

No fallback to current time was used.

## Title Normalizer Compatibility

PASS

For the sampled real List post:

- raw rendered-title input size: 81 UTF-8 bytes
- normalized title output size: 81 UTF-8 bytes
- no full real title is recorded here

## Excerpt Normalizer Compatibility

PASS

For the sampled real List post:

- rendered-excerpt input size: 308 UTF-8 bytes
- normalized plain excerpt output size: 300 UTF-8 bytes
- HTML/entities/whitespace normalization completed without Contract failure
- no full real excerpt is recorded here

## Content HTML / Sanitizer Compatibility

PASS with one non-blocking compatibility finding.

The sampled real detail HTML contained:

- 4 `figure` elements
- 4 `figcaption` elements
- 4 `img` elements
- 0 `srcset` attributes in the sampled detail
- 0 `data-src` attributes in the sampled detail
- 0 unsafe/non-HTTPS image `src` values
- 0 anchor elements in the sampled detail

Current Sanitizer does not allowlist `figure` or `figcaption`; those wrapper tags are therefore not preserved. This is recorded as a compatibility finding only. Step 4.1 does not automatically broaden the Sanitizer allowlist.

The existing Sanitizer successfully processed the real detail, produced safe HTML, and the final ContentDetail passed the Stage 5 validator.

## Real Adapter / Provider Validation

### Before minimal List query fix

Real List Adapter validation: FAIL with `provider_invalid_payload` because the live `_fields + _embed` List response omitted `_embedded`.

### After minimal List query fix

Production Content Provider was instantiated only in a one-off in-memory integration process with explicit temporary configuration and the normal default configuration was not changed.

Real Production Provider List result:

- items returned in verification: 2
- real total: 172
- all returned summaries passed Stage 5 `validateContentSummary()`
- generated pagination passed Stage 5 `validatePagination()`
- Stage 5 List Contract: PASS

Real Production Provider Detail result:

- Sanitized content size: 13,766 UTF-8 bytes
- Stage 5 `validateContentDetail()`: PASS
- validation errors: 0
- `rawHtml` in final detail: false
- Stage 5 Detail Contract: PASS

## Raw HTML Bypass

0

Real WordPress `content.rendered` continued through:

`Raw Validation -> Mapper -> ContentDetailSanitizerInput.rawHtml -> ServerHtmlSanitizer -> ContentDetail.content`

No raw HTML bypass was introduced.

## Real Content Fixture Policy

Real wanluu.com article content saved as Fixture: NO

The temporary integration scripts kept real payloads in process memory only and were deleted before final validation.

Remaining Step 4.1 temporary integration files: 0.

Fixtures remain synthetic test data.

## Request / Credential Audit

All actual wanluu.com requests were sequential and low-frequency.

No concurrency test, benchmark, load test, crawler, security scan, or repeated bulk article fetch was performed.

The first temporary script attempt failed at TypeScript transform time and made 0 network requests.

Cumulative Step 4.1 integration request audit:

- GET: 11
- HEAD: 4
- POST: 0
- PUT: 0
- PATCH: 0
- DELETE: 0
- total controlled wanluu.com integration requests: 15
- WordPress REST-specific requests: 13
- canonical site-root HEAD requests: 2

Authentication / credentials:

- Authorization Header Count: 0
- Cookie Credential Count: 0
- WordPress Username: 0
- WordPress Password: 0
- Application Password: 0
- Bearer Token: 0

No WordPress login was performed.

## Production / Environment Defaults

After real verification:

- `CONTENT_PROVIDER_ENABLED=false`
- `GITHUB_PROVIDER_ENABLED=false`
- `AI_PROVIDER_ENABLED=false`
- `WORDPRESS_BASE_URL=` remains empty in `.env.example`
- real `server/.env`: absent

The real domain was used only in temporary integration context and Result/Plan engineering records. It was not hard-coded into `server/src/**` or Mini Program Runtime.

## Remote

Mini Program Remote remains:

- development: false
- production: false
- `REMOTE_API_ENABLED=false`

The Mini Program did not connect directly to WordPress or the local Server.

## Deployment

NOT EXECUTED

No:

- SSH
- Nginx
- Docker
- DNS change
- SSL change
- Tencent Cloud server operation
- server deployment

was performed.

## DNS / SSRF Status

The system DNS resolver was naturally used by the operating system for this approved public read-only integration.

This does not complete deployment-layer SSRF protection.

Still pending:

- DNS Resolution Security: PENDING DEPLOYMENT SECURITY
- Resolved Private-IP Enforcement: PENDING DEPLOYMENT SECURITY
- DNS Rebinding Protection: PENDING DEPLOYMENT SECURITY

## Static / Security Audit

PASS

Final `server/src/**` scan:

- hard-coded `wanluu.com`: 0
- hard-coded `api.github.com`: 0
- AI endpoint markers: 0
- Runtime Fixture imports: 0
- DB connection strings: 0
- high-confidence real credential markers: 0
- dynamic `eval`: 0
- `new Function`: 0
- rawHtml bypass: 0
- `fetch` outside `providers/native-fetch-http-client.ts`: 0
- remaining temporary Step 4.1 integration files: 0

## Server Validation

### npm ci

PASS

- 102 packages installed
- 103 packages audited
- 0 vulnerabilities

### npm audit

PASS

- total vulnerabilities: 0
- High: 0
- Critical: 0

### Server Build

PASS

`npm run build`

TypeScript `strict=true` remains enabled.

### Server Test

PASS

`234 / 234 PASS`

- fail: 0
- cancelled: 0
- skipped: 0
- todo: 0

Step 3.4/Formal Seal baseline was 233 tests. Step 4.1 adds one synthetic regression test for the live `_fields + _embed` behavior.

## Root Regression

- `npm run test-stage5`: PASS - 813 / 813
- `npm run test:stage4`: PASS - 733 / 733
- `npm run test:stage4:static`: PASS - 20 / 20
- `npm run test:stage3`: PASS
- `npm run check`: PASS
- ERROR = 0
- WARNING = 0

## Runtime Cleanup

- remaining WebCodex jobs: 0
- Port 3000 listeners: 0
- remaining temporary integration scripts: 0
- no test-created long-running Server process remains

## Files Changed in Step 4.1

Production Runtime modified:

- `server/src/providers/wordpress/adapter.ts`

Tests modified:

- `server/tests/wordpress-adapter.test.ts`
- `server/tests/production-content-provider.test.ts`

Documentation modified:

- `Wanlu_Toolbox_Stage6_Implementation_Plan.md`

Documentation added:

- `Wanlu_Toolbox_Stage6_Step4_1_Result.md`

Mini Program production code modified: NO

## Git

- HEAD remains `8f7f4d7df9bc6c8d96d96d8e526cb2aa79023263`
- Branch: `main`
- origin/main ahead: 0
- origin/main behind: 0
- Tracked Mini Program diff: 0
- Staged: 0
- `git add`: not executed
- `git commit`: not executed
- `git push`: not executed
- `git reset`: not executed
- `git restore`: not executed
- `git clean`: not executed

## Final Decision

Stage 6 Step 4.1: PASS

Real WordPress public read-only discovery: PASS

Real List Contract after minimal Adapter query fix: PASS

Real Detail Contract: PASS

Real Sanitizer compatibility: PASS with recorded `figure/figcaption` compatibility finding

Production Content Provider default: DISABLED

Deployment: NOT EXECUTED

Mini Program Remote: DISABLED

Stage 6 Step 4.2: NOT ENTERED
