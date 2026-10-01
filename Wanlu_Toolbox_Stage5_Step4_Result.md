# Stage 5 Step 4 Content Service 执行结果

## 1. 执行前基线

- Stage 5 Step 3：155 / 155 PASS。
- Stage 4：733 / 733 PASS。
- Stage 4 Static：20 / 20 PASS。
- Stage 3：PASS。
- `npm run check`：PASS，ERROR = 0，WARNING = 0。
- Stage 4 Baseline Commit：`d8e198accaf874a26825c8b2b14404f44707e098`。
- `development` / `production` Remote 均保持 `false`。
- Base URL 继续为 `https://api.example.com` placeholder。

## 2. Content Service 架构

本 Step 将 `services/content.js` 从离线占位骨架实装为正式 Content 业务 Service：

```text
未来文章页面
→ services/content.js
→ utils/api-client.js
→ utils/api-transport.js
→ 未来挽鹿服务器
```

Service 不直接实现网络 Transport，不直接访问 WordPress，不操作 Storage，不实现页面状态或 UI。

## 3. createContentService

新增正式工厂：

```text
createContentService({ apiClient })
```

- 支持注入 Fake / Mock API Client。
- 默认使用项目统一 `apiClient`。
- 注入对象必须提供 `get()`。
- 模块加载时不发请求、不写 Storage、不启动 timer、不依赖 Node 全局 `wx`。

## 4. getArticles

正式提供：

```text
getArticles(options)
```

支持：

- `page`
- `pageSize`
- `category`（可选）

调用正式 Endpoint：

```text
GET /api/v1/content/articles
```

通过统一 `apiClient.get()` 发起业务调用，不直接使用 Transport。

## 5. getArticleDetail

正式提供：

```text
getArticleDetail(id)
```

`id` 按 opaque string 处理，trim 后验证非空，不 `parseInt`，不假设 WordPress 数字 ID。

Endpoint 统一由 `config/api-endpoints.js` 构建并负责 `encodeURIComponent`：

```text
GET /api/v1/content/articles/:id
```

## 6. Input Validation

- `options` 必须为普通对象语义。
- `page` / `pageSize` 只在未提供时使用默认值。
- `null`、空字符串、0、负数、NaN、Infinity 等非法显式分页输入返回 Contract Error。
- 数字字符串可按统一 schema 规范化为整数。
- `category` 可选；`undefined` / `null` / 空白字符串不发送。
- 非字符串 category 返回 Contract Error。
- article id 必须为非空字符串。

## 7. Pagination

继续复用 Step 3 规范：

```text
page 默认 1，最小 1
pageSize 默认 10，最大 20
```

响应必须通过 `validatePagination()`：

```text
page
pageSize
total
hasMore
```

负 total、非法 page/pageSize、非 boolean hasMore、hasMore 与 total 不一致均不能作为成功数据进入业务层。

## 8. Article Summary Schema

列表项继续唯一复用 `validateContentSummary()`：

```text
id
title
excerpt
cover
publishTime
category
author?
```

要求：

- id 为非空 opaque string。
- title 非空。
- excerpt 为字符串。
- cover 为 HTTPS 完整 URL 或 Contract 允许的空字符串。
- publishTime 为带时区 ISO 8601。
- category 非空。
- author 可选。

列表 Service 输出不会带入 Detail `content` 字段。

## 9. Article Detail Schema

详情继续唯一复用 `validateContentDetail()`：

```text
id
title
content
publishTime
category
author?
cover?
```

`content` 仅接受符合已冻结 sanitized HTML Contract 的字符串。Content Service 不做 HTML 清洗、不做 replace/regex sanitizer、不注入样式。

## 10. API Endpoint

Content Service 只使用：

```text
API_ENDPOINTS.content.articles
API_ENDPOINTS.content.articleDetail(id)
```

没有在 Service 内硬编码 `/api/v1/content/...`，没有自行拼 Base URL。

## 11. Error Preservation

API Client 已标准化错误时，Content Service 保留原错误语义，不统一改写为模糊“加载失败”。

继续保留：

```text
client_disabled
contract
transport
http
business
```

`20004 CONTENT_NOT_FOUND` 保持 Business Error；HTTP 503 的 `retryable = true` 不被破坏。

Content Schema / Pagination 违反契约时转换为 Content Contract Error。

## 12. Remote Disabled

默认项目 `apiClient` 仍为 disabled。

生产默认 Content Service 调用得到：

```text
REMOTE_DISABLED
client_disabled
```

并在 Transport 前停止，不产生真实网络请求。

## 13. Fixture / Mock

新增独立 Content Service 自动测试，全部通过 Fake / Injected API Client 完成。

Fixture 扩展保持在：

```text
scripts/fixtures/stage5-api-contract.js
```

新增典型 fixture：

- empty article list
- invalid article summary
- invalid article detail
- invalid pagination

生产 `services/content.js` 不导入 fixture，不在 Remote disabled 时返回假文章。

## 14. Security

确认 `services/content.js`：

- 无 `wx.request`
- 无 `wx.uploadFile`
- 无 `fetch`
- 无 `XMLHttpRequest`
- 无 `/wp-json/`
- 无 WordPress Provider 直连
- 无完整 Server URL
- 无 Secret / Token / Password
- 无用户 ID / OpenID / Authorization 注入

## 15. Storage Boundary

Content Service 本 Step 不写 Storage，不建立 Cache，不复用 Stage 3 五个 Key：

```text
wl_meta_v1
wl_favorites_v1
wl_history_v1
wl_tool_usage_v1
wl_tool_state_v1
```

远程缓存仍留到 Step 7。

## 16. Mutation

自动测试确认：

- List Fixture 调用前后深度一致。
- Detail Fixture 调用前后深度一致。
- Service 通过新对象返回稳定业务数据。
- 不对原始 `items` 原地排序或改字段。

## 17. Static Rules

扩展 `scripts/stage5-static-rules.js`，针对正式 Content Service 固化：

- 必须复用 `config/api-endpoints.js`。
- 必须复用 `utils/api-schema.js`。
- 禁止完整 Server URL。
- 禁止 Service 内硬编码 `/api/v1/` Endpoint。
- 禁止 Storage 写入。
- 禁止导入 `scripts/fixtures/*`。
- 禁止明显硬编码假文章。
- 既有页面/Service 禁止直接 `wx.request` 与第三方 Provider 直连规则继续生效。

测试脚本和 fixture 不作为正式生产路径误报。

## 18. Stage 5 Tests

`npm run test-stage5` 当前统一执行：

```text
Stage 5 API/Transport/Contract tests: 155 cases
Stage 5 Content Service tests: 86 cases
```

合计：

```text
241 / 241 PASS
```

Content 测试覆盖 construction、输入、分页、category、Endpoint、Summary/Detail Schema、空列表、opaque ID 编码、错误保持、Remote disabled、Mutation、Static Rule、安全边界与无真实联网。

## 19. Stage 4 Regression

```text
452 tools
53 search
30 search integration
57 discovery
71 discover integration
70 interaction
```

合计 `733 / 733 PASS`。

Stage 4 Static：`20 / 20 PASS`。

## 20. Stage 3 Regression

`npm run test:stage3`：PASS。

Stage 3 Storage / Schema 未修改。

## 21. npm run check

`npm run check`：PASS。

Stage 5 API / Client / Transport / Content 网络边界检查通过。

## 22. ERROR / WARNING

```text
ERROR = 0
WARNING = 0
```

## 23. 是否真实联网

否。

自动测试全部使用 fixture、Fake Client、Injected Transport；没有访问 `api.example.com`、`wanluu.com`、WordPress、GitHub 或其他公网服务。

## 24. 是否操作服务器

否。

未执行 SSH、Nginx、Docker、数据库、DNS、微信后台或部署操作。

## 25. 是否具备进入 Step 5 条件

是。

Step 4 已完成 Content Service 业务层，且 Stage 3 / Stage 4 / Stage 5 全部自动测试与静态检查通过。但本 Step 未进入 Stage 5 Step 5，必须等待用户确认。
