# 挽鹿工具箱 Server API 规范

> Stage 5 Step 3 冻结的前后端通信契约。当前仅为协议与边界规范，不代表真实服务器已经部署或联通。

## 1. API Version

正式 API 使用明确版本前缀：

```text
/api/v1
```

第一版客户端只依赖 `v1`。禁止新增无版本正式接口（例如 `/api/articles`）。未来不兼容升级使用新的版本前缀，不通过静默改变 `v1` 字段含义完成破坏性升级。

## 2. Base URL 原则

- Endpoint 常量只保存相对路径，不保存服务器完整 URL。
- 当前 `development` / `production` 均继续使用占位 Base URL：`https://api.example.com`。
- 当前 `REMOTE_API_ENABLED = false`，两套环境均不得自动联网。
- 真实开发/生产 API 域名必须在后续明确联调 Step 经用户确认后加入。
- 正式 Base URL 必须为 HTTPS；禁止服务器 IP 直接成为小程序正式 Base URL。

正式调用链：

```text
页面
→ 业务 Service
→ utils/api-client.js
→ utils/api-transport.js
→ 挽鹿服务器
```

页面、业务 Service 均不得自己拼完整 Base URL。

## 3. Response Contract

服务器 Envelope 统一为：

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "meta": {}
}
```

规则：

- `code`：非负整数；`0` 表示业务成功。
- `message`：稳定、简短的机器/开发可识别消息，不向用户泄漏技术堆栈。
- `data`：业务数据；允许为 `null`、对象或数组。
- `meta`：可选扩展元数据，例如 `requestId`、`pagination`、`retryAfter`。
- 小程序继续由 `utils/api-contract.js` 统一 normalization，不建立第二套响应模型。

## 4. Error Contract

必须区分：

1. Transport / Network Error：网络、DNS、超时等。
2. HTTP Error：HTTP 非 2xx。
3. Business Error：HTTP 2xx，但 `code != 0`。
4. Client Disabled Error：远程能力被本地配置关闭。
5. Contract Error：响应结构、Method、状态等违反契约。

非 2xx 时客户端优先按 HTTP Error 处理；即使响应体含业务 code，也不得把 HTTP 500 伪装为普通业务错误。

服务器错误 Envelope 仍使用同一字段：

```json
{
  "code": 20004,
  "message": "content_not_found",
  "data": null,
  "meta": {
    "requestId": "optional-non-user-trace-id"
  }
}
```

## 5. Error Codes

业务错误码按领域保留简单分区：

| 范围 | 领域 |
| --- | --- |
| `10000-19999` | 通用 |
| `20000-29999` | Content |
| `30000-39999` | GitHub |
| `40000-49999` | AI（仅保留，Stage 5 不开发） |

当前冻结的基础 code：

```text
10001 INVALID_REQUEST
10004 RESOURCE_NOT_FOUND
10029 RATE_LIMITED
10053 SERVICE_UNAVAILABLE
10054 UPSTREAM_ERROR
20004 CONTENT_NOT_FOUND
30054 GITHUB_UPSTREAM_ERROR
```

禁止随意生成随机数字作为长期业务 code。

## 6. HTTP Status

客户端规则：

- `2xx`：进入业务 Envelope normalization。
- `400`：请求参数/结构不合法。
- `401`：未来需要身份时表示认证失败；当前 Stage 5 不启用登录。
- `404`：HTTP 资源不存在。
- `429`：限流，可重试，但当前客户端不自动 retry。
- `500`：服务器内部错误，可重试。
- `503`：服务暂不可用/上游不可用，可重试。

当前 API Client 继续只标记 `retryable`，不自动等待或无限重试。

## 7. Pagination

统一使用 `page` / `pageSize`，不同时引入 cursor 体系。

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

列表响应统一：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": []
  },
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 0,
      "hasMore": false
    }
  }
}
```

`hasMore` 必须与 `page * pageSize < total` 一致。

## 8. Health

Endpoint：

```text
GET /api/v1/health
```

成功数据：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "status": "ok",
    "apiVersion": "v1",
    "serverTime": "2026-10-01T08:30:00+08:00"
  },
  "meta": {
    "requestId": "optional"
  }
}
```

Health 禁止暴露服务器 IP、绝对路径、数据库版本、容器细节、Secret 或完整系统环境。

## 9. Content List

Endpoint：

```text
GET /api/v1/content/articles
```

Query：

```text
page       必选语义，省略时默认 1
pageSize   省略时默认 10，最大 20
category   可选
```

v1 不提前加入 `keyword`，文章搜索需求以后独立规划。

每个 summary 至少包含：

```text
id
name/title → 正式字段使用 title
excerpt
cover
publishTime
category
author（可选）
```

正式字段为：`id / title / excerpt / cover / publishTime / category / author?`。

列表接口禁止返回完整文章 HTML。

## 10. Content Detail

Endpoint：

```text
GET /api/v1/content/articles/:id
```

`id` 对客户端为 opaque string：客户端只保存和传回，不假设它是 WordPress 数字 ID，也不解析内部结构。

详情至少包含：

```text
id
title
content
publishTime
category
author（可选）
cover（可选）
```

## 11. Rich Content

Stage 5 第一版正式方向：

```text
sanitized HTML string
```

由服务器先完成清洗和标准化，小程序后续通过受控 `rich-text` 消费。客户端不得信任或直接渲染原始 WordPress HTML。

服务端至少移除/拒绝：

```text
script
iframe
object
embed
form
onclick / onerror / onload 等事件属性
javascript: URL
危险 URL scheme
未受控脚本/style 注入
```

第一版文章任意外链不作为自由可点击链接开放；优先移除点击能力或转换为普通文本。未来如需要跳转，必须单独建立白名单并完成微信平台 B 类验收。

## 12. GitHub Rankings

Endpoint：

```text
GET /api/v1/github/rankings
```

Query：

```text
period   daily | weekly | all
page     默认 1
pageSize 默认 5，最大 10
```

UI 文案映射：

```text
daily  → 今日
weekly → 本周
all    → 总榜
```

每个 item：

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

`avatar` 不作为 v1 必填字段，避免手机端图片堆积。

禁止将 GitHub 原始完整 API Response 直接透传给小程序。

## 13. Security

- 小程序前端不得保存 GitHub Token、WordPress 私有凭据、AI Key、数据库密码、服务器 Secret。
- 页面不得直接 `wx.request`。
- Service 不得直接 `wx.request`。
- `wx.request` 只允许统一 WeChat Transport。
- `packageGithub` 不得直接访问 `api.github.com`。
- Content Service 不得直接依赖 `/wp-json/` 原始 WordPress API。
- `packageAI` / `services/ai.js` 不得直连 OpenAI、豆包、DeepSeek、Gemini 或其他 Provider。
- API Header 当前不自动注入 Authorization、OpenID、UnionID、设备 ID、Fingerprint 或用户画像。

## 14. Secret

Secret 边界固定在服务器：

```text
GitHub Token
WordPress 私有凭据（如未来需要）
AI Provider Key（未来）
数据库密码
server secret
```

小程序只调用挽鹿自有 API，不接触第三方 Secret。

## 15. Rate Limit

服务器未来使用 HTTP `429` 表示限流。

v1 统一在 Envelope `meta.retryAfter` 返回建议等待秒数：

```json
{
  "code": 10029,
  "message": "rate_limited",
  "data": null,
  "meta": {
    "retryAfter": 30,
    "requestId": "optional"
  }
}
```

`retryAfter` 为非负整数秒。当前客户端只保留该元数据并标记 `retryable = true`，不自动 retry。

## 16. Cache

可缓存候选：

- Article List
- Article Detail
- GitHub Rankings

禁止缓存错误响应作为正常数据。

持久化 Remote Cache 在 Stage 5 Step 7 单独实现；不得复用：

```text
wl_meta_v1
wl_favorites_v1
wl_history_v1
wl_tool_usage_v1
wl_tool_state_v1
```

如后续需要 Storage，必须使用独立 namespace、版本、TTL、容量和清理策略。

## 17. Request ID

服务器可在 `meta.requestId` 返回可选 trace id。

要求：

- 字符串。
- 不包含 OpenID、UnionID、用户 ID、设备 ID、广告 ID、位置或 Fingerprint。
- 仅用于错误排查和服务端日志关联。
- 不为 requestId 引入复杂追踪依赖。

## 18. Mini Program Responsibility

小程序负责：

- UI 与用户操作。
- 业务 Service 调用。
- 统一 API Client / Transport 使用。
- 有限、明确版本的本地缓存（后续 Step）。
- loading / success / empty / network error / timeout / server error / fallback 状态展示。
- 本地 24 个工具和 Stage 3 数据体系。

小程序不负责第三方 Secret、数据库、第三方 API 签名或核心内容清洗安全。

## 19. Server Responsibility

挽鹿服务器负责：

- 第三方 Secret 保管。
- WordPress / wanluu.com 数据获取与标准化。
- GitHub API 调用、Token、标准化和缓存。
- AI Provider 调用（未来独立 Stage）。
- 内容清洗与危险内容过滤。
- API Version。
- 限流。
- 缓存。
- 第三方错误隔离与统一错误码。
- 必要安全校验。

正式内容链路：

```text
wanluu.com / WordPress
→ 挽鹿服务器标准化与清洗
→ /api/v1/content/...
→ 小程序 Content Service
```

正式 GitHub 链路：

```text
GitHub
→ 挽鹿服务器代理/缓存/标准化
→ /api/v1/github/rankings
→ 小程序 GitHub Service
```

## 20. Dev / Production

当前代码状态：

```text
development.remoteApiEnabled = false
production.remoteApiEnabled  = false
Base URL                      = https://api.example.com
```

未来：

- development → 测试服务器 HTTPS 域名。
- production → 正式服务器 HTTPS 域名。

真实域名必须由后续 Step 明确授权，不在本规范创建真实地址。

## 21. Mock / Integration Boundary

自动测试必须依赖本地 fixture / mock transport，可以在断网 Node 环境运行。

当前 fixture 覆盖：

- health success
- article list
- article detail
- GitHub rankings
- business error
- rate limit

fixture 仅用于测试，不进入生产页面数据路径，不得伪装为线上内容。

真实服务器、DNS、TLS、微信 request 合法域名、wanluu.com 数据和 GitHub 上游联调全部属于 B 类人工/外部条件。

## 22. B 类人工配置

后续真实联调前至少需要人工确认：

- 开发服务器已部署。
- 正式服务器已部署。
- HTTPS 证书有效。
- DNS 正确。
- 微信公众平台 request 合法域名已配置。
- 真机可以访问对应域名。
- wanluu.com / WordPress 数据源可用。
- GitHub 服务端 Token/限流策略已在服务器安全配置。
- 外链行为符合微信小程序平台规则。

这些项目在代码测试 PASS 时仍保持 B，不自动升级为 C。
