# 挽鹿工具箱 Stage 5 实施计划

> 本文由 Stage 5 Step 0 生成。Stage 5 Step 0 只做规划与基线确认，不开发 Stage 5 业务功能。

## 1. Stage 4 当前封板状态

Stage 4 已完成代码侧封板，当前必须保护的正式基线：

- 24 个正式工具。
- Stage 4 功能测试：733 / 733 PASS。
- Stage 4 Static Check：20 / 20 PASS。
- Stage 3 data-layer：PASS。
- `npm run check`：PASS，ERROR = 0，WARNING = 0。
- Search：`utils/tool-search.js` 为唯一正式文本搜索算法。
- Discovery：`services/discovery.js` + `utils/discovery-view-model.js` 为唯一正式本地发现体系。
- Stage 3 Storage：`wl_meta_v1` / `wl_favorites_v1` / `wl_history_v1` / `wl_tool_usage_v1` / `wl_tool_state_v1`。
- Usage：`aggregate-no-tombstone`；Recent 继续由 `recentClearedAt` 派生。
- 权限最小化：正式权限仅保留相册写入；媒体选择保持 album-only。
- 正式前端无真实 API Key / AppSecret / GitHub Token / WordPress 管理密钥。
- `packageAI`、`packageGithub`、`services/content.js`、`services/ai.js`、`services/github.js` 当前均保留但隔离。
- `wooden-fish` / `zodiac` 继续无正式入口。

任何 Stage 5 Step 如需突破上述基线，必须单独说明原因并等待用户确认。

## 2. 当前真实项目架构

当前实际仓库架构为：

```text
主包 pages/
├─ index       首页 + 统一 Search
├─ tools       工具目录 + 分类 + 统一 Search
├─ discover    本地 Discovery 动态区块
└─ mine        本地用户数据入口

packageTools/  24 个正式工具
packageUser/   收藏 / 浏览 / 最近使用 / 数据管理
packageAI/     AI 未来预留首页，当前无正式入口、无远程请求
packageGithub/ GitHub + 原生内容未来预留首页，当前无正式入口、无远程请求

services/
├─ storage / favorites / history / tool-usage / tool-state / user-data
├─ discovery
├─ content     wanluu.com 内容接口骨架
├─ github      GitHub 榜单接口骨架
└─ ai          AI 能力接口骨架

utils/
├─ tool-catalog / tool-search / discovery-view-model
├─ data-schema / data-migrations / data-merge
├─ policy-config
└─ tool-logic/*
```

当前 `config/api.example.js` 已存在 develop / trial / release 的 Base URL 示例，但尚不是正式统一 API Client；页面当前没有正式远程请求。

`utils/data-merge.js` 已为未来云同步预留 Favorites、History、Meta 合并纯函数和 Usage Merge Plan，但 Usage 跨设备计数仍明确处于“待决议”状态，不能直接持久化为当前 usage 数据。

## 3. Stage 5 产品目标

Stage 5 推荐定义为：

**【远程内容与 API 基础设施阶段】**

目标不是一次性加入所有未来功能，而是在不破坏本地工具核心的前提下，建立可长期复用的远程能力底座，并完成两类低耦合远程内容：

1. wanluu.com 原生文章内容。
2. GitHub 榜单基础内容。

Stage 5 完成后，小程序应具备：

- 一个统一、可测试、无前端 Secret 的 API Client。
- develop / trial / release 环境隔离。
- 统一远程响应、错误、超时、分页、缓存语义。
- wanluu.com 原生文章列表与详情能力。
- GitHub 今日 / 本周 / 总榜的移动端基础展示能力。
- 网络失败时清晰的空态 / 重试 / 缓存 fallback。
- 远程页面不绕过统一 Service 直接大量 `wx.request`。
- Stage 3 / Stage 4 全部回归继续稳定。

## 4. Stage 5 范围

Stage 5 推荐纳入：

1. API 契约与错误模型。
2. 环境配置体系。
3. 统一 API Client。
4. 服务端 API 契约与安全边界。
5. wanluu.com 内容 Service。
6. wanluu.com 原生文章列表。
7. wanluu.com 原生文章详情与安全内容节点。
8. 远程内容缓存 / fallback。
9. packageGithub 受控开放内容入口。
10. GitHub 服务端代理与标准化数据模型。
11. GitHub 今日 / 本周 / 总榜移动端页面。
12. Stage 5 专属测试和静态防回退规则。
13. Stage 5 最终回归与封板。

当前 `packageGithub` 的已有页面和 README 已明确将“GitHub 榜单 + wanluu.com 原生内容”作为同一未来内容分包承载，因此 Stage 5 优先沿用该分包，不在 Step 0 规划中强制新建 `packageContent` 或做目录大迁移。

## 5. Stage 5 不包含内容

Stage 5 不建议包含：

- AI 聊天 / 写作 / 绘图 / 视频 / 编程真实接入。
- 微信登录真实链路。
- 云端收藏 / 历史 / Usage 正式同步。
- 会员权益体系。
- 微信支付。
- 流量主广告。
- CPS / 联盟商业化。
- 大规模个性化画像。
- `wooden-fish` / `zodiac` 恢复。
- 大规模 UI 重构。

这些能力依赖更高，且会显著增加服务器、安全、隐私、审核和商业合规复杂度，建议在 Stage 5 远程基础稳定后按独立 Stage 推进。

## 6. Stage 4 基线保护规则

Stage 5 每一步都必须保护：

- 正式工具始终为 24，除非用户单独批准产品变更。
- `wooden-fish` / `zodiac` 不恢复。
- Search 评分和排序不被远程内容逻辑污染。
- Discovery 本地工具推荐权重不被远程内容逻辑替换。
- Stage 3 Schema 不因远程内容随意升级。
- Stage 3 Storage Keys 不因文章 / GitHub 缓存而改名或复用。
- Usage 语义不改变。
- 733 个 Stage 4 功能 Case 不删除、不弱化。
- 20 个 Stage 4 Static Case 不删除、不弱化。
- 页面不直接保存 Secret。
- 新远程能力默认不得新增 camera / location / microphone / contacts。
- packageAI 在 Stage 5 仍保持隔离。

## 7. Git 当前状态

Step 0 实际读取 `git status`、`git diff --name-status`、`git diff --stat`。

当前 worktree 非 clean，属于 Stage 2～4 多阶段累计变更，不是单一小改动。

Tracked diff 统计：

```text
135 files changed
1080 insertions(+)
27854 deletions(-)
```

该统计只覆盖 tracked diff，不包含大量 untracked 新目录 / 新文件。

当前变更大致可分为：

1. **旧单体页面迁移**：原 `pages/<tool>` 大量工具页面被删除，正式工具迁移至 `packageTools/pages/*`。
2. **主包重构**：首页更新，并新增当前正式 `pages/tools`、`pages/discover`、`pages/mine`。
3. **Stage 3 数据层**：新增 `services/*`、`utils/data-*`、`packageUser/*`、`behaviors/tool-page.js` 等。
4. **Stage 4 能力**：新增 `utils/tool-logic/*`、`tool-search.js`、Discovery、测试脚本、静态规则与结果文档。
5. **组件 / 样式**：新增 tool-card、section-header、empty-state、favorite-action、styles 等。
6. **未来模块骨架**：新增 `packageAI`、`packageGithub`、`services/ai.js`、`services/github.js`、`services/content.js`。
7. **工程配置**：`app.json`、`package.json`、`project.config.json`、`.gitignore` 等发生变化。
8. **旧资源清理**：部分旧外部入口图片 / README 资源已删除。
9. **私有配置历史处理**：`project.private.config.json` 当前被 `.gitignore` 忽略且工作区文件存在，但 Git cached 状态显示旧版本存在 staged deletion，需要在建立正式 Git 基线前人工确认这一历史迁移状态。
10. `.workbuddy/` 等本地工作环境目录当前为 untracked，不应自动进入正式基线提交。

Step 0 未执行 commit / push / reset / restore / clean / stash。

## 8. Git 基线建议

在真正开始 Stage 5 生产代码修改前，**强烈建议先人工确认 Stage 2～4 累积变更并建立清晰的 Stage 4 封板 Git 基线**。

推荐流程：

```text
人工检查 git status / diff
↓
确认哪些文件应纳入 Stage 4 正式基线
↓
确认 project.private.config.json 不进入仓库
↓
确认 .workbuddy / 临时文件不进入仓库
↓
用户明确授权 commit
↓
建立一个 Stage 4 code-freeze baseline commit
↓
再进入 Stage 5 Step 1
```

考虑到 Stage 2～4 变更已经高度交织，**不建议现在强行拆成大量历史提交**，否则容易误拆迁移和删除。更安全的方式是经人工复核后建立一个清晰的“Stage 4 代码侧封板”基线提交。

本计划只给建议，不执行任何 Git 写操作。

## 9. API 架构规划

推荐正式链路：

```text
页面
↓
业务 Service（content / github / future ai）
↓
统一 API Client
↓
挽鹿自有服务器
↓
第三方数据源（WordPress / GitHub / future AI）
```

页面不得各自散落 `wx.request`。

统一 API Client 建议负责：

- Base URL 选择。
- HTTPS 请求。
- timeout。
- HTTP 状态映射。
- 服务端业务 code 映射。
- JSON 解析异常。
- requestId / serverTime / apiVersion 等 meta。
- 可注入 transport，便于 Node 自动测试使用 mock，而不依赖微信环境。
- 后续登录阶段可扩展会话 header，但 Stage 5 不提前加入真实账号 Token。

### 服务端响应建议

服务端协议建议采用稳定 envelope：

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "meta": {
    "requestId": "...",
    "serverTime": 0,
    "apiVersion": "v1"
  }
}
```

列表 `data` 建议统一：

```json
{
  "items": [],
  "page": 1,
  "pageSize": 10,
  "total": 0,
  "hasMore": false
}
```

但页面不直接依赖原始 envelope。API Client / Service 应映射为统一内部结果：

```text
成功：{ ok: true, data, meta }
失败：{ ok: false, error: { kind, code, message, retryable }, meta }
```

`error.kind` 至少区分：

- network
- timeout
- http
- business
- parse
- aborted

空列表属于成功，不应伪装成错误。

## 10. 环境配置规划

当前 `config/api.example.js` 已使用 `develop / trial / release` 思路，Stage 5 应在不存 Secret 的前提下正式化。

推荐原则：

- develop：开发 / 测试服务器。
- trial：体验版 / 预发布服务器。
- release：正式 HTTPS API 域名。
- Base URL 可以在前端公开，因为它不是 Secret。
- AppSecret、第三方 Token、数据库密码绝不能进入环境配置文件。
- `project.private.config.json` 继续只承担本机微信项目配置，不作为业务 Secret 容器。
- 正式 request 域名配置属于微信公众平台 B 类人工事项。

## 11. 安全 / Secret 规划

服务器负责：

- GitHub Token 保管。
- WordPress 管理凭据（如果确实需要）保管。
- future AI Key 保管。
- 第三方 API 调用。
- 限流。
- 缓存。
- 请求日志脱敏。
- 数据结构标准化。
- 内容清洗。
- 错误隔离。
- 必要的防滥用与服务保护。

小程序不得保存：

- OpenAI / 其他 AI Key。
- GitHub Token。
- WordPress 管理密钥。
- AppSecret。
- 数据库密码。
- 服务器 Secret。
- `session_key`。

Stage 5 静态规则应新增“远程请求只能在统一 API Client / approved Service 路径出现”的防回退检查。

## 12. wanluu.com 内容规划

### 列表数据模型

至少包含：

- id
- title
- excerpt
- cover
- publishTime
- category
- categoryId（可选）
- author（可选）
- tags（可选）

### 详情数据模型

至少包含：

- id
- title
- content / contentNodes
- publishTime
- author
- cover
- category
- tags
- sourceUrl（只作为来源信息，不默认直接外跳）

### 内容安全

不建议把 WordPress 原始 HTML 无限制直接塞入页面。

推荐服务端：

```text
WordPress HTML
↓
服务端 allowlist 清洗
↓
移除 script / style / iframe / form / 事件属性 / javascript URL
↓
规范图片 URL / 尺寸
↓
输出安全 rich-text nodes 或受限 HTML
↓
小程序 rich-text 渲染
```

优先推荐“服务端转换后的安全节点结构”；若使用受限 HTML，也必须先由服务端清洗。

### 手机端要求

- 单列内容卡片。
- cover 采用统一比例和尺寸策略。
- 正文图片最大宽度限制在容器内。
- 段落、标题、引用、代码块需有小屏样式。
- 分页或 cursor，避免一次加载大量文章。
- 首屏 skeleton / loading。
- 空数据与网络错误分开。
- 支持重试。

### 缓存

先建立内存缓存；如确实需要离线 / 弱网 persistent cache，应在单独 Step 引入新的 Stage 5 remote cache key，并明确：

- 不复用 Stage 3 五个 Storage Key。
- 有版本号。
- 有 TTL。
- 可整体清除。
- 不保存个人敏感数据。
- 新增前需用户确认并扩展 Static Check。

## 13. GitHub 内容规划

GitHub 榜单由自有服务器代理，不建议小程序前端直接使用 GitHub Token 或依赖 GitHub API 限额。

榜单：

- 今日
- 本周
- 总榜

每个榜单手机端默认最多显示约 5 项；如需要“查看更多”，进入独立列表而不是首页堆叠。

标准条目建议：

- id / fullName
- name
- owner
- description
- stars
- language
- updatedAt
- url
- optional ownerAvatar

服务器负责：

- GitHub API 请求。
- Token。
- 结果缓存。
- 频率控制。
- 榜单规则版本。
- 中文化 / 截断 / 字段清洗。

小程序对外部仓库链接不得假设可以自由跳转；“复制链接 / WebView / 其他跳转方式”必须在实施 Step 中根据微信平台当时规则单独核验，并列为 B 类。

## 14. AI 未来规划

AI 不纳入 Stage 5 正式功能范围。

原因：

- 调用成本。
- Key 安全。
- 配额。
- 滥用。
- 内容安全。
- 限流。
- 审核复杂度。
- 图片/视频任务异步状态。

未来 AI Stage 推荐前置依赖：

```text
统一 API Client
+ 自有服务器
+ 身份 / 匿名限流策略
+ 服务端 Key 管理
+ 内容安全策略
+ 成本预算
↓
AI Service
↓
packageAI
```

`packageAI` 在 Stage 5 继续隔离。

## 15. 用户身份未来规划

真实登录不纳入 Stage 5。

当前 `utils/auth.js` 已有离线接口骨架，真实未来流程应是：

```text
wx.login()
↓
临时 code 发送自有服务器
↓
服务器使用 AppSecret 换取身份
↓
服务器建立自己的安全会话
↓
小程序只保存必要的非敏感会话信息
```

不得把 AppSecret / session_key 留在前端。

用户体系需要单独 Stage，因为登录会影响：

- 本地匿名数据归属。
- 云同步。
- 多设备冲突。
- 会员身份。
- 支付权益。
- 隐私说明。

## 16. 本地 → 云端数据迁移规划

登录后不能删除匿名本地数据。

推荐：

```text
匿名本地数据
↓
首次登录
↓
服务器读取云端数据
↓
本地纯函数生成 merge proposal
↓
按实体模型合并
↓
用户数据 Service 写回本地 + 云端
```

当前已有能力：

- Favorites：Tombstone，可按 updatedAt 合并。
- History：按 entity 去重并保留时间信息。
- Meta：recentClearedAt 取较新时间。
- Usage：当前只生成 `createUsageMergePlan()`，跨设备 `useCount` 仍需专门同步模型，禁止简单相加或覆盖。
- Tool State：未来是否同步必须按字段逐项决定，不默认同步。

因此云同步必须在登录之后单独实现，而不是 Stage 5 顺手加入。

## 17. 会员未来规划

会员依赖：

```text
真实身份
↓
服务器 entitlement
↓
会员产品定义
↓
支付结果 / 服务端校验
↓
前端展示
```

在没有真实用户身份与稳定业务价值前，不进入 Stage 5。

未来会员可以围绕：去广告、批量处理、云同步、AI 配额等设计，但具体权益必须单独产品确认，不能现在写死。

## 18. 广告未来规划

广告不是 Stage 5 优先项。

推荐顺序：

```text
稳定工具 + 远程内容
↓
真实使用数据 / 留存观察
↓
合理广告位设计
↓
微信流量主平台配置
```

广告接入必须保持手机端可用性，不得遮挡输入、结果、保存按钮、文章正文主要内容。

广告属于 B 类平台能力，代码完成不等于平台人工验收完成。

## 19. 支付未来规划

支付建议最后进入：

```text
用户身份
↓
会员 / 商品产品模型
↓
服务端订单
↓
微信支付能力与商户配置
↓
支付回调验签
↓
权益发放 / 补单 / 退款
```

Stage 5 不接支付。

## 20. 微信审核风险

Stage 5 新增远程能力会提高审核复杂度，主要风险类别：

- 远程内容与服务类目是否匹配。
- 内容来源与内容安全。
- 外链 / WebView 行为。
- 用户隐私与网络数据处理说明。
- 域名配置与 HTTPS。
- AI（未来）内容与生成式服务风险。
- 登录、会员、支付（未来）带来的身份和交易要求。
- 广告（未来）平台能力要求。

规则：每新增一种平台能力都继续分 A / B / C 验收；实施时如依赖当期微信规则，必须在对应 Step 再按最新平台规则人工核验，不在 Step 0 把未来审核规则写死。

## 21. A / B / C 验收体系

### A：GPT 自动验收通过

适合：

- API Client 纯逻辑。
- 数据 normalizer。
- 错误映射。
- 分页。
- cache 纯逻辑。
- Service 注入 mock 后的集成测试。
- 页面静态结构 / 路由。
- Secret 静态扫描。
- Stage 3 / 4 回归。

### B：代码通过，待外部环境 / 平台验收

适合：

- 真实服务器。
- HTTPS 域名。
- 微信 request 合法域名。
- 真实 WordPress 内容。
- 真实 GitHub API 代理。
- 弱网 / 真实网络。
- WebView / 外部跳转。
- 微信公众平台配置。
- 真机。

### C：人工验收通过

只有用户本人实际完成微信开发者工具、真机、平台或服务器环境验收后才可标记。

规划和代码自动测试不得把 B 自动升级为 C。

## 22. Stage 5 测试体系

Stage 5 不替换旧测试。

每个 Step 完成后必须继续执行：

```bash
npm run test:stage4
npm run test:stage4:static
npm run test:stage3
npm run check
```

固定保护：

- Stage 4 功能 733 cases。
- Stage 4 Static 20 cases。
- Stage 3 PASS。
- ERROR = 0。
- WARNING = 0。

Stage 5 Step 1 开始建立独立：

```text
test:stage5
```

建议子测试逐步增加：

- api-contract
- env-config
- api-client
- content-service
- content-view-model
- content-cache
- github-service
- github-view-model
- remote-integration
- stage5-static

Stage 5 自动测试默认使用 mock transport / fixture，不依赖真实公网才能 PASS。

---

## 23. Stage 5 Step 1

### 名称

【API 契约 + 环境配置 + Stage 5 测试骨架】

### 【目标】

- 固定服务端 envelope 与前端内部 Result 结构。
- 正式化 develop / trial / release 环境配置。
- 建立 `test:stage5` 入口和第一批纯逻辑测试。
- 不发真实网络请求。

### 【允许修改文件】

候选：`config/api.example.js`、新增 `config/env.js` / `utils/api-contract.js`、`scripts/test-stage5-*.js`、`package.json`、Stage 5 文档。最终以实际审计后的最小方案为准。

### 【禁止事项】

- 不新增 `wx.request`。
- 不接真实域名。
- 不存 Secret。
- 不修改页面。
- 不开放 packageAI / packageGithub。

### 【自动测试】

- 环境映射。
- response schema。
- success/error normalizer。
- pagination schema。
- Stage 3 / 4 全回归。

### 【人工依赖】

无必须人工平台依赖；Git 基线建议应在本 Step 前由用户明确处理。

### 【完成标准】

API 契约稳定、环境切换纯逻辑 PASS、`test:stage5` 可独立运行、Stage 3 / 4 零回退。

### 【是否修改生产代码】

会修改/新增基础设施生产模块，但不改变业务页面行为。

### 【完成后必须停止】

是，等待用户确认后再进入 Step 2。

## 24. Stage 5 Step 2

### 名称

【统一 API Client + Transport 抽象】

### 【目标】

建立唯一远程请求入口，支持 timeout、HTTP/业务错误映射、mock transport、requestId/meta；正式页面仍不接远程内容。

### 【允许修改文件】

新增/修改 `services/api-client.js`（或实际最合适命名）、环境配置、Stage 5 测试、Static Check 最小规则。

### 【禁止事项】

页面不得直接 `wx.request`；不得接 AI；不得放 Secret；不得修改 Stage 3 Storage。

### 【自动测试】

成功、超时、网络失败、HTTP 非 2xx、业务错误、JSON 异常、空数据、abort、input mutation、并发独立性。

### 【人工依赖】

真实 request 域名仍为 B，不要求本 Step 完成。

### 【完成标准】

业务 Service 可通过注入统一 Client 调用；Node mock 测试完全 PASS；旧基线继续 PASS。

### 【是否修改生产代码】

是，仅基础设施。

### 【完成后必须停止】

是。

## 25. Stage 5 Step 3

### 名称

【服务器 API 规范 + 开发联调边界】

### 【目标】

固定 `/api/v1` 或等价版本策略、内容/GitHub endpoint 规范、错误码、分页、缓存 header/meta、限流语义；准备开发服务器联调方案。

### 【允许修改文件】

API 契约文档、服务器接口 schema/fixture（若服务器项目届时已纳入明确范围）、Stage 5 contract tests。

### 【禁止事项】

不操作生产服务器；不放第三方 Key 到小程序；不开放正式页面入口。

### 【自动测试】

fixture/schema contract tests；Client 与 mock server envelope 一致性。

### 【人工依赖】

真实服务器、DNS、HTTPS、微信 request 域名属于 B。

### 【完成标准】

前后端协议可独立实现，第三方数据源不会直接泄露到页面结构。

### 【是否修改生产代码】

小程序侧原则上只做契约适配；是否涉及服务器代码取决于用户届时明确授权。

### 【完成后必须停止】

是。

## 26. Stage 5 Step 4

### 名称

【wanluu.com Content Service 实装】

### 【目标】

将 `services/content.js` 从 unavailable skeleton 演进为依赖统一 API Client 的正式内容 Service，完成文章 normalizer、分页、详情模型和错误映射。

### 【允许修改文件】

`services/content.js`、内容 model/normalizer、Stage 5 tests；必要时服务器 content endpoint。

### 【禁止事项】

不改首页/发现页；不直接渲染原始未清洗 WordPress HTML；不新增用户数据 Storage。

### 【自动测试】

列表、详情、空列表、缺字段、非法字段、分页、错误、input mutation、禁止 direct third-party call。

### 【人工依赖】

真实 wanluu.com / server endpoint 联调属于 B。

### 【完成标准】

Service 可使用 mock 完整通过；真实 endpoint 如未就绪仍可保持 B，不伪造线上成功。

### 【是否修改生产代码】

是，Service 层。

### 【完成后必须停止】

是。

## 27. Stage 5 Step 5

### 名称

【原生文章列表页】

### 【目标】

在当前远程内容分包内建立手机端原生文章列表：加载、分页、重试、空态、封面尺寸控制。

### 【允许修改文件】

`packageGithub` 内内容列表相关页面、组件、content Service adapter、Stage 5 integration tests。

### 【禁止事项】

不修改本地工具 Search/Discovery；不开放 AI；不将 WordPress 原站直接 WebView 作为默认实现。

### 【自动测试】

ViewModel、分页追加/去重、重复请求防护、空态、错误态、导航目标、最大图片字段约束。

### 【人工依赖】

真实图片域名、HTTPS、微信 request/download 域名和真机网络属于 B。

### 【完成标准】

mock 数据页面逻辑稳定，真实环境状态明确分 A/B。

### 【是否修改生产代码】

是。

### 【完成后必须停止】

是。

## 28. Stage 5 Step 6

### 名称

【原生文章详情 + 安全 Rich Content】

### 【目标】

完成文章详情页面；服务端提供 allowlist 清洗后的安全节点/受限内容，客户端原生渲染。

### 【允许修改文件】

详情页、内容节点 normalizer、服务端 sanitizer 契约/实现（若获授权）、Stage 5 tests。

### 【禁止事项】

不执行脚本、不允许事件属性、不直接信任 raw HTML、不默认 WebView。

### 【自动测试】

标题/正文/图片节点、非法标签/属性过滤契约、空正文、超长内容、图片失败 fallback、导航。

### 【人工依赖】

真实文章视觉、复杂富文本、真机长文性能属于 B。

### 【完成标准】

常见文章安全、可读、移动端布局稳定；raw HTML 不绕过 sanitizer。

### 【是否修改生产代码】

是。

### 【完成后必须停止】

是。

## 29. Stage 5 Step 7

### 名称

【远程内容缓存 / Fallback + packageGithub 受控开放】

### 【目标】

完成网络失败 fallback、缓存策略，并在内容能力稳定后有控制地开放 `packageGithub` 正式入口。

### 【允许修改文件】

remote cache Service（如确有必要）、packageGithub 首页、一个经过确认的入口页面、Static Check、Stage 5 tests。

### 【禁止事项】

不修改 Stage 3 五个 Storage Key；不把缓存当用户画像；不一次向首页/发现页加入多个远程区块。

### 【自动测试】

TTL、过期、网络失败 fallback、缓存损坏恢复、入口 feature flag、Stage 4 isolation regression。

### 【人工依赖】

如果新增 persistent cache key，必须在执行本 Step 前明确向用户说明并确认；真实弱网/断网为 B。

### 【完成标准】

packageGithub 从“隔离骨架”变为“经用户批准的远程内容入口”；这一基线突破必须有明确记录。

### 【是否修改生产代码】

是。

### 【完成后必须停止】

是。

## 30. Stage 5 Step 8

### 名称

【GitHub Service + 服务端榜单代理】

### 【目标】

将 `services/github.js` 接入统一 API Client；服务器代理 GitHub 数据、缓存并输出今日/本周/总榜标准结构。

### 【允许修改文件】

`services/github.js`、GitHub model/normalizer、API 契约、服务器 GitHub proxy（经授权）、Stage 5 tests。

### 【禁止事项】

前端不存 GitHub Token；页面不直接请求 api.github.com；不一次展示大量仓库。

### 【自动测试】

三榜模型、字段缺失、排序稳定、最大条目限制、错误/空态、缓存 meta、禁 Secret。

### 【人工依赖】

真实 GitHub Token、服务器限额、代理部署属于 B。

### 【完成标准】

小程序只认识标准化后的自有 API 数据；GitHub Token 仅服务器可见。

### 【是否修改生产代码】

是，Service 层。

### 【完成后必须停止】

是。

## 31. Stage 5 Step 9

### 名称

【GitHub 今日 / 本周 / 总榜移动端 UI】

### 【目标】

在 `packageGithub` 完成三榜移动端页面/区块，每榜默认约 5 项，并定义安全的仓库链接交互。

### 【允许修改文件】

`packageGithub` 页面、必要组件、Stage 5 integration tests。

### 【禁止事项】

不堆大量项目；不假设任意外链可直接打开；不引入 AI。

### 【自动测试】

tab 切换、每榜上限、字段 fallback、稳定排序、空态/错误态、重复点击、导航/复制动作。

### 【人工依赖】

外链/WebView/复制链接的最终行为必须按当期微信规则和真机验证，属于 B。

### 【完成标准】

手机端信息密度受控，三榜数据清晰，不破坏主包本地工具体验。

### 【是否修改生产代码】

是。

### 【完成后必须停止】

是。

## 32. Stage 5 Step 10

### 名称

【Stage 5 远程能力静态规则 + 安全/隐私回归】

### 【目标】

新增 Stage 5 Static 防回退：Secret、direct wx.request、third-party endpoint、未批准权限、缓存 key、packageAI 意外开放等。

### 【允许修改文件】

`scripts/stage5-static-rules.js` 或现有最合适静态体系、Stage 5 static tests、`package.json`。

### 【禁止事项】

不重写 Stage 4 static；不降低已有 20 cases；不把测试/Markdown 文本误报为生产违规。

### 【自动测试】

合法项目 PASS + 负例 fixture：页面 direct request、前端 Token、GitHub API 直连、WordPress 管理 URL/凭据、非法 Storage、camera、packageAI 开放等。

### 【人工依赖】

无新增平台操作。

### 【完成标准】

Stage 5 新规则稳定且 0 ERROR / 0 WARNING，Stage 4 20 cases 原样保留。

### 【是否修改生产代码】

否，原则上只修改工程检查/测试。

### 【完成后必须停止】

是。

## 33. Stage 5 Step 11

### 名称

【Stage 5 全量回归 + 远程内容阶段封板】

### 【目标】

系统重复执行 Stage 3 / 4 / 5 功能测试与静态检查，审计远程能力、Secret、缓存、平台 B 项，生成 Stage 5 final result。

### 【允许修改文件】

最终结果文档、必要的最小回归修复；如无真实问题不修改生产代码。

### 【禁止事项】

不自动进入 AI / 登录 / 会员 / 广告 / 支付 Stage；不自动 commit/push。

### 【自动测试】

- `npm run test:stage5`
- `npm run test:stage4`
- `npm run test:stage4:static`
- `npm run test:stage3`
- `npm run check`
- Stage 5 Static（实际命令以最终 package.json 为准）

### 【人工依赖】

真实服务器、域名、真机、外链、微信后台继续按 B/C 分类，不虚报。

### 【完成标准】

全部自动测试稳定 PASS；Stage 4 基线无回退；无前端 Secret；无未解决 P0/P1；远程内容 Stage 正式封板。

### 【是否修改生产代码】

原则上否；只有封板必需真实回归才允许最小修复。

### 【完成后必须停止】

是，等待用户决定下一 Stage。

## 34. 后续 Stage 路线图（不属于 Stage 5）

推荐顺序：

```text
Stage 5  远程内容 + API 基础设施
↓
Stage 6  用户身份 + 云同步
↓
Stage 7  AI 独立阶段（服务端 Key / 配额 / 限流 / 内容安全）
↓
Stage 8  会员 + 支付
↓
Stage 9  广告 / CPS / 商业化优化
```

实际 Stage 编号可由用户后续调整，但依赖顺序不建议倒置。

## 最终完成标准

Stage 5 只有在以下条件同时满足时才能最终封板：

1. 统一 API Client 已建立且页面不散落远程请求。
2. 前端无 Secret。
3. wanluu.com 内容列表 / 详情使用原生页面并经过安全内容清洗。
4. GitHub 数据只通过自有服务器标准化接口进入小程序。
5. 每个 GitHub 榜单手机端信息量受控。
6. 网络错误 / timeout / 空数据 / retry / fallback 均有明确语义。
7. 如新增远程 cache，不破坏 Stage 3 Storage，且有版本 / TTL / 清理策略。
8. 24 正式工具不回退。
9. Search 不回退。
10. Discovery 不回退。
11. Stage 4 733 cases 持续 PASS。
12. Stage 4 Static 20 cases 持续 PASS。
13. Stage 3 持续 PASS。
14. Stage 5 测试全部 PASS。
15. `npm run check` ERROR = 0 / WARNING = 0。
16. 服务器 / 域名 / 真机 / 微信平台项目按 A/B/C 准确分类。
17. 不把 B 类自动宣布为 C。
18. 不自动进入 AI / 登录 / 会员 / 支付 / 广告开发。
19. 不自动执行 Git commit / push。
