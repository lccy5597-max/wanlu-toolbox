# Stage 4 Step 7 执行结果

> 项目：挽鹿工具箱 / Wanlu Toolbox
>
> 阶段：Stage 4 Step 7
>
> 目标：建立统一、确定性、完全本地、可 Node 自动测试的工具文本搜索模块。本步骤不修改首页 / 工具页搜索调用，不创建 Discovery Service，不进入 Step 8。

---

## 1. 新增文件

```text
utils/tool-search.js
scripts/test-stage4-search.js
Wanlu_Toolbox_Stage4_Step7_Result.md
```

同时修改：

```text
package.json
utils/tool-catalog.js
```

没有修改任何页面 JS / WXML / WXSS。

---

## 2. tool-search API

正式模块：

```text
utils/tool-search.js
```

主要 API：

```js
normalizeSearchText(value)
scoreToolMatch(tool, query)
searchTools(tools, query)
isSearchableTool(tool)
```

同时导出稳定评分常量、分类别名和正式禁用 ID 集合，供自动测试和后续 Step 8 接入使用。

搜索模块只接收普通工具数组和查询文本，返回原工具对象组成的新数组；不会向工具对象写入 `_score`、`matchScore` 等临时属性。

---

## 3. 文本标准化规则

`normalizeSearchText()` 当前规则：

1. `null / undefined → ''`
2. 转成字符串
3. `trim()` 去除前后空白
4. 连续空白统一为单个空格
5. 英文统一 `lowercase`
6. 中文保持原文本
7. 数字和中英文混合文本可正常参与匹配

搜索文本不写 Storage、不上传、不缓存、不形成用户画像。

---

## 4. 搜索评分规则

正式评分优先级固定为：

```text
工具名称完全匹配    600
>
工具名称前缀匹配    500
>
工具名称包含        400
>
keywords 匹配       300
>
描述匹配            200
>
分类匹配            100
```

名称同时兼容 `name / title`，描述兼容 `description / desc`；当前真实 catalog 主要使用 `name / description / keywords / category`。

同一工具多个低级字段匹配不会通过重复出现关键词无限叠加分数，因此不存在描述文本重复刷高排名的问题。

---

## 5. 排序规则

非空查询：

```text
score 降序
↓
同分按调用方传入 catalog 原始顺序
```

空查询：

```text
保持调用方正式 catalog 原始稳定顺序
```

不使用 `Math.random()`，不读取 Usage / Favorites / History，不根据用户行为改变文本搜索排名。

连续执行相同查询 3 次，结果顺序一致。

---

## 6. 去重规则

按正式唯一标识：

```text
id
```

进行去重。

若调用方数据异常地出现相同 id 多次：

- 非空查询优先保留匹配分更高的候选；
- 同分保留更早的原始项；
- 最终一个 id 只出现一次。

没有使用名称作为长期唯一键。

---

## 7. disabled 过滤

搜索层同时支持当前正式字段及兼容字段：

```text
enabled === false
或
disabled === true
```

均直接排除。

即使工具名称完全匹配，也不得进入结果。

同时要求工具至少具有合法非空：

```text
id
name / title
path
```

并要求正式工具路径位于：

```text
/packageTools/pages/
```

---

## 8. wooden-fish / zodiac 防恢复结果

搜索层增加明确防恢复保护：

```text
wooden-fish
zodiac
```

即使未来被误传入调用方工具数组，也会被 `isSearchableTool()` 过滤。

真实 `utils/tool-catalog.js` 回归测试同时确认：

```text
wooden-fish 不在 24 个正式工具 id 中
zodiac 不在 24 个正式工具 id 中
```

搜索模块不会扫描 `packageTools` 目录自动发现页面，因此不会因为项目目录残留而把非正式工具重新加入搜索结果。

---

## 9. 空搜索语义

Step 7 正式统一为：

```text
query = '' / null / undefined / 纯空格
→ 返回全部合法、启用、非禁用正式工具
→ 保持传入 catalog 原始稳定顺序
```

该语义保持当前工具页“空搜索展示全部工具”的既有产品方向，供 Step 8 首页 / 工具页正式接入时统一复用。

---

## 10. 中文搜索结果

真实 catalog 已回归以下典型词：

```text
压缩
图片
尺寸
二维码
工资
退休
养老金
日期
餐饮
价格
复利
计算
其他
```

关键结果包括：

- `压缩`：`image-compress` 排在前面；
- `尺寸`：`image-resize` 优先；
- `二维码`：`qrcode` 优先；
- `工资`：`salary` 优先；
- `退休`：可找到 `retirement-age` 与 `retirement-pension`；
- `养老金`：`retirement-pension` 优先；
- `日期`：`date-diff` 优先；
- `餐饮`：可找到 `restaurant`；
- `价格`：可找到 `price-compare`；
- `复利`：可找到 `compound`。

分类别名：

```text
图片 → image
计算 → calc
其他 → other
```

只作为轻量搜索别名，不改变 Stage 3 category 语义，也没有建立第二套分类系统。

---

## 11. 英文 / 大小写结果

自动测试确认：

```text
bmi
BMI
Bmi
```

结果一致，且 `bmi` 工具优先。

```text
bmr
BMR
```

结果一致，且 `bmr` 工具优先。

中英文混合：

```text
BMI 计算
```

可稳定匹配 `BMI 计算` 正式工具。

---

## 12. Input Mutation

自动测试确认：

- `searchTools()` 不修改传入数组顺序；
- 不对工具对象写入临时评分字段；
- `scoreToolMatch()` 不修改输入工具对象；
- 排序发生在内部候选数组上；
- 返回值由原工具对象引用组成，但搜索模块本身不改写这些对象。

当前未发现 Input Mutation。

---

## 13. 稳定排序

已验证：

- 同一查询连续执行至少 3 次结果完全一致；
- 相同评分按原 catalog 顺序稳定排序；
- 不依赖随机数；
- 不依赖用户本地行为；
- 不依赖对象临时字段；
- 不依赖网络。

---

## 14. 真实 catalog 回归

真实：

```text
utils/tool-catalog.js
```

当前正式工具仍为：

```text
24
```

搜索前后数量不变。

空搜索结果 id 顺序与正式 catalog 完全一致。

搜索结果 path 均来自调用方传入的正式 catalog，没有搜索模块自行拼接不存在的工具结果，也没有扫描文件目录发现额外页面。

---

## 15. 是否修改 tool-catalog

**是，进行了 1 项最小元数据补充。**

`price-compare` 原有关键词：

```text
比价 / 单价 / 哪个便宜 / 购物 / 克价 / 毫升价
```

补充：

```text
价格
```

原因：`价格` 是“比价计算器”的直接自然搜索词，属于明确 catalog 元数据质量补充。

未修改：

```text
toolId / id
path
category
sort
正式工具数量
```

没有为了测试堆叠无意义关键词。

---

## 16. 搜索测试 Case 数

```text
53 cases
```

覆盖：

- 标准化
- 名称完全 / 前缀 / 包含
- keywords
- description
- category
- 优先级
- 空 query
- null / undefined / 空格
- 无结果
- 中文
- 英文大小写
- 中英文混合
- disabled
- 去重
- stable sort
- Input Mutation
- wooden-fish / zodiac 防恢复
- 正式 catalog 数量 / 顺序 / path 回归
- 搜索模块无 UI / Storage / 网络 / 隐私 API 静态依赖

---

## 17. Stage 4 总 Case 数

Step 6 工具测试：

```text
452 cases
```

Step 7 搜索测试：

```text
53 cases
```

当前 Stage 4 自动测试总计：

```text
505 cases
```

---

## 18. npm run test:stage4

`package.json` 已整合：

```text
node scripts/test-stage4-tools.js && node scripts/test-stage4-search.js
```

实际执行结果：

```text
Stage 4 tools tests: PASS (452 cases)
Stage 4 search tests: PASS (53 cases)
```

结论：

```text
Stage 4 tools/search tests: PASS
```

---

## 19. npm run test:stage3

实际执行：

```text
Stage 3 data-layer tests: PASS
```

Stage 3 冻结数据结构未修改。

---

## 20. npm run check

实际执行：

```text
PASS
```

---

## 21. ERROR / WARNING

```text
ERROR = 0
WARNING = 0
```

`utils/tool-search.js` 自动测试同时确认未出现：

```text
wx.
setData
Page
Component
Storage 读写
fetch / request / http
camera
location
microphone
```

搜索模块不保存搜索文本，也不读取 Usage / Favorites / History。

---

## 22. 是否具备进入 Step 8 条件

**是。**

当前技术条件：

```text
Stage 4 tools tests: PASS (452 cases)
Stage 4 search tests: PASS (53 cases)
Stage 4 total: 505 cases
Stage 3 data-layer tests: PASS
npm run check: PASS
ERROR = 0
WARNING = 0
```

但本步骤只确认 Step 7 完成。

**当前未修改首页 / 工具页搜索调用，未创建 Discovery Service，未进入 Stage 4 Step 8，也未进入 Stage 5。**

等待用户明确确认后再继续。
