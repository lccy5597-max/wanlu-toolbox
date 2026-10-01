# 挽鹿工具箱 Stage 5 执行约束

> 本文件是 Stage 5 每一个 Step 的强制执行边界。除非用户在当前 Step 明确授权例外，否则不得突破。

## 1. 不自动跨 Step

- 每个 Step 只执行用户明确批准的范围。
- 完成后必须输出结果并停止。
- 未获得用户确认，不进入下一 Step。

## 2. 不自动进入下一 Stage

- Stage 5 完成后不得自动开始 AI、登录、会员、支付、广告或任何下一 Stage。
- 下一 Stage 必须由用户明确授权。

## 3. Stage 4 正式基线不可无意破坏

默认必须保持：

- 24 个正式工具。
- Stage 4 功能测试 733 cases。
- Stage 4 Static 20 cases。
- Stage 3 PASS。
- `npm run check` ERROR = 0 / WARNING = 0。
- `wooden-fish` / `zodiac` 无正式入口。

如某 Step 必须突破基线，先说明：原因、影响文件、迁移方案、回归方案，并等待用户确认。

## 4. 不在前端存 Secret

小程序源码、配置、Storage、日志中禁止出现真实：

- AppSecret
- API Key
- GitHub Token
- WordPress 管理凭据
- AI Key
- 数据库密码
- server secret
- session_key
- private key

Base URL 不属于 Secret，但必须使用 HTTPS 正式域名并按环境区分。

## 5. 远程请求必须统一封装

正式架构必须保持：

```text
页面
↓
业务 Service
↓
统一 API Client
↓
自有服务器
```

禁止：

- 页面大量直接 `wx.request`。
- 页面直接请求 GitHub API。
- 页面直接携带第三方 Token。
- 页面自己实现 timeout / error mapping / response envelope。

只有统一 API Client 可以承担底层网络 transport；业务 Service 负责业务 normalizer。

## 6. 不破坏 Stage 3 本地数据

必须继续保护：

```text
wl_meta_v1
wl_favorites_v1
wl_history_v1
wl_tool_usage_v1
wl_tool_state_v1
```

以及：

- `SCHEMA_VERSION = 1`，除非单独批准数据迁移 Step。
- Favorites Tombstone。
- Usage `aggregate-no-tombstone`。
- Recent `recentClearedAt`。
- clearRecent 不清 useCount。
- Tool State 白名单。

远程内容 cache 不得复用这五个业务 Key。

## 7. 不破坏 Stage 4 Search

正式文本搜索继续唯一使用：

```text
utils/tool-search.js
```

禁止远程内容功能：

- 修改工具 Search 评分。
- 用 Usage / Favorites / History 改工具文本搜索排名。
- 把文章搜索逻辑混入工具 Search。
- 在首页 / 工具页重新实现第二套工具匹配算法。

远程文章若未来需要搜索，应使用独立内容搜索 Service，并单独规划。

## 8. 不破坏 Discovery

本地工具 Discovery 继续使用：

```text
pages/discover
→ services/discovery.js
→ Stage 3 Service
```

禁止 Stage 5：

- 修改现有推荐权重而未单独批准。
- 建立隐藏用户画像。
- 把远程文章热度伪装成现有工具 Discovery。
- 用远程数据替换 EMPTY / LIGHT / RICH 本地工具逻辑。

若未来发现页增加远程内容区块，必须单独 Step、明确数据源和去重职责。

## 9. 不恢复 wooden-fish / zodiac

Stage 5 全程：

- 不加入 tool-catalog。
- 不注册为正式工具。
- 不加入首页 / 工具页 / 发现页入口。
- 不通过搜索或远程配置恢复。

除非用户未来明确重新评估并批准。

## 10. 不自动开放 packageAI / packageGithub

- `packageAI` 默认继续隔离。
- `packageGithub` 只有在 Stage 5 对应“受控开放”Step 经用户确认后才允许加入正式入口。
- 不得因为目录已存在就默认视为正式功能。

## 11. 不自动新增敏感权限

默认禁止新增：

- camera
- location
- microphone
- contacts

媒体选择继续遵循 album-only 基线，除非用户单独批准权限变化并完成隐私/审核评估。

## 12. 不自动修改微信后台

Stage 5 代码执行不自动完成：

- request 合法域名
- download/upload 合法域名
- WebView 业务域名
- 隐私保护指引
- 服务类目
- 备案
- 版本上传
- 提审
- 发布

这些继续属于 B/C 类人工事项。

## 13. 不自动操作服务器

任何服务器操作必须用户在对应 Step 明确授权。

未经授权不得：

- SSH 登录服务器。
- 部署服务。
- 修改 Nginx。
- 修改 DNS。
- 修改数据库。
- 写入生产 Secret。
- 重启生产服务。

Step 0 只规划服务器角色。

## 14. 不自动 Git commit / push

当前 worktree 非 clean。

未经用户明确授权，禁止：

```text
git commit
git push
git reset
git restore
git checkout .
git clean
git stash
```

允许只读：

```text
git status
git diff
git diff --stat
git log
git show
```

在正式 Stage 5 代码开发前建议人工确认 Stage 2～4 变更并建立 Stage 4 baseline commit，但真正 commit 必须用户明确授权。

## 15. 所有 B 类保持人工验收

B 类包括但不限于：

- 真实服务器。
- DNS / HTTPS。
- 微信 request 合法域名。
- wanluu.com 真实数据。
- GitHub 真实代理。
- 外链 / WebView。
- 弱网真机行为。
- 微信后台。
- iPhone / Android。

代码自动 PASS 不得自动改为 C。

## 16. 每一步必须回归 Stage 3 / Stage 4

每个 Stage 5 Step 完成后至少执行：

```bash
npm run test:stage4
npm run test:stage4:static
npm run test:stage3
npm run check
```

并继续要求：

```text
Stage 4 = 733 / 733 PASS
Stage 4 Static = 20 / 20 PASS
Stage 3 = PASS
ERROR = 0
WARNING = 0
```

如果 Stage 5 自己已经建立 `test:stage5`，同时必须执行。

## 17. Stage 5 测试不得依赖公网才能 PASS

自动测试优先使用：

- mock transport
- fixtures
- pure normalizer
- contract tests

真实服务器集成属于 B，不得导致开发机无网络时整个单元测试不可运行。

## 18. API Client 唯一性

远程基础设施建立后：

- 业务 Service 不重复实现底层 request。
- 页面不重复实现 network error mapping。
- timeout / HTTP / business error / parse error 统一定义。
- request/response 日志不得记录 Secret 或敏感正文。

## 19. 服务端是第三方 Secret 边界

服务器负责：

- GitHub Token。
- WordPress 管理凭据（如需要）。
- AI Key（未来）。
- 限流。
- 缓存。
- 内容清洗。
- 第三方错误隔离。

小程序只调用挽鹿自有 API。

## 20. wanluu.com 内容必须原生优先

优先：

```text
wanluu.com / WordPress
→ 服务端清洗标准化
→ 挽鹿 API
→ 小程序原生列表/详情
```

WebView 只作为必要备用方案，不默认承载所有文章。

禁止直接把未清洗 WordPress 原始 HTML 当可信内容渲染。

## 21. 内容清洗规则必须在服务端

至少禁止：

- script
- iframe（除非未来单独 allowlist）
- form
- event handler 属性
- `javascript:` URL
- 不受控 style/script 注入

图片 URL、协议、尺寸也必须规范化。

## 22. GitHub 数据必须服务器代理

禁止小程序：

- 保存 GitHub Token。
- 直接依赖 `api.github.com` 作为正式业务源。
- 每次页面打开无缓存请求大量仓库。

每个榜单手机端默认限制约 5 项，更多内容进入独立列表。

## 23. AI 继续独立

Stage 5 不直接启用真实 AI。

未来 AI 必须经过：

- 自有服务器代理。
- Key 隔离。
- 配额。
- 限流。
- 成本控制。
- 内容安全。

`packageAI` 在用户明确开启对应 Stage 前保持隔离。

## 24. 登录 / 云同步不得顺手加入

Stage 5 远程内容不等于用户系统。

未来登录必须单独设计：

- 微信 code → server。
- server 换身份。
- 匿名本地数据迁移。
- Favorites/History merge。
- Usage count resolution。
- 冲突策略。

不得因内容 API 已存在就顺手开启登录。

## 25. 会员 / 支付 / 广告不得提前

Stage 5 不接：

- VIP。
- 支付。
- 流量主广告。
- CPS。

顺序建议：业务价值与内容稳定 → 用户体系 → 商业化。

## 26. 新 Storage Key 必须单独确认

Stage 5 如需要 persistent remote cache：

1. 说明为什么内存缓存不够。
2. 提供 Key 名、版本、TTL、最大容量。
3. 说明清理策略。
4. 证明不含个人敏感数据。
5. 不复用 Stage 3 五个 Key。
6. 增加迁移/损坏恢复/Static Check 测试。
7. 等待用户确认后再实现。

## 27. Feature Flag 必须安全默认关闭

新远程能力未完成时：

- 默认不显示入口。
- 不请求远程数据。
- 不显示假内容。

只有对应 Step PASS 且用户确认开放后，才修改正式入口或 feature flag。

## 28. 不使用假数据冒充正式内容

允许测试 fixture，但必须限定测试环境。

生产页面禁止展示：

- 假文章。
- 假 GitHub 热榜。
- 假浏览量。
- 假 AI 推荐。
- 假会员状态。

空数据必须明确空状态。

## 29. 远程错误必须可恢复

正式远程页面必须区分：

- loading
- success
- empty
- network error
- timeout
- server/business error
- cached fallback

必须有清晰重试入口，不得失败后静默伪造正常数据。

## 30. 页面职责保持清晰

- 页面负责 UI 状态与导航。
- Service 负责业务数据。
- API Client 负责 transport。
- Server 负责第三方数据与 Secret。

不要把 normalizer / cache / request / 页面状态混在一个 Page 文件中。

## 31. 修改范围最小化

每个 Step：

- 优先增量修改。
- 不顺带重构不相关旧代码。
- 不为了“更漂亮”改 Stage 4 已稳定 UI。
- 不删除已通过测试的兼容代码，除非当前 Step 明确要求并有回归依据。

## 32. 每个 Step 必须产出结果文档

建议：

```text
Wanlu_Toolbox_Stage5_StepN_Result.md
```

至少记录：

- 修改文件。
- 测试结果。
- ERROR/WARNING。
- A/B/C 状态。
- 未完成人工事项。
- 是否具备进入下一 Step 条件。

## 33. 每个 Step 完成后必须停止

禁止自动进入下一 Step。

最终回复应明确：

- 当前 Step PASS / FAIL。
- 是否修改生产代码。
- 是否新增远程请求。
- 是否新增 Storage / 权限 / Secret。
- Stage 3 / 4 回归结果。
- Stage 5 测试结果。
- B 类事项。
- 是否具备进入下一 Step 条件。

然后等待用户确认。
