# Stage 4 Step 9 执行结果

> 项目：挽鹿工具箱 / Wanlu Toolbox
>
> 阶段：Stage 4 Step 9
>
> 目标：建立完全本地、确定性、可解释、只读聚合的 Discovery Service，为后续发现页动态区块提供真实本地数据基础。本步骤不修改发现页，不进入 Step 10。

---

## 1. 新增/修改文件

新增：

```text
services/discovery.js
scripts/test-stage4-discovery.js
Wanlu_Toolbox_Stage4_Step9_Result.md
```

修改：

```text
package.json
```

本步骤未修改：

```text
pages/discover/*
pages/index/*
pages/tools/*
pages/mine/*
utils/tool-search.js
utils/tool-catalog.js
Stage 3 Storage / Migration / Schema
```

---

## 2. Discovery Service API

正式文件：

```text
services/discovery.js
```

生产 API：

```js
getFrequentTools(options?)
getRecentDiscoveryTools(options?)
getFavoriteDiscoveryTools(options?)
getFeaturedTools(options?)
getRecommendedTools(options?)
```

测试适配 API：

```js
createDiscoveryService({
  catalog,
  favoritesService,
  toolUsageService,
})
```

`createDiscoveryService()` 仅用于轻量依赖注入与纯 Node 自动测试；生产默认导出使用正式：

```text
utils/tool-catalog.js
services/favorites.js
services/tool-usage.js
```

没有修改 Stage 3 Service API。

---

## 3. 数据来源

Discovery 只读取以下现有真实数据：

```text
utils/tool-catalog.js
services/favorites.js
services/tool-usage.js
```

没有读取：

```text
AI
GitHub
wanluu.com
远程文章
设备指纹
敏感工具输入
搜索历史
```

正式工具合法性由 Discovery 再统一过滤：

```text
存在 id
存在 /packageTools/pages/ 正式 path
enabled !== false
disabled !== true
不是 wooden-fish
不是 zodiac
```

旧 Usage / Favorite / Recent 中即使存在无效 ID，也不能恢复正式入口。

---

## 4. 是否直接访问 Storage

**否。**

`services/discovery.js` 不引用：

```text
services/storage.js
wx.getStorage*
wx.setStorage*
STORAGE_KEYS
```

数据链路保持：

```text
Discovery
↓
Favorites / Tool Usage Service
↓
Stage 3 数据层
```

没有重新解析 `wl_*` Storage。

---

## 5. Frequent 规则

`getFrequentTools()` 基于正式 `services/tool-usage.js`：

```text
getToolUsage(toolId)
```

对当前合法 catalog 工具逐个读取现有 Usage，不直接访问存储。

过滤：

```text
useCount <= 0
不存在 catalog 的工具
disabled / enabled=false
wooden-fish / zodiac
非法 path
```

排序：

```text
1. useCount 降序
2. lastUsedAt 降序
3. catalog 原始顺序
```

因此结果稳定、确定性、无随机。

`limit` 规则：

```text
undefined / null / 未传 → 不截断
正有限数字 > 0 → floor 后截断
0 → []
负数 / NaN / Infinity / 字符串等非法值 → []
```

Service 不把具体发现页卡片数量写死。

---

## 6. Recent 规则

`getRecentDiscoveryTools()` 直接调用正式：

```text
services/tool-usage.js → getRecentTools(0)
```

没有自行使用 `useCount > 0` 重建 Recent。

因此正式复用 Stage 3：

```text
recentClearedAt
```

语义。

自动测试确认：

```text
工具 A useCount = 10
lastUsedAt = 100
recentClearedAt = 200

Recent   → 不返回 A
Frequent → 仍可返回 A
```

即：

```text
清空最近使用
≠
清空累计 Usage
```

---

## 7. Favorite 规则

`getFavoriteDiscoveryTools()` 读取正式：

```text
services/favorites.js → getFavorites()
```

Stage 3 `getFavorites()` 本身只返回：

```text
deletedAt === null
```

的 active 收藏，并按既有更新时间规则排序。

Discovery 继续做防御性合法性过滤：

```text
entityType === 'tool'
deletedAt == null
正式 catalog 存在
合法 path
非 disabled
非 wooden-fish / zodiac
```

测试确认 active favorite 可出现，设置 tombstone 后下一次调用立即消失。

---

## 8. Featured 规则

`getFeaturedTools()` 只读取：

```text
正式 tool-catalog
isHot === true
```

产品语义固定为：

```text
精选工具
```

不是：

```text
实时热门
今日热门
全网热门
```

精选顺序保持 catalog 原始稳定顺序。

该函数不读取 Usage、Favorites、Recent。

如果当前没有合法 `isHot` 工具：

```text
返回 []
```

不会制造假数据。

---

## 9. Recommendation 规则

`getRecommendedTools()` 为完全本地、确定性、即时计算规则。

允许信号仅为：

```text
Usage
Favorites
Recent
category
tool-catalog
isHot
```

### 9.1 使用最多分类

根据当前有效 Usage 按 category 聚合：

```text
1. category 累计 useCount 降序
2. category 最新 lastUsedAt 降序
3. catalog 中首次出现顺序
```

得到当前本机主使用分类。

不持久化该分类，不建立 categoryProfile。

### 9.2 推荐评分

只在本次函数调用内使用临时内部评分结构，不写回 tool 对象：

```text
存在 Usage         + 400 + min(useCount, 100)
属于主使用分类     + 200
当前 active 收藏   + 150
当前 Recent         + 100
当前精选            + 50
```

排序 tie-break：

```text
score 降序
→ useCount 降序
→ lastUsedAt 降序
→ Favorites 既有顺序
→ Recent 既有顺序
→ catalog 原始顺序
```

最终返回正式工具对象列表，不返回 `_score / recommendScore / reason` 等污染字段。

同一 id 只保留一个正式 catalog 项。

---

## 10. 默认推荐回退

如果当前没有任何有效：

```text
Usage
Favorite
Recent
```

则：

```text
getRecommendedTools()
→ getFeaturedTools()
```

即使用真实 `isHot` 配置的“精选工具”作为默认推荐。

不会生成：

```text
假使用记录
假收藏
假最近
随机“猜你喜欢”
```

---

## 11. 清空数据后的推荐恢复

Discovery 不缓存用户行为或推荐结果。

自动测试实际执行：

```text
存在 Usage + Favorite
→ 产生本地个性化推荐

清空 mock Usage / Favorite / Recent 数据
→ 再次 getRecommendedTools()
→ 立即恢复 Featured 默认推荐
```

没有：

```text
内存画像缓存
Storage 推荐缓存
隐藏 categoryProfile
session 推荐残留
```

---

## 12. recentClearedAt 结果

**PASS。**

Discovery Recent 完全复用 Stage 3 `getRecentTools()`。

测试确认：

```text
recentClearedAt > lastUsedAt
→ Recent 不出现
→ Frequent 仍保留累计 useCount
```

Discovery 没有修改：

```text
useCount
lastUsedAt
recentClearedAt
```

---

## 13. Favorite tombstone 结果

**PASS。**

测试确认：

```text
active favorite / deletedAt = null
→ Favorites Discovery 出现

tombstone / deletedAt = timestamp
→ 下一次 Favorites Discovery 不出现
```

取消收藏只取消 Favorite 信号。

如果工具仍因 Usage / Recent / Featured 等其他合法信号入选 Recommendation，仍允许按对应规则出现；没有把“取消收藏”实现为永久屏蔽。

---

## 14. disabled 过滤

**PASS。**

自动测试模拟一个同时具有：

```text
高 useCount
Recent
Favorite
isHot
```

但：

```text
enabled === false
```

的工具。

确认其不会进入：

```text
Frequent
Recent
Favorites Discovery
Featured
Recommended
```

同样测试 `disabled === true`。

---

## 15. wooden-fish / zodiac

**均不会出现。**

即使测试人为把：

```text
wooden-fish
zodiac
```

重新放入模拟 catalog，并赋予极高 Usage / Favorite / isHot 信号，Discovery 仍统一过滤。

旧用户行为数据不能成为恢复旧入口的依据。

---

## 16. 无效旧工具 ID

**已过滤。**

测试覆盖：

```text
Usage 指向 removed-tool
Favorite 指向 removed-tool
Recent 指向 removed-tool
非法正式 path
```

均不会进入 Discovery 结果。

Discovery 只以当前合法 tool-catalog 为最终工具合法性来源。

---

## 17. 去重

Discovery 以：

```text
tool.id
```

作为唯一标识。

同一工具可能同时拥有：

```text
Usage
Recent
Favorite
Featured
主分类信号
```

但 Recommendation 最终只返回一次。

没有按显示名称去重。

---

## 18. 稳定排序

自动测试确认相同输入连续执行 3 次：

```text
结果一致
顺序一致
```

Discovery 未使用：

```text
Math.random()
```

同分有明确稳定 tie-break，不依赖不可追踪对象遍历或随机行为。

---

## 19. Input Mutation

**未发现 Input Mutation。**

已测试调用前后：

```text
catalog
favorites mock
usage mock
recentClearedAt
```

保持原值。

Discovery 没有：

```text
原数组直接 sort()
tool._score = ...
tool.recommendScore = ...
tool.reason = ...
```

也没有修改 Stage 3：

```text
useCount
lastUsedAt
recentClearedAt
收藏状态
```

---

## 20. 是否新增 Storage

**否。**

未新增任何：

```text
wl_discovery_*
wl_recommend_*
wl_profile_*
wl_recent_*
```

未新增 Storage Key。

---

## 21. 是否建立用户画像

**否。**

没有：

```text
设备指纹
隐藏标签
持久化偏好分类
推荐缓存
用户画像 Storage
```

每次 Recommendation 都根据当前 Stage 3 数据即时重新计算。

---

## 22. 是否联网

**否。**

静态测试确认 `services/discovery.js` 不包含：

```text
wx.request
fetch(
http://
https://
```

也未引用：

```text
AI
GitHub
wanluu.com
packageAI
packageGithub
```

本 Step Discovery 为 100% 本地工具发现能力。

---

## 23. Discovery 测试 Case 数

```text
57 cases
```

覆盖：

- 全新用户
- Usage / 高频 Usage
- useCount / lastUsedAt / catalog tie-break
- Recent
- recentClearedAt
- 清空 Recent 不清空 Frequent
- Favorite active / tombstone
- 取消收藏后推荐信号变化
- Featured
- 默认推荐回退
- 本地个性化推荐
- 主使用分类
- 多分类 Usage
- 推荐去重
- disabled / enabled=false
- wooden-fish / zodiac
- 无效旧 ID / 非法 path
- limit 正常 / 0 / 负数 / NaN / Infinity / 字符串
- 稳定执行
- Catalog / Favorites / Usage Mutation
- 不写 Storage
- 不修改 useCount / recentClearedAt
- 清空全部行为后恢复默认推荐
- 不建立 profile / recommend Storage
- 不联网
- 正式 API 存在性

---

## 24. Stage 4 总 Case 数

现有：

```text
Tools              452 cases
Search              53 cases
Search Integration  30 cases
Discovery            57 cases
```

总计：

```text
592 cases
```

---

## 25. npm run test:stage4

实际执行：

```text
Stage 4 tools tests: PASS (452 cases)
Stage 4 search tests: PASS (53 cases)
Stage 4 search integration tests: PASS (30 cases)
Stage 4 discovery tests: PASS (57 cases)
```

结论：

```text
Stage 4 tests: PASS (592 cases total)
```

---

## 26. npm run test:stage3

实际执行：

```text
Stage 3 data-layer tests: PASS
```

Stage 3 冻结数据结构、recentClearedAt、Favorites tombstone 和 aggregate-no-tombstone Usage 语义未修改。

---

## 27. npm run check

实际执行：

```text
PASS
```

---

## 28. ERROR / WARNING

```text
ERROR = 0
WARNING = 0
```

---

## 29. 是否具备进入 Step 10 条件

**是。**

当前满足：

```text
Stage 4 tools tests: PASS (452 cases)
Stage 4 search tests: PASS (53 cases)
Stage 4 search integration tests: PASS (30 cases)
Stage 4 discovery tests: PASS (57 cases)
Stage 4 total: 592 cases
Stage 3 data-layer tests: PASS
npm run check: PASS
ERROR = 0
WARNING = 0
```

但本步骤只确认 Stage 4 Step 9。

**未修改发现页，未进入 Stage 4 Step 10，也未进入 Stage 5。**

等待用户确认后再继续。
