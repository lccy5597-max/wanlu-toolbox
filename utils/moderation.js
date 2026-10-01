/**
 * 内容安全审核统一入口
 *
 * 本模块是「可选能力」的门面：
 * - 默认关闭（见 config/moderation.js），调用会直接放行并返回原始文件列表
 * - 开启且 provider 为 remote 时，才会去加载远程审核实现
 * - 远程实现缺失（例如没有 config/api.js）时只告警不阻断业务
 *
 * 本地图片/视频工具的默认链路不依赖本模块。
 */

const moderationConfig = require('../config/moderation')

// null = 未加载；false = 加载失败；Object = 已加载
let remoteProvider = null

const loadRemoteProvider = () => {
  if (remoteProvider !== null) return remoteProvider

  try {
    // 延迟 require：避免未配置服务端地址时阻断页面加载
    // eslint-disable-next-line global-require
    remoteProvider = require('./image-moderation')
  } catch (error) {
    console.warn('[moderation] 远程审核模块不可用，已跳过内容审核', error)
    remoteProvider = false
  }

  return remoteProvider
}

const isModerationEnabled = () => Boolean(
  moderationConfig
  && moderationConfig.enabled
  && moderationConfig.provider === 'remote',
)

/**
 * 按需执行图片内容安全审核
 *
 * @param {Array} files 图片文件列表
 * @param {Object} [options]
 * @param {boolean} [options.force] 强制审核（忽略开关）
 * @returns {Promise<Array>} 审核通过时返回原始文件列表
 */
const moderateImages = (files, options = {}) => {
  const forced = options.force === true

  if (!Array.isArray(files) || !files.length) {
    return Promise.resolve([])
  }

  if (!forced && !isModerationEnabled()) {
    return Promise.resolve(files)
  }

  const provider = loadRemoteProvider()

  if (!provider) {
    return Promise.resolve(files)
  }

  const config = moderationConfig || {}

  return provider.moderateImages(files, {
    ...(config.options || {}),
    ...options,
  })
}

module.exports = {
  isModerationEnabled,
  moderateImages,
}
