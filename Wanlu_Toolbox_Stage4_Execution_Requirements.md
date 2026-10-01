# 挽鹿工具箱 Stage 4 开发执行要求

> 文件：`Wanlu_Toolbox_Stage4_Execution_Requirements.md`
>
> 主方案：`Wanlu_Toolbox_Stage4_Implementation_Plan.md`
>
> 用途：固定 Stage 4 正式开发期间的执行纪律与用户最终补充要求。本文件不重新设计 Stage 4；未被本文件明确修改的内容，继续严格按 `Wanlu_Toolbox_Stage4_Implementation_Plan.md` 执行。

---

## 1. 执行依据与优先级

Stage 4 正式开发依据：

1. `Wanlu_Toolbox_Stage4_Implementation_Plan.md`：Stage 4 主方案。
2. 本文件：Stage 4 最终执行补充。
3. Stage 3 已确认的数据结构、边界和回归要求继续作为不可破坏基础。
4. `Wanlu_Toolbox_Manual_Release_Checklist.md`：所有必须由管理员本人完成的微信公众平台、隐私、备案、真机、上传、审核与发布事项统一后移记录。

如主方案与本文件以下四项最终补充出现冲突，以本文件的最终补充为准；其他内容仍以 Stage 4 主方案为准。

---

# 2. 最终补充一：`isHot` 的正式 UI 命名

当前 `utils/tool-catalog.js` 中的 `isHot` 属于人工配置标记，不代表实时用户统计、全网热度或真实榜单数据。

因此 Stage 4 正式 UI 必须遵守：

```text
isHot（内部配置字段）
≠
真实实时热门统计
```

正式用户界面优先使用：

```text
精选工具
```

或在具体语境确有需要时使用：

```text
推荐工具
```

在没有真实统计依据前，禁止使用可能暗示实时统计的文案：

```text
热门工具
实时热门
今日热门
全网热门
热榜
趋势榜
```

允许内部继续保留 `isHot` 字段，避免为纯命名问题破坏既有 catalog 结构；Stage 4 只调整它在产品层的语义解释和正式 UI 文案。

未来只有在具备真实、可说明的数据统计依据后，才能重新评估是否使用“热门”。

自动检查应能够发现正式 UI 中新增或残留的不当“热门”语义。

---

# 3. 最终补充二：政策 / 金额类工具必须具备规则版本意识

Stage 4 对以下工具进行重点规则审计：

```text
mortgage
salary
retirement-pension
retirement-age
```

同时覆盖其他依赖以下外部变化因素的正式工具：

```text
政策
税率
利率
缴费规则
退休规则
时间生效条件
金额上下限
地区或年份规则
```

## 3.1 规则与页面 UI 分离

不得把会变化的政策、税率、利率、金额边界或生效时间规则无结构地散落硬编码在 Page 文件中。

应优先形成清晰的规则层，例如：

```text
utils/tool-logic/<tool>.js
utils/policy-config.js
或同等级明确结构
```

页面主要负责：

```text
输入
↓
调用规则 / 计算逻辑
↓
展示结果
```

规则模块负责：

```text
规则版本
更新时间
适用范围
边界参数
计算公式
```

## 3.2 规则版本元数据

对适用工具预留并维护：

```js
RULE_VERSION
UPDATED_AT
```

或同等级清晰结构，例如：

```js
const RULE_META = Object.freeze({
  version: '...',
  updatedAt: '...',
})
```

要求：

- 能从代码中明确判断当前规则版本；
- 能明确判断规则最后核对 / 更新时间；
- 规则更新时能够定位对应测试；
- 不要求 Stage 4 建立服务器规则中心；
- 不要求 Stage 4 接远程配置；
- 不要求 Stage 4 接入真实 API。

## 3.3 自动测试要求

政策 / 金额类工具不能只测试普通公式结果，还必须测试：

```text
规则边界
生效时间边界（适用时）
最低 / 最高金额边界
税率 / 利率分段边界
0 / 空值 / 非法值
规则版本元数据存在性
规则更新后测试可追踪性
```

若某项规则属于会随政策变化的数据，测试要验证当前代码声明的规则边界，而不是假设规则永久不变。

---

# 4. 最终补充三：本地“为你推荐”必须轻量、可解释、可清除

Stage 4 本地推荐只允许使用：

```text
本机 wl_tool_usage_v1
本机收藏
本机最近使用
工具分类
tool-catalog
```

明确禁止：

```text
设备指纹
敏感画像
远程行为分析
新增推荐 Storage
AI 推荐
云端用户画像
隐藏持久化标签
```

推荐算法必须满足：

1. 完全本地运行；
2. 输入来源明确；
3. 可用纯函数自动测试；
4. 推荐结果可解释；
5. disabled 工具不进入结果；
6. `wooden-fish` / `zodiac` 永不进入正式推荐；
7. 不持久化额外画像；
8. 不增加新的 Storage Key。

## 4.1 清除数据后的推荐回退

这是 Stage 4 硬性规则：

```text
用户清空对应本地行为数据
↓
推荐层下一次读取立即失去对应个性化依据
↓
立即回到默认推荐状态
```

不得：

```text
保留隐藏画像
保留额外推荐缓存
保留不可见用户标签
通过其他新 Storage 恢复旧画像
```

默认推荐只能来自真实 `tool-catalog` 配置，例如“精选工具”集合与分类探索。

自动测试必须至少覆盖：

- 无行为数据 → 默认推荐；
- 有 Usage → 本地个性化推荐；
- 有收藏 → 可参与推荐；
- 有最近使用 → 可参与推荐；
- 清空 Usage 后 → 相关推荐立即回退；
- 清空收藏后 → 收藏信号立即消失；
- 清空最近使用后 → 最近使用信号立即消失；
- 清空全部本地数据后 → 完全回到默认推荐状态。

---

# 5. 最终补充四：发现页必须采用动态区块

发现页定位：

```text
帮助用户发现可能有用的真实工具
```

不得成为：

```text
第二个完整工具目录
第二个首页
第二个“我的”页
```

候选区块包括：

```text
常用工具
最近使用
我的收藏
精选工具
分类探索
为你推荐
```

但禁止六个模块无条件全部同时展示。

## 5.1 动态展示原则

应根据真实本地数据量和可用信号决定展示区块。

### 无行为数据

优先展示：

```text
精选工具
分类探索
```

### 有少量数据

优先展示：

```text
最近使用
精选工具
分类探索
```

### 有较丰富数据

优先展示：

```text
常用工具
为你推荐
我的收藏
分类探索
```

具体阈值在开发时必须采用确定、可测试的纯规则，不得根据不可追踪的随机逻辑决定。

## 5.2 去重与职责约束

发现页必须：

- 同一工具避免在同屏多个模块无意义重复；
- 优先保留更有用户价值的区块；
- 数据不足的区块应隐藏，而不是显示空壳；
- 不复制完整工具目录；
- 不复制“我的”全部本地数据管理能力；
- 不复制首页所有快捷入口；
- 不显示假数据来填满布局。

## 5.3 动态区块自动测试

必须覆盖：

```text
无行为数据
仅有最近使用
仅有收藏
有少量 Usage
有丰富 Usage
同时存在 Usage + 收藏 + 最近使用
清空最近使用后
清空收藏后
清空 Usage 后
清空全部数据后
```

并检查：

- 区块组合符合规则；
- 工具结果去重；
- 无空壳区块；
- 无 disabled 工具；
- 无 wooden-fish / zodiac；
- 无假远程内容。

---

# 6. Stage 4 继续保持的硬性边界

Stage 4 继续严格禁止：

```text
破坏 Stage 3 数据结构
新增无必要 Storage
真实 AI
GitHub API
wanluu.com API
真实微信登录
会员
支付
广告
云同步
新的隐私权限
摄像头
定位
麦克风
通讯录
设备指纹
恢复 wooden-fish 正式入口
恢复 zodiac 正式入口
```

同时保持：

- 公开代码不暴露 AppSecret、API Key、Token；
- 不保存图片 / 视频大文件；
- 不保存 Base64；
- 不长期保存图片 / 视频临时路径；
- 不持久化敏感业务输入；
- 页面不绕过 Stage 3 Service 直接散落操作业务 Storage；
- 最近使用继续由 `wl_tool_usage_v1 + recentClearedAt` 派生；
- `wl_tool_usage_v1` 继续使用 `aggregate-no-tombstone`；
- Stage 3 Migration / Recovery 继续保持可回归；
- 所有人工微信后台事项继续后移。

---

# 7. Stage 4 Step 1：基线冻结标准

Stage 4 正式开始前必须执行：

```bash
npm run check
npm run test:stage3
```

通过标准：

```text
ERROR = 0
WARNING = 0
Stage 3 data-layer tests = PASS
```

如果任一项失败：

```text
停止 Stage 4 后续步骤
↓
先修复基线问题
↓
重新运行完整基线
↓
全部通过后才能进入 Step 2
```

Step 1 只用于冻结现有 Stage 3 稳定基线，不提前实现 Stage 4 功能。

## 7.1 Step 1 实际执行结果

已实际执行：

```text
npm run check
→ ERROR = 0
→ WARNING = 0

npm run test:stage3
→ Stage 3 data-layer tests: PASS
```

结论：

```text
Stage 4 Step 1：PASS
Stage 3 稳定基线已冻结
可以进入 Step 2，但本次不提前执行 Step 2
```


---

# 8. Stage 4 全程测试纪律

每个大步骤完成后必须至少执行：

```text
对应 Stage 4 专项测试
+
Stage 3 回归测试
+
静态检查
```

最终目标固定为：

```text
npm run test:stage3  → PASS
npm run test:stage4  → PASS
npm run check        → PASS

ERROR = 0
WARNING = 0
```

出现 ERROR / WARNING 时必须先修复，不得积累。

---

# 9. 人工微信事项继续后移

以下事项不阻塞 Stage 4：

```text
微信公众平台人工配置
用户隐私保护指引
服务内容声明
相册后台声明
服务类目
备案
真机隐私授权
iPhone 真机测试
Android 真机测试
版本上传
提交审核
正式发布
```

依赖这些条件的能力继续标记：

```text
【B：代码通过，待人工平台验收】
```

新增人工事项只追加到：

```text
Wanlu_Toolbox_Manual_Release_Checklist.md
```

不得为了通过模拟器或自动测试而加入绕过微信正式隐私机制的临时代码。

---

# 10. Stage 4 完成停止规则

Stage 4 代码侧全部完成并满足：

```text
Stage 3 回归 PASS
Stage 4 自动测试 PASS
ERROR = 0
WARNING = 0
```

后立即停止。

不得自动进入：

```text
Stage 5
```

必须等待用户明确确认。
