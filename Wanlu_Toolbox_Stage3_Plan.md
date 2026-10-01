【阶段3目标】

阶段3定位为：**建立“本地用户数据能力 + 工具使用数据层”**，让挽鹿工具箱从单纯工具集合升级为具有连续使用体验的正式产品，同时仍然完全不依赖账号和服务器。

阶段3完成后，应具备：

```text
工具使用
↓
本地记录
├─ 收藏
├─ 浏览记录
├─ 最近使用
├─ 使用次数/最后使用时间
└─ 少量非敏感工具状态
↓
packageUser 本地用户数据中心
↓
未来微信登录
↓
本地数据 + 云端数据安全合并
```

本阶段明确不做：

```text
真实微信登录
服务器账号
数据库
会员
支付
广告
AI
GitHub API
wanluu.com API
云端同步
```

阶段3仍以正式上线审核标准开发，不出现“先占位以后再说”的公开功能。

---

# 【功能范围】

阶段3建议分为 6 个内部模块完成。

### 1. 本地数据基础层

建立统一的数据访问层，所有页面以后禁止直接散落调用：

```js
wx.getStorageSync()
wx.setStorageSync()
wx.removeStorageSync()
```

业务页面只通过统一 service 操作。

需要覆盖：

```text
读取
写入
更新
删除
校验
数据迁移
容量控制
异常恢复
批量清理
数据导出为内部对象
未来云同步合并
```

---

### 2. 收藏

首发支持**工具收藏**。

用户可以：

```text
收藏工具
取消收藏
查看收藏列表
清空收藏
```

收藏入口建议同时支持：

```text
工具卡片
工具详情页
```

但 UI 不要到处堆星标。

推荐：

- 工具详情页：明显但不抢主按钮的收藏按钮
- 工具列表卡片：可显示收藏状态，但首版可以暂不提供卡片直接收藏，降低误触

---

### 3. 浏览记录

用户进入正式工具详情页时记录浏览。

例如：

```text
二维码生成
图片压缩
日期计算
单位换算
```

不记录：

```text
首页
发现
我的
系统页面
未公开分包
wooden-fish
zodiac
```

用户可以：

```text
查看浏览记录
删除单条
清空全部
```

---

### 4. 最近使用

“最近使用”和“浏览记录”需要明确区分。

建议：

**浏览记录**
= 用户打开过这个工具。

**最近使用**
= 用户真正执行过这个工具的核心操作。

例如：

```text
二维码：
点击并成功生成二维码 → 使用一次

图片压缩：
成功得到压缩结果 → 使用一次

日期计算：
成功计算结果 → 使用一次

单位换算：
完成一次有效换算 → 使用一次
```

而不是只打开页面就算使用。

这样“最近使用”才有价值。

---

### 5. 工具使用状态

记录：

```text
最后浏览时间
最后使用时间
浏览次数
成功使用次数
收藏状态
```

以及少量安全的 UI 偏好。

例如可以保存：

```text
图片压缩上次选择的压缩质量
单位换算上次选择的单位类型
二维码上次选择的纠错配置
```

但**默认不保存用户输入内容**。

尤其禁止默认持久化：

```text
身份证相关图片
工资数字
房贷金额
健康数据
BMI身高体重
个人文本
二维码正文
水印文字
用户相册路径
图片临时路径
视频路径
```

这条建议作为阶段3数据层硬规则。

---

### 6. packageUser 本地用户中心

阶段3开始让 `packageUser` 真正承担数据管理，但仍然不登录。

可以正式加入：

```text
我的收藏
浏览记录
最近使用
本地数据管理
```

这些是真功能，不是占位。

---

# 【数据结构】

不建议把所有数据塞进一个巨大 JSON。

建议采用**分区存储 + 独立版本号**。

### 全局元数据

建议：

```js
{
  schemaVersion: 1,
  createdAt: 1780000000000,
  updatedAt: 1780000000000
}
```

存储键：

```text
wl_meta
```

---

### 收藏数据

建议：

```js
{
  version: 1,
  items: [
    {
      entityType: 'tool',
      entityId: 'qrcode',
      createdAt: 1780000000000,
      updatedAt: 1780000000000,
      deletedAt: null
    }
  ]
}
```

不要保存：

```text
工具名称
描述
图标
页面路径
```

这些信息继续从：

```text
utils/tool-catalog.js
```

动态读取。

这样以后工具改名字，不需要迁移收藏数据库。

---

### 浏览记录

建议：

```js
{
  version: 1,
  items: [
    {
      entityType: 'tool',
      entityId: 'qrcode',

      firstViewedAt: 1780000000000,
      lastViewedAt: 1780000100000,

      viewCount: 4,

      updatedAt: 1780000100000,
      deletedAt: null
    }
  ]
}
```

同一个工具不无限新增记录。

采用：

```text
toolId 去重
+
lastViewedAt 更新
+
viewCount +1
```

这样容量稳定。

---

### 工具使用数据

建议：

```js
{
  version: 1,
  tools: {
    qrcode: {
      lastUsedAt: 1780000100000,
      useCount: 6,
      lastSuccessAt: 1780000100000,
      updatedAt: 1780000100000
    },

    "image-compress": {
      lastUsedAt: 1780000200000,
      useCount: 3,
      lastSuccessAt: 1780000200000,
      updatedAt: 1780000200000
    }
  }
}
```

“最近使用”直接由：

```text
lastUsedAt
```

排序得到。

**不单独再存一份“最近使用列表”。**

这样避免三套数据互相不一致。

---

### 工具偏好状态

单独存：

```js
{
  version: 1,
  tools: {
    "image-compress": {
      quality: 'medium'
    },

    converter: {
      category: 'length'
    }
  }
}
```

只允许白名单字段。

禁止页面随便把整个 `data` 写入 Storage。

---

# 【本地存储方案】

阶段3建议正式形成：

```text
services/storage.js
        ↓
services/user-data.js
        ↓
repositories
├─ favorites
├─ history
├─ usage
└─ tool-state
        ↓
页面
```

不建议页面直接操作 Storage。

---

### Storage Key

建议统一：

```text
wl_meta_v1
wl_favorites_v1
wl_history_v1
wl_tool_usage_v1
wl_tool_state_v1
```

全部使用：

```text
wl_
```

命名空间，防止与其他模块冲突。

---

### 容量策略

不依赖微信平台理论最大容量去设计。

项目内部主动限制：

```text
收藏          ≤ 200
浏览记录      ≤ 300
最近使用      从 usage 派生
工具状态      只存白名单小字段
```

整个阶段3用户数据建议长期控制在：

```text
约 1 MB 以内
```

正常实际使用应远低于这个数值。

禁止 Storage 存：

```text
base64 图片
图片文件
视频文件
Canvas 数据
文章正文
大段 HTML
```

---

### 自动清理

浏览记录超过上限：

```text
按 lastViewedAt
删除最旧数据
```

不存在于当前 `tool-catalog` 的工具：

不要立即删除。

可以标记为：

```text
orphan
```

下一次维护清理。

这样工具暂时下架后重新上线，用户数据仍有机会恢复。

---

### 数据版本升级

必须从阶段3第一天就设计 migration。

例如未来：

```text
schemaVersion 1
↓
schemaVersion 2
↓
schemaVersion 3
```

升级流程：

```text
读取旧数据
↓
校验
↓
复制到内存
↓
执行 migration
↓
验证新结构
↓
写入新版本 key
↓
最后更新 meta
```

如果中途失败：

**旧数据不能删除。**

---

### 异常恢复

所有读取都需要：

```text
try/catch
类型验证
字段验证
默认值
```

例如 Storage 数据损坏：

不要：

```text
整个小程序白屏
```

应该：

```text
检测到 favorites 损坏
↓
只恢复 favorites
↓
其他 history / usage 不受影响
```

---

# 【收藏设计】

建议建立统一接口：

```js
isFavorite(toolId)

addFavorite(toolId)

removeFavorite(toolId)

toggleFavorite(toolId)

getFavorites()

clearFavorites()
```

页面不能自己判断数组。

收藏数据只保存：

```text
toolId
时间
同步字段
```

展示时：

```text
收藏记录
↓
tool-catalog
↓
工具名称 / 图标 / 路由
```

---

### 收藏 UI

工具详情：

```text
标题              ☆ 收藏
```

收藏后：

```text
★ 已收藏
```

不要使用误导性成功动画。

取消收藏允许直接取消，不必弹二次确认。

清空全部收藏需要确认：

```text
确定清空全部收藏吗？
```

---

# 【浏览记录设计】

建议统一接口：

```js
recordView(toolId)

getHistory()

removeHistory(toolId)

clearHistory()
```

在正式工具页：

```js
onLoad()
```

调用一次：

```text
recordView(toolId)
```

同一个页面：

```text
onShow
```

不要重复计数。

这样：

用户切后台再回来不会多记一次。

---

### 展示顺序

按：

```text
lastViewedAt DESC
```

展示：

```text
工具图标
工具名称
最后浏览时间
```

不需要显示过多技术数据。

可显示：

```text
刚刚
5分钟前
今天
昨天
09-28
```

---

# 【最近使用设计】

建议不建立独立数据库。

统一使用：

```text
wl_tool_usage_v1
```

计算：

```js
getRecentTools(limit = 20)
```

排序：

```text
lastUsedAt DESC
```

---

### 什么时候记录“使用”

每个工具定义**成功事件**。

例如：

| 工具 | 使用成功定义 |
|---|---|
| 二维码 | 成功生成二维码 |
| 图片压缩 | 成功获得压缩结果 |
| 改尺寸 | 成功生成结果 |
| 水印 | 成功生成水印图 |
| 长图 | 成功生成长图 |
| 九宫格 | 成功生成9张图片 |
| 视频压缩 | 成功产生压缩视频 |
| 日期计算 | 成功显示结果 |
| 单位换算 | 有效输入并完成换算 |
| 房贷 | 成功计算 |
| BMI | 成功计算 |
| 选择助手 | 完成一次选择 |

统一调用：

```js
recordToolUse(toolId)
```

这样未来可以统计：

```text
最常使用工具
最近使用
常用工具推荐
```

而不需要重新改数据库。

---

# 【packageUser如何衔接】

阶段3建议开始让：

```text
packageUser
```

成为真正的“个人数据中心”。

但依旧保持匿名本地模式。

结构建议：

```text
packageUser/pages/
├─ index/
├─ favorites/
├─ history/
├─ recent/
└─ data-management/
```

其中：

### 用户中心首页

正式显示：

```text
我的收藏
浏览记录
最近使用
数据管理
意见反馈
关于
```

不显示：

```text
登录
VIP
支付
AI额度
云同步
```

直到对应功能真正完成。

---

### 为未来登录同步预留

阶段3所有记录必须具备：

```text
createdAt
updatedAt
deletedAt
```

其中 `deletedAt` 非常重要。

因为以后：

```text
手机A删除收藏
↓
登录
↓
服务器如果只看到“没有这个收藏”
```

无法判断：

```text
它从未收藏
```

还是：

```text
用户主动删除了
```

所以未来需要“墓碑记录”。

阶段3先把结构设计好。

---

### 未来云端合并原则

现在只写纯函数和接口规范，不联网。

未来登录后：

收藏：

```text
toolId 相同
↓
比较 updatedAt
↓
较新的状态生效
```

删除：

```text
deletedAt 不为空
且时间更新
↓
删除优先
```

浏览记录：

```text
lastViewedAt 取最新
viewCount 不建议简单相加
```

防止重复同步造成次数膨胀。

工具使用：

```text
lastUsedAt 取最新
```

以后服务器可重新设计精确统计。

---

# 【需要修改的文件】

预计主要修改：

```text
app.json

utils/tool-catalog.js

services/storage.js

pages/index/*
pages/tools/*
pages/mine/*

packageTools/pages/*
```

其中 `packageTools` 并不是所有页面都大改。

主要增加：

```text
recordView()
recordToolUse()
收藏按钮接入
安全偏好恢复
```

还需要更新：

```text
README.md
scripts/check-project.js
```

让静态检查覆盖阶段3新增规范。

---

# 【需要新增的文件】

建议新增：

```text
services/user-data.js
```

负责用户本地数据总入口。

再拆：

```text
services/favorites.js
services/history.js
services/tool-usage.js
services/tool-state.js
```

推荐增加：

```text
utils/data-schema.js
utils/data-migrations.js
utils/data-merge.js
```

职责分别是：

```text
data-schema
→ 数据结构与验证

data-migrations
→ 本地版本升级

data-merge
→ 未来本地+云端合并纯函数
```

packageUser 新增：

```text
packageUser/pages/favorites/
packageUser/pages/history/
packageUser/pages/recent/
packageUser/pages/data-management/
```

可新增公共组件：

```text
components/favorite-action/
```

避免 24 个工具页面重复实现收藏 UI。

---

# 【审核与隐私风险】

阶段3应该比登录阶段风险低，但仍需特别控制。

### 1. 不新增权限

阶段3：

```text
不新增摄像头
不新增定位
不新增通讯录
不新增麦克风
不新增用户资料权限
```

收藏、历史、最近使用全部本地完成。

---

### 2. 不存敏感工具输入

这是最重要的隐私边界。

例如：

房贷计算用户可能输入：

```text
资产情况
贷款金额
```

工资计算可能涉及：

```text
收入
社保
```

BMI：

```text
身高
体重
```

图片工具：

```text
用户照片
```

阶段3不能因为“恢复上次状态”而默认持久化这些内容。

只保存：

```text
工具ID
使用次数
时间
非敏感UI偏好
```

---

### 3. 用户必须能删除数据

packageUser 必须提供：

```text
清空收藏
清空浏览记录
清空最近使用/使用记录
清空全部本地数据
```

“清空全部本地数据”必须二次确认。

建议文案直接说明：

> 仅清除本机挽鹿工具箱保存的收藏、浏览记录、最近使用及工具偏好，不会删除手机相册中的文件。

---

### 4. 清缓存后的行为

用户：

```text
微信清理缓存
删除小程序
系统清理数据
```

本地数据可能消失。

当前没有登录和云同步，因此不能宣传：

```text
永久保存
跨设备同步
自动恢复
```

UI只能表述：

```text
本地保存
```

---

### 5. 不做设备指纹

不要为了未来同步提前采集：

```text
设备唯一标识
IMEI
MAC
广告ID
设备指纹
```

阶段3没有必要。

---

# 【测试方案】

阶段3测试建议分 7 组。

### A. 数据层测试

检查：

```text
首次启动无数据
新增收藏
重复收藏
取消收藏
重复取消
空收藏
200条上限
数据排序
非法 toolId
```

---

### B. 浏览记录

测试：

```text
第一次进入
重复进入
退出再进入
后台恢复
删除单条
清空
超过上限自动裁剪
```

验证：

```text
onShow 不重复增加
```

---

### C. 最近使用

每个正式工具至少测试一次：

```text
打开页面不计使用
操作失败不计使用
操作成功才计使用
```

然后检查：

```text
lastUsedAt
useCount
排序
```

---

### D. Storage 异常

人工制造：

```text
损坏 JSON
字段缺失
version 错误
items 不是数组
toolId 不存在
时间字段非法
```

目标：

```text
不白屏
不崩溃
不影响其他数据集
```

---

### E. 数据迁移

至少提前写一个模拟：

```text
v0
↓
v1
```

即使现在只有 v1，也要证明 migration 框架可以运行。

测试：

```text
升级成功
升级失败
旧数据保留
重复升级幂等
```

---

### F. 数据删除

测试：

```text
删除单个收藏
清空收藏
清空历史
清空最近使用
清空所有本地数据
重新启动
```

确认：

```text
页面实时更新
缓存没有残留
不会删相册文件
```

---

### G. 真机测试

至少：

```text
iPhone 小屏
iPhone 全面屏
Android
```

重点检查：

```text
收藏按钮点击区域
列表滚动
长列表性能
页面返回
冷启动
微信杀后台后恢复
清缓存
卸载重进
深层页面返回
```

最终阶段3建议增加静态检查规则：

```text
页面不得直接调用 wx.setStorageSync
页面不得直接调用 wx.removeStorageSync
敏感页面不得持久化输入值
所有 Storage key 必须 wl_ 前缀
数据结构必须包含 version
wooden-fish/zodiac 不得重新出现
禁止新增真实登录/API
```

阶段3建议按以下顺序实施：

```text
1. 数据 Schema
2. Storage 基础层
3. migration / 异常恢复
4. 收藏
5. 浏览记录
6. 使用统计 / 最近使用
7. packageUser 页面
8. 24个正式工具接入使用记录
9. 数据管理/删除
10. 云端合并纯函数预留
11. 静态检查
12. 微信开发者工具 + 真机验收
```

当前只完成阶段3实施方案设计，没有修改项目代码。
