# Stage 4 Step 6 执行结果

> 项目：挽鹿工具箱 / Wanlu Toolbox
>
> 阶段：Stage 4 Step 6
>
> 目标：对图片 / 视频工具中可独立验证的纯逻辑进行抽离、Node 自动测试、边界验证和最小问题修复；微信相册、Canvas 实际绘制、真实编码与隐私后台能力继续保留为 B 类人工平台验收。

---

## 1. 本步骤范围

本步骤仅处理以下 8 个正式工具：

1. `image-compress`
2. `image-resize`
3. `qrcode`
4. `image-watermark`
5. `long-image`
6. `nine-grid`
7. `pindou`
8. `video-compress`

未处理 `ruler / choice-helper / guide`，未修改搜索、发现页、Discovery Service、首页产品结构、“我的”页，也未接入 AI、GitHub、wanluu.com、登录、会员、支付或广告。

---

## 2. 新增纯逻辑文件

本步骤形成 / 使用以下纯逻辑模块：

```text
utils/tool-logic/image-compress.js
utils/tool-logic/image-resize.js
utils/tool-logic/qrcode.js
utils/tool-logic/image-watermark.js
utils/tool-logic/long-image.js
utils/tool-logic/nine-grid.js
utils/tool-logic/pindou.js
utils/tool-logic/video-compress.js
```

另外 `pindou` 继续复用既有纯引擎：

```text
utils/pindou-engine.js
```

上述 `utils/tool-logic/*` 中未发现 `wx.*`、`setData`、`canvasToTempFilePath` 等平台调用，Node 可直接加载测试。

---

## 3. 修改页面文件

```text
packageTools/pages/image-compress/image-compress.js
packageTools/pages/image-resize/image-resize.js
packageTools/pages/qrcode/qrcode.js
packageTools/pages/image-watermark/image-watermark.js
packageTools/pages/long-image/long-image.js
packageTools/pages/nine-grid/nine-grid.js
packageTools/pages/pindou/pindou.js
packageTools/pages/video-compress/video-compress.js
```

页面继续负责真实微信 API、Canvas、文件、相册和 UI 状态；可测的参数计算与校验由统一纯逻辑提供。

---

## 4. image-compress

纯逻辑覆盖：

- 原图宽高合法性
- 最大边限制
- 横图 / 竖图 / 方图等比缩放
- `original / 1920 / 1280 / 800`
- 4096 Canvas 安全上限
- 清晰 / 均衡 / 极小质量参数
- 质量降级尝试顺序
- 压缩率计算
- NaN / Infinity / 0 / 负尺寸防护
- Input Mutation / 重复执行

真实 Canvas 编码后的文件大小是否实际下降不做伪自动验收。

---

## 5. image-resize

纯逻辑覆盖：

- 自定义宽高校验
- 50~4096 px 正式边界
- 小数尺寸舍入
- `cover / contain / stretch`
- 16:9、4:3、1:1、竖图几何
- source / dest 参数有限性
- 0、负值、NaN、Infinity 防护
- Input Mutation / 重复执行

页面生产逻辑与自动测试使用同一份 `utils/tool-logic/image-resize.js`。

---

## 6. qrcode

纯逻辑覆盖：

- 正常文本
- 中文
- URL
- 空文本 / 空白文本
- 非字符串
- 最大输入长度边界
- 超长输入
- QR model 生成
- 矩阵静默区 / scale / offset
- 无效 model
- 0 / 负数 / NaN / Infinity 导出尺寸
- Logo 尺寸 / padding / 中心坐标
- Logo 比例边界
- 重复执行稳定性

真实 Canvas 绘制、Logo 图片加载、PNG 导出仍属于平台路径。

---

## 7. image-watermark

纯逻辑覆盖：

- 水印文字规范化
- 最多 3 行
- 超大图片导出尺寸限制
- 横 / 竖 / 极端比例
- 透明度档位
- opacity 0 / 1
- opacity 越界 / NaN / Infinity
- 字号、行高、块高度、平铺间距、对角线参数
- Input Mutation / 重复执行

实际 Canvas 视觉效果不做虚假 Node 验收。

---

## 8. long-image

纯逻辑覆盖：

- 2~9 张输入
- 混合尺寸
- 等比统一输出宽度
- 总高度计算
- 超高结果自动缩放
- 最大导出高度
- 最小安全宽度
- 空数组 / 单图 / 超过 9 张
- 0 / 负数 / NaN / Infinity 尺寸
- 顺序计划
- Input Mutation / 重复执行

真实图片加载、逐张 Canvas 绘制、最终 JPG 导出仍需平台环境。

---

## 9. nine-grid

纯逻辑覆盖：

- 横图左 / 中 / 右裁切
- 竖图上 / 中 / 下裁切
- 方图
- 3×3 九个 source rect
- 非 3 整除尺寸的完整 fractional source coverage
- 小尺寸图片
- 899 / 1000 / 3072 / 超 3072 尺寸
- 最大输出 tile 1024 px
- 裁切区域越界保护
- Preview 几何有限性
- Input Mutation / 重复执行

真实九次 JPG Canvas 导出与批量相册保存继续为平台路径。

---

## 10. pindou

先按真实项目代码确认功能后进行测试，没有按名称猜测。

纯逻辑覆盖：

- 网格宽度 10~100
- 原图宽高比例换算
- 网格高度上限
- NaN / Infinity / 0 尺寸保护
- 图纸导出布局
- 4096 最大导出边
- 图例列数
- 不可能导出的超大 pattern 拒绝
- `utils/pindou-engine` 基础像素量化确定性
- 透明输入
- `replacePatternColor()` 不修改源数组
- Input Mutation / 重复执行

真实 `getImageData`、编辑 Canvas 和 PNG 导出仍属于平台验收。

---

## 11. video-compress

纯逻辑覆盖：

- `high / medium / low` 质量尝试顺序
- 无效 quality
- 横屏 / 竖屏视频元数据
- width / height / duration / size 校验
- 0 / 负时长 / NaN / Infinity
- 压缩结果 width / height / size 校验
- 压缩率计算
- 压缩后不更小时的状态
- Input Mutation / 重复执行

真实 `wx.compressVideo` 压缩效果和编码质量不得由 Node 测试冒充正式验收。

---

## 12. 完整纯逻辑覆盖工具

**0 个被标记为“整工具完全自动验收”。**

原因：8 个工具全部包含真实微信媒体、Canvas、文件或编码路径，不能脱离微信运行环境完整验收。

因此本步骤不宣称 8/8 全自动覆盖。

---

## 13. 部分纯逻辑覆盖工具

**8 / 8 均完成有价值的纯逻辑自动覆盖：**

```text
image-compress
image-resize
qrcode
image-watermark
long-image
nine-grid
pindou
video-compress
```

这里的“部分纯逻辑覆盖”只表示参数、尺寸、几何、策略和核心非平台算法已经自动验证，不代表微信平台实际处理路径已人工验收。

---

## 14. 仍需平台人工验收能力

以下继续统一标记：

**【B：代码通过，待人工平台验收】**

包括：

- `wx.chooseMedia`
- 真实相册选图 / 选视频
- `wx.getImageInfo`
- `wx.getVideoInfo`
- Canvas 2D 实际绘制
- `canvasToTempFilePath`
- 真机 JPG / PNG 编码效果
- `wx.compressVideo`
- 真机视频编码 / 文件结果
- `wx.saveImageToPhotosAlbum`
- `wx.saveVideoToPhotosAlbum`
- `wx.requirePrivacyAuthorize`
- 真实隐私后台声明
- iPhone / Android 真机媒体能力

图片来源仍强制：

```text
sourceType: ['album']
```

没有恢复 camera，也没有新增 `scope.camera`。

---

## 15. qrcode P1 状态

**已最小修复。**

Step 2 P1 原因为渲染过程可重复触发，并存在并发 Canvas / 重复 Usage / 旧任务覆盖风险。

当前页面具备：

- `if (this.data.isRendering) return`
- `_renderTaskId` 请求序号
- 异步阶段检查 `renderTaskId !== this._renderTaskId`
- 输入变化 / 页面退出使旧任务失效
- Canvas / 导出失败后恢复 `isRendering=false`
- 失败时撤销 `hasGenerated`
- 只有当前有效任务 PNG 成功导出后才 `recordToolUse()`

自动测试同时增加页面静态回归检查，锁定防重入和 task token 结构。

---

## 16. image-compress P2 状态

**已修复。**

Step 2 P2 原因：UI “原尺寸”实际仍会对超 4096 px 图片缩放，文案存在误导。

当前选项明确为：

```text
原尺寸（最长边≤4096）
```

逻辑测试同时验证超 4096 输入会正确限制并标记 `platformLimited=true`。

---

## 17. image-resize P2 状态

**已修复。**

Step 2 P2 原因：无效自定义尺寸曾静默回退 800 或被直接夹到边界，用户输入与实际生成尺寸可能不一致。

当前改为显式校验：

```text
宽高必须为有限数值
50 <= width,height <= 4096
```

空值、0、负数、NaN、Infinity、49、4097 等均返回明确失败，不再静默回退为有效生成尺寸。

---

## 18. nine-grid P2 状态

**已修复。**

Step 2 P2 原因：小图曾强制每格至少 300px，导致无提示上采样。

当前 tile 输出尺寸：

```text
floor(min(cropSize, 3072) / 3)
```

不再强制 300px。

同时 source tile 使用 fractional source size，1000×1000 等不可被 3 整除的裁切区仍完整覆盖到 1000px 边界，不丢失最后 1px 源区域。

---

## 19. Canvas 参数安全结果

自动测试已验证可由纯逻辑产生的 Canvas 参数必须为有限合法值。

重点包括：

- width / height
- sourceX / sourceY
- sourceWidth / sourceHeight
- destX / destY
- destWidth / destHeight
- tileSize
- drawY / drawHeight
- QR scale / offset
- watermark 布局尺寸
- pindou export layout

`0 / 负数 / NaN / Infinity` 在不允许的场景会提前失败。

这不等于 Canvas 运行时已经 C 类人工验收；真实 Canvas 仍为 B 类。

---

## 20. NaN / Infinity

当前 Stage 4 自动测试未发现图片 / 视频纯逻辑成功结果存在 `NaN / Infinity / -Infinity` 参数泄漏。

非法非有限输入均被拒绝或无法形成成功业务结果。

---

## 21. Input Mutation

当前纯逻辑测试未发现调用方输入对象 / 数组被意外修改。

已覆盖图片尺寸、布局对象、图片数组、视频元数据、pindou 参数等代表性输入。

---

## 22. 重复执行

可重复纯函数均验证相同输入连续执行至少 3 次结果稳定。

未发现依赖前一次调用状态、全局缓存污染或输入数组修改导致结果漂移。

真实异步 wx / Canvas 调用不使用伪环境冒充重复执行测试。

---

## 23. recordToolUse 核对

8 个页面继续保持“核心处理真正成功后才计 Usage”的语义：

- `image-compress`：有效压缩/导出结果成功后记录
- `image-resize`：有效输出文件成功后记录
- `qrcode`：当前有效 render task PNG 导出成功后记录
- `image-watermark`：水印输出成功后记录
- `long-image`：完整长图输出成功后记录
- `nine-grid`：9 张全部生成后记录
- `pindou`：pattern 真正生成并建立编辑状态后记录
- `video-compress`：取得有效压缩结果后记录

保存到相册是后续独立动作；用户取消保存或保存失败，不会反向抹掉已经完成的核心处理 Usage。

---

## 24. 新发现问题

本步骤没有发现额外新的 P0 / P1 生产缺陷。

本步骤重点通过自动测试和静态验证重新锁定 Step 2 已记录的 4 个问题：

1. qrcode P1
2. image-compress P2
3. image-resize P2
4. nine-grid P2

这些问题均已在本步骤范围内完成最小修复。

---

## 25. 实际修复问题

实际修复 **4 项**：

1. `qrcode`：渲染防重入、旧任务失效和失败状态恢复
2. `image-compress`：4096 上限文案与真实行为一致
3. `image-resize`：无效自定义尺寸不再静默回退 / clamp 成成功值
4. `nine-grid`：移除小图强制 300px tile 上采样，并锁定完整源像素覆盖策略

---

## 26. 自动测试总 Case 数

Step 5 基线：

```text
291 cases
```

Step 6 最终：

```text
452 cases
```

本步骤累计新增 / 扩展：

```text
161 cases
```

测试仍由：

```text
scripts/test-stage4-tools.js
```

统一执行，没有引入大型测试框架。

---

## 27. npm run test:stage4

```text
Stage 4 tools tests: PASS (452 cases)
```

---

## 28. npm run test:stage3

```text
Stage 3 data-layer tests: PASS
```

---

## 29. npm run check

```text
PASS
```

---

## 30. ERROR / WARNING

```text
ERROR = 0
WARNING = 0
```

静态检查同时确认首发版未发现摄像头能力，未发现密钥类明文，Stage 3 本地数据架构继续通过。

---

## 31. 是否具备进入 Step 7 条件

**是。**

当前技术条件满足：

```text
Stage 4 tools tests: PASS (452 cases)
Stage 3 data-layer tests: PASS
npm run check: PASS
ERROR = 0
WARNING = 0
```

但本文件只确认 Step 6 完成状态。

**当前未进入 Stage 4 Step 7，也未进入 Stage 5。**

等待用户确认后再执行下一步骤。
