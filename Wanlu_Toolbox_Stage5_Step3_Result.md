# Stage 5 Step 3 执行结果

## 1. 执行前基线

- Stage 5 Step 2：94 / 94 PASS。
- Stage 4：733 / 733 PASS。
- Stage 4 Static：20 / 20 PASS。
- Stage 3：PASS。
- `npm run check`：PASS，ERROR = 0，WARNING = 0。
- Stage 4 Baseline Commit：`d8e198accaf874a26825c8b2b14404f44707e098`。
- 当前 Remote：development / production 均为 false。
- 当前 Base URL：`https://api.example.com` placeholder。

## 2. API Version

冻结正式版本：

```text
v1
/api/v1
```

禁止无版本正式 API。

## 3. Endpoint 规范

新增 `config/api-endpoints.js`，仅保存相对 path：

```text
GET /api/v1/health
GET /api/v1/content/articles
GET /api/v1/content/articles/:id
GET /api/v1/github/rankings
```

文章 ID 按 opaque string 处理，并由 detail path builder 安全编码。

## 4. Response Contract

继续唯一复用 `utils/api-contract.js`：

```text
code
message
data
meta
```

`code = 0` 表示业务成功；`code != 0` 表示 Business Error。没有建立第二套 Contract。

## 5. Error Contract

继续区分：

```text
Transport / Network Error
HTTP Error
Business Error
Client Disabled Error
Contract Error
```

HTTP 非 2xx 不会被伪装为普通 Business Error。

## 6. Pagination

统一 page/pageSize：

Content：

```text
page >= 1
pageSize 默认 10
pageSize 最大 20
```

GitHub Rankings：

```text
page >= 1
pageSize 默认 5
pageSize 最大 10
```

响应 pagination：

```text
page
pageSize
total
hasMore
```

并验证 `hasMore` 与 total 一致。

## 7. Health

正式契约：

```text
GET /api/v1/health
```

只返回：

```text
status
apiVersion
serverTime
optional requestId
```

不暴露服务器 IP、路径、数据库、容器、Secret。

## 8. Content List

正式契约：

```text
GET /api/v1/content/articles
```

Query：

```text
page
pageSize
category（可选）
```

v1 不提前加入 keyword。

Summary 字段：

```text
id
title
excerpt
cover
publishTime
category
author（可选）
```

列表不返回完整文章 HTML。

## 9. Content Detail

正式契约：

```text
GET /api/v1/content/articles/:id
```

Detail 字段：

```text
id
title
content
publishTime
category
author（可选）
cover（可选）
```

客户端不假设 ID 为 WordPress 数字 ID。

## 10. Rich Content

Stage 5 第一版正式方向：

```text
sanitized_html
```

服务端必须先清洗，至少禁止：

```text
script
iframe
object
embed
form
事件属性
javascript:
危险 URL Scheme
```

客户端未来只消费服务器已清洗内容，本 Step 没有实现 HTML sanitizer 或文章页面。

## 11. GitHub Ranking

正式契约：

```text
GET /api/v1/github/rankings
```

period：

```text
daily
weekly
all
```

手机端默认 pageSize = 5，最大 10。

Item：

```text
id
name
fullName
description
author
stars
language
url
updatedAt
```

不直接透传 GitHub 原始完整 Response。

## 12. Security

确认：

- 第三方 Secret 只允许服务器保存。
- Endpoint config 不允许完整 Server URL。
- 页面 / Service 不直接 wx.request。
- packageGithub 不直连 GitHub Provider。
- Content 不直连 WordPress REST。
- packageAI 不直连 AI Provider。
- 当前无 Authorization / OpenID / UnionID / 设备 ID 自动注入。

## 13. Environment

保持：

```text
development.remoteApiEnabled = false
production.remoteApiEnabled = false
Base URL = https://api.example.com
```

没有填入 wanluu.com API、测试域名、服务器 IP 或生产 API 域名。

## 14. Server Responsibility

服务器未来负责：

- Secret / Token。
- WordPress / wanluu.com 标准化。
- GitHub 代理与缓存。
- 内容清洗。
- 限流。
- 缓存。
- API Version。
- 第三方错误隔离。
- AI Provider 代理（未来独立 Stage）。

本 Step 未操作任何服务器。

## 15. Mini Program Responsibility

小程序负责：

- UI。
- Service 调用。
- API Client / Transport。
- 错误状态展示。
- 后续受控本地缓存。

小程序不负责第三方 Secret、数据库或核心 HTML 安全清洗。

## 16. Cache Boundary

Article List / Detail / GitHub Rankings 可作为后续缓存候选。

Step 7 前不创建 Remote Cache Storage Key，不复用 Stage 3：

```text
wl_meta_v1
wl_favorites_v1
wl_history_v1
wl_tool_usage_v1
wl_tool_state_v1
```

## 17. Rate Limit

HTTP `429` 为 Rate Limit。

v1 选择 Envelope：

```text
meta.retryAfter
```

单位为秒、非负整数。API Client 仍只标记 retryable，不自动 retry。

`utils/api-contract.js` 最小增强：HTTP Error 保留安全的服务器 meta，因此 `retryAfter` / `requestId` 可以在后续 Service 使用。

## 18. Static Rules

扩展 `scripts/stage5-static-rules.js`：

- 强制存在 `config/api-endpoints.js`。
- 强制存在 `utils/api-schema.js`。
- Endpoint config 只能使用相对 API Path。
- Endpoint 必须固定版本前缀。
- Remote 默认 false 继续保护。
- `wx.request` 仍只允许统一 Transport。
- Service / 页面不得直连第三方 Provider。
- packageGithub 禁止 `api.github.com`。
- Content 禁止 `/wp-json/` 直连。
- packageAI 禁止 AI Provider 直连。
- Secret 检查继续生效。
- scripts / fixture / Markdown 不作为生产 Provider 直连判断来源。

## 19. Stage 5 Tests

新增：

```text
config/api-endpoints.js
utils/api-schema.js
scripts/fixtures/stage5-api-contract.js
```

扩展 `scripts/test-stage5-api.js` 后：

```text
Stage 5 API/Transport/Contract tests: PASS (155 cases)
```

覆盖 Version、Endpoint、Pagination、Health、Content、Rich Content、GitHub、Error Namespace、Rate Limit、requestId、fixtures、Static Rules。

所有 Fixture 为本地测试数据，没有真实联网。

## 20. Stage 4 Regression

```text
452 tools PASS
53 search PASS
30 search integration PASS
57 discovery PASS
71 discover integration PASS
70 interaction PASS
```

合计 733 / 733 PASS。

Stage 4 Static：20 / 20 PASS。

## 21. Stage 3 Regression

`npm run test:stage3`：PASS。

未修改 Stage 3 Schema / Storage / Usage 语义。

## 22. npm run check

PASS。

Stage 5 Static Rules 与现有 Stage 3 / 4 规则同时通过。

## 23. ERROR / WARNING

```text
ERROR = 0
WARNING = 0
```

## 24. 是否真实联网

否。

没有访问：

```text
wanluu.com
WordPress
GitHub API
AI Provider
api.example.com
任何真实互联网 API
```

## 25. 是否操作服务器

否。

未执行 SSH、Nginx、Docker、数据库、部署、DNS 或微信后台操作。

## 26. 是否具备进入 Step 4 条件

是。

Step 3 协议、Endpoint、Schema、fixture、Static Rule 与自动测试已建立，Stage 3 / 4 基线保持 PASS。

但本 Step 已停止，不自动进入 Stage 5 Step 4。
