# Stage 5 Step 9 GitHub 榜单移动端 UI 执行结果

## 1. 执行前基线

- Stage 5 Step 8：591 / 591 PASS。
- Stage 4：733 / 733 PASS。
- Stage 4 Static：20 / 20 PASS。
- Stage 3：PASS。
- `npm run check`：PASS，ERROR = 0，WARNING = 0。
- Stage 4 Baseline HEAD：`d8e198a`。
- 注册页面：36。
- Remote：development / production 均为 false。
- 真实联网：0。

## 2. packageGithub 页面

继续使用既有 `packageGithub/pages/index/index`，未新增 GitHub 页面。原 Skeleton UI 已替换为正式移动端 GitHub 榜单页面，但没有首页、发现页或 TabBar 公开入口。

## 3. Period Tabs

同一页面固定 3 个 Tab：

```text
今日 → daily
本周 → weekly
总榜 → all
```

默认选中 `daily`。

## 4. Daily

固定调用：

```text
githubService.getRankings('daily', { page: 1, pageSize: 5 })
```

## 5. Weekly

切换“本周”后固定调用：

```text
githubService.getRankings('weekly', { page: 1, pageSize: 5 })
```

## 6. All

切换“总榜”后固定调用：

```text
githubService.getRankings('all', { page: 1, pageSize: 5 })
```

## 7. Github Service Integration

页面只依赖 `services/github.js` 和纯展示 ViewModel，不直接依赖 API Client、Transport、Endpoint 或 Schema。

## 8. Page State

支持：

```text
initial
loading
success
empty
error
unavailable(client_disabled)
```

不实现 loadingMore、无限滚动或第二页请求。

## 9. Client Disabled

Remote 默认关闭时页面显示：

```text
GitHub 榜单服务暂未启用
```

不展示 `REMOTE_DISABLED`、`client_disabled`、Transport 等技术信息，不生成假榜单，不循环 Retry。

## 10. Empty

合法空榜单显示：

```text
暂时没有榜单数据
```

空状态不是 Error，不补示例 Repo。

## 11. Error

Transport / HTTP / Business / Contract 统一映射为简洁用户文案，不暴露 HTTP 状态、业务错误码或堆栈。

## 12. Retry

仅 `error.retryable = true` 的错误显示“重新加载”。Retry 重新请求当前 `selectedPeriod`，参数仍固定为 `page=1`、`pageSize=5`，并防止加载中的重复 Retry。

## 13. Stale Request

页面使用 `_requestSeq`。快速切换 daily / weekly / all 时，旧请求即使更晚返回，也不能覆盖当前选中的 period。

## 14. Page Unload

`onUnload()` 将页面标记为 inactive 并递增 `_requestSeq`。页面退出后，旧 Promise 完成不会继续 `setData`。

## 15. Repository Card

移动端单列卡片展示：

```text
rank
name
fullName
description（有值才显示）
stars
language（有值才显示）
updated date
```

不展示 URL，不绑定 Repo 点击行为。

## 16. Rank

Rank 只按服务器返回数组顺序生成：

```text
rank = index + 1
```

不根据 Stars、时间或语言重新排序。

## 17. Stars

ViewModel 保留原始整数 `stars`，并生成轻量展示字符串：

```text
0      → 0
999    → 999
1000   → 1k
1250   → 1.3k
12000  → 12k
12500  → 12.5k
1000000 → 1m
```

最多 1 位小数，不修改 Service 原始 stars。

## 18. Language

有合法语言字符串时显示纯文字；`null` / 空值在 ViewModel 层隐藏，不生成 `Unknown`，不建立语言颜色数据库。

## 19. Updated Date

ISO 8601 `updatedAt` 在 ViewModel 中展示为：

```text
YYYY-MM-DD
```

不实现“3 小时前”等相对时间。

## 20. ViewModel

新增：

```text
utils/github-ranking-view-model.js
```

纯函数负责 Period Tab、Rank、Stars、日期、可选字段和 Error View 映射。无 wx、Storage、Service、Provider 网络依赖；不排序、不计算 Trending Score；不 Mutation 输入 Repository。

## 21. External Link Boundary

本 Step 不使用 WebView，不调用外部浏览器，不复制 Repository URL，不绑定 Repo Card 跳转。普通 Repository `github.com` URL 仍只属于 Service 数据字段，不在页面主动消费。

## 22. Storage Boundary

GitHub 页面与 ViewModel 不访问 Storage。

新增 GitHub Storage Key：

```text
0
```

未实现 GitHub Cache，未复用 `wl_content_cache_v1`，未修改 Stage 3 五个 Key。

## 23. Public Entry Boundary

继续保持：

- 首页无 GitHub 入口。
- 发现页无 GitHub 入口。
- TabBar 无 GitHub。
- `packageGithub` 仍只有 `pages/index/index` 一个页面。
- 注册页面总数仍为 36。

## 24. Security

`packageGithub` 页面禁止并实际不存在：

```text
wx.request
wx.uploadFile
fetch
XMLHttpRequest
api.github.com
GitHub Token
Authorization Secret
Storage write
Fixture import
WebView
生产假 Repo
远程 Repo Avatar / image
```

## 25. Static Rules

Stage 5 Static 已扩展：

- packageGithub Step 9 页面必须通过 GitHub Service。
- 页面禁止依赖 API Client / Transport / Endpoint / Schema。
- 禁止 Provider 直连、Storage、Fixture、Secret、WebView、外链打开/复制。
- 禁止硬编码假 Repo / 假 Stars。
- GitHub ViewModel 必须保持纯展示逻辑。
- ViewModel 禁止排序和 Trending Score。
- 固定 daily / weekly / all → 今日 / 本周 / 总榜。
- 固定 default daily、page=1、pageSize=5。
- 禁止第 2 页。
- 禁止 Repo Avatar / 远程图片。
- 首页、发现页、TabBar 继续禁止公开 GitHub 入口。

## 26. Stage 5 Tests

新增：

```text
scripts/test-stage5-github-page.js
```

新增 GitHub Page Tests：

```text
112 cases
```

Stage 5 总数：

```text
155 API / Transport / Contract
86  Content Service
66  Content List Page
84  Content Detail
91  Content Cache / GitHub Boundary
109 GitHub Service
112 GitHub Page
--------------------------------
703 cases
```

全部 PASS。

## 27. Stage 4 Regression

```text
733 / 733 PASS
```

## 28. Stage 3 Regression

```text
PASS
```

## 29. npm run check

```text
PASS
```

注册页面：36。

## 30. ERROR / WARNING

```text
ERROR = 0
WARNING = 0
```

## 31. B 类人工验收

仍需后续人工/真机确认：

- 微信开发者工具真实编译。
- 今日 / 本周 / 总榜三 Tab 真机点击体验。
- iPhone。
- Android。
- 不同微信版本。
- 窄屏适配。
- 超长 Repo 名。
- 超长 Description。
- 不同语言名称。
- 超大 Stars 数。
- 页面滚动。
- TDesign 样式兼容。
- Remote 开启后的真实榜单联网与服务端数据。

本 Step 未将这些项目声明为 C 类通过。

## 32. 是否真实联网

```text
0
```

GitHub Page 自动测试全部使用 Fake Github Service / Page Harness；未访问 `api.example.com`、`api.github.com`、wanluu.com 或 GitHub API。

## 33. 是否具备进入 Step 10 条件

具备代码侧条件。

本 Step 未操作服务器，未执行 Git Commit / Push，HEAD 仍为 `d8e198a`；未进入 Stage 5 Step 10。
