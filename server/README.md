# Wanlu Toolbox Server

Stage 6 Step 4.3 compiled-runtime and staging-deployment preflight foundation for Wanlu Toolbox.

## Current status

- API prefix: `/api/v1`
- Health endpoint: implemented
- Content list/detail routes: real WordPress Contract and local staging E2E verified; production provider remains disabled by default
- GitHub rankings route: skeleton only
- Content, GitHub, and AI providers: disabled by default
- Production Native `fetch` HTTP client foundation: implemented with dependency-injected FetchLike, timeout abort, JSON/content-type checks, redirect blocking, and response-size limits
- WordPress production composition path: implemented but disabled by default; no real domain is hard-coded
- WordPress detail HTML passes through an independent server-side sanitizer before it can become `ContentDetail.content`
- Sanitizer uses an explicit tag/attribute allowlist, HTTPS-only image policy, and non-clickable link policy; `figure` / `figcaption` are allowed as attribute-free static semantic containers
- Contract harness reuses Stage 5 validators in tests only
- Success-path tests use dependency-injected test-only fake providers
- Static/security tests scan production server source separately from docs/tests
- Compiled runtime starts with `node dist/server.js`; `npm start` is the formal production start command
- Graceful shutdown handlers close the HTTP server on SIGTERM/SIGINT
- `STAGING_DEPLOYMENT.md` documents the future manual deployment boundary without executing deployment

The production Content Provider composition remains disabled by default. Public read-only WordPress Contract verification and an ephemeral local Wanlu Server E2E have been completed, but no real domain is hard-coded into Runtime source. GitHub provider integration, AI provider, database, authentication, membership, payment, server cache, deployment, and Remote activation remain outside this step.

## Local development

```bash
npm install
npm run dev
```

The development server binds to `127.0.0.1` by default.

## Validation

```bash
npm test
npm run build
```

Tests use only the local Express app/ephemeral loopback server and do not call real business providers.
The fake providers are defined only under `server/tests` and are never selected by the production default app.
Production HTTP client and Content Provider regression tests inject Fake Fetch. The automated test suite does not call a real WordPress or other business endpoint. Step 4.2 real-provider verification was performed separately through a temporary local integration process that was deleted after use.

## Environment

Copy values from `.env.example` into your local environment only when needed. This skeleton intentionally does not create or require a `.env` file. `WORDPRESS_BASE_URL` is the WordPress site base URL (root or a fixed subpath), must be HTTPS when configured, and may remain empty while the Content Provider is disabled. Provider flags remain `false` until a later explicitly approved integration step.

The default upstream timeout is 7000 ms so server-side provider work remains below the Stage 5 client's 10-second overall timeout budget. Real WordPress integration has been verified only through approved local staging processes; Remote remains disabled and no server deployment has been performed.

## Environment roles

- `development`: all providers remain disabled by default. Local and automated tests may inject Fake Fetch without real provider networking.
- `staging`: approved Step 4.1/4.2 verification used temporary process-only configuration with `CONTENT_PROVIDER_ENABLED=true`; defaults and tracked environment templates remain disabled/empty after the process exits.
- `production`: the code path exists, but the Content Provider must remain disabled until Stage 6 is fully sealed and manually accepted. No code rule permanently prevents a future approved production enablement.

No `.env.staging` or `.env.production` file is created by this stage.

## Content Provider readiness gate

`CONTENT_PROVIDER_ENABLED` is the single Content Provider toggle. No second WordPress/remote-content enable flag exists.

- Disabled: the server starts without `WORDPRESS_BASE_URL`; Content list/detail return the frozen `503 / 10053 service_unavailable` response and no upstream request occurs.
- Enabled: startup configuration must contain API version `v1`, a valid HTTPS `WORDPRESS_BASE_URL`, valid timeout/port values, and supported-provider flags. Missing or invalid Content configuration fails fast rather than starting a half-enabled provider.
- The base URL is an administrator-controlled server environment value. Client query parameters, article IDs, categories, page or pageSize cannot replace its host.

## Staging-integration safety checklist

Before the first real WordPress request, all of the following require explicit manual approval:

1. Set `NODE_ENV=staging` in the private server environment.
2. Set `CONTENT_PROVIDER_ENABLED=true` only in that staging environment.
3. Set `WORDPRESS_BASE_URL` privately on the server; do not commit it to Git.
4. Confirm the URL is HTTPS, contains no credentials/query/hash, and is not an obvious loopback/private IP literal.
5. Keep the integration read-only (`GET` only); do not add WordPress writes, authentication, database operations, or cache in this step.
6. Keep Mini Program production Remote disabled; development Remote may also remain disabled until server-side verification is complete.
7. Verify server-side connectivity and frozen `/api/v1` contracts before deciding whether to enable client development Remote in a separately approved step.
8. Verify the live WordPress `_embed` + `_fields` response shape, featured-media/term embedding, `X-WP-Total`, and category identifiers against the real site.
9. Confirm deployment-layer DNS resolution / resolved-private-IP / egress controls before production use.
10. On any Contract drift, unsafe payload, upstream instability, or unexpected response, disable `CONTENT_PROVIDER_ENABLED` immediately.

Step 4.1/4.2 used this boundary for controlled read-only verification. It does not authorize deployment, persistent staging environment files, or Production enablement.

## Kill switch and rollback

`CONTENT_PROVIDER_ENABLED=false` is the only Content Provider kill switch. It can disable the server-side content upstream path without changing the Mini Program Contract or publishing a new client build.

Rollback for a future real-integration problem is:

1. Set `CONTENT_PROVIDER_ENABLED=false` on the server.
2. Keep Mini Program development/production Remote settings unchanged or disabled.
3. Do not delete data, reset Git, change the frozen client Contract, or add a second provider toggle.
4. Investigate the provider/contract problem offline before any re-enable.

## Pending integration / deployment items

The following remain intentionally unresolved after the local Step 4.2 verification:

- Wanlu category string -> real WordPress numeric category-ID mapping. Without an injected resolver, categorized requests fail safely before HTTP.
- DNS resolution security, resolved-private-IP enforcement, and DNS-rebinding protection. Current URL-string checks reduce obvious SSRF configuration risk but do not solve DNS-layer SSRF. `WORDPRESS_BASE_URL` is administrator-controlled rather than request-controlled, which limits exposure; deployment egress/firewall controls are still required.
- Server deployment, Nginx/SSL/DNS setup, Mini Program Remote enablement, and Production Content Provider enablement.

## Production status

The real WordPress Contract, local Wanlu Server E2E, compiled runtime, production-only dependency shape, and staging deployment preflight are verified. The system is still **NOT Production Deployed**, **NOT Production Enabled**, and does not claim Production Ready status. Nginx, DNS, SSL, public staging exposure, and Mini Program Remote remain for a separately approved deployment step.
