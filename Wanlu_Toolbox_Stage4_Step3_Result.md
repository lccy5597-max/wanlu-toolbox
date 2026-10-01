# Stage 4 Step 3 执行结果

> 步骤：Stage 4 Step 3【建立核心工具逻辑测试基础】
>
> 范围：仅 `converter / date-diff / bmi / mortgage / salary`
>
> 原则：纯核心逻辑可被 Node 直接加载；生产页面与自动测试共用同一份核心算法；不进入 Step 4。

---

## 1. 修改文件

本步骤仅修改以下现有文件：

```text
packageTools/pages/converter/converter.js
packageTools/pages/date-diff/date-diff.js
packageTools/pages/bmi/bmi.js
packageTools/pages/mortgage/mortgage.js
packageTools/pages/salary/salary.js
package.json
```

未修改：

```text
Stage 3 Storage / Migration / Favorites / History / Usage / Tool State
behaviors/tool-page.js
搜索
发现页
首页布局
工具页 WXML / WXSS
qrcode
relationship
restaurant
其他正式工具
```

---

## 2. 新增文件

```text
utils/tool-logic/converter.js
utils/tool-logic/date-diff.js
utils/tool-logic/bmi.js
utils/tool-logic/mortgage.js
utils/tool-logic/salary.js
scripts/test-stage4-tools-smoke.js
Wanlu_Toolbox_Stage4_Step3_Result.md
```

`package.json` 新增最小测试命令：

```text
npm run test:stage4:smoke
```

当前没有建立 Step 4 全量边界测试，也没有把 smoke test 冒充为完整 `test:stage4`。

---

## 3. converter 抽离结果

已将以下内容从页面核心计算中抽离到：

```text
utils/tool-logic/converter.js
```

统一维护：

- 长度 / 面积 / 重量 / 体积 / 温度单位定义；
- 普通单位换算公式；
- 温度换算公式；
- 有限数输入验证；
- 有限数输出验证；
- 数值格式化。

纯逻辑入口：

```js
convertValue({
  category,
  value,
  fromUnitIndex,
  toUnitIndex,
})
```

返回统一为：

```js
{ ok: true, data: { ... } }
```

或：

```js
{ ok: false, errorCode, errorMessage }
```

### converter P1 最小修复

Step 2 的明确 P1：

```text
Infinity → formatNumber('--') → 仍 recordToolUse()
```

本步骤已随纯逻辑抽离做最小修复：

1. `Infinity / -Infinity / NaN / 非数字` 不再属于成功结果；
2. 任何非有限计算结果返回 `ok=false`；
3. 页面只有 `result.ok === true` 才写入有效结果；
4. 页面只有真正成功后才允许 `recordToolUse()`。

页面不再把 `--` 当作业务成功结果。

---

## 4. date-diff 抽离结果

已抽离到：

```text
utils/tool-logic/date-diff.js
```

核心能力：

- 严格解析 `YYYY-MM-DD`；
- 日期合法性验证；
- 两日期有符号差值；
- 绝对天数；
- 含首尾天数；
- 周数与余天；
- 周一至周五数量；
- 基准日期前 / 后 N 天；
- 最大跨度 36500 天。

### 时区规则

当前页面“今天”仍使用用户设备本地日期：

```text
Date → formatLocalDate()
```

但两个业务日期之间的差值与日期偏移采用“公历日期字符串 → UTC civil date/day number”的方式计算，不依赖本地 DST 小时差，因此避免用两个本地午夜时间戳直接相减导致跨 DST 日期误差。

反向日期继续允许：

```text
startDate > endDate
```

结果通过 `direction = reverse` 明确表达。

---

## 5. bmi 抽离结果

已抽离到：

```text
utils/tool-logic/bmi.js
```

核心逻辑只返回结构化数据：

- BMI 数值；
- `category`；
- 健康体重参考上下限；
- marker 百分比。

分类继续严格保持项目原规则：

```text
< 18.5     → underweight
< 24       → normal
< 28       → overweight
>= 28      → obese
```

输入边界继续保持：

```text
身高：80 ~ 250 cm
体重：20 ~ 300 kg
```

页面层只负责把 `category` 映射为现有中文标题、说明和 tone，不再保存 BMI 公式或分类阈值。

Step 2 已记录的 BMI 适用人群 P2 本步骤没有扩展处理，留待后续对应步骤。

---

## 6. mortgage 抽离结果

已抽离到：

```text
utils/tool-logic/mortgage.js
```

已统一抽离：

- 等额本息；
- 等额本金；
- 0 利率路径；
- 组合贷分项计算；
- 月度 schedule；
- 汇总首月 / 月供、总利息、总还款、月递减；
- 房屋总价 / 首付比例 / 贷款额之间的辅助换算；
- 有限数、非负金额、整数期限、计算溢出保护。

页面中原来的：

```text
calculateLoan
calculateEqualInterest
calculateEqualPrincipal
buildFlatSchedule
mergeLoanParts
```

已删除，避免生产页面和测试逻辑形成两套公式。

### 政策来源

继续只使用：

```text
utils/policy-config.js
→ mortgage
→ POLICY_META.version
→ POLICY_META.updatedAt
```

核心逻辑通过参数接收 `mortgagePolicy`，没有建立第二套利率、年限或政策元数据。

当前项目代码无法证明这些政策参数在实际使用时仍为最新政策，需要后续单独人工 / 专项核验。本步骤未联网查询，也未修改现有政策值。

---

## 7. salary 抽离结果

已抽离到：

```text
utils/tool-logic/salary.js
```

已统一抽离：

- 五险比例解析与合计；
- 五险金额预览；
- 公积金比例校验；
- 应纳税所得额；
- 税档匹配；
- 速算扣除；
- 个税；
- 到手工资；
- 非有限结果与明显无效百分比保护。

页面不再保留独立 `calculateTax()` 或社保合计公式。

### 政策来源

继续只使用：

```text
utils/policy-config.js
→ incomeTax
→ POLICY_META.version
→ POLICY_META.updatedAt
```

当前政策元数据：

```text
POLICY_META.version   = 2026.09
POLICY_META.updatedAt = 2026-09-28
```

没有新增 `RULE_VERSION / UPDATED_AT` 第二套来源。

当前项目代码无法证明默认税率、起征点、社保 / 公积金默认比例在实际使用时仍为最新政策，需要后续单独人工 / 专项核验。本步骤未联网查询，也未修改现有政策参数。

---

## 8. 页面与纯逻辑是否共用同一算法

**是。**

当前生产页面调用关系：

```text
converter page  → utils/tool-logic/converter.js
date-diff page  → utils/tool-logic/date-diff.js
bmi page        → utils/tool-logic/bmi.js
mortgage page   → utils/tool-logic/mortgage.js
salary page     → utils/tool-logic/salary.js
```

专项源码检查确认：

- converter 页面不再保留 `value * from.factor / to.factor` 核心换算公式；
- date-diff 页面不再保留 `MS_PER_DAY` 日期差公式；
- BMI 页面不再保留 `18.5 / 24 / 28` 分类阈值；
- mortgage 页面不再保留等额本息 / 等额本金公式；
- salary 页面不再保留 taxBrackets / 独立个税公式。

因此 Node smoke test 与生产页面使用的是同一份核心算法，而不是复制测试实现。

---

## 9. recordToolUse 是否保持正确

`recordToolUse()` 仍只存在于页面层，`utils/tool-logic/*` 中没有 Usage 写入。

首批 5 工具当前语义：

```text
converter  → convertValue.ok === true 后记录
date-diff  → calculateInterval / calculateOffset ok 后记录
bmi        → calculateBmi ok 后记录
mortgage   → calculateMortgage ok 后记录
salary     → calculateSalary ok 后记录
```

没有修改 `behaviors/tool-page.js`，没有修改 Stage 3 `aggregate-no-tombstone` Usage 模型。

---

## 10. 政策规则来源

唯一政策配置来源继续为：

```text
utils/policy-config.js
```

规则版本元数据继续为：

```text
POLICY_META.version
POLICY_META.updatedAt
```

本步骤没有：

- 建立第二套政策配置；
- 新增远程规则 API；
- 自动联网更新政策；
- 声称当前规则一定是最新政策。

---

## 11. 最小 Smoke Test 结果

新增：

```text
scripts/test-stage4-tools-smoke.js
```

覆盖范围仅限 Step 3 最小基础：

- 5 个纯逻辑模块可被 Node 正常 require；
- 每个工具至少一个正常输入可执行；
- 明显非有限输入被拒绝；
- 成功对象递归检查，不含 `NaN / Infinity / -Infinity`；
- date-diff 验证闰年 2 月跨日基础路径；
- mortgage 验证 30 年 schedule 基础路径；
- `POLICY_META.version / updatedAt` 存在。

执行结果：

```text
npm run test:stage4:smoke
→ Stage 4 Step 3 tool-logic smoke tests: PASS
```

这不是 Step 4 全量正常 / 边界 / 非法 / 重复执行测试。

---

## 12. Stage 3 回归结果

```text
npm run test:stage3
→ Stage 3 data-layer tests: PASS
```

Stage 3 数据语义未修改。

---

## 13. 静态检查结果

```text
npm run check
→ ERROR = 0
→ WARNING = 0
```

并额外检查 `utils/tool-logic/`：

```text
无 wx.*
无 Page(
无 setData
无 recordToolUse
无 Storage
```

---

## 14. 尚未处理的 P1/P2

本步骤严格没有处理：

```text
P1：qrcode
P1：relationship
P1：restaurant
```

也没有批量处理 Step 2 中其他 P2 工具。

`mortgage / salary` 在抽离过程中已经增加有限数、溢出和百分比等基础防御，使核心逻辑具备可测试的安全失败结构；但 Stage 4 Step 4 尚未执行完整边界测试，因此本文件不提前宣称所有审计 P1 已完成最终关闭。

`bmi` 的适用人群 P2 未处理。

---

## 15. Step 4 准备状态

Stage 4 Step 3 的基础已经形成：

```text
纯核心逻辑目录存在
↓
首批 5 个模块可 Node 加载
↓
生产页面调用相同逻辑
↓
最小 smoke PASS
↓
Stage 3 回归 PASS
↓
静态检查 ERROR=0 / WARNING=0
```

**状态：已具备进入 Stage 4 Step 4 的技术基础，但本步骤到此停止，不自动进入 Step 4。**
