/**
 * 图片选择封装（纯本地）
 *
 * 职责：
 * - 统一处理选图入口、错误提示与隐私/权限文案
 * - 不做任何远程调用，不依赖服务端内容审核
 *
 * 说明：
 * 若将来需要接入服务端内容安全检测，请在业务侧显式引入
 * utils/moderation（小程序 require 只支持相对路径，
 * 例如 packageTools 页面内为 require('../../../utils/moderation')），
 * 而不是在本模块内部隐式调用。
 */

const DEFAULT_SIZE_TYPE = ['original']
const DEFAULT_SOURCE_TYPE = ['album']

const getErrorMessage = (error) => String(
  error && (error.errMsg || error.message) || '',
).toLowerCase()

const getChooseImageErrorMessage = (error) => {
  const errMsg = getErrorMessage(error)

  if (errMsg.includes('cancel')) return ''

  if (
    errMsg.includes('privacy api banned') ||
    errMsg.includes('privacy interface is banned') ||
    errMsg.includes('api scope is not declared in the privacy agreement') ||
    errMsg.includes('interface is not declared in the privacy agreement')
  ) {
    return '选择图片暂不可用：需先在小程序后台配置「用户隐私保护指引」并声明相册权限'
  }

  if (
    errMsg.includes('privacy permission is not authorized') ||
    errMsg.includes('require privacy authorize')
  ) {
    return '请先同意小程序隐私保护指引'
  }

  if (
    errMsg.includes('permission') ||
    errMsg.includes('auth') ||
    errMsg.includes('deny') ||
    errMsg.includes('denied')
  ) {
    return '相册权限未开启'
  }

  if (
    errMsg.includes('system') ||
    errMsg.includes('album')
  ) {
    return '系统暂时无法打开相册，请重试'
  }

  return '选择图片失败，请重试'
}

const showError = (title) => {
  wx.showToast({
    title,
    icon: 'none',
  })
}

const handleChooseFailure = (error, resolve) => {
  const userMessage = getChooseImageErrorMessage(error)

  if (userMessage) {
    console.error('[image-picker] chooseMedia failed', error)
    showError(userMessage)
  }

  resolve([])
}

/**
 * 选择图片
 * @param {Object} options
 * @param {number} [options.count=1] 最多可选数量
 * @param {Array} [options.sizeType] original / compressed
 * @returns {Promise<Array>} 选中的临时文件列表，取消或失败时返回空数组
 */
const chooseImages = (options = {}) => new Promise((resolve) => {
  const count = Number.isInteger(options.count) && options.count > 0 ? options.count : 1
  const sizeType = Array.isArray(options.sizeType) && options.sizeType.length
    ? options.sizeType
    : DEFAULT_SIZE_TYPE
  // 首发版强制仅相册。调用方不能通过参数重新打开 camera 等来源。
  const sourceType = DEFAULT_SOURCE_TYPE

  try {
    wx.chooseMedia({
      count,
      mediaType: ['image'],
      sizeType,
      sourceType,
      success: (res) => {
        const files = res && Array.isArray(res.tempFiles) ? res.tempFiles : []

        if (!files.length) {
          showError('未获取到图片，请重试')
          resolve([])
          return
        }

        resolve(files)
      },
      fail: (error) => handleChooseFailure(error, resolve),
    })
  } catch (error) {
    handleChooseFailure(error, resolve)
  }
})

/**
 * 选择视频
 * 统一走 wx.chooseMedia，不再使用已停止维护的 wx.chooseVideo 作为主路径
 * @returns {Promise<Object|null>}
 */
const chooseVideo = (options = {}) => new Promise((resolve) => {
  const sourceType = ['album']

  try {
    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      sourceType,
      maxDuration: Number.isInteger(options.maxDuration) ? options.maxDuration : 60,
      success: (res) => {
        const files = res && Array.isArray(res.tempFiles) ? res.tempFiles : []

        if (!files.length) {
          resolve(null)
          return
        }

        resolve(files[0])
      },
      fail: (error) => {
        if (!getErrorMessage(error).includes('cancel')) {
          console.error('[image-picker] chooseMedia(video) failed', error)
          showError('选择视频失败，请重试')
        }

        resolve(null)
      },
    })
  } catch (error) {
    console.error('[image-picker] chooseMedia(video) error', error)
    resolve(null)
  }
})

module.exports = {
  chooseImages,
  chooseVideo,
}
