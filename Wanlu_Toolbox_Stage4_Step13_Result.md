# Stage 4 Step 13 静态检查扩展结果

## 1. 执行前基线

- Stage 4 功能测试：733 cases PASS。
- Stage 3：PASS。
- `npm run check`：ERROR = 0，WARNING = 0。

## 2. 原有 check-project 架构

保留原 `scripts/check-project.js` 的页面、组件、WXML/WXSS、导航、废弃 API、AppID、密钥、隐私、摄像头、半成品文案与 Stage 3 数据架构检查；未推倒重写。

## 3. Stage 4 静态规则

新增 `scripts/stage4-static-rules.js` 并由 `scripts/check-project.js` 调用，固化以下边界：

- Discovery 不直读 Storage，不使用无真实数据支撑的热门/AI 推荐文案。
- Search 不持久化 query，不通过 Usage/Favorites/History 改变文本搜索排名，首页/工具页继续接入统一 `tool-search`。
- 禁止新增 `wl_discovery_*` / `wl_recommend_*` / `wl_profile_*` / `wl_search_*` / `wl_recent_*`。
- 禁止 camera 与新增定位/录音类隐私能力；媒体来源不得恢复 camera。
- Stage 4 正式业务不得新增真实远程请求；`services/ai.js` / `github.js` / `content.js` 继续保持无网络骨架。
- `wooden-fish` / `zodiac` 不得恢复到正式 catalog 或 app 注册。
- `packageAI` / `packageGithub` 不得进入当前 TabBar 或主页面正式入口。
- 正式 tool-catalog 固定 24 项，并检查 id、name、category、path、重复项与页面四文件。
- guide / ruler 当前不得调用 `recordToolUse()`。
- 公共 `project.config.json` 必须保持占位 AppID，`project.private.config.json` 必须在 `.gitignore` 中。

## 4. 静态规则测试

新增：

```text
scripts/test-stage4-static-check.js
```

真实命令：

```bash
npm run test:stage4:static
```

测试数量：20 cases。

覆盖合法当前项目、catalog 重复 id、非法 category、missing page、camera 权限、camera sourceType、Discovery Storage、Search Storage、`wl_search`、`wl_recent`、wooden-fish、zodiac、guide/ruler Usage、公共 AppID，以及测试/Markdown 误报控制等。

## 5. 生产代码与测试/文档排除

静态规则明确排除 `scripts/`、Markdown、`.workbuddy/`、`node_modules/`、`miniprogram_npm/` 等非生产来源，避免仅因测试 fixture 或文档出现 camera / API Key / wooden-fish / zodiac 等字符串而误报。

## 6. 最终结果

- Stage 4 Static Check Tests：PASS (20 cases)。
- `npm run check`：PASS。
- ERROR = 0。
- WARNING = 0。
- 未修改业务 UI、搜索评分、Discovery 权重、工具公式或 Stage 3 schema。
