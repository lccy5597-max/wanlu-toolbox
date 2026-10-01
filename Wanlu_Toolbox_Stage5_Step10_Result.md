# Stage 5 Step 10 Remote / Security / Privacy / Static Audit

## 1. 执行前基线

- Stage 5 Step 9：703 / 703 PASS。
- Stage 4：733 / 733 PASS。
- Stage 4 Static：20 / 20 PASS。
- Stage 3：PASS。
- `npm run check`：PASS，ERROR = 0，WARNING = 0。
- Stage 4 Baseline HEAD：`d8e198accaf874a26825c8b2b14404f44707e098`。
- 注册页面：36。
- Remote：development / production 均为 false。
- 真实网络：0。

## 2. Remote 状态

`config/environment.js` 继续固定：

```text
REMOTE_API_ENABLED = false
development = false
production = false
```

新增总审计规则禁止通过 `process.env`、Storage、启动参数或隐藏逻辑绕过正式 Remote 开关。

## 3. Base URL

正式 Stage 5 Base URL 继续仅为：

```text
https://api.example.com
```

未发现真实服务器 IP、wanluu.com API 地址、测试 API 地址或生产 API 地址。`config/api.example.js` 仍是未被生产代码导入的 placeholder 模板。

## 4. API Endpoint / Version

API Version：`v1`。

正式 Endpoint 继续使用相对路径：

```text
/api/v1/health
/api/v1/content/articles
/api/v1/content/articles/:id
/api/v1/github/rankings
```

Service 不自行拼接 Base URL。

## 5. Network Boundary

生产源码扫描确认：

```text
wx.request      → 仅 utils/api-transport.js
wx.uploadFile   → 仅 utils/image-moderation.js 既有 dormant 例外
fetch           → 0
XMLHttpRequest  → 0
api.github.com  → 0
/wp-json/       → 0
```

## 6. wx.request Boundary

普通 JSON API 的 `wx.request` 只允许统一 Adapter：

```text
utils/api-transport.js
```

Page / Service / 其他业务 utils 不允许直接 `wx.request`。

## 7. wx.uploadFile Existing Exception

唯一保留：

```text
utils/image-moderation.js
```

这是 Stage 4 已知 dormant 例外，本 Step 未删除、未启用、未重构。

## 8. Provider Direct Access

未发现生产直连：

- GitHub Provider API。
- WordPress REST Provider。
- OpenAI / DeepSeek / Gemini / 豆包等 AI Provider。

正式边界继续为 Mini Program → Wanlu API → Third Party Provider；当前 Wanlu API 仍未启用。

## 9. Secret Audit

高置信 Secret / Token / Password 扫描通过。

未发现真实：

- AppSecret。
- client_secret。
- API Key。
- access_token。
- session_key 明文 Secret。
- private_key。
- Authorization Bearer。
- GitHub PAT / `ghp_` / `github_pat_`。
- AI Provider Key。
- AWS Access Key。
- 数据库密码。

规则代码、测试负例、注释和 placeholder 不作为真实 Secret 误报。

## 10. AppID / Private Config

公开 `project.config.json`：

```text
appid = wx0000000000000000
```

`project.private.config.json`：

- 本地文件仍存在。
- `.gitignore` 继续忽略。
- `git ls-files project.private.config.json` 无输出。
- 未读取或输出私人配置值。

## 11. Content Architecture

继续保持：

```text
packageContent Page
→ services/content.js
→ API Client
```

Content Page 不直接依赖 API Client / Transport / Endpoint / Schema，不直连 WordPress。

## 12. Github Architecture

继续保持：

```text
packageGithub Page
→ services/github.js
→ API Client
```

GitHub Page 不直接依赖 API Client / Transport / Endpoint / Schema，不直连 `api.github.com`，不持有 GitHub Token。

## 13. AI Boundary

`packageAI` 与 `services/ai.js` 继续保持离线 Skeleton：

- 无真实 AI 请求。
- 无 Provider URL。
- 无 API Key。
- 无 Storage Key。
- 无公开入口。

## 14. Content Rich Text Security

Content Detail 继续使用原生：

```xml
<rich-text nodes="{{article.content}}"></rich-text>
```

不使用 WebView、`eval`、`new Function` 或客户端 HTML Runtime / Sanitizer。正式安全边界继续是服务端 Sanitized HTML + 客户端 Contract 验证。

## 15. Content Cache

固定：

```text
Key                    = wl_content_cache_v1
Version                = 1
List TTL               = 5 min
Detail TTL             = 30 min
Max Stale              = 24 h
List max entries       = 10
Detail max entries     = 30
Detail max content     = 200000 chars
```

Remote disabled 不允许 Cache 绕过；Fallback 条件继续由既有测试保护。

## 16. Stage 3 Storage Isolation

Content Cache 不读写：

```text
wl_meta_v1
wl_favorites_v1
wl_history_v1
wl_tool_usage_v1
wl_tool_state_v1
```

Stage 3 `SCHEMA_VERSION = 1` 保持不变。

## 17. Github Storage

新增 GitHub Storage Key：0。

未实现 GitHub Cache / History / Favorites / Profile。

## 18. Privacy

Stage 5 未新增实际收集：OpenID、UnionID、手机号、位置、联系人、麦克风、相机、设备唯一 ID、广告 ID、IMEI、Fingerprint 或用户画像。

既有离线 `utils/auth.js` Skeleton 的未来流程注释不等于 Stage 5 实际身份采集，`features.user` 仍关闭。

## 19. Permission

`app.json` 当前唯一 permission：

```text
scope.writePhotosAlbum
```

Stage 5 新增权限：0。

## 20. chooseMedia

`utils/image-picker.js` 继续强制 album-only；未恢复 camera 来源。

## 21. Analytics / Tracking

未发现 Stage 5 Analytics SDK、Tracking SDK、Fingerprint、阅读时长、GitHub Tab 偏好或用户兴趣画像记录。

## 22. Public Content Entry

首页 / 工具 / 发现 / 我的 / TabBar 均无 Content 正式入口。

## 23. Public Github Entry

首页 / 工具 / 发现 / 我的 / TabBar 均无 GitHub 正式入口。

## 24. Public AI Entry

首页 / 工具 / 发现 / 我的 / TabBar 均无 AI 正式入口。

## 25. TabBar

继续严格为：

```text
首页
工具
发现
我的
```

## 26. Fake Data

正式生产代码未导入或返回假文章、假 Repo、假 Stars、Example Ranking 或 Remote-disabled Mock Response。

## 27. Fixture Boundary

`scripts/fixtures/*` 仅供测试使用。生产 Page / Service / 业务 utils 不导入 Fixture。

## 28. Import Side Effect

新增 Step 10 自动测试确认以下核心模块 import / require 时均为 0 网络 / 0 Storage 写入：

- `utils/api-client.js`
- `utils/api-transport.js`
- `services/content.js`
- `services/content-cache.js`
- `services/github.js`

## 29. Dependency Audit

Stage 5 未新增第三方 runtime dependency。

当前 runtime dependency 仍只有：

```text
tdesign-miniprogram
```

## 30. Page Count

注册页面继续为：36。

## 31. Formal Tool Count

正式 `packageTools` 页面继续为：24。

Content / GitHub 未计入工具目录。

## 32. Hidden Tools

`wooden-fish` 与 `zodiac` 仍未注册到正式 `app.json` packageTools 页面，不恢复首页 / Search / Discovery / 推荐入口。

## 33. Logging

未发现 Stage 5 日志输出真实 Token、Secret、Authorization、Article HTML 全文或 Storage 全内容。

## 34. Stage 5 Static Rules

扩展统一规则源：

```text
scripts/stage5-static-rules.js
```

Step 10 总审计规则清单：48 项。

覆盖 Remote、Base URL、Endpoint、Network、Secret、Provider、AppID、Private Config、Page/Service 分层、Content Rich Text、Cache、Storage、Privacy、Permission、Public Entry、TabBar、Tool/Page Count 与 Dependency 等。

## 35. Negative Static Tests

新增：

```text
scripts/test-stage5-static-check.js
```

静态/安全回归：110 cases PASS。

负例通过内存字符串变体验证，不污染生产文件，可捕获包括：

- Remote true / process.env 隐藏开启。
- Page / Service direct `wx.request`。
- 新 `wx.uploadFile`。
- fetch / XMLHttpRequest。
- `api.github.com` / WordPress / AI Provider 直连。
- Secret / PAT / Authorization Bearer。
- 真实 Server IP / 非 placeholder Base URL。
- 真实 AppID。
- Private config ignore 丢失。
- Page 越层 API Client。
- Service 越层 Transport。
- Content / GitHub WebView。
- eval。
- Content Cache Key / Stage 3 Key 越界。
- GitHub / AI Storage。
- `wx.clearStorage`。
- OpenID / Fingerprint。
- Analytics。
- Camera permission / chooseMedia camera。
- Content / GitHub / AI 公开入口。
- TabBar 越界。
- Production Fixture / 假 Repo。
- GitHub 客户端排序 / Trending Score。
- Formal Tool / Hidden Tool / Page Count 回退。
- Stage 3 Schema 变化。
- 新 runtime dependency。
- dormant moderation 被启用或扩展网络栈。

## 36. Stage 5 Tests

```text
API / Transport / Contract       155
Content Service                   86
Content List Page                 66
Content Detail                    84
Content Cache / GitHub Boundary   91
GitHub Service                   109
GitHub Page                      112
Static / Security                110
------------------------------------
Total                            813
```

813 / 813 PASS。

## 37. Stage 4 Regression

733 / 733 PASS。

## 38. Stage 3 Regression

PASS。

## 39. npm run check

PASS。

`check-project` 的 Stage 5 项已升级为：

```text
Stage 5 Remote / Security / Privacy / Static 总审计
```

并实际接入统一 `runStage5StaticChecks()`。

## 40. P0 / P1 / P2

执行中未发现生产 P0 / P1 缺陷。

发现并修复 2 类 P2 防回退覆盖缺口：

1. Step 9 前尚无独立 Stage 5 总 Static/Security 负例测试入口。
2. 原 Stage 5 Static 对 tools/mine 公开入口、AppID/private-config、AI、dependency、Remote 隐藏开启等总审计覆盖不够完整。

修复后：

```text
P0 = 0
P1 = 0
P2 = 0
```

没有因此修改任何生产业务逻辑。

## 41. ERROR / WARNING

```text
ERROR = 0
WARNING = 0
```

## 42. B 类人工验收

继续保留：

- 微信开发者工具真实编译。
- iPhone / Android 真机。
- 不同微信版本。
- 真实网络与真实服务器联调。
- 微信 request 合法域名。
- 真实 HTTPS 证书。
- Content rich-text 真机表现。
- Storage 真机行为。
- 断网 Content Cache Fallback 真机。
- GitHub 三 Tab 真机体验。
- 微信审核 / 备案 / 隐私后台配置。

代码测试通过不等于以上 C 类通过。

## 43. 是否真实联网

```text
0
```

本 Step 未访问 `api.example.com`、`api.github.com`、wanluu.com、WordPress 或 AI Provider。自动测试全部使用本地 Fixture / Fake / Mock / Injected Client/Transport。

## 44. 是否具备进入 Step 11 条件

具备代码侧条件。

本 Step 未操作服务器、未执行 Git Commit / Push，未进入 Stage 5 Step 11。
