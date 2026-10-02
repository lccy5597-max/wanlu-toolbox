# Wanlu Toolbox Stage 6 Step 3.1 Result

## Stage

Stage 6 Step 3.1 - Content Provider Contract + WordPress Adapter Foundation

## Status

PASS

Step 3.2 was not entered.

## Baseline

- Branch: `main`
- HEAD: `8f7f4d7df9bc6c8d96d96d8e526cb2aa79023263`
- origin/main ahead: 0
- origin/main behind: 0
- Tracked Mini Program diff: 0
- Staged: 0
- development Remote: false
- production Remote: false

## Contract Source of Truth

1. Stage 5 real source
2. `utils/api-schema.js`
3. `utils/api-contract.js`
4. `Wanlu_Toolbox_Server_API_Spec.md`
5. Stage 5 fixtures/tests
6. Stage 6 Server tests
7. Stage 6 documents

No Mini Program production contract was modified.

## Content Provider Contract

The existing `ContentProvider` remains the final Wanlu-facing provider contract. Its `ContentDetail.content` still represents sanitized HTML only.

Step 3.1 adds `ContentDetailSanitizerInput` with `rawHtml` so raw WordPress detail HTML cannot be confused with production `content` before the future sanitizer step.

## WordPress Adapter Boundary

Added under `server/src/providers/wordpress/`:

- `raw-types.ts`
- `normalizers.ts`
- `validation.ts`
- `mapper.ts`
- `adapter.ts`

The adapter:

- depends only on an injected abstract `HttpClient`
- accepts fixture/raw payloads
- validates the minimal raw shape
- maps list items to Wanlu `ContentSummary`
- maps detail data to `ContentDetailSanitizerInput`
- does not create Express responses
- does not access Controller/Router
- does not cache
- does not access a database
- does not implement real networking

## HTTP Client Boundary

Added `server/src/providers/http-client.ts` containing only interfaces/contracts.

Real HTTP implementation: 0.

Runtime `fetch`: 0.

Runtime `axios`: 0.

## Provider Error Boundary

Added `server/src/providers/provider-error.ts` with minimal provider error kinds:

- `invalid_payload`
- `timeout`
- `http_error`
- `unavailable`

Unknown source errors are normalized to generic `provider_unavailable`; raw source error details are not propagated.

## WordPress Raw Models

List raw model minimum boundary:

- numeric internal WordPress `id`
- `date_gmt`
- `title.rendered`
- `excerpt.rendered`
- optional embedded featured-media boundary
- optional embedded term boundary used by the current fixture mapper

Detail raw model adds:

- `content.rendered`

The model intentionally does not copy the full WordPress REST object.

The exact live WordPress embedded category/media payload shape and category-query mapping remain subject to later real-provider integration confirmation; Step 3.1 does not guess or enable production behavior around those unresolved live details.

## Raw Validation

Fixture tests cover:

- valid list payload
- valid detail payload
- missing title rejection
- invalid ID rejection
- invalid publish date rejection
- unsafe non-HTTPS cover rejection
- missing optional cover

## Mapping / Normalization

### Article ID

Step 3.1 internal strategy:

`wp:<positive-wordpress-id>`

Example: `wp:1001`.

The client still treats the value as an opaque string and never parses the WordPress numeric ID.

### Title

- strips markup to plain text
- decodes a small safe HTML-entity set plus numeric entities
- normalizes whitespace
- rejects an empty normalized title

### Summary

- converts rendered excerpt HTML to plain text
- decodes entities
- normalizes whitespace
- does not implement rich-content sanitization

### Publish Time

The minimal Step 3.1 raw boundary uses `date_gmt` and converts the UTC semantic field to an ISO 8601 `Z` value.

Invalid or ambiguous input is rejected; current time is never substituted.

### Cover

- HTTPS accepted
- missing featured media maps to the Stage 5-valid Summary empty-string form
- unsafe/non-HTTPS URL rejected
- no default remote image is invented

### Category

Current fixture mapper normalizes a category name from the internal embedded-term boundary.

Mapping the Wanlu `category` query string to a live WordPress category/filter identifier is intentionally deferred to a later real-provider integration step.

## HTML Security Boundary

Raw WordPress detail HTML is exposed only as `rawHtml` in `ContentDetailSanitizerInput`.

It is not assigned to `ContentDetail.content`.

The only complete Stage 5 Detail validation in Step 3.1 uses an explicitly test-only sanitized string in the test harness.

Production Content Provider remains disabled, so raw WordPress HTML cannot reach the production Content API.

## Fixture Isolation

Test fixtures exist only under:

`server/tests/fixtures/wordpress.ts`

Production Runtime imports from tests/fixtures: 0.

Production Fake Data: 0.

## Static / Security Verification

Runtime source checks pass with:

- `api.github.com`: 0
- `/wp-json/`: 0
- `wanluu.com`: 0
- `fetch(`: 0
- `axios`: 0
- `api.openai.com`: 0
- database connection strings: 0
- test fixture imports: 0
- real secret material: 0
- `eval`: 0
- `new Function`: 0

GitHub module was not modified.

AI remains disabled/unimplemented.

Server Cache remains 0.

Database remains 0.

Auth remains 0.

## Dependencies

New Runtime Dependency: 0.

New Dev Dependency: 0.

Existing dependency versions were not upgraded.

`npm audit`: 0 vulnerabilities; High 0; Critical 0.

`npm ci`: PASS.

## Validation

- Server Build: PASS
- Server Tests: 73 / 73 PASS
- Stage 5: 813 / 813 PASS
- Stage 4: 733 / 733 PASS
- Stage 4 Static: 20 / 20 PASS
- Stage 3: PASS
- `npm run check`: PASS
- ERROR: 0
- WARNING: 0

Business Provider network requests:

- WordPress: 0
- wanluu.com: 0
- GitHub: 0
- AI: 0

Port 3000 listener after tests: 0.

No test server was left listening after completion.

## Git

No `git add`, `git commit`, `git push`, `git reset`, `git restore`, or `git clean` was executed.

HEAD remains unchanged.

## Next Step

Do not enter Stage 6 Step 3.2 automatically.

Stage 6 Step 3.2 may begin only after explicit user confirmation.
