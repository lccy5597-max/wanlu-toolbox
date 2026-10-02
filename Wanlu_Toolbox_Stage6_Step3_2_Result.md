# Wanlu Toolbox Stage 6 Step 3.2 Result

## Stage

Stage 6 Step 3.2 - Server-side HTML Sanitization + Content Detail Safety Pipeline

## Status

PASS

Step 3.3 was not entered.

## Baseline

- Branch: `main`
- HEAD: `8f7f4d7df9bc6c8d96d96d8e526cb2aa79023263`
- origin/main ahead: 0
- origin/main behind: 0
- Tracked Mini Program diff: 0
- Staged: 0
- development Remote: false
- production Remote: false
- `REMOTE_API_ENABLED`: false

## Sanitizer Architecture

The server now has an independent sanitizer boundary in `server/src/security/html-sanitizer.ts`.

The content detail flow is:

`WordPress Raw HTML -> ContentDetailSanitizerInput.rawHtml -> ServerHtmlSanitizer -> sanitized HTML -> ContentDetail.content`

`server/src/providers/wordpress/detail-pipeline.ts` is the only Step 3.2 conversion boundary from sanitizer input to final `ContentDetail`.

Raw HTML is never assigned directly to `ContentDetail.content`.

## Sanitizer Library

- Runtime dependency: `sanitize-html@2.18.0`
- Dev types: `@types/sanitize-html@2.16.2`
- Reason: mature server-side HTML sanitizer, no browser DOM runtime, explicit policy support, suitable for the current lightweight Node server.
- Runtime dependencies before Step 3.2: 1 (`express`)
- Runtime dependencies after Step 3.2: 2 (`express`, `sanitize-html`)
- No existing dependency was upgraded.

## Explicit Policy

Allowed tags:

`p, br, strong, b, em, i, u, s, blockquote, ul, ol, li, h1, h2, h3, h4, h5, h6, pre, code, span, div, img, table, thead, tbody, tr, th, td`

Allowed attributes:

- `img`: `src`, `alt`, `title`
- `th`: `colspan`, `rowspan`
- `td`: `colspan`, `rowspan`
- no `style`
- no `class`
- no `on*` event attributes

Forbidden active tags include:

`script, iframe, object, embed, form, style`

Link policy:

- `<a>` is not in the allowlist in v1.
- Anchor markup and `href` are removed while readable link text is retained.
- This follows the Stage 5 policy that arbitrary article links are not freely clickable in the first release.

Image policy:

- only absolute `https://` image URLs are accepted.
- `http:`, `javascript:`, `data:`, `file:`, `blob:`, protocol-relative URLs and relative URLs are rejected.
- Invalid images are removed instead of replacing them with a remote default image.

## Protocol / XSS Security

Tests cover:

- `script`, `iframe`, `object`, `embed`, `form`
- `onclick`, `onerror`, `onload`, uppercase event attributes
- `javascript:` and mixed-case `JaVaScRiPt:`
- HTML-entity-obfuscated dangerous schemes
- whitespace/newline/tab-obfuscated dangerous schemes
- URL-encoded dangerous scheme text
- unsafe image schemes
- nested malicious HTML
- malformed/broken HTML
- style/class stripping

## Size Boundary

- Raw HTML maximum: 512 KiB UTF-8
- Sanitized HTML maximum: 256 KiB UTF-8
- Oversized input/output throws a bounded internal `HtmlSanitizationError`.
- Error messages never contain the raw HTML payload.
- These limits are independent server safety limits and are not a mechanical copy of the client cache's 200000-character threshold.

## Empty Content

The frozen Stage 5 validator accepts an empty string for `content`, so:

- `rawHtml = ""` -> `content = ""`
- danger-only HTML such as a script-only payload -> `content = ""`

No new client-visible error code was invented.

## Detail Pipeline Compatibility

Fixture-driven integration verifies:

- fake `HttpClient`
- `WordPressContentAdapter`
- raw validation / mapper
- `ContentDetailSanitizerInput`
- `ServerHtmlSanitizer`
- final `ContentDetail`
- Stage 5 `validateContentDetail()` PASS

Production Content Provider remains disabled, so production Content API still returns the existing `503 / 10053 service_unavailable` skeleton result.

## Static / Security

Server runtime scan confirms:

- real WordPress endpoint: 0
- `wanluu.com`: 0
- `/wp-json/`: 0
- `api.github.com`: 0
- production provider `fetch(`: 0
- axios: 0
- runtime test fixture import: 0
- raw `content: rawHtml` bypass: 0
- real secret: 0
- database: 0
- AI integration: 0
- `eval`: 0
- `new Function`: 0

Production Fake Data: 0.

Real business network requests:

- WordPress: 0
- wanluu.com: 0
- GitHub: 0
- AI: 0

## Validation

- `npm audit`: PASS, 0 vulnerabilities, High 0, Critical 0
- `npm ci`: PASS, 102 packages installed, 0 vulnerabilities
- Server Build: PASS (`tsc -p tsconfig.json`, strict remains enabled)
- Server Tests: 117 / 117 PASS
- Stage 5 regression: 813 / 813 PASS
- Stage 4 regression: 733 / 733 PASS
- Stage 4 Static: 20 / 20 PASS
- Stage 3: PASS
- `npm run check`: PASS, ERROR 0, WARNING 0
- Port 3000 listeners after tests: 0

## Files Changed in Step 3.2

Modified:

- `server/package.json`
- `server/package-lock.json`
- `server/README.md`
- `server/tests/static.test.ts`

Added:

- `server/src/security/html-sanitizer.ts`
- `server/src/providers/wordpress/detail-pipeline.ts`
- `server/tests/fixtures/safe-rich-html.ts`
- `server/tests/html-sanitizer.test.ts`
- `Wanlu_Toolbox_Stage6_Step3_2_Result.md`

Mini Program production code was not changed.
GitHub modules were not changed.
Database/Auth/Cache/AI were not added.

## Git

- `git add`: not executed
- `git commit`: not executed
- `git push`: not executed
- HEAD unchanged
- Stage 6 files remain uncommitted as required

## Stop Point

Stage 6 Step 3.2: PASS

WAITING FOR STAGE 6 STEP 3.3 CONFIRMATION

Stage 6 Step 3.3 was not entered.
