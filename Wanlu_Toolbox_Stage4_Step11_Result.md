# Stage 4 Step 11 执行结果

> 项目：挽鹿工具箱 / Wanlu Toolbox
>
> 阶段：Stage 4 Step 11
>
> 目标：重新检查 24 个正式工具的交互一致性，只做真实问题的最小修复；不新增业务功能，不进入 Step 12 / Stage 5。

## 1. 审计的24个正式工具

本 Step 以 `utils/tool-catalog.js` 为正式清单，重新检查：

```text
image-compress
image-resize
qrcode
image-watermark
long-image
nine-grid
pindou
video-compress
converter
date-diff
mortgage
salary
price-compare
compound
retirement-pension
retirement-age
shelf-life
relationship
bmi
bmr
restaurant
ruler
choice-helper
guide
```

共 24 / 24。

`wooden-fish / zodiac` 继续不属于正式工具，未恢复、未重新注册。

## 2. 修改文件

本 Step 明确修改 / 新增：

```text
packageTools/pages/ruler/ruler.js
packageTools/pages/choice-helper/choice-helper.js
packageTools/pages/guide/guide.js
packageTools/pages/guide/guide.wxml
packageTools/pages/bmi/bmi.wxml
scripts/test-stage4-interaction.js
scripts/check-project.js
package.json
Wanlu_Toolbox_Stage4_Step11_Result.md
```

共 9 个文件（含结果文档）。

## 3. loading / processing

8 个图片 / 视频正式工具均重新核对其真实异步状态防护：

```text
image-compress   isCompressing / isSaving
image-resize     isProcessing / isSaving
qrcode           isRendering / isSaving
image-watermark  isProcessing / isSaving
long-image       isGenerating / isSaving
nine-grid        isGenerating / isSaving
pindou           isLoadingImage / isGenerating / isExporting / isSaving
video-compress   isCompressing / isSaving
```

同步计算工具没有为了“统一”被强行改成异步 loading。

## 4. 防重复点击

代码层已重新检查生成、处理、压缩、保存、抽选、计算等操作。

重点结果：

- qrcode 保持 `isRendering` 防重入；
- 图片 / 视频处理与保存各自有状态 guard；
- choice-helper `isPicking` 继续阻止重复抽取；
- 本 Step 额外发现 choice-helper 在抽取动画期间仍可执行“添加选项”，会改变正在抽选的数据集合，因此新增 `isPicking` guard；
- 同步计算器允许用户主动再次点击计算，每次合法主动计算可形成一次新的业务成功，不属于异步重复提交缺陷。

## 5. Async 竞态

已知重点：

- qrcode：保留 `_renderTaskId`，旧渲染任务不能覆盖当前任务；
- pindou：保留 `_imageRequestId` / pattern revision 等现有机制；
- choice-helper：本 Step 新增 `_isPageActive` 生命周期防护，Promise / timer 尾回调在页面失效后不再继续更新抽选结果；
- 其他媒体页已存在单任务 processing guard，不允许同类处理并发启动。

代码层未发现仍可确认的“旧任务覆盖新任务”生产缺陷；真实微信 Canvas / 文件回调在页面切换时的最终时序仍属于 B 类真机验收。

## 6. 页面退出后的异步任务

本 Step 重点修复 choice-helper Step 2 P2：

```text
onLoad  → _isPageActive = true
onUnload → _isPageActive = false + clearPickTimer()
Promise.then / timer / finishPick → 检查 _isPageActive 与 isPicking
```

qrcode 继续在 `onUnload()` 使旧 `_renderTaskId` 失效。

pindou 继续在 `onUnload()` 清理绘制定时器，并对选图使用 request id。

真实 iPhone / Android 页面退出、Canvas 和临时文件生命周期仍不能由 Node 静态测试冒充真机 PASS。

## 7. Error / Retry

重新核对原则：

- 异步失败会释放 processing / saving 状态；
- 保存取消不作为核心处理失败；
- 同步计算输入变化会清理或重新计算旧结果，避免旧成功结果冒充新输入结果；
- 错误信息继续使用用户可理解文案，不把技术堆栈直接显示给用户。

本 Step 未发现需要重构统一错误框架的 P0/P1 问题。

## 8. 用户取消

图片 / 视频选择和相册保存继续复用现有 cancel 处理。

保存取消时：

```text
恢复 isSaving
不撤销已生成核心结果
不重复 recordToolUse
不显示严重系统错误
```

真实授权弹窗与系统取消交互继续属于 B 类平台验收。

## 9. Success 状态

24 个工具按实际职责重新核对成功点。

同步计算器以合法纯逻辑结果为成功；图片 / 视频工具以有效处理产物生成为核心成功；guide 没有核心业务成功；ruler 当前没有一个可准确代表“测量完成”的主动动作。

## 10. 核心成功与保存成功语义

8 个图片 / 视频工具继续保持：

```text
核心结果生成成功
≠
保存到系统相册成功
```

`recordToolUse()` 保持在核心处理成功点；后续保存失败 / 取消不会反向撤销已完成的业务成功，也不会因为保存再次计 Usage。

## 11. recordToolUse

24 / 24 已重新核对。

结论：

- 22 个有明确业务成功点的正式工具继续按成功点记录 Usage；
- `guide`：无核心工具操作，继续不记录；
- `ruler`：本 Step 决定暂时不记录 Usage，原因是当前页面没有“用户完成一次测量”的明确确认动作，而“保存校准”只是配置行为，不能代表真实尺子使用次数；
- qrcode：PNG 导出成功后记录，防重入 / task token 防止同一次任务重复计数；
- relationship：silent 中间解析继续不计 Usage，只在明确用户查询语义满足时记录；
- 失败、NaN / Infinity、页面打开、预览、相册保存均不作为新的 Usage 成功点。

为与上述真实语义一致，静态检查规则把 `ruler` 与 `guide` 设为允许无 `recordToolUse` 的正式特殊工具；没有放宽其他 22 个工具的规则。

## 12. qrcode 回归

Step 2 P1 状态：**已关闭**。

Step 11 回归确认：

```text
isRendering 防重入
_renderTaskId 任务序号
onUnload 失效旧任务
成功 PNG export 后才 recordToolUse
保存动作独立
```

## 13. relationship 回归

Step 2 P1 状态：**已关闭**。

继续确认：

```text
silent 自动中间计算
→ 更新展示
→ 不记录 Usage
```

`shouldRecordRelationshipUsage()` 和一次构建期防重复语义仍在。

## 14. ruler Usage 最终语义

最终决定：**当前版本 ruler 不记录 Usage。**

理由：

- 尺子的核心价值是实际屏幕测量；
- 页面没有“完成测量 / 确认测量”的主动成功动作；
- 页面打开不代表有效使用；
- 保存校准也不等于实际测量成功。

因此删除“保存校准 → recordToolUse”的错误统计语义，比人为制造虚假 Usage 更准确。

未来若新增明确的用户主动测量确认动作，再单独定义真实成功点。

## 15. choice-helper

Step 2 P2-07：**本 Step 已关闭代码风险**。

修复：

- 增加页面活动状态；
- unload 立即失效异步尾任务并清 timer；
- Promise / timer / finishPick 均检查页面活动状态；
- 抽选进行中禁止新增选项；
- 原有 `isPicking` 防重复抽取继续保留；
- Usage 仍只在最终抽选结果真正完成后记录一次。

真实动画观感与真机退出时序继续 B 类验收。

## 16. guide

Step 2 P2-08：**本 Step 已关闭**。

修复：

- “首页热门”统一改为“首页精选”；
- 移除已非正式工具“星座计算器”的提示与说明；
- 保持 guide 为说明页；
- 继续不调用 `recordToolUse()`。

## 17. Step 2 P1 风险关闭表

| 风险 | Step 11 最终状态 |
|---|---|
| qrcode P1-01 | 已关闭；Step 6 修复，Step 11 回归 PASS |
| converter P1-02 | 已关闭；共享 core 已有限数校验，自动测试继续 PASS |
| mortgage P1-03 | 代码问题已关闭；共享 core 有有限数/极端边界保护；政策默认参数新鲜度另行核验 |
| salary P1-04 | 代码问题已关闭；共享 core 有比例/有限数边界；政策默认参数新鲜度另行核验 |
| relationship P1-05 | 已关闭；silent 中间计算不再膨胀 Usage |
| restaurant P1-06 | 已关闭；共享 core 统一金额/比例合法区间，自动测试继续 PASS |

## 18. Step 2 P2 风险关闭表

| 风险 | Step 11 最终状态 |
|---|---|
| image-compress P2-01 | 已关闭；“原尺寸”4096 安全边界已明确并测试 |
| image-resize P2-02 | 已关闭；自定义尺寸显式校验，不再静默 fallback/clamp 成成功 |
| nine-grid P2-03 | 已关闭；取消强制 300px 上采样，并测试余数裁切 |
| bmi P2-04 | 本 Step 关闭；UI 明确“成年人 BMI 参考范围”，儿童/青少年提示使用年龄对应标准 |
| bmr P2-05 | 已关闭；core 最低年龄已与成人说明统一为 18 岁 |
| ruler P2-06 | 本 Step 关闭语义歧义；取消“保存校准=Usage”，当前不记录 Usage |
| choice-helper P2-07 | 本 Step 关闭代码风险；增加页面活动 / timer / Promise 尾回调防护 |
| guide P2-08 | 本 Step 关闭；改“精选”并移除 zodiac 说明 |

## 19. mortgage / salary 政策状态

### mortgage

```text
代码计算与边界：自动测试 PASS
NaN / Infinity 防护：PASS
极端金额 / 利率边界：已覆盖
政策默认参数新鲜度：待后续专项核验
```

### salary

```text
代码计算与边界：自动测试 PASS
比例 / 非有限输入防护：PASS
旧结果清理：当前页面 updateDraft 已处理
政策默认参数新鲜度：待后续专项核验
```

本 Step 没有擅自修改任何现实政策数值，也不把代码测试冒充现实政策最新性证明。

## 20. 新发现 P0

**0。**

## 21. 新发现 P1

**0。**

## 22. 新发现 P2

**1。**

新发现：choice-helper 抽选动画期间虽然不能再次 `onPick`，但原 `onAddOption()` 没有 `isPicking` guard，可能改变当前抽选的数据集合。

已在本 Step 最小修复。

## 23. 实际修复数量

生产交互 / 语义问题共 **5 项**：

1. ruler：取消“保存校准 = Usage”的错误统计语义；
2. choice-helper：修复既有 unload / Promise / timer 尾回调 P2；
3. choice-helper：修复本 Step 新发现的抽选中仍可添加选项问题；
4. guide：修复“热门”与 zodiac 文案回归；
5. BMI：明确成年人适用范围，关闭适用人群文案歧义。

另同步修正 1 处静态检查规则，使 ruler / guide 的“无 Usage”特殊语义与正式检查一致；该规则调整不计入生产问题数量。

## 24. 仍需 B 类人工验收项目

以下继续不能自动宣称真机 PASS：

```text
真实微信按钮高频连续点击
Canvas 真机任务时序
图片 / 视频选取取消
相册保存取消 / 权限弹窗
wx.compressVideo 真机行为
canvasToTempFilePath 真机文件生命周期
iPhone 页面退出时异步回调
Android 页面退出时异步回调
choice-helper 动画真实观感
临时文件失效后的真实系统表现
```

继续标记：**【B：代码通过，待人工平台 / 真机验收】**。

## 25. Interaction Test

新增：

```text
scripts/test-stage4-interaction.js
```

自动检查：

- 24 / 24 正式工具存在并接入统一 `withToolPage`；
- wooden-fish / zodiac 未恢复；
- qrcode 防重入 / task token / unload；
- relationship silent Usage；
- ruler 无虚假 calibration Usage；
- choice-helper 防重复 / 页面失效 / timer 尾回调；
- 8 个媒体工具 processing / save 分离；
- Step 2 已关闭 P1/P2 静态回归；
- guide 无“热门”/zodiac 回归；
- 无 camera 恢复。

结果：

```text
Stage 4 interaction tests: PASS (70 cases)
```

## 26. Stage 4 总 Case 数

```text
452 tools
+ 53 search
+ 30 search integration
+ 57 discovery
+ 71 discover integration
+ 70 interaction
= 733 cases
```

## 27. npm run test:stage4

最终执行：

```text
Stage 4 tools tests: PASS (452 cases)
Stage 4 search tests: PASS (53 cases)
Stage 4 search integration tests: PASS (30 cases)
Stage 4 discovery tests: PASS (57 cases)
Stage 4 discover integration tests: PASS (71 cases)
Stage 4 interaction tests: PASS (70 cases)
```

结论：**PASS**。

## 28. npm run test:stage3

最终执行：

```text
Stage 3 data-layer tests: PASS
```

结论：**PASS**。

## 29. npm run check

在 ruler Usage 语义正式改为“当前无真实成功点，不记录”后，首次静态检查暴露旧规则仍强制所有非 guide 工具必须 `recordToolUse`。

因此只做规则一致性修正：

```text
usageOptionalTools = guide + ruler
```

其他 22 个正式工具仍必须拥有核心成功 Usage。

最终执行：

```text
PASS
```

## 30. ERROR / WARNING

最终：

```text
ERROR = 0
WARNING = 0
```

## 31. 是否具备进入 Step 12 条件

**是。**

当前满足：

```text
Stage 4 total tests: PASS (733 cases)
Stage 3 data-layer tests: PASS
npm run check: PASS
ERROR = 0
WARNING = 0
```

但本 Step 已立即停止。

**未进入 Stage 4 Step 12，未进入 Stage 5。**
