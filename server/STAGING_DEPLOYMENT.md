# Wanlu Toolbox Server - Staging Deployment Runbook

This document is a future manual-deployment checklist only. Stage 6 Step 4.3 does not execute any server deployment, SSH, Nginx, DNS, SSL, firewall, systemd, PM2, or Docker action.

## 1. Validated runtime baseline

Step 4.3 was locally verified with:

- Node.js: `24.x` (local verification runtime: `v24.18.0`)
- npm: `11.x` (local verification runtime: `11.16.0`)
- Server bind: `127.0.0.1`
- Default port: `3000`
- API version: `v1`
- Production start command: `npm start` -> `node dist/server.js`

Use the same Node major version for the first staging deployment unless a later approved compatibility step changes it.

## 2. Code delivery boundary

In the future deployment step, place the reviewed `server/` source on the staging host using an approved source-control or file-transfer method. Do not copy local `.env`, test fixtures containing real data, `node_modules`, or build caches.

`dist/` is build output and remains Git ignored. The preferred staging flow is to build on the staging host from the reviewed source rather than commit `dist/`.

## 3. Install and build

From the staging server directory, after the source has been reviewed:

```bash
npm ci
npm run build
```

For a runtime-only artifact assembled after build, the production dependency shape is:

```bash
npm ci --omit=dev
node dist/server.js
```

The compiled runtime must not require `tsx`, `typescript`, or `@types/*` packages.

## 4. Private staging environment

Real configuration must exist only in the private server environment or the later-approved service manager configuration. Do not commit a real `.env` file.

Required staging values:

```text
NODE_ENV=staging
PORT=3000
API_VERSION=v1
CONTENT_PROVIDER_ENABLED=true
GITHUB_PROVIDER_ENABLED=false
AI_PROVIDER_ENABLED=false
UPSTREAM_TIMEOUT_MS=7000
WORDPRESS_BASE_URL=<wordpress-site-base>
```

`<wordpress-site-base>` must be the reviewed HTTPS WordPress site base and must not contain credentials, query parameters, or fragments.

Public WordPress content currently requires no username, password, application password, cookie credential, or bearer token.

## 5. Bind and future reverse-proxy boundary

The Node server should remain bound to:

```text
127.0.0.1:3000
```

Future deployment topology:

```text
Internet
  -> Nginx
  -> 127.0.0.1:3000
  -> Wanlu Server
```

Step 4.3 does not create an Nginx configuration and does not expose the Node process on `0.0.0.0`.

## 6. Local server checks on the staging host

After a future staging start, verify the loopback API first:

```bash
curl --fail http://127.0.0.1:3000/api/v1/health
curl --fail "http://127.0.0.1:3000/api/v1/content/articles?page=1&pageSize=2"
curl --fail "http://127.0.0.1:3000/api/v1/content/articles/<encoded-opaque-id>"
```

Expected health data must preserve the frozen Stage 5 contract:

- `status = ok`
- `apiVersion = v1`
- valid ISO 8601 `serverTime`

Do not use these checks for crawling or bulk content retrieval.

## 7. Kill switch

The single Content Provider kill switch remains:

```text
CONTENT_PROVIDER_ENABLED=false
```

After changing the private environment, restart the future service through the deployment mechanism approved in that later step. With the provider disabled, the Content API should return the frozen `503 / 10053 / service_unavailable` response and make no upstream WordPress request.

## 8. Rollback boundary

If staging verification fails:

1. Set `CONTENT_PROVIDER_ENABLED=false` in the private server environment.
2. Keep Mini Program Remote disabled.
3. Do not change the frozen Stage 5 Client Contract.
4. Do not delete application data or use destructive Git reset/clean operations as a service rollback mechanism.
5. Diagnose the Provider / Adapter / Sanitizer / environment issue before any re-enable.

## 9. Deployment security still pending

Before any public staging exposure, a separately approved deployment-security step must evaluate:

- DNS resolution security
- resolved private-IP enforcement
- DNS rebinding protection
- outbound egress policy
- firewall / network policy

The existing URL-string validation reduces obvious configuration risk but does not complete DNS-layer SSRF protection.

## 10. Deferred infrastructure

The following are intentionally not configured by Step 4.3:

- SSH deployment
- Nginx
- SSL / TLS certificate setup
- DNS
- firewall changes
- systemd service
- PM2
- Docker
- WeChat Mini Program request legal domain
- Mini Program Remote

The API domain is `DEPLOYMENT DECISION PENDING`; do not assume any specific subdomain until the deployment step is explicitly approved.

## 11. Safety rules

Do not place any of the following in tracked files or command history intended for sharing:

- real server IP
- passwords
- tokens
- private keys
- WordPress credentials
- application passwords
- bearer tokens

Do not disable TLS verification, disable the firewall as a shortcut, use `chmod 777`, run untrusted `curl | bash` installers, or force-overwrite system configuration.
