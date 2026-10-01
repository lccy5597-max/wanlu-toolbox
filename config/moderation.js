/**
 * 内容安全审核配置
 *
 * 设计原则：
 * 1. 本地图片/视频工具（压缩、改尺寸、水印、长图、九宫格、二维码等）
 *    的默认链路是「选择 → 本地处理 → 本地保存」，不调用任何远程接口。
 * 2. 远程审核是一个**独立、可选**的模块，默认关闭（enabled: false）。
 * 3. 只有当业务引入「上传到服务器 / 云端存储 / 公开发布 / 社区展示 /
 *    用户互传 / 用户投稿」等能力时，才把 enabled 置为 true。
 * 4. 即使本模块关闭、未配置服务地址、或服务不可用，
 *    本地图片工具也必须能正常运行。
 */

const moderationConfig = {
  // 是否启用远程内容安全审核
  enabled: false,

  // 审核服务提供方：
  // - 'none'    不启用（默认）
  // - 'remote'  走 utils/image-moderation.js 的远程接口
  provider: 'none',

  // 远程审核参数
  options: {
    path: '/file/image/moderation',
    uploadFieldName: 'multipartFile',
    timeout: 15000,
    maxConcurrency: 9,
  },
}

module.exports = moderationConfig
