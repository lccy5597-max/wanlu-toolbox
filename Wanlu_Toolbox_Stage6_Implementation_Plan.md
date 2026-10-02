# Stage 6 Implementation Plan

## Scope
Stage 6 Step 1 is planning only. No server deployment or production code change.

## Current Client Boundary

Page -> Service -> api-client -> api-transport -> Server API

## Frozen Contract

- API version: /api/v1
- Base URL remains placeholder only.
- REMOTE_API_ENABLED remains false.
- Response envelope:
  - code
  - message
  - data
  - meta

## Server Responsibilities

Server owns:
- external provider integration
- data normalization
- ranking/content aggregation
- secrets

Client must not own:
- provider tokens
- GitHub direct API access
- server credentials

## Step 1 Deliverable

Contract mapping and implementation boundary confirmation only.
## Stage 6 Step 3 - Content Server Foundation

### Planning record

The Step 3.1-3.4 sequence below was not part of the original Step 1 planning document. It was progressively refined during Stage 6 implementation from the actual frozen Stage 5 Contract, provider boundaries, security findings, and validation results. This section records the work that was actually completed; it does not claim these substeps were pre-planned from the beginning.

### Formal Step 3 scope

Stage 6 Step 3 owns the Content Server Foundation code-side scope:

- WordPress Raw Boundary
- WordPress Adapter
- normalization and mapping
- Provider Error boundary
- HTTP boundary
- server-side HTML sanitization
- Production HTTP Client foundation
- Production Content Provider composition
- opaque article ID handling
- pagination mapping
- `X-WP-Total` handling
- URL security / basic SSRF configuration protection
- Provider Readiness Gate
- Content Provider kill switch
- Staging Integration Gate documentation

### Stage 6 Step 3.1 - Content Provider Contract + WordPress Adapter Boundary

Status: PASS

Completed scope:

- WordPress Raw Model
- Raw Validation
- Mapper
- Normalizer
- abstract HTTP Client Boundary
- Provider Error Boundary

### Stage 6 Step 3.2 - Server-side HTML Sanitization + Content Detail Security Pipeline

Status: PASS

Completed scope:

- `ServerHtmlSanitizer`
- explicit allowed tags / attributes
- HTTPS image policy
- dangerous HTML filtering
- `ContentDetailSanitizerInput.rawHtml` -> Sanitizer -> `ContentDetail.content` pipeline

### Stage 6 Step 3.3 - Production Content Provider Composition + Production HTTP Client Foundation

Status: PASS

Completed scope:

- `NativeFetchHttpClient`
- timeout / AbortController
- upstream response-size boundary
- JSON Content-Type validation
- WordPress Base URL validation
- opaque ID decoder
- `X-WP-Total`
- `ProductionWordPressContentProvider`
- Production Content Provider composition

### Stage 6 Step 3.4 - Content Provider Final Readiness Audit + Staging Integration Gate

Status: PASS

Completed scope:

- Provider Readiness Gate
- development / staging / production boundary documentation
- single Content Provider kill switch
- rollback strategy
- remaining SSRF-risk classification
- category-mapping pending boundary
- real-integration checklist
- final code-side readiness/security regression

Stage 6 Step 3.4 is the final code-side / readiness substep of Stage 6 Step 3.

A future real WordPress Staging Integration is not part of the Step 3 code implementation scope and requires a separate explicit integration step.

### Step 3 intentionally excludes

Stage 6 Step 3 does not include:

- real `wanluu.com` requests
- real WordPress REST integration
- real WordPress category-ID discovery
- real `_embed` / `_fields` compatibility verification
- DNS-resolution security
- resolved-private-IP enforcement
- DNS-rebinding protection
- Nginx / SSL / DNS configuration
- server deployment
- Mini Program Remote enablement
- Production Content Provider enablement

Those items belong to later real Integration / Deployment work.

### Step 3 pending items retained after code-side seal

The following are intentionally unresolved and do not block the Step 3 code-side seal because they are outside the Step 3 completion definition:

1. Real WordPress `_embed` / `_fields` compatibility - PENDING REAL INTEGRATION.
2. Wanlu category -> WordPress category-ID mapping - PENDING REAL INTEGRATION.
3. DNS resolution security - PENDING DEPLOYMENT SECURITY.
4. Resolved private-IP enforcement - PENDING DEPLOYMENT SECURITY.
5. DNS rebinding protection - PENDING DEPLOYMENT SECURITY.
6. Real `wanluu.com` Contract verification - NOT EXECUTED.

### Step 3 production status boundary

The Production Content code path exists and is code-side ready for controlled staging integration.

It must not be described as Production Ready. Current status remains:

- Real WordPress Integration: NOT EXECUTED
- Real `wanluu.com` Verification: NOT EXECUTED
- Deployment: NOT EXECUTED
- Production Content Provider: NOT ENABLED

The single Content Provider kill switch remains:

`CONTENT_PROVIDER_ENABLED=false`

## Stage 6 Step 4 - Real WordPress Staging Integration

### Planning record

Stage 6 Step 4 begins only after the Stage 6 Step 3 code-side seal. It is the real-provider integration phase and must not be back-dated as part of the earlier code-only work.

### Stage 6 Step 4.1 - Real WordPress Read-only Discovery + Contract Verification

Status: PASS

This is the first real WordPress Provider integration step. It is limited to low-frequency public GET/HEAD verification and local in-memory transformation.

Completed scope:

- canonical HTTPS site / REST discovery
- public `wp/v2` namespace verification
- real Posts List and Detail payload-shape verification
- real `_embed` and `_fields` compatibility verification
- real `X-WP-Total` / `X-WP-TotalPages` verification
- real `date_gmt`, rendered title/excerpt/content verification
- featured-media and category-term shape verification
- minimal real category metadata discovery
- real Raw Validation / Mapper / Sanitizer / Production Provider compatibility verification
- Stage 5 List / Detail Contract validation using real upstream data in memory only
- request-method / credential audit

One small real-contract difference was confirmed and fixed: on the live WordPress List endpoint, `_embed=true` combined with `_fields` requires `_links` to remain in the selected field set for `_embedded` resources to be returned. The List Adapter now requests `id,date_gmt,title,excerpt,_links,_embedded`. This does not change the Stage 5 client Contract.

Step 4.1 does not enable the Production Content Provider by default, does not enable Mini Program Remote, does not deploy the Server, and does not persist real WordPress article content as fixtures.

### Step 4.1 retained follow-up boundaries

- exact Wanlu category string -> WordPress category-ID configuration: discovered as feasible, not hard-coded; follow-up integration/configuration work required
- complete DNS resolution security: PENDING DEPLOYMENT SECURITY
- resolved private-IP enforcement: PENDING DEPLOYMENT SECURITY
- DNS rebinding protection: PENDING DEPLOYMENT SECURITY
- server deployment / Nginx / SSL / DNS / Mini Program Remote: NOT EXECUTED

### Stage 6 Step 4.2 - Local Staging End-to-End Content Integration + Real Content Compatibility Hardening

Status: PASS

This step was added after Step 4.1 real discovery succeeded. It was not part of the original Stage 6 planning document.

Completed scope:

- ephemeral `127.0.0.1` Wanlu Server with process-only staging configuration
- real WordPress -> NativeFetchHttpClient -> Adapter -> Mapper -> Sanitizer -> Production Content Provider -> Service -> Controller -> local `/api/v1` end-to-end verification
- real List E2E through `/api/v1/content/articles?page=1&pageSize=2`
- real Detail E2E through the opaque article ID returned by the local Wanlu List API
- Stage 5 List / pagination / Detail validator verification against local Wanlu API responses
- Step 4.1 `_links` List regression retained
- real-content `figure` / `figcaption` compatibility decision and minimal attribute-free Sanitizer allowlist expansion
- synthetic security regression proving `class`, `style`, `on*`, `script`, dangerous URLs, and clickable anchors remain blocked
- Content client category-usage audit: current articles page does not send `category`; server mapping therefore remains `PENDING CONFIGURATION`
- no-Resolver categorized requests continue to fail safe before upstream HTTP
- Content Provider kill-switch regression: default disabled returns frozen `503 / 10053 service_unavailable` with zero upstream calls
- temporary integration process and scripts removed after verification

Step 4.2 does not deploy the Server, enable Mini Program Remote, persist a real `.env`, hard-code the real domain into Runtime source, or enable the Production Content Provider by default.

Step 4.2 is not declared the final Stage 6 Step 4 substep. Any Step 4.3 requires separate explicit approval.

### Stage 6 Step 4.3 - Compiled Runtime Verification + Staging Deployment Preflight + Step 4 Final Seal

Status: PASS / SEALED (local / code-side / Integration Readiness).

This substep was added after Step 4.2 succeeded. It was not part of the original Stage 6 planning document; it is the explicit deployment preflight required before any real staging-server deployment.

Step 4.3 scope:

- verify `dist/` compiled runtime can run directly with Node
- establish the formal `npm start` -> `node dist/server.js` command
- verify a temporary `npm ci --omit=dev` production-only runtime
- verify compiled Health and Provider-disabled behavior
- verify safe loopback bind and startup-failure behavior
- add simple SIGTERM / SIGINT HTTP-server close handling and verify the compiled handler paths
- document a future manual staging deployment runbook
- preserve all Step 4.1 / Step 4.2 Contract and Sanitizer regressions
- run final Server / root regression and security checks

Stage 6 Step 4.3 is the final local / code-side / Integration Readiness substep of Stage 6 Step 4. Actual staging-server deployment is explicitly outside Step 4 and requires separate user approval.

### Formal Stage 6 Step 4 scope

Stage 6 Step 4 consists of:

1. Step 4.1 - Real WordPress Read-only Discovery + Contract Verification
2. Step 4.2 - Local Staging End-to-End Content Integration + Real Content Compatibility Hardening
3. Step 4.3 - Compiled Runtime Verification + Staging Deployment Preflight

If Step 4.3 final validation passes, Stage 6 Step 4 may be sealed as `PASS / SEALED` for local integration readiness only. That seal does not mean the server is deployed or production enabled.

Retained post-Step-4 boundaries:

- Server Deployment: NOT EXECUTED
- Nginx: NOT CONFIGURED
- DNS: NOT CONFIGURED
- SSL: NOT CONFIGURED
- Mini Program Remote: DISABLED
- Production Content Provider default: DISABLED
- Category Mapping: PENDING CONFIGURATION
- DNS Resolution Security: PENDING DEPLOYMENT SECURITY
- Resolved Private-IP Enforcement: PENDING DEPLOYMENT SECURITY
- DNS Rebinding Protection: PENDING DEPLOYMENT SECURITY
- Rate Limit: NOT IMPLEMENTED
- Server Cache: NOT IMPLEMENTED

Step 4.3 final validation completed successfully. The compiled Runtime, production-only dependency shape, loopback bind, health/kill-switch behavior, startup-failure handling, graceful shutdown handler paths, staging runbook, security checks, and all constituent root regression scripts were verified. Actual server deployment remains a separate step requiring explicit user approval.


