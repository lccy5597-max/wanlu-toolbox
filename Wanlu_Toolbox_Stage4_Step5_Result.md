# Stage 4 Step 5 执行结果

> 阶段：Stage 4 Step 5【批量覆盖剩余计算 / 逻辑工具】
>
> 本步骤严格限定：`price-compare`、`compound`、`retirement-pension`、`retirement-age`、`shelf-life`、`relationship`、`bmr`、`restaurant`。
>
> 未处理图片/视频工具、`qrcode`、`ruler`、`choice-helper`、`guide`、搜索或发现页；未进入 Step 6 / Step 7 / Stage 5。

---

## 1. 新增/修改文件

### 新增纯逻辑模块

```text
utils/tool-logic/price-compare.js
utils/tool-logic/compound.js
utils/tool-logic/retirement-pension.js
utils/tool-logic/retirement-age.js
utils/tool-logic/shelf-life.js
utils/tool-logic/relationship.js
utils/tool-logic/bmr.js
utils/tool-logic/restaurant.js
```

8 个模块均通过纯逻辑扫描，不包含：

```text
Page
setData
wx.*
recordToolUse
Storage
Canvas
网络请求
```

### 修改生产页面

```text
packageTools/pages/price-compare/price-compare.js
packageTools/pages/compound/compound.js
packageTools/pages/retirement-pension/retirement-pension.js
packageTools/pages/retirement-age/retirement-age.js
packageTools/pages/shelf-life/shelf-life.js
packageTools/pages/relationship/relationship.js
packageTools/pages/bmr/bmr.js
packageTools/pages/restaurant/restaurant.js
```

生产页面已改为调用对应 `utils/tool-logic/*`，没有保留第二套核心业务公式。

### 扩展正式测试

```text
scripts/test-stage4-tools.js
```

`npm run test:stage4` 现覆盖 13 个正式计算 / 逻辑工具。

---

## 2. price-compare

已抽离：

- 比较类型与单位换算配置；
- 商品输入规范化；
- 单位价格计算；
- 排序；
- 并列最低判断；
- 差价 / 百分比；
- 非有限值保护。

生产页继续维持实时比较交互，不新增 UI。

测试覆盖：正常价格、不同单位、小数、同价、价格 0、极小数量、大有限值、负数、空值、非数字、`NaN`、`Infinity`、无效模式、重复执行、Input Mutation。

结果：**PASS**。

---

## 3. compound

已抽离：

- 年化收益率转等效月收益率；
- 月复利增长；
- 初始本金终值；
- 月末定投终值；
- 累计投入；
- 累计收益；
- 收益率；
- 输入范围与溢出保护。

保持当前产品“月复利 + 月末定投”定义，没有新增复利频率 UI。

测试覆盖本金、定投、0 利率、0 本金、0 定投、年限上下界、负数、非法利率、`NaN`、`Infinity`、大金额、重复执行、Mutation。

结果：**PASS**。

---

## 4. retirement-pension

纯计算已从页面抽离，并继续只复用：

```text
utils/policy-config.js
→ pension
→ POLICY_META.version
→ POLICY_META.updatedAt
```

未创建第二套政策配置。

测试覆盖：

- 正常估算；
- 已缴年限；
- 账户余额；
- 缴费基数；
- 缴费档位；
- 计发月数；
- 当前年龄 / 退休年龄；
- 0 和边界；
- 负数；
- 非有限数；
- policy 参数注入；
- 重复执行；
- Input / policy Mutation。

所有成功金额输出均为有限值。

**政策新鲜度：待后续专项核验。**

本阶段未联网查询或修改政策参数。

---

## 5. retirement-age

已抽离：

- civil date 解析；
- 月份顺延；
- 原退休年月；
- 延迟月数；
- 最终退休年月；
- 弹性延迟参考；
- 人员类型规则读取。

政策来源继续为：

```text
utils/policy-config.js
→ retirementAge
→ POLICY_META.version
→ POLICY_META.updatedAt
```

覆盖全部现有正式人员类型：

```text
male
female55
female50
```

测试覆盖正常日期、政策起始边界、闰年、2 月 29 日、非法日期、非法人员类型、极端合法年份、最大延迟边界、重复执行、Mutation。

**政策新鲜度：待后续专项核验。**

---

## 6. shelf-life

已抽离基于自然日期的保质期计算。

当前既有定义保持：

```text
生产日期当天计入保质期
天：生产日 + 天数 - 1
月：按自然月顺延后 - 1 天
年：按自然年顺延后 - 1 天
```

日期运算使用 civil-date / UTC day number 思路，避免本地时区 / DST 造成跨日误差。

测试覆盖：月末、跨年、闰年、2 月 29 日、状态边界、空日期、非法日期、0、负数、小数、`NaN`、`Infinity`、超大保质期、重复执行、Mutation。

结果：**PASS**。

---

## 7. relationship

优先复用了原关系映射表和关系解析数据，没有重新实现第二套关系算法。

新增纯逻辑职责：

```text
normalizeInput
getDraftMeta
parseRelation
resolveRelationship
shouldRecordRelationshipUsage
```

### Step 2 P1 修复

原问题：

```text
silent 自动中间计算
→ 也 recordToolUse()
→ 一次关系构建可能累计多次 Usage
```

当前页面语义：

```text
构建器 onAppendToken
→ onCalculate(true) 只负责 silent 结果计算，本身不写 Usage
→ 随后由页面层把这次真实用户追加动作交给单次 Usage 门控
→ 当前连续构建第一次成功时最多计 1 次
→ 后续继续追加的中间成功结果不重复计数

删除一步内部重算
→ silent
→ 不计新的 Usage

示例查询
→ 作为一次新的用户查询重新开始计数窗口
→ 成功后最多计一次 Usage
```

`shouldRecordRelationshipUsage()` 同时锁定：

- silent / 非用户完成操作不得记录；
- 失败不得记录；
- 同一次已记录 build 不得重复记录。

结果：**P1 已修复并有回归测试。**

---

## 8. bmr

已抽离 Mifflin-St Jeor 核心计算、活动系数、TDEE 与热量参考。

没有改变项目原有计算公式。

### Step 2 P2 同步修复

原审计问题：JS 允许 10 岁起，但 UI 明确写“结果适合成年人”。

当前统一为：

```text
年龄 18 ~ 100
```

使代码输入边界与正式 UI 文案一致。

测试覆盖男 / 女、全部活动类型、小数输入、成年年龄边界、身高/体重边界、0、负数、非数字、`NaN`、`Infinity`、非法类型、重复执行、Mutation。

结果：**PASS**。

---

## 9. restaurant

Step 2 审计中的具体 P1 为：

```text
核心经营金额 / 比例缺少统一合法区间；
毛利率可超过 100%；
负数 / 非有限成本缺少统一校验；
异常输入仍可能生成经营结论并记录 Usage。
```

已抽离三个正式模块：

```text
calculateCost()
calculateBreakEven()
calculateAnalysis()
```

并统一加入：

- 非负有限金额校验；
- 毛利率 0~100%；
- 销售占比 0~100%；
- 销售占比合计 100%；
- 固定成本 > 0；
- 月营业额 > 0；
- 除零保护；
- 非有限结果保护；
- policy 参数校验。

生产页只在 `result.ok === true` 后渲染结果并 `recordToolUse()`。

P1 回归用例明确锁定：

```text
offlineGrossMarginRate = 150
→ ok = false
→ 不生成经营结果
```

`businessPolicy` 继续来自 `utils/policy-config.js`，其性质为项目已有“经营经验参数”，不是官方政策。

结果：**P1 已修复并有回归测试。**

---

## 10. 新增测试数量

Step 4 基线：

```text
140 cases
```

Step 5 完成后：

```text
298 cases
```

因此本步骤新增有效自动测试：

```text
158 cases
```

测试数量不是验收目标；新增用例主要覆盖正常、边界、非法、非有限数、重复执行、Mutation、政策参数和已知 P1 回归。

---

## 11. Step 2 P1 修复情况

### relationship

```text
状态：已修复
```

silent / 中间计算不再增加 Usage，同一显式完成查询受单次记录保护。

### restaurant

```text
状态：已修复
```

>100% 毛利率、负数、非有限金额等异常输入不能形成成功经营结果，也不会进入 Usage 成功路径。

本步骤没有处理 `qrcode` P1，因为它属于后续图片 / Canvas 范围。

---

## 12. 新发现问题

本步骤自动测试没有发现新的生产核心逻辑故障。

```text
新增真实问题：0
```

另外修复了 Step 2 已记录的 BMR 成人适用范围 P2。

测试开发过程中曾发现一条关系称谓测试预期写错（父亲的姐姐的儿子应为表亲称呼，不是堂亲称呼）；这是测试预期问题，未修改生产关系映射去迎合错误测试。

---

## 13. recordToolUse 核对结果

8 个工具逐项检查：

| 工具 | Usage 成功点 |
|---|---|
| price-compare | 至少 2 个有效商品首次形成真实比较结果后 |
| compound | `calculateCompound().ok === true` 后 |
| retirement-pension | 养老金纯逻辑成功后 |
| retirement-age | 退休年龄纯逻辑成功后 |
| shelf-life | 保质期纯逻辑成功后 |
| relationship | silent 中间计算不记；显式完成查询受单次保护 |
| bmr | `calculateBmr().ok === true` 后 |
| restaurant | 对应模块纯逻辑成功后 |

结论：当前未发现失败、`NaN/Infinity` 或 silent 中间计算进入 Usage 成功路径。

---

## 14. NaN / Infinity

13 个已覆盖工具的正式测试全部通过。

本 Step 新增 8 个工具均加入非有限数测试。

```text
成功结果 NaN 泄漏：未发现
成功结果 Infinity 泄漏：未发现
成功结果 -Infinity 泄漏：未发现
```

---

## 15. Input Mutation

8 个新覆盖工具均进行适用的输入稳定性 / Mutation 检查。

同时验证：

```text
pensionPolicy
retirementAgePolicy
businessPolicy
```

不会被计算函数修改。

结论：**未发现 Input Mutation 或 policy-config Mutation。**

---

## 16. 精度 / 舍入

### price-compare

核心保留有限 Number 结果；页面沿用现有单价格式化精度。

### compound

核心保留 Number 计算精度；页面最终金额按现有格式化显示两位小数。

### retirement-pension

核心保留计算值；页面养老金金额沿用当前整数元显示规则，年限沿用 1 位小数显示规则。

### restaurant

核心保持有限 Number；页面继续按现有元 / 万 / 百分比格式化显示。

未发现浮点非有限值直接进入成功 UI 的路径。

---

## 17. 政策参数来源

统一来源继续为：

```text
utils/policy-config.js
```

相关结构：

```text
POLICY_META.version
POLICY_META.updatedAt
pension
retirementAge
business
```

未创建第二套 `RULE_VERSION / UPDATED_AT`。

---

## 18. 政策新鲜度

```text
retirement-pension：待后续专项核验
retirement-age：待后续专项核验
```

本步骤没有联网查询政策，没有改写政策参数，也没有声称当前政策已确认最新。

---

## 19. npm run test:stage4

最终执行：

```text
Stage 4 tools tests: PASS (298 cases)
```

状态：**PASS**。

---

## 20. npm run test:stage3

最终执行：

```text
Stage 3 data-layer tests: PASS
```

状态：**PASS**。

---

## 21. npm run check

最终执行结果：

```text
ERROR = 0
WARNING = 0
```

状态：**PASS**。

---

## 22. ERROR / WARNING

```text
ERROR   = 0
WARNING = 0
```

---

## 23. 是否具备 Step 6 条件

当前技术门槛：

```text
13 个正式计算 / 逻辑工具自动测试 → PASS
Stage 4 tests → PASS (298 cases)
Stage 3 data-layer tests → PASS
静态检查 → PASS
ERROR → 0
WARNING → 0
```

因此：

```text
具备进入 Stage 4 Step 6 的技术条件
```

但当前严格停止在 Stage 4 Step 5 完成状态。

**未进入 Step 6，未进入 Step 7，未进入 Stage 5，等待用户确认。**
