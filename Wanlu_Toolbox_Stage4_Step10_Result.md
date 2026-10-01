# Stage 4 Step 10 执行结果

> 项目：挽鹿工具箱 / Wanlu Toolbox
>
> 阶段：Stage 4 Step 10
>
> 目标：把发现页正式升级为完全基于本机真实数据的工具发现页；不进入 Step 11，不接入任何远程内容。

## 1. 修改/新增文件

修改：

```text
pages/discover/discover.js
pages/discover/discover.wxml
pages/discover/discover.wxss
pages/discover/discover.json
package.json
```

新增：

```text
utils/discovery-view-model.js
scripts/test-stage4-discover-integration.js
Wanlu_Toolbox_Stage4_Step10_Result.md
```

未修改：

```text
services/discovery.js
utils/tool-search.js
utils/tool-catalog.js
pages/index/*
pages/tools/*
pages/mine/*
```

## 2. 发现页原状态

原发现页只保留一个“想去工具页看看”的入口和说明，没有正式本地发现数据区块。

## 3. 发现页新架构

正式结构：

```text
pages/discover/discover.js
        ↓
services/discovery.js
        ↓
Stage 3 favorites / tool-usage
        ↓
utils/discovery-view-model.js
        ↓
动态工具区块 + 分类探索
```

发现页本身只负责读取正式 Service、构建展示 ViewModel、导航和页面状态，不重新实现 Usage / Recent / Favorite / Recommendation 业务规则。

## 4. Discovery Service 接入

`refreshDiscovery()` 统一读取：

```text
getFrequentTools({ limit: 4 })
getRecentDiscoveryTools({ limit: 4 })
getFavoriteDiscoveryTools({ limit: 4 })
getFeaturedTools({ limit: 8 })
getRecommendedTools({ limit: 12 })
```

页面没有直接解析 Stage 3 Storage，也没有重新计算推荐权重。

读取异常按集合独立降级为空数组，同时记录本地开发错误并显示轻量安全错误提示；不会因为一个集合异常导致页面白屏或无限 loading。

## 5. EMPTY 模式

行为工具去重数量为 0：

```text
精选工具（有真实数据才显示）
分类探索
```

不显示：

```text
常用工具
最近使用
我的收藏
为你推荐
```

## 6. LIGHT 模式

行为工具去重数量为 1～2。

只显示一个主要个性化区块，优先级固定：

```text
Recent 非空 → 最近使用
否则 Favorites 非空 → 我的收藏
否则 Frequent 非空 → 常用工具
```

然后显示去重后的精选工具，再显示分类探索。

不会因为一次少量行为把多个个性化区块全部展开。

## 7. RICH 模式

行为工具去重数量 >= 3。

动态工具区块顺序：

```text
常用工具
→ 为你推荐
→ 我的收藏（有非重复收藏才显示）
→ 分类探索
```

Rich 模式不单独显示最近使用；Recent 信号继续由 Step 9 Recommendation Service 使用。

## 8. 行为数量计算规则

`behaviorCount` 来源：

```text
Frequent + Recent + Favorites
→ 过滤无效工具
→ 按正式 tool.id 去重
```

固定阈值：

```text
0     → EMPTY
1～2  → LIGHT
>= 3  → RICH
```

## 9. 常用工具

只使用 Discovery Service 返回顺序。

ViewModel 不根据 `useCount / lastUsedAt` 重新排序，也不向 UI 暴露真实使用次数。

最多显示 4 个。

## 10. 最近使用

只使用：

```text
getRecentDiscoveryTools()
```

只在 LIGHT 模式作为最高优先级主要行为区块显示。

页面通过 `onShow → refreshDiscovery()` 每次重新读取，因此 Stage 3 `recentClearedAt` 生效后，切回发现页会立即使用最新结果。

## 11. 我的收藏

只使用：

```text
getFavoriteDiscoveryTools()
```

不存在 active favorite 时不显示收藏区块。

取消收藏后下次 `onShow` 重新读取，不缓存旧收藏。

## 12. 精选工具

只使用：

```text
getFeaturedTools()
```

正式展示标题固定为：

```text
精选工具
```

页面没有使用“热门工具 / 实时热门 / 今日热门 / 全网热门”文案。

最多显示 4 个，不足 4 个按真实数量展示，不做假数据补足。

## 13. 为你推荐

只使用：

```text
getRecommendedTools()
```

页面没有重新计算 Step 9 推荐权重。

副说明：

```text
根据本机使用情况推荐
```

不会暗示 AI、云端、大数据或全网推荐。

EMPTY 模式不显示“为你推荐”。

## 14. 分类探索

固定使用当前正式工具分类的轻量展示映射：

```text
image → 图片工具
calc  → 计算工具
other → 其他工具
```

仅提供 3 个分类入口，不展开完整分类工具列表，不建立新分类体系。

点击分类使用 `wx.switchTab()` 进入正式工具 Tab；本步骤没有新增 Storage 或复杂全局路由系统来传分类。

## 15. 跨区块去重

展示层按正式 `tool.id` 去重。

EMPTY：只有 Featured。

LIGHT：主要个性化区块优先，Featured 排除已经展示的 tool.id。

RICH：

```text
Frequent 优先
Favorites 排除已显示 Frequent
Recommended 排除 Frequent + Favorites
```

因此同一个工具在同一发现页展示周期不会重复占据多个工具区块。

## 16. 每区块最大展示数量

```text
MAX_TOOLS_PER_SECTION = 4
```

所有工具区块最多 4 个，适配手机端 2 列 Grid。

## 17. onShow 刷新

正式刷新入口：

```text
onShow()
→ refreshDiscovery()
```

没有只在 `onLoad` 读取一次。

用户使用工具、收藏/取消收藏、清空最近使用或清空本地数据后，切回发现 Tab 会重新读取最新本机数据。

## 18. 工具导航

所有发现页工具卡统一使用正式：

```text
tool.path
```

通过 `wx.navigateTo()` 打开。

没有按名称拼 URL，没有建立第二套路由表。

无效 path 会安全提示，不会直接崩溃。

发现页没有调用 `recordToolUse()`；Usage 仍只由具体工具业务成功后记录。

## 19. 分类导航

当前项目没有“switchTab 并直接带入 category”的正式机制。

因此按本 Step 安全边界：

```text
分类探索
→ wx.switchTab('/pages/tools/tools')
→ 用户使用工具页现有分类筛选
```

同时复用已有 transient `toolsKeyword` 机制清空待传搜索词，不新增持久化数据。

## 20. 无数据体验

全新用户不会再只看到一个“去工具页看看”按钮。

至少具备：

```text
真实精选工具（若 catalog 有精选）
+ 分类探索
```

全部来源于正式 catalog / Discovery Service。

## 21. 错误状态

页面包含：

```text
isLoading
hasError
```

数据完全本地同步读取，因此不显示长时间 Skeleton。

任一 Discovery 集合读取异常时：

- 该集合安全降级为空；
- 其他集合仍可继续展示；
- 用户看到“部分内容暂时无法加载”；
- 提供“重新加载”；
- 不展示堆栈、Storage Key 或内部技术错误。

## 22. 是否直接访问 Storage

**否。**

`pages/discover/discover.js` 不包含：

```text
wx.getStorage*
wx.setStorage*
STORAGE_KEYS
services/storage
```

## 23. 是否新增 Storage

**否。**

未新增任何：

```text
wl_discovery_*
wl_recommend_*
wl_profile_*
wl_section_*
wl_category_*
```

发现页模式、推荐列表、行为数量、分类偏好均不持久化。

## 24. 是否存在假内容

**否。**

未出现：

```text
假文章
假新闻
假 GitHub
假 AI
假热度
假排行榜
假用户数字
猜你喜欢
今日趋势
实时排行榜
```

## 25. 是否接入远程服务

**否。**

没有：

```text
wx.request
fetch
wanluu.com
services/content
services/github
services/ai
```

发现页保持 100% 本地工具发现。

## 26. 是否建立用户画像

**否。**

ViewModel 只根据当前 Discovery Service 返回数组即时生成页面结构，不保存行为计数、偏好分类或推荐结果。

## 27. wooden-fish / zodiac

ViewModel 对：

```text
wooden-fish
zodiac
```

继续进行展示层防恢复过滤。

Step 10 集成测试确认两者不能进入正式发现页工具区块。

## 28. ViewModel 测试

新增纯函数：

```text
buildDiscoveryViewModel(...)
```

测试覆盖：

- EMPTY / LIGHT / RICH；
- behaviorCount 0 / 1 / 2 / 3 / >3；
- LIGHT 主区块优先级；
- RICH 动态区块；
- 每区块最多 4 个；
- Featured / Recommended 跨区块去重；
- disabled / enabled=false；
- wooden-fish / zodiac；
- 无效 path；
- 稳定顺序；
- Input Mutation；
- 清空行为数据后恢复 EMPTY；
- Recent 清空后的模式更新；
- Favorite 取消后的模式更新；
- 页面静态接入 Discovery Service；
- 不直接访问 Storage / 网络 / Usage 记录。

## 29. Discovery Integration Case 数

```text
71 cases
```

## 30. Stage 4 总 Case 数

```text
452 tools
+ 53 search
+ 30 search integration
+ 57 discovery
+ 71 discover integration
= 663 cases
```

## 31. npm run test:stage4

实际执行：

```text
Stage 4 tools tests: PASS (452 cases)
Stage 4 search tests: PASS (53 cases)
Stage 4 search integration tests: PASS (30 cases)
Stage 4 discovery tests: PASS (57 cases)
Stage 4 discover integration tests: PASS (71 cases)
```

结论：**PASS**。

## 32. npm run test:stage3

实际执行：

```text
Stage 3 data-layer tests: PASS
```

结论：**PASS**。

## 33. npm run check

实际执行：

```text
PASS
```

## 34. ERROR / WARNING

```text
ERROR = 0
WARNING = 0
```

## 35. 是否具备进入 Step 11 条件

**是。**

当前满足：

```text
Stage 4 total tests: PASS (663 cases)
Stage 3 data-layer tests: PASS
npm run check: PASS
ERROR = 0
WARNING = 0
```

但本步骤已立即停止。

**未进入 Stage 4 Step 11，未修改其他工具进行全局交互修复，未进入 Stage 5。**
