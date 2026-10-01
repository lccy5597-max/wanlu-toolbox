# Stage 5 Step 2 执行结果

## 1. 执行前基线

- Stage 5 Step 1：32 / 32 PASS。
- Stage 4 功能测试：733 / 733 PASS。
- Stage 4 Static：20 / 20 PASS。
- Stage 3：PASS。
- `npm run check`：PASS，ERROR = 0，WARNING = 0。
- Stage 4 远程封板基线：`d8e198accaf874a26825c8b2b14404f44707e098`。

## 2. Transport 架构

本 Step 建立单一普通 JSON 网络 Transport：

```text
业务 Service（后续 Step）
↓
utils/api-client.js
↓
utils/api-transport.js
↓
wx.request
```

页面和业务 Service 当前均没有直接 `wx.request`。

## 3. WeChat Transport

新增 `utils/api-transport.js`。

提供：

- `createWechatTransport({ requestImpl })`
- `request(options)` Promise 接口
- 生产运行时可惰性解析 `wx.request`
- Node 测试可注入 `requestImpl`
- Node 中没有全局 `wx` 时模块仍可加载并可测试

Transport 仅负责把标准请求映射到 `wx.request` 并返回原始 HTTP transport result，不解释业务 `code`。

本 Step 未实现 `uploadFile`、`downloadFile`、WebSocket。

## 4. API Client

`utils/api-client.js` 继续是统一 Client。

职责已扩展为：

- Remote enabled/disabled 前置检查
- GET / POST method normalization
- URL 构建
- Query 编码
- Headers 合并
- Timeout 规范化
- Transport 调用
- HTTP response normalization
- Business response normalization
- Transport / Network error normalization

Remote disabled 时会在调用 Transport 前直接返回 `REMOTE_DISABLED`，测试确认 Transport 调用次数为 0。

## 5. Environment

`config/environment.js` 继续支持：

- `development`
- `production`

两套环境均保持：

```text
remoteApiEnabled = false
apiBaseUrl = https://api.example.com
```

新增 timeout 基线：

```text
DEFAULT_REQUEST_TIMEOUT_MS = 10000
MIN_REQUEST_TIMEOUT_MS = 1000
MAX_REQUEST_TIMEOUT_MS = 60000
```

未写入真实域名、服务器 IP、Token 或 Secret。

## 6. URL 构建

统一 `buildUrl(baseUrl, path, query)`：

- 清理 baseUrl 尾部 `/`
- 自动补 path 开头 `/`
- 保持 `https://` 协议完整
- 统一拼接 query string

## 7. Query 编码

统一 `encodeQuery()`：

- string / number / boolean 正常编码
- 中文、空格、特殊字符使用 `encodeURIComponent`
- `undefined` / `null` 跳过
- 不新增依赖

## 8. Headers

默认 Headers：

```text
Accept: application/json
Content-Type: application/json
```

支持 Client 默认 Header 与单次请求 Header 合并，单次请求值优先。

没有默认注入 `Authorization`、OpenID、UnionID、设备标识或用户画像字段。

## 9. Method

当前正式支持：

- GET
- POST

内部统一大写。非法 Method 返回 `INVALID_METHOD` Contract Error，不调用 Transport。

未提前开放 PUT / PATCH / DELETE。

## 10. Timeout

默认 10000ms，允许 1000～60000ms。

`0`、负数、`NaN`、`Infinity`、超范围值统一回退默认 timeout。

## 11. Response Normalization

继续复用 `utils/api-contract.js`，没有建立第二套响应格式。

成功结果保持：

```text
ok
code
message
data
meta
```

HTTP 2xx 后再进行业务 envelope normalization。

## 12. Error Normalization

新增统一 error 对象字段：

```text
type
code
message
statusCode
retryable
```

当前错误类型：

- `client_disabled`
- `contract`
- `transport`
- `http`
- `business`

不会把 `wx.request` 原始错误文本直接作为用户消息返回。

## 13. HTTP Error

非 2xx HTTP 状态统一归类为 `http` error。

已自动覆盖：

- 400
- 401
- 404
- 429
- 500
- 503

## 14. Network Error

`wx.request fail` / injected transport rejection 统一映射为：

```text
code = NETWORK_ERROR
type = transport
message = network_error
retryable = true
```

## 15. Remote Disabled 行为

`development` 和 `production` 均保持 `remoteApiEnabled = false`。

Disabled Client 在 Transport 之前直接返回，测试证明 Transport 调用次数为 0。

## 16. Security

本 Step 未加入：

- API Key
- AppSecret
- client_secret
- access_token
- session_key
- private_key
- password
- Authorization 默认 Header
- OpenID / UnionID
- 设备唯一标识 / Fingerprint

`api.example.com` 仍仅为 placeholder。

## 17. Static Rules

升级 `scripts/stage5-static-rules.js`：

- `wx.request` 只允许在 `utils/api-transport.js`
- pages / packageTools / packageUser / packageAI / packageGithub 禁止直接 `wx.request`
- services 禁止直接 `wx.request`
- 其他 utils 禁止直接 `wx.request`
- API Client / Contract / Environment 禁止实现网络 Transport
- WeChat Transport 禁止 `fetch` / `XMLHttpRequest` / upload / download / socket
- Secret 检查继续生效
- `REMOTE_API_ENABLED = false` 继续强制

Stage 4 已存在的 dormant `utils/image-moderation.js` `wx.uploadFile` 适配器保持原 Stage 4 基线例外，本 Step 未修改、未接入正式链路、未新增第二个上传实现。

同时 `scripts/check-project.js` 的 Stage 3 远程边界精确升级：仅允许 `utils/api-transport.js` 承载普通 `wx.request`，不对其他模块放开。

## 18. Stage 5 Tests

`npm run test-stage5`：

```text
Stage 5 API/Transport tests: PASS (94 cases)
```

覆盖：

- Remote disabled
- development / production disabled
- URL
- Query
- Method
- Headers
- Timeout
- WeChat Transport success/fail/injection/Node no-wx
- HTTP 200/201/400/401/404/429/500/503
- Business Error
- Network Error
- input mutation
- Static Rule
- Secret / 网络边界

全部使用 mock / injected transport，没有真实互联网访问。

## 19. Stage 4 Regression

`npm run test:stage4`：PASS。

```text
452 + 53 + 30 + 57 + 71 + 70 = 733 / 733 PASS
```

`npm run test:stage4:static`：20 / 20 PASS。

## 20. Stage 3 Regression

`npm run test:stage3`：

```text
Stage 3 data-layer tests: PASS
```

Stage 3 Storage、Search、Discovery、24 工具逻辑均未修改。

## 21. check

`npm run check`：PASS。

Stage 5 检查项：

```text
[15] Stage 5 API 契约 / 环境 / Client / Transport 基础
OK
```

## 22. ERROR / WARNING

```text
ERROR = 0
WARNING = 0
```

## 23. 是否真实联网

否。

虽然 `utils/api-transport.js` 已具备生产运行时 `wx.request` Adapter，但：

- Remote 默认关闭
- 当前没有业务页面调用
- 当前没有业务 Service 调用
- 自动测试只使用 injected fake requestImpl / mock transport
- 未访问 `api.example.com`
- 未访问 wanluu.com
- 未访问 GitHub
- 未访问 WordPress
- 未访问 AI 服务

## 24. 是否具备进入 Step 3 条件

是。

Stage 5 Step 2 已满足：

- Transport abstraction 已建立
- `wx.request` 正式调用只位于统一 Adapter
- 页面 / Service 无直接 `wx.request`
- Remote development / production 均为 false
- 无真实服务器地址
- 无 Secret
- API Client 可在 Node 环境测试
- Response / Error / URL / Query / HTTP 分类稳定
- Stage 5 94 cases PASS
- Stage 4 733 cases PASS
- Stage 4 Static 20 cases PASS
- Stage 3 PASS
- check PASS
- ERROR = 0 / WARNING = 0

本 Step 未执行 Git Commit / Push，未进入 Stage 5 Step 3。
