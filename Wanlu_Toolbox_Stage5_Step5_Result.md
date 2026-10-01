# Stage 5 Step 5 原生文章列表页执行结果

## 1. 执行前基线

- Stage 5：241 / 241 PASS。
- Stage 4：733 / 733 PASS。
- Stage 4 Static：20 / 20 PASS。
- Stage 3：PASS。
- `npm run check`：PASS，ERROR = 0，WARNING = 0。
- Stage 4 Baseline HEAD：`d8e198a`。
- development / production Remote 均为 false。

## 2. Content 页面目录结构

新增独立内容分包：

```text
packageContent/
└─ pages/
   └─ articles/
      ├─ articles.js
      ├─ articles.json
      ├─ articles.wxml
      └─ articles.wxss
```

同时新增纯逻辑 ViewModel：`utils/content-list-view-model.js`。

## 3. app.json 注册

新增：

```text
root = packageContent
name = content
pages = pages/articles/articles
```

注册后项目正式注册页面总数为 35。

## 4. 是否存在公开入口

不存在。

- 未加入 TabBar。
- 首页未增加文章入口。
- 发现页未增加文章入口。
- 工具页未增加文章入口。

当前页面仅可作为已注册、可编译的 Content 模块页面存在。

## 5. 页面状态模型

页面区分：

```text
initial
loading
success
empty
error
unavailable
loadingMore
```

并维护：`items / hasLoaded / page / pageSize / hasMore / errorView / loadMoreError`。

## 6. Initial Loading

`onLoad()` 首次调用 Content Service：

```text
getArticles({ page: 1, pageSize: 10 })
```

首次请求期间进入 `loading`，不会死 loading。

## 7. Client Disabled

当前默认 Remote 为 false。

默认 Content Service 返回 `client_disabled` 后，页面映射为用户可理解的：

```text
内容服务暂未启用
```

不显示 REMOTE_DISABLED / API Client / Transport 等技术词，不自动重试，不展示假文章。

## 8. Empty State

合法空列表：

```text
items = []
total = 0
hasMore = false
```

页面显示“暂时没有内容”，不视为 Error，不填充示例数据。

## 9. Error State

页面级纯函数将标准 Service Error 映射为有限用户状态：

- transport → 网络异常。
- retryable HTTP → 服务暂不可用。
- business / contract → 内容加载失败。
- client_disabled → 内容服务暂未启用。

不向 UI 暴露 code / statusCode / stack / errMsg。

## 10. Retry

首次加载 retryable error 支持用户点击“重新加载”。

- Retry 固定从 page = 1 开始。
- 正在 loading / loadingMore 时防重复。
- client_disabled 不提供无意义重复请求。

## 11. Pagination

页面固定：

```text
pageSize = 10
```

首次 page = 1；加载更多请求 `page + 1`；成功后同步服务端 pagination page / hasMore。

## 12. Duplicate ID

`mergeArticleItems()` 按文章 opaque `id` 做展示层去重。

- page 1 替换旧 items。
- page > 1 追加。
- 重复 id 只保留首次出现项。
- 不修改服务端 total。
- 不 mutate 原输入数组。

## 13. Async Stale Task

页面使用轻量 `_requestSeq`。

新 refresh / 请求产生新 task id；旧 Promise 后完成时如果 task id 已失效，不再覆盖新结果。

自动测试已覆盖“请求 B 先完成、请求 A 后完成，A 不覆盖 B”。

## 14. Page Unload

`onUnload()`：

- `_isPageActive = false`。
- 递增 `_requestSeq` 使旧任务失效。

自动测试确认页面退出后旧 Promise 完成不会继续 `setData`。

## 15. Article Card

列表只展示 Summary：

```text
title
excerpt
category
displayPublishTime
author（可选）
cover（可选）
```

不展示完整 `content`，不绑定文章详情跳转。

## 16. Cover

- cover 存在时显示 HTTPS 图片。
- cover 缺失/null 时安全隐藏图片区域。
- 图片加载失败只隐藏该文章封面，不删除文章卡片。
- 不使用远程假默认图片。

## 17. Publish Time

`formatPublishDate()` 将已验证 ISO 8601 时间显示为：

```text
YYYY-MM-DD
```

不实现“刚刚 / 昨天 / 3小时前”等复杂相对时间。

## 18. ViewModel

新增：

```text
utils/content-list-view-model.js
```

职责：

- 日期展示格式化。
- Summary → 页面展示对象。
- cover 展示状态。
- 分页 items 合并与 id 去重。
- Service Error → 页面安全状态。

不访问 wx、不访问 Storage、不访问 Service，不修改输入对象。

## 19. Storage Boundary

文章列表页未调用：

```text
wx.setStorage
wx.setStorageSync
storage.set/remove/clear
```

未新增 `wl_content_*`、`content_articles_cache` 等 Storage Key。

Stage 3 五个 Key 无修改。

## 20. Network Boundary

页面只调用 `services/content.js`。

页面没有：

```text
wx.request
wx.uploadFile
fetch
XMLHttpRequest
WordPress /wp-json/
wanluu.com 直连
```

统一 API Client / Transport 边界保持不变。

## 21. Fake Data Boundary

生产页面：

- 不 import `scripts/fixtures/*`。
- 不硬编码正式假文章。
- Remote disabled 时不返回 mock 内容。

Fixture 继续只存在测试目录。

## 22. Static Rules

Stage 5 Static Rule 扩展：

- packageContent 四文件必须存在。
- app.json 必须正确注册 packageContent。
- packageContent 不得进入 TabBar。
- 首页 / 发现页不得开放 Content 正式入口。
- Content 页面禁止直接网络调用。
- 禁止 Storage 写入。
- 禁止 fixture import。
- 禁止 WordPress / wanluu.com 直连。
- 禁止 WebView。
- 禁止列表 Rich Text / 完整 content 渲染。
- 禁止高可靠命中的硬编码假文章文案。

规则仅针对生产 Content 路径，不对测试 fixture / Markdown 做同类误报。

## 23. Stage 5 Tests

`npm run test-stage5`：

```text
Stage 5 API/Transport/Contract tests: PASS (155 cases)
Stage 5 Content Service tests: PASS (86 cases)
Stage 5 Content Page tests: PASS (66 cases)
```

Stage 5 合计：307 / 307 PASS。

Content Page Tests 覆盖：ViewModel、日期、cover、mutation、分页合并、id 去重、错误映射、首次加载、client_disabled、Retry、loadMore、防重入、stale task、unload、Static Rule、页面注册和公开入口边界。

自动测试真实公网请求：0。

## 24. Stage 4 Regression

`npm run test:stage4`：733 / 733 PASS。

## 25. Stage 3 Regression

`npm run test:stage3`：PASS。

Stage 4 Static：20 / 20 PASS。

## 26. npm run check

PASS。

扫描注册页面数：35。

页面四文件、usingComponents、WXML handler、导航、权限、Stage 3/4/5 防回退全部通过。

## 27. ERROR / WARNING

```text
ERROR = 0
WARNING = 0
```

## 28. 是否真实联网

否。

- REMOTE_API_ENABLED 未打开。
- development = false。
- production = false。
- 测试全部使用纯逻辑 / Fake Service / disabled default client。
- 未访问 api.example.com、wanluu.com、WordPress、GitHub。

## 29. 是否开放正式入口

否。

packageContent 已注册且可编译，但当前未加入首页、发现页、TabBar 或其他正式产品入口。

## 30. 是否具备进入 Step 6 条件

是。

当前已经具备 Step 6 原生文章详情页 + 安全 Rich Content 消费的代码基础，但本 Step 未创建详情页、未进入 Step 6。
