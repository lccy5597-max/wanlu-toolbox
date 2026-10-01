# Stage 5 Step 7 Content Cache / Fallback 执行结果

## 1. 执行前基线

- Stage 5 Step 6：391 / 391 PASS。
- Stage 4：733 / 733 PASS。
- Stage 4 Static：20 / 20 PASS。
- Stage 3：PASS。
- `npm run check`：PASS，ERROR = 0，WARNING = 0。
- Stage 4 Baseline HEAD：`d8e198a`。
- Remote：development / production 均为 false。
- 真实联网：0。

## 2. Cache Architecture

新增 `services/content-cache.js`。正式链路为：

```text
Page
→ Content Service
→ API Client（Network First）
→ 成功：写 Content Cache
→ retryable network/http failure：尝试 Content Cache fallback
```

页面不知道 Storage Key，不直接访问 Cache。

## 3. Storage Namespace

Content Cache 使用独立 Key：

```text
wl_content_cache_v1
```

未修改或复用 Stage 3：

```text
wl_meta_v1
wl_favorites_v1
wl_history_v1
wl_tool_usage_v1
wl_tool_state_v1
```

## 4. Cache Schema

```text
version = 1
entries = { ... }
```

每个 Entry 包含：

```text
type
key
cachedAt
expiresAt
data
```

仅保存通过 Content Contract 的公开业务数据，不保存用户身份、Token、Header、Authorization、请求对象或设备信息。

## 5. List Cache

List Cache Key 稳定包含：

```text
page
pageSize
category
```

不同分页、pageSize、category 不互相覆盖。每页独立缓存，不缓存页面层 merge 后的列表 ViewModel。

## 6. Detail Cache

Detail Cache 根据 opaque Article ID 建立：

```text
detail:id=<encoded opaque id>
```

不使用 parseInt，不把正文 HTML 放入 Cache Key。

## 7. TTL

```text
LIST_TTL_MS   = 5 分钟
DETAIL_TTL_MS = 30 分钟
```

## 8. Max Stale

```text
MAX_STALE_MS = 24 小时
```

Network First 下 fresh / stale 都不会主动绕过网络。只有符合 fallback 条件的网络失败才读取缓存；超过 `expiresAt + 24h` 的 Entry 视为 expired/miss。

## 9. Capacity

```text
List Entries 最大 10
Detail Entries 最大 30
```

超限按 cachedAt 淘汰最旧 Entry，不实现复杂 LRU。

## 10. Oversize Policy

单条 Detail `content` 最大缓存字符数：

```text
200000
```

超过限制时不写 Cache，但网络成功仍正常返回页面。

## 11. Network First

正常请求始终先调用 Content API。远程成功且 Schema/Contract 验证通过后才写 Cache，并返回：

```text
source = network
isFallback = false
cachedAt = null
```

未实现 Cache First 或后台静默刷新。

## 12. Fallback Conditions

仅允许：

```text
transport error
HTTP error + retryable = true
```

因此 429 / 500 / 503 可尝试 Cache fallback。

Cache 命中时返回：

```text
source = cache
isFallback = true
cachedAt = <cache timestamp>
```

## 13. No-Fallback Conditions

以下不允许缓存覆盖：

```text
client_disabled
business error
CONTENT_NOT_FOUND
contract error
HTTP 400
HTTP 401
HTTP 404
```

无可用 Cache 时保留并返回原始错误对象。

## 14. Client Disabled

当前 Remote 仍为 false。`client_disabled` 不读取 Cache，不显示旧文章，页面继续显示：

```text
内容服务暂未启用
```

## 15. Cache Metadata

Content Service 的本地业务结果增加轻量 metadata：

```text
source
isFallback
cachedAt
```

未修改 Server Envelope Contract。

## 16. Content Service Integration

`services/content.js` 仅为 Cache/Fallback 集成做修改：

- Endpoint 不变。
- Pagination 不变。
- Article Schema 不变。
- Error Contract 不变。
- Content Service 不直接写 Storage，而是调用 `services/content-cache.js`。
- Cache 读写异常不会把网络成功降级为失败。

## 17. List Page Integration

文章列表增加：

```text
isFallback
```

fallback 成功时最终状态仍为 success/empty，不是 error + content 双状态。

页面轻量显示：

```text
当前显示缓存内容
```

Page 2 fallback 可继续 append 缓存页，并保留已有 Page 1 内容。

## 18. Detail Page Integration

文章详情 fallback 成功仍进入 success，并显示：

```text
当前显示缓存内容
```

`client_disabled`、`CONTENT_NOT_FOUND`、contract 等继续保持原状态，不显示 fallback hint。

## 19. Storage Error

Storage read/write/remove 均为增强能力：

- Cache read fail → miss，保留原网络错误。
- Cache write fail → 网络成功仍成功。
- Cache clear fail → 返回显式失败，不影响其他数据。

## 20. Corrupt Cache

以下均安全视为 miss：

- Version 不匹配。
- Root Schema 损坏。
- Entry Schema 损坏。
- 时间字段非法。
- Article 数据不再通过 Content Schema。

修复/清理只作用于 `wl_content_cache_v1`。

## 21. Mutation

Cache 写入使用受控 JSON-safe 结构复制，不修改 Content Service 原始数据。

Cache 读取返回独立副本，页面修改返回对象不会污染内部 Cache。

## 22. Security

Content Cache 不保存：

```text
OpenID
UnionID
User ID
Device ID
Fingerprint
Token
Authorization
Secret
Header
Request Object
```

不新增 Analytics、Tracking、阅读时长、兴趣权重或隐藏用户画像。

## 23. packageGithub Controlled Opening

`packageGithub` 从旧“阶段 2 预留骨架”文案调整为 Stage 5 受控开发模块状态，但仍未向用户开放。

当前：

- 仍只有既有 `pages/index/index` skeleton。
- 无首页入口。
- 无发现页入口。
- 无 TabBar。
- 无 wx.request / fetch。
- 无 `api.github.com`。
- 无 GitHub Token。
- 无假榜单 / 假 Stars。
- packageGithub 页面未消费 `services/github.js`。

`services/github.js` 本 Step 未修改、未实装。其既有旧 placeholder endpoint 常量留给 Step 8 按已冻结 API Spec 正式替换，不在 Step 7 抢跑。

## 24. Static Rules

Stage 5 Static 新增：

- Content Cache 独立 Key。
- 禁止其它 `wl_content_*` profile/history/recommend Key。
- 禁止 Content Cache 读写 Stage 3 五个 Key。
- Content Cache 必须通过 `services/storage.js` Adapter。
- 禁止 Content Cache 直接 `wx.*Storage`。
- 禁止 `wx.clearStorage` / 全局清理。
- `clearContentCache()` 只删除 Content Key。
- packageContent 页面禁止直接读/写 Storage 或 Content Cache。
- packageGithub 保持无网络、无 Provider 直连、无假榜单、无正式入口。

## 25. Stage 5 Tests

新增：

```text
scripts/test-stage5-content-cache.js
```

新增 91 cases。

Stage 5 总数：

```text
155 API / Transport / Contract
86  Content Service
66  Content List Page
84  Content Detail
91  Content Cache / GitHub Boundary
--------------------------------
482 cases
```

全部 PASS。

## 26. Stage 4 Regression

```text
733 / 733 PASS
```

## 27. Stage 3 Regression

```text
PASS
```

## 28. npm run check

```text
PASS
```

注册页面仍为 36。

## 29. ERROR / WARNING

```text
ERROR = 0
WARNING = 0
```

## 30. B 类人工验收

仍需后续平台/真机确认：

- 微信 Storage 真机行为。
- Content Cache 容量与性能。
- 超长正文缓存行为。
- 断网后 fallback。
- 网络恢复后重新刷新。
- iPhone / Android。
- 不同微信版本 Storage 差异。
- rich-text + 缓存正文真实表现。

本 Step 未将这些项目声明为 C 类通过。

## 31. 是否真实联网

```text
0
```

测试使用 Fake API Client、Memory Storage、Injected Clock。未访问 api.example.com、wanluu.com、WordPress、GitHub 或 AI Provider。

## 32. 是否具备进入 Step 8 条件

具备代码侧条件。

本 Step 未执行 Git Commit / Push，HEAD 仍为 `d8e198a`；未操作服务器；未进入 Stage 5 Step 8。
