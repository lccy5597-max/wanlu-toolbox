# Stage 5 Step 8 GitHub Service 执行结果

## 1. 执行前基线

- Stage 5 Step 7：482 / 482 PASS。
- Stage 4：733 / 733 PASS。
- Stage 4 Static：20 / 20 PASS。
- Stage 3：PASS。
- `npm run check`：PASS，ERROR = 0，WARNING = 0。
- Stage 4 Baseline HEAD：`d8e198a`。
- 注册页面：36。
- Remote：development / production 均为 false。
- 真实联网：0。

## 2. Github Service Architecture

正式客户端链路保持：

```text
未来 packageGithub Page
→ services/github.js
→ utils/api-client.js
→ utils/api-transport.js
→ 未来挽鹿服务器
→ GitHub Provider
```

小程序侧不直连 `api.github.com`，不持有 GitHub Token。

## 3. createGithubService

`services/github.js` 正式提供：

```text
createGithubService({ apiClient })
```

支持注入 Fake API Client，便于 Node 自动测试。无效 Client 会抛出明确构造错误。

## 4. getRankings

统一业务入口：

```text
getRankings(period, { page, pageSize })
```

核心逻辑只有一套，不建立 daily / weekly / all 三套重复实现。

## 5. Period Contract

正式枚举仅为：

```text
daily
weekly
all
```

大小写严格，不自动 lowercase。`undefined`、`null`、空字符串、空白、别名、非字符串均返回 Contract Error。

## 6. Pagination

GitHub Rankings：

```text
page 默认 1
pageSize 默认 5
pageSize 最大 10
```

GitHub 输入使用严格安全整数校验；0、负数、NaN、Infinity、超过最大值等返回 Contract Error。Content 原有最大 pageSize 20 的语义未修改。

## 7. Endpoint

正式复用：

```text
API_ENDPOINTS.github.rankings
```

对应已冻结 Contract：

```text
GET /api/v1/github/rankings
```

`services/github.js` 不硬编码 Endpoint 字符串，也不拼 Base URL。

## 8. Request Query

只发送：

```text
period
page
pageSize
```

不发送 Authorization、GitHub Token、OpenID、UnionID、User ID、Device ID、Fingerprint、Location 或用户画像字段。

## 9. Repository Schema

继续复用 `utils/api-schema.js`，正式字段：

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

`id` 视为 opaque string。

`stars`：`Number.isSafeInteger` 且 `>= 0`。

`url`：HTTPS URL。

`updatedAt`：ISO 8601 且带明确时区。

单个 Repo 不合法时整个 Ranking Response 转为 Contract Error，不静默过滤。

## 10. Ranking Response

Service 输出稳定业务结构：

```text
{
  period,
  items,
  pagination
}
```

不把原始 API Envelope 暴露给未来页面。

## 11. Empty Ranking

合法：

```text
items = []
total = 0
hasMore = false
```

视为正常成功，不生成假仓库。

## 12. Order Preservation

Service 使用 `map` 创建新业务对象并保持服务器原顺序。

未调用 `.sort()`，不按 stars / updatedAt 在客户端重新排序。

## 13. Error Preservation

以下统一错误对象原样保留：

```text
client_disabled
transport
http
business
contract
```

Service 不 catch 后统一改写为普通 Error。

## 14. GITHUB_UPSTREAM_ERROR

服务器 Business Error：

```text
30054 GITHUB_UPSTREAM_ERROR
```

保持 Business Error，不转换为空榜单。

## 15. Remote Disabled

当前：

```text
development = false
production = false
```

默认 `githubService.getRankings('daily')` 返回 `client_disabled`。

使用 disabled API Client + injected transport 的自动测试确认 Transport 调用次数为 0。

## 16. Security

`services/github.js` 不包含：

```text
wx.request
wx.uploadFile
fetch
XMLHttpRequest
api.github.com
GitHub Token
Authorization Secret
完整 Server URL
Storage
Fixture import
生产 Mock 榜单
```

Repo 业务字段中的普通 HTTPS `github.com` URL 不被误判为 Provider API 直连。

## 17. Import Side Effect

模块 import / require：

```text
网络请求 = 0
Storage 调用 = 0
Timer = 0
```

Node 环境不需要 `global.wx`。

## 18. Mutation

Service 不修改 Fake Client / Fixture 原始对象。

Repo 输出为新对象，不添加 `displayStars`、`displayUpdatedAt`、`languageColor`、`rankLabel`、`periodLabel` 等 UI 字段。

## 19. Storage Boundary

Step 8 新增 GitHub Storage Key：

```text
0
```

未实现 GitHub Cache，未复用 `wl_content_cache_v1`，未修改 Stage 3 Storage。

## 20. packageGithub Boundary

`packageGithub` 页面保持 Step 7 Skeleton：

- 无 GitHub Service 消费。
- 无真实榜单 UI。
- 无首页入口。
- 无发现页入口。
- 无 TabBar。
- 无 Provider 直连。
- 无假榜单 / 假 Stars。

注册页面仍为 36。

## 21. Static Rules

Stage 5 Static 对 GitHub Service 新增/强化：

- 必须复用 `config/api-endpoints.js`。
- 必须复用统一 API Client。
- 必须复用 `utils/api-schema.js`。
- 禁止直接网络 Transport。
- 禁止 `api.github.com`。
- 禁止硬编码 Server URL / Endpoint。
- 禁止 Storage / GitHub Cache。
- 禁止 Fixture import。
- 禁止 GitHub Token / Authorization Secret。
- 禁止生产假榜单。
- 禁止客户端 `.sort()` / Trending Score。
- packageGithub 继续禁止公开入口和 Step 9 UI 抢跑。

## 22. Stage 5 Tests

新增：

```text
scripts/test-stage5-github.js
```

新增 GitHub Service 测试：

```text
109 cases
```

Stage 5 总数：

```text
155 API / Transport / Contract
86  Content Service
66  Content List Page
84  Content Detail
91  Content Cache / GitHub Boundary
109 GitHub Service
--------------------------------
591 cases
```

全部 PASS。

## 23. Stage 4 Regression

```text
733 / 733 PASS
```

## 24. Stage 3 Regression

```text
PASS
```

## 25. npm run check

```text
PASS
```

注册页面：36。

## 26. ERROR / WARNING

```text
ERROR = 0
WARNING = 0
```

## 27. 是否真实联网

```text
0
```

GitHub Service 自动测试全部使用 Fake API Client / disabled injected API Client；未访问 `api.github.com`、GitHub API、`api.example.com`、wanluu.com 或 WordPress。

## 28. 是否存在公开 GitHub 入口

不存在。

首页 / 发现页 / TabBar 均未增加 GitHub 入口；未新增 GitHub 页面。

## 29. 是否具备进入 Step 9 条件

具备代码侧条件。

本 Step 未操作服务器，未执行 Git Commit / Push，未进入 Stage 5 Step 9。
