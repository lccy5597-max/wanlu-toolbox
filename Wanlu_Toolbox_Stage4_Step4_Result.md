# Stage 4 Step 4 执行结果

> 阶段：Stage 4 Step 4【第一批工具自动化测试】
>
> 范围：仅 `converter`、`date-diff`、`bmi`、`mortgage`、`salary`。
>
> 本步骤未处理 `qrcode`、`relationship`、`restaurant`、其他工具、搜索或发现页；未进入 Step 5。

---

## 1. 测试文件结构

本步骤新增正式测试文件：

```text
scripts/test-stage4-tools.js
```

`package.json` 新增正式测试命令：

```text
npm run test:stage4
→ node scripts/test-stage4-tools.js
```

原 Step 3 smoke test 继续保留：

```text
scripts/test-stage4-tools-smoke.js
npm run test:stage4:smoke
```

正式 Step 4 测试直接调用生产代码中的：

```text
utils/tool-logic/converter.js
utils/tool-logic/date-diff.js
utils/tool-logic/bmi.js
utils/tool-logic/mortgage.js
utils/tool-logic/salary.js
```

测试文件没有复制生产业务公式。

本次正式测试共执行：

```text
140 cases
```

全部通过。

---

## 2. converter 测试结果

覆盖：

- 正常整数换算；
- 正常小数换算；
- 同单位换算；
- 不同单位换算；
- 正数；
- 0；
- 极小有限小数；
- 很大的有限值；
- 摄氏 / 华氏 / 开尔文转换；
- 负温度有限值；
- 空值 / 空白字符串；
- `null` 空输入；
- 非数字字符串；
- `NaN`；
- `Infinity`；
- `-Infinity`；
- 无效分类；
- 无效源单位；
- 无效目标单位；
- 结果溢出保护；
- 显示精度；
- 连续 3 次重复执行；
- 输入对象 Mutation 检查。

关键结果：

```text
NaN       → ok = false
Infinity  → ok = false
-Infinity → ok = false
```

非有限值不会生成成功结果，也不会以 `--` 冒充成功结果。

精度规则按当前生产逻辑验证：

```text
绝对值 < 1e-10 → 显示 0
绝对值 < 1000  → 最多 6 位小数
绝对值 >= 1000 → 最多 2 位小数
```

例如：

```text
1 / 3 → 0.333333
1234.567 → 1234.57
```

结果：**PASS**。

---

## 3. date-diff 测试结果

覆盖：

- 同一天；
- 相邻两天；
- 同月；
- 跨月；
- 跨年；
- 闰年 `2024-02-29`；
- 非闰年不存在的 `02-29`；
- 月末；
- `12-31 → 01-01`；
- `02-28 → 02-29`；
- 开始日期大于结束日期；
- 空开始日期；
- 空结束日期；
- 非法格式；
- 不存在日期；
- 非法类型；
- 负 offset；
- 小数 offset；
- 超过 36500 天；
- 非法方向；
- `NaN / Infinity / -Infinity` offset；
- 连续 3 次重复执行；
- 输入对象 Mutation 检查。

当前正式规则保持：

```text
start > end
→ 允许计算
→ days 为绝对天数
→ signedDays 保留负值
→ direction = reverse
```

日期核心逻辑使用 UTC civil-day number 做自然日差值，不使用 `new Date('YYYY-MM-DD')` 的隐式时区解析，因此 DST / 本地时区不会把两个相邻自然日误算成非 1 天。

页面“今天”的初始字符串仍由本地日期生成，日期业务计算则按纯 civil date 处理。

结果：**PASS**。

---

## 4. bmi 测试结果

覆盖：

- 正常身高 / 体重；
- 小数输入；
- 18.5 分类边界；
- 24 分类边界；
- 28 分类边界；
- 当前允许的最低身高 / 体重组合；
- 当前允许的最高身高 / 体重组合；
- 身高 0；
- 体重 0；
- 负身高；
- 负体重；
- 空值；
- 非数字；
- `NaN`；
- `Infinity`；
- 输出类别合法性；
- 连续 3 次重复执行；
- 输入对象 Mutation 检查。

当前分类标准保持项目既有规则：

```text
< 18.5       → underweight
18.5 ~ < 24  → normal
24 ~ < 28    → overweight
>= 28        → obese
```

未擅自切换 BMI 标准。

成功结果中的 BMI、理想体重范围和 marker 均验证为有限数值。

当前纯逻辑舍入：

```text
BMI → 1 位小数
理想体重上下限 → 1 位小数
marker → 整数百分比
```

结果：**PASS**。

---

## 5. mortgage 测试结果

覆盖：

- 等额本息；
- 等额本金；
- 组合贷；
- 常规金额 / 利率 / 期限；
- 利率 = 0；
- 最短 1 年；
- 当前规则最大 40 年；
- 小数利率；
- 较大有限金额；
- 金额 = 0；
- 负金额；
- 负利率；
- 期限 0；
- 负期限；
- 非整数期限；
- `NaN` 期限；
- `Infinity` 期限；
- `NaN` 金额；
- `Infinity` 商业贷金额；
- `Infinity` 公积金金额；
- `Infinity` 利率；
- 非数字利率；
- 非法还款方式；
- 极端有限利率引发的溢出防护；
- policy 年限参数注入；
- 默认 policy 读取；
- schedule 数量；
- 总还款与本金 + 总利息一致性；
- 金额显示的 2 位小数投影稳定性；
- 连续 3 次重复执行；
- 输入对象 Mutation；
- policy-config Mutation。
- 等额本息已知值回归；
- 等额本金已知值回归；

验证结果：

```text
月供 → finite
总利息 → finite
总还款 → finite
schedule 各项 → finite
```

等额本金 schedule 长度与月份一致，等额本息输出重复执行稳定。

当前内部计算保留 JavaScript Number 的完整计算精度，不在中途人为逐月四舍五入；页面展示层按现有 `formatMoney()` 在最终展示时保留 2 位小数（金额 >= 10000 时转换为“万”后保留 2 位）。正式测试验证核心金额可稳定投影为 2 位小数显示。

结果：**PASS**。

---

## 6. salary 测试结果

覆盖：

- 常规工资；
- 小数工资；
- 当前起征点；
- 第一税档上边界；
- 第一税档切换点；
- 所有已配置有限税档上边界；
- 每个有限税档边界的 `-0.01 / 边界 / +0.01`；
- 较大有限收入；
- 专项附加扣除大于收入；
- 工资 0；
- 负工资；
- 非数字工资；
- `NaN` 工资；
- `Infinity` 工资；
- 负社保比例；
- `Infinity` 社保比例；
- 社保单项 >100%；
- 社保合计 >100%；
- 负公积金比例；
- `NaN` / `Infinity` / 非数字公积金比例；
- 五险 + 公积金合计 >100%；
- 负专项扣除；
- `NaN` / `Infinity` / 非数字专项扣除；
- 自定义 threshold 参数注入；
- 默认 policy 读取；
- 金额 2 位小数显示投影；
- 连续 3 次重复执行；
- 输入对象 Mutation；
- policy-config Mutation。

“专项附加扣除大于收入”继续保持当前既有语义：

```text
应纳税所得额最低 clamp 到 0
税额最低为 0
专项附加扣除是税务扣除，不作为实际现金缴费从到手工资再次扣除
```

金额内部计算保留完整 Number 精度，页面层现有 `formatMoney()` 最终 `toFixed(2)`；正式测试验证主要金额输出均可稳定映射为两位小数显示。

结果：**PASS**。

---

## 7. 测试中发现的问题

本轮正式测试发现 1 个新的真实输入边界问题：

```text
converter：null 输入会被 Number(null) 转成 0，错误视为合法输入。
```

首次加入该测试后，`npm run test:stage4` 按预期失败，证明问题真实存在；随后仅对 converter 纯逻辑做最小修复。

```text
新增真实代码问题：1
```

Step 3 已完成的 converter 非有限值 P1 修复也在正式测试中得到持续回归确认。

Stage 2 审计中尚未处理的 `qrcode / relationship / restaurant` 等问题不属于本步骤范围，本步骤没有提前处理。

---

## 8. 实际修复的问题

本 Step 4 实际进行 1 个最小生产逻辑修复：

```text
utils/tool-logic/converter.js
```

修复内容：

```text
null / undefined
或空白字符串
→ EMPTY_INPUT
→ ok = false
```

原失败测试修复后已 PASS。

```text
实际新增生产修复：1
```

没有修改 converter UI，也没有修改其他 4 个生产页面、Stage 3 数据层、搜索或发现页。

---

## 9. 精度/舍入结果

### converter

```text
内部：Number 原始结果
展示：formatNumber
< 1e-10 → 0
< 1000 → 最多6位小数
>=1000 → 最多2位小数
```

### bmi

```text
BMI → 1位小数
理想体重范围 → 1位小数
marker → 整数百分比
```

### mortgage

```text
核心公式：保持 Number 计算精度
中间 schedule：不逐月强制 toFixed
最终页面金额展示：2位小数
```

### salary

```text
核心税费过程：保持 Number 计算精度
最终页面金额展示：2位小数
到手比例：Math.round 后整数百分比
```

测试未发现会把 `0.30000000000000004` 一类原始浮点尾差直接作为正式金额显示给用户的路径。

---

## 10. 重复执行结果

5 个工具均执行了相同输入连续至少 3 次的确定性测试。

结果：

```text
converter → PASS
date-diff → PASS
bmi → PASS
mortgage → PASS
salary → PASS
```

同样输入结果完全一致，没有发现依赖上一次运行状态的纯逻辑行为。

---

## 11. 输入对象是否存在 Mutation

对 5 个工具均在调用前后比较输入对象序列化结果。

结果：

```text
converter → 无 Mutation
date-diff → 无 Mutation
bmi → 无 Mutation
mortgage → 无 Mutation
salary → 无 Mutation
```

同时额外验证：

```text
mortgagePolicy → 未被计算函数修改
incomeTax      → 未被计算函数修改
```

结论：**未发现输入或政策配置 Mutation。**

---

## 12. 政策参数引用结果

政策统一来源继续为：

```text
utils/policy-config.js
```

元数据继续为：

```text
POLICY_META.version
POLICY_META.updatedAt
```

### mortgage

使用：

```text
policy-config.mortgage
```

测试确认：

- 默认规则可被 `calculateMortgage()` 直接使用；
- `minYears / maxYears` 确实参与边界校验；
- 页面 / tool-logic 没有新增第二套政策配置。

### salary

使用：

```text
policy-config.incomeTax
```

测试确认：

- `threshold` 被真实用于应税所得计算；
- `brackets` 被真实用于税额计算；
- 默认规则可被 `calculateSalary()` 直接使用；
- 页面 / tool-logic 没有新增第二套税率表。

---

## 13. 政策新鲜度状态

Stage 4 Step 4 只验证项目当前代码的逻辑和参数引用，不联网核验政策。

因此状态继续明确为：

```text
mortgage 政策新鲜度：待专项核验
salary 政策新鲜度：待专项核验
```

不得表述为“政策已确认最新”。

---

## 14. npm run test:stage4

执行：

```text
npm run test:stage4
```

结果：

```text
Stage 4 tools tests: PASS (140 cases)
```

状态：**PASS**。

---

## 15. npm run test:stage3

执行：

```text
npm run test:stage3
```

结果：

```text
Stage 3 data-layer tests: PASS
```

状态：**PASS**。

---

## 16. npm run check

执行：

```text
npm run check
```

结果：

```text
ERROR = 0
WARNING = 0
```

状态：**PASS**。

---

## 17. ERROR / WARNING

```text
ERROR   = 0
WARNING = 0
```

---

## 18. 是否具备进入 Step 5 条件

从 Step 4 自动化质量门槛看：

```text
5 个首批工具正式测试 → PASS
Stage 3 回归 → PASS
静态检查 → PASS
ERROR → 0
WARNING → 0
```

因此：

```text
具备进入 Stage 4 Step 5 的技术条件
```

但当前严格停在 Step 4 完成状态。

**未自动进入 Step 5，等待用户确认。**
