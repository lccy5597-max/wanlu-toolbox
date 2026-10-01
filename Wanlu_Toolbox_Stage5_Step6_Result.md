# Stage 5 Step 6 原生文章详情页执行结果

## 1. 执行前基线

- Stage 5 Step 5：307 / 307 PASS。
- Stage 4：733 / 733 PASS。
- Stage 4 Static：20 / 20 PASS。
- Stage 3：PASS。
- `npm run check`：PASS，ERROR = 0，WARNING = 0。
- Stage 4 Baseline Commit：`d8e198accaf874a26825c8b2b14404f44707e098`。
- Remote：development / production 均保持 false。
- 当前无真实服务器、真实 wanluu.com API、WordPress API 或 Secret。

## 2. Detail 页面目录

新增：

```text
packageContent/pages/article-detail/article-detail.js
packageContent/pages/article-detail/article-detail.json
packageContent/pages/article-detail/article-detail.wxml
packageContent/pages/article-detail/article-detail.wxss
```

页面位于独立 `packageContent`，没有放入主包、packageTools、packageUser、packageAI 或 packageGithub。

## 3. app.json 注册

`packageContent` 当前注册：

```text
pages/articles/articles
pages/article-detail/article-detail
```

注册页面总数由 35 增加到 36。Content 仍不在 TabBar。

## 4. Route ID

新增 `utils/content-detail-view-model.js` 中的轻量 Route Helper：

```text
buildArticleDetailRoute(id)
parseArticleDetailRoute(options)
```

Article ID 保持 opaque string，不使用 `parseInt` / `Number`，对中文、空格、slash、query 特殊字符进行一次安全 encode/decode。无效 ID 不调用 Content Service。

## 5. List → Detail 导航

文章列表卡片现在使用 `wx.navigateTo()` 进入：

```text
/packageContent/pages/article-detail/article-detail?id=<encoded opaque id>
```

只传 Article ID，不传完整 article JSON、content 或 HTML，也不通过 Storage 传文章。

首页、发现页、TabBar 仍无 Content 正式入口。

## 6. Detail Loading

详情页首次合法加载：

```text
articleId
→ contentService.getArticleDetail(articleId)
→ loading
→ success / unavailable / not_found / error
```

重复加载期间会阻止第二个非强制请求。

## 7. Client Disabled

当前 Remote 仍为 false。默认直接打开详情页时，Content Service 返回 `client_disabled`，页面显示：

```text
内容服务暂未启用
```

不会真实联网、不会返回假详情、不会死 Loading，也不会循环 Retry。

## 8. Content Not Found

`code = 20004` + `business` 被独立映射为：

```text
文章不存在
```

不是网络异常，不进入 success，也不提供循环 Retry。

## 9. Error

详情页区分：

- transport
- HTTP
- business
- contract
- client_disabled
- content_not_found

普通用户只看到简短状态文案，不显示 code、statusCode、Schema、JSON、stack 或 Transport 技术信息。

## 10. Retry

仅 retryable 错误提供重新加载，并继续使用当前 opaque Article ID。Loading 中、防 client_disabled、防 not_found 重试均有自动测试。

## 11. Stale Request

详情页沿用轻量 `_requestSeq`。较旧请求晚完成时不会覆盖较新请求结果。

## 12. Page Unload

`onUnload()`：

```text
_isPageActive = false
_requestSeq + 1
```

页面退出后旧 Promise 完成不会继续 `setData`。

## 13. Detail ViewModel

新增：

```text
utils/content-detail-view-model.js
```

负责：

- opaque ID Route Helper
- Detail 展示对象映射
- `YYYY-MM-DD` 发布时间
- cover 可见状态
- Detail Error View 映射

输入对象不 Mutation。

## 14. Rich Content

正文继续遵循 Step 3 冻结的服务端 Sanitized HTML Contract。

客户端不实现 WordPress Parser，不重写正文，不 decode entity，不插入 CSS，不改变 `article.content` 字符串。

为避免空正文进入成功 UI，Detail ViewModel 仅执行非空存在性防线，不执行 HTML 清洗或内容重写。

## 15. Rich Text

详情正文使用微信原生：

```xml
<rich-text nodes="{{article.content}}"></rich-text>
```

未引入第三方富文本框架。

## 16. HTML Sanitizer 边界

客户端没有新增 HTML Sanitizer。

没有：

- DOMParser
- sanitize-html
- cheerio
- DOMPurify
- htmlparser
- Regex 清洗正文
- eval
- new Function

既有 `utils/api-schema.js` 仍只承担契约验证，不改写正文。核心 Sanitizer 责任继续属于未来服务器。

## 17. Cover

Detail cover 有值时展示；null / 空值不显示图片区域。图片加载失败只隐藏封面，不删除文章正文。

## 18. Meta

详情顶部展示：

- title
- category
- author（可选）
- publishTime → YYYY-MM-DD
- cover（可选）

未新增假阅读量、假点赞、假热度、假评论或假来源数据。

## 19. Storage Boundary

本 Step 新增 Storage Key：0。

没有写：

```text
wl_meta_v1
wl_favorites_v1
wl_history_v1
wl_tool_usage_v1
wl_tool_state_v1
```

没有文章 History、Favorites 或 Content Cache。

## 20. Network Boundary

详情页只调用 `services/content.js`。

没有直接：

- wx.request
- wx.uploadFile
- fetch
- XMLHttpRequest
- API Client
- Transport
- api-endpoints
- WordPress
- wanluu.com

Remote development / production 均保持 false。

## 21. Security

详情生产代码没有真实 Server URL、Secret、Token、API Key、AppSecret、Password。

列表 → 详情仅传 opaque ID；不把正文写入 Route 或 Storage。

## 22. Static Rules

Stage 5 Static Rule 扩展到 Detail Page，检查：

- 页面四文件存在
- app.json 注册正确
- packageContent 不在 TabBar
- 只经 Content Service
- 禁止直接网络
- 禁止 Storage Write
- 禁止 Fixture Import
- 禁止 WordPress / Server / Provider 直连
- 禁止 WebView
- 必须使用 rich-text
- 禁止 eval / new Function
- 禁止第三方 HTML Parser / Sanitizer
- 禁止主动分享 Hook

首次完整 `npm run check` 检出 WXML 使用了不合法的 `<article>` 标签；已最小修正为原生 `<view>`，随后完整回归通过。

## 23. Stage 5 Tests

新增：

```text
scripts/test-stage5-content-detail.js
```

`npm run test-stage5` 继续作为唯一总入口：

```text
API / Transport / Contract：155 PASS
Content Service：86 PASS
Content Page：66 PASS
Content Detail：84 PASS
总计：391 / 391 PASS
```

自动测试真实网络请求：0。

## 24. Stage 4 Regression

```text
npm run test:stage4
733 / 733 PASS
```

24 个正式工具、Search、Discovery、Interaction 未破坏。

## 25. Stage 3 Regression

```text
npm run test:stage3
PASS
```

Stage 3 Storage / Schema 未修改。

## 26. npm run check

最终：PASS。

扫描注册页面：36。

## 27. ERROR / WARNING

```text
ERROR = 0
WARNING = 0
```

## 28. B 类真机验收

以下继续保持 B 类，未自动宣称真机 PASS：

- rich-text 实际排版
- 富文本远程图片尺寸与加载
- 超长文章滚动性能
- iPhone 真机
- Android 真机
- 微信真实 List → Detail 导航
- 富文本链接表现
- 文字选择行为
- 不同微信版本 rich-text 兼容性

## 29. 是否真实联网

否。真实网络请求为 0。

未访问 api.example.com、wanluu.com、WordPress、GitHub 或任何第三方。

## 30. 是否存在公开 Content 入口

否。

虽然 articles / article-detail 均已注册和可编译，但首页、发现页、TabBar 仍没有 Content 正式入口。

## 31. 是否具备进入 Step 7 条件

是。代码侧 Step 6 已满足当前自动验收条件。

未进入 Stage 5 Step 7；未操作服务器；未执行 Git commit / push。
