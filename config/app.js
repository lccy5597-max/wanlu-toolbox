/**
 * 应用级配置
 *
 * 说明：
 * - 本文件不包含任何真实密钥、AppID、Secret、Token。
 * - 需要密钥的能力（AI、支付、会员、内容审核等）请通过自建服务端代理，
 *   不要写入小程序前端代码。
 * - 首发版只暴露已经完成并验收的功能；长期能力使用独立分包与服务接口隔离。
 */

const brand = {
  name: '挽鹿工具箱',
  nameEn: 'Wanlu Toolbox',
  slogan: '日常小工具，一个就够',
  desc: '轻量、纯净、好用的微信小程序工具集合',
  // 展示用版本号：发版时同步修改这里（关于我们、我的页脚会读取）
  version: '1.0.0',
}

/**
 * 长期能力开关。
 * 首发版全部关闭，不在公开页面展示未完成入口，也不调用任何真实服务。
 */
const features = {
  ai: false,          // AI 聊天 / 写作 / 润色 / 摘要 等
  github: false,      // GitHub 今日榜 / 周榜 / 总榜
  content: false,     // AI 教程 / 科技内容 / 实用教程
  user: false,        // 微信登录 / 云端同步 / 账号资料；本地收藏和浏览记录不依赖此开关
  vip: false,         // 会员体系
  ads: false,         // 流量主广告
  moderation: false,  // 服务端内容安全审核
}

const isEnabled = (key) => Boolean(features[key])

module.exports = {
  brand,
  features,
  isEnabled,
}
