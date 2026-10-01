<h1 align="center">挽鹿工具箱 · Wanlu Toolbox</h1>

<p align="center">
  一个长期维护的微信小程序工具合集。以本地计算、本地图片处理为核心，不依赖后端服务，也不强制登录。
</p>

<p align="center">
  <a href="#-功能概览">功能概览</a> ·
  <a href="#-快速开始">快速开始</a> ·
  <a href="#-技术栈">技术栈</a> ·
  <a href="#-项目结构">项目结构</a> ·
  <a href="#-新增工具">新增工具</a>
</p>

<p align="center">
  <img alt="微信小程序" src="https://img.shields.io/badge/WeChat-Mini%20Program-07C160">
  <img alt="TDesign" src="https://img.shields.io/badge/UI-TDesign%20MiniProgram-0052D9">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-2F7567">
</p>

> [!IMPORTANT]
> 本项目以「纯本地优先」为原则：计算类工具在小程序内完成运算，图片/视频类工具在端侧处理后再预览或保存到相册。工具数据统一维护在 `utils/tool-catalog.js`，政策类可变参数统一维护在 `utils/policy-config.js`。

---

## ✨ 功能概览

### 底部导航

| Tab | 页面 | 说明 |
| --- | --- | --- |
| 首页 | `pages/index/index` | 品牌区 + 统一搜索 + 首屏 8 个高频工具 + 精选工具 |
| 工具 | `pages/tools/tools` | 分类硬筛选 + `utils/tool-search.js` 统一文本搜索，数据来自 `tool-catalog.js` |
| 发现 | `pages/discover/discover` | 基于本机 Frequent / Recent / Favorites / Featured / Recommended 的动态工具发现页 |
| 我的 | `pages/mine/mine` | 唯一“我的”主页：本地数据摘要、收藏、浏览记录、最近使用、数据管理、帮助与反馈 |

### 已可用工具（位于分包 `packageTools`）

| 分类 | 工具 |
| --- | --- |
| 图片处理 | 二维码生成、图片压缩、图片改尺寸、图片水印、长图拼接、九宫格切图 |
| 图片创作 | 图片转拼豆图纸（MARD 色号） |
| 视频处理 | 视频压缩 |
| 日常计算 | 单位换算、日期计算、比价计算器、商品保质期、亲戚关系计算、校准尺子 |
| 生活计算 | 房贷计算器、工资个税计算器、养老金估算、退休年龄计算、复利/定投计算、餐饮投资测算 |
| 运动健康 | BMI 计算、基础代谢率 |
| 生活娱乐 | 选择困难助手 |
| 其他 | 使用指南 |

### Stage 3 本地用户数据

- `pages/mine`：唯一“我的”Tab 主页，不建立第二套用户中心首页。
- `packageUser`：当前只承载真实可用的收藏、浏览记录、最近使用、本地数据管理功能页。
- 收藏采用单记录 Tombstone：同一工具只保留一条记录，取消收藏写 `deletedAt`，重新收藏恢复为 `null`。
- 浏览记录按工具去重，更新 `lastViewedAt` / `viewCount`，不保存工具输入内容。
- 最近使用不建立独立数据库，从 `wl_tool_usage_v1.lastUsedAt` 派生；“清空最近使用”只更新 `recentClearedAt`，不删除长期 `useCount`。
- `wl_tool_usage_v1` 明确采用 `aggregate-no-tombstone` 聚合统计模型，不使用 `deletedAt`；未来跨设备统计采用独立统计合并策略。
- 所有业务本地存储统一经过 `services/storage.js`，工具页面禁止直接调用 StorageSync。
- 工具详情页通过 `behaviors/tool-page.js` 统一接入浏览、收藏和安全偏好；收藏 UI 复用 `components/favorite-action`。
- 工具偏好只允许白名单内的非敏感字段；图片、视频、Base64、临时路径、工资/房贷/BMI 等敏感输入不持久化。

### Stage 4 搜索 / Discovery / 工程质量

- 首页与工具页统一使用 `utils/tool-search.js`；文本搜索评分、去重、disabled 过滤只有一套正式实现。
- `services/discovery.js` 只聚合 `tool-catalog`、Favorites 与 Tool Usage，不直接读写 Storage，不建立推荐数据库或隐藏画像。
- 发现页通过 `utils/discovery-view-model.js` 按本机真实数据动态形成 EMPTY / LIGHT / RICH 区块，每个工具区块最多 4 个并跨区块去重。
- 正式 `tool-catalog` 当前固定为 24 个公开工具；`wooden-fish` / `zodiac` 源码保留但不注册、不进入 catalog，并从正式构建排除。
- Stage 4 功能回归当前为 733 cases；另有独立的 20 cases 静态规则测试，防止 Search、Discovery、Storage、权限和未来模块边界回退。

### 未来远程能力（当前继续隔离）

- `packageGithub`：保留 GitHub + `wanluu.com` 内容架构，当前不调用真实 API，也没有正式首页/发现页入口。
- `packageAI`：保留 AI 能力架构，当前不调用真实 AI API，也没有正式 Tab/首页/发现页入口。
- `services/content.js`：保留未来网站文章内容接入的数据模型与接口骨架，当前只返回未连接结果。
- 微信登录、云端同步、会员、支付、广告目前均未接入正式业务。

---

## 🚀 快速开始

**前提**：安装微信开发者工具，本机可用 npm。

```bash
# 1. 安装依赖
npm install

# 2. 微信开发者工具 -> 工具 -> 构建 npm
# 3. 裁剪 npm 产物（必须！否则主包超出微信 2MB 上限）
npm run prune:npm

# 4. 点击「编译」
```

**可选但推荐**：每次改动告一段落跑一次静态体检（不联网、不改文件、无第三方依赖）：

```bash
npm run test:stage4
npm run test:stage4:static
npm run test:stage3
npm run check
```

`npm run test:stage4` 当前执行 733 个功能回归用例，覆盖工具核心逻辑、Search、Search Integration、Discovery、Discover Integration 与 Interaction；`npm run test:stage4:static` 独立执行 20 个静态规则测试。`npm run test:stage3` 覆盖收藏 Tombstone、浏览记录、最近使用、使用次数、migration、损坏数据恢复、工具偏好白名单、清空数据和未来合并纯函数。`npm run check` 覆盖页面/组件/导航/权限/密钥/Stage 3 数据架构，并固化 Stage 4 的 Search、Discovery、Storage、远程请求、正式工具和未来模块隔离边界。有 ERROR 时脚本以退出码 1 结束。

> [!WARNING]
> 项目已关闭 Skyline 渲染器，统一使用 WebView 渲染（`renderer` 相关配置已移除，`project.private.config.json` 中 `skylineRenderEnable` 为 `false`）。改动渲染相关配置前请先在开发者工具里验证。

> [!WARNING]
> 公共仓库的 `project.config.json` 使用非真实占位 AppID `wx0000000000000000`；本机真实 AppID 只放在已被 `.gitignore` 忽略的 `project.private.config.json`。当前基础库统一为 `3.17.3`。**不要把 AppSecret、session_key、API Key、Token 或服务器/数据库密码写进仓库。**

> [!TIP]
> `miniprogram_npm/` 由微信开发者工具「构建 npm」生成。**每次重新构建 npm 后必须执行 `npm run prune:npm`**：全量 TDesign 产物约 1.5MB，会把主包顶破微信 2MB 上限；该脚本按依赖闭包只保留实际用到的组件（button / icon / search 及其依赖）。若新增使用其他 TDesign 组件，请同步更新 `scripts/prune-npm.js` 里的 `SEED_COMPONENTS`。

---

## 📦 技术栈

- **框架**：微信小程序原生开发（JS + WXML + WXSS + JSON，无额外构建框架）
- **UI 组件**：TDesign MiniProgram（仅基础组件，不依赖其私有实现）
- **渲染器**：WebView
- **基础库**：`3.17.3`（项目公共配置与本机私有配置保持一致）
- **分包**：`packageTools` / `packageAI` / `packageGithub` / `packageUser`
- **Stage 3 本地数据层**：`services/storage.js` / `user-data.js` / `favorites.js` / `history.js` / `tool-usage.js` / `tool-state.js`
- **数据 schema / migration / 合并**：`utils/data-schema.js` / `data-migrations.js` / `data-merge.js`
- **未来远程接口骨架**：`services/ai.js` / `services/github.js` / `services/content.js`（Stage 3 不联网）
- **数据源**：`utils/tool-catalog.js`（工具目录）、`utils/policy-config.js`（政策参数）
- **设计变量**：`styles/theme.wxss`（颜色、圆角、间距、阴影）+ `styles/common.wxss`（通用类）
- **通用能力**：`utils/qrcode.js`（自研二维码生成）、`utils/image-picker.js`、`utils/image-save.js`、`utils/device.js`、`utils/moderation.js`

### 为什么自己实现二维码

原先依赖 TDesign `t-qrcode` 的私有属性 `canvasNode`，属于组件库内部实现，一升级就可能失效。`utils/qrcode.js` 是自研的纯 JS 实现：

- 字节模式（Byte mode），支持中文（UTF-8）
- 版本 1~40 自动选择，纠错等级 L / M / Q / H
- 8 种掩码自动择优（惩罚分 N1~N4）
- 页面侧用 Canvas 2D 自行绘制，不依赖第三方组件

---

## 📁 项目结构

```text
.
├── app.js / app.json / app.wxss      # 全局入口、页面注册与分包、全局样式
├── pages/                            # 主包：4 个 Tab 页面
│   ├── index/                        # 首页
│   ├── tools/                        # 工具（分类 + 搜索）
│   ├── discover/                     # 发现
│   └── mine/                         # 我的
├── packageTools/pages/               # 工具分包：24 个首发注册工具页面
├── packageAI/                        # 长期架构：AI 能力
├── packageGithub/                    # 长期架构：GitHub + wanluu.com 原生内容
├── packageUser/pages/                # Stage 3 本地用户数据功能页（无重复首页）
│   ├── favorites/                    # 我的收藏
│   ├── history/                      # 浏览记录
│   ├── recent/                       # 最近使用
│   └── data-management/              # 本地数据管理
├── behaviors/
│   └── tool-page.js                  # 工具页统一数据能力层
├── components/
│   ├── navigation-bar/               # 自定义导航栏
│   ├── tool-card/                    # 工具卡片（宫格 / 列表两种形态）
│   ├── section-header/               # 区块标题
│   ├── empty-state/                  # 空状态
│   └── favorite-action/              # 统一收藏 UI
├── config/
│   ├── app.js                        # 品牌信息与功能模块开关（不含任何密钥）
│   ├── moderation.js                 # 内容审核模块配置（默认关闭）
│   └── api.example.js                # 后端接口配置示例模板（当前不联网）
├── services/
│   ├── storage.js                    # 统一 Storage 封装
│   ├── user-data.js                  # 本地用户数据总入口
│   ├── favorites.js                  # 收藏 Tombstone
│   ├── history.js                    # 浏览记录
│   ├── tool-usage.js                 # 使用统计 / 最近使用派生
│   ├── tool-state.js                 # 非敏感工具偏好白名单
│   ├── ai.js                         # 未来接口骨架，当前不联网
│   ├── github.js                     # 未来接口骨架，当前不联网
│   └── content.js                    # wanluu.com 内容接口骨架，当前不联网
├── styles/
│   ├── theme.wxss                    # 设计变量
│   └── common.wxss                   # 通用样式类
├── utils/
│   ├── data-schema.js                # Stage 3 schema / 容量 / 白名单
│   ├── data-migrations.js            # schema migration / 异常恢复
│   ├── data-merge.js                 # 未来本地与云端合并纯函数
│   └── ...                           # 工具目录、政策参数、二维码、图片选择与保存等
├── scripts/
│   ├── prune-npm.js                  # 按依赖闭包裁剪 miniprogram_npm
│   ├── test-stage3-data.js           # Stage 3 数据层回归
│   ├── test-stage4-*.js              # Stage 4 功能与静态规则回归
│   ├── stage4-static-rules.js        # Stage 4 静态防回退规则
│   └── check-project.js              # 项目静态体检（npm run check）
├── assets/                           # 图标与音效资源
├── miniprogram_npm/                  # npm 构建产物
└── sitemap.json                      # 页面收录配置
```

---

## 🧩 新增工具

1. 在 `packageTools/pages/` 下新建目录，例如 `example/`，添加 `example.js` / `.wxml` / `.wxss` / `.json`。
2. 在 `app.json` 的 `subPackages` 中注册该页面路径（**不要**放进主包 `pages`，主包只保留 Tab 页）。
3. 在 `utils/tool-catalog.js` 补充工具元信息：`id` / `name` / `description` / `category` / `path` / `keywords` / `sort` / `isHot` / `isNew` / `isVip` / `isAi` / `enabled`。
4. 页面通用逻辑需要从 `utils/` 引入时，注意分包路径为 `../../../utils/xxx`。
5. 若该工具涉及税率、汇率、社平工资等会随时间变化的参数，一律写入 `utils/policy-config.js`，不要在页面里硬编码。
6. 使用 TDesign 组件时在页面 `json` 的 `usingComponents` 中声明，避免依赖组件私有属性。

---

## 🔧 维护建议

- 工具名称、描述、分类、关键词只维护在 `tool-catalog.js`，不要在页面里重复写一份。
- 正式工具页统一通过 `withToolPage(toolId, ...)` 接入浏览、收藏和安全偏好；不要复制本地数据逻辑。
- 只有核心业务真正成功后才调用 `recordToolUse()`；打开页面、失败或取消操作不计使用。
- 页面禁止直接调用 `wx.setStorageSync` / `wx.removeStorageSync`；所有业务本地数据经过统一数据层。
- 不持久化工资、房贷、BMI/健康、二维码正文、水印文字、个人文本、图片/视频/Base64/临时文件路径等敏感或大体积数据。
- 颜色、圆角、间距、阴影统一取 `styles/theme.wxss` 的变量，页面中不重复定义主题色。
- 图片/视频类页面要处理好临时文件、canvas 尺寸、压缩质量、保存授权与失败兜底。
- 分享文案里的 `path` 必须与页面真实路径一致（分包页面是 `/packageTools/pages/...`）。
- 每次「构建 npm」后执行 `npm run prune:npm`，并确认微信开发者工具里编译无组件报错。
- 提交前依次执行 `npm run test:stage4`、`npm run test:stage4:static`、`npm run test:stage3` 与 `npm run check`，确认功能回归、静态规则、数据层与工程体检全部通过且 0 ERROR / 0 WARNING；新增 CSS 变量引用前先在 `styles/theme.wxss` 里定义，否则整条声明会静默失效。
- 公共 `project.config.json` 不保存真实 AppID；本机真实 AppID 只放 `project.private.config.json`，该文件已加入 `.gitignore`。
- `wanluu.com` 内容未来走 WordPress REST API / 自建 API → 服务端统一清洗 → 小程序后端 API → 原生列表/详情页；默认不使用 WebView 直接承载文章。

---

## 📄 许可证

本项目基于 MIT License 开源，详见 [LICENSE](./LICENSE)。
