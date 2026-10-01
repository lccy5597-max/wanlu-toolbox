const { withToolPage } = require('../../../behaviors/tool-page')
const { isSaveCancel, saveVideoToAlbum } = require('../../../utils/image-save')
const { chooseVideo } = require('../../../utils/image-picker')
const { isDesktopPlatform } = require('../../../utils/device')
const {
  getCompressionRatio,
  getQualityAttempts,
  qualityOptions,
  validateCompressionResult,
  validateVideoInfo,
} = require('../../../utils/tool-logic/video-compress')

const formatFileSize = (size) => {
  if (!size) return '--'

  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(2)} MB`
  }

  return `${(size / 1024).toFixed(1)} KB`
}

const kbToBytes = (size) => {
  const value = Number(size)

  return Number.isFinite(value) && value > 0 ? Math.round(value * 1024) : 0
}

const formatDuration = (duration) => {
  const totalSeconds = Math.round(Number(duration) || 0)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes <= 0) return `${seconds} 秒`

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const formatDimensions = (width, height) => {
  if (!width || !height) return '--'

  return `${Math.round(width)} × ${Math.round(height)}`
}

Page(withToolPage('video-compress', {
  data: {
    qualityOptions,
    qualityMode: 'medium',
    originalPath: '',
    compressedPath: '',
    originalSize: '--',
    compressedSize: '--',
    originalDimensions: '--',
    compressedDimensions: '--',
    durationText: '--',
    compressionRatio: '--',
    compressionNote: '',
    hasVideo: false,
    hasResult: false,
    isCompressing: false,
    isSaving: false,
    videoInfo: null,
  },

  /**
   * 选择视频
   * 统一使用 wx.chooseMedia，不再把已停止维护的 wx.chooseVideo 作为主路径。
   * 低端机型上 chooseMedia 不可用时会给出明确提示，不做静默降级。
   */
  onChooseVideo() {
    if (this.data.isCompressing || this.data.isSaving) return

    if (isDesktopPlatform()) {
      this.showDesktopUnsupportedToast()
      return
    }

    chooseVideo({
      sourceType: ['album'],
    }).then((file) => {
      if (!file || !file.tempFilePath) return

      this.loadVideo(file.tempFilePath, file)
    })
  },

  loadVideo(filePath, file = {}) {
    this.getVideoInfo(filePath)
      .catch(() => ({}))
      .then((info) => this.getFileSize(filePath, file.size || kbToBytes(info.size)).then((size) => ({
        ...info,
        size,
      })))
      .then((info) => {
        const mergedInfo = {
          width: info.width || file.width || 0,
          height: info.height || file.height || 0,
          duration: info.duration || file.duration || 0,
          size: info.size,
        }
        const validation = validateVideoInfo(mergedInfo, { requireDimensions: true })
        if (!validation.ok) return Promise.reject(new Error(validation.errorMessage))
        const safeInfo = validation.data
        this.setData({
          originalPath: filePath,
          compressedPath: '',
          originalSize: formatFileSize(safeInfo.size),
          compressedSize: '--',
          originalDimensions: formatDimensions(safeInfo.width, safeInfo.height),
          compressedDimensions: '--',
          durationText: formatDuration(safeInfo.duration),
          compressionRatio: '--',
          compressionNote: '',
          hasVideo: true,
          hasResult: false,
          videoInfo: safeInfo,
        })
      })
      .catch(() => {
        wx.showToast({
          title: '读取视频失败',
          icon: 'none',
        })
      })
  },

  onQualityTap(event) {
    if (this.data.isCompressing) return

    if (isDesktopPlatform()) {
      this.showDesktopUnsupportedToast()
      return
    }

    this.setData({
      qualityMode: event.currentTarget.dataset.value,
      hasResult: false,
      compressedPath: '',
      compressedSize: '--',
      compressedDimensions: '--',
      compressionRatio: '--',
      compressionNote: '',
    })
  },

  onCompress() {
    if (!this.data.originalPath) {
      wx.showToast({
        title: '请先选择视频',
        icon: 'none',
      })
      return
    }

    if (this.data.isCompressing) return

    this.setData({
      isCompressing: true,
    })

    this.compressBestResult()
      .then((result) => {
        this.setData({
          compressedPath: result.path,
          compressedSize: formatFileSize(result.size),
          compressedDimensions: formatDimensions(result.width, result.height),
          compressionRatio: this.getCompressionRatio(result.size),
          compressionNote: result.note || '',
          hasResult: true,
          isCompressing: false,
        })
        this.recordToolUse()
      })
      .catch(() => {
        this.setData({
          isCompressing: false,
        })
        wx.showToast({
          title: '压缩失败',
          icon: 'none',
        })
      })
  },

  compressBestResult() {
    const originalSize = this.data.videoInfo && this.data.videoInfo.size
    const qualityResult = getQualityAttempts(this.data.qualityMode)
    if (!qualityResult.ok) return Promise.reject(new Error(qualityResult.errorMessage))
    const qualities = qualityResult.data
    let smallestResult = null

    return qualities.reduce((promise, quality, index) => (
      promise.then((found) => {
        if (found) return found

        return this.compressVideoByQuality(quality).then((result) => {
          const validation = validateCompressionResult(result)
          if (!validation.ok) return Promise.reject(new Error(validation.errorMessage))
          if (!smallestResult || result.size < smallestResult.size) {
            smallestResult = result
          }

          if (!originalSize || result.size < originalSize) {
            return {
              ...result,
              note: index > 0 ? '所选质量会让体积变大，已自动改用更低质量。' : '',
            }
          }

          return null
        })
      })
    ), Promise.resolve(null)).then((result) => {
      if (result) return result

      if (smallestResult) {
        return {
          ...smallestResult,
          note: '原视频已经足够小，已保留最小的压缩结果，体积可能略有增加。',
        }
      }

      return Promise.reject(new Error('compress failed'))
    })
  },

  compressVideoByQuality(quality) {
    return new Promise((resolve, reject) => {
      wx.compressVideo({
        src: this.data.originalPath,
        quality,
        success: (res) => {
          const videoPath = res.tempFilePath

          this.getCompressedVideoResult(videoPath, kbToBytes(res.size))
            .then((result) => resolve({
              ...result,
              path: videoPath,
            }))
            .catch(reject)
        },
        fail: reject,
      })
    })
  },

  getCompressedVideoResult(filePath, knownSize) {
    return this.getVideoInfo(filePath)
      .catch(() => ({}))
      .then((info) => this.getFileSize(filePath, knownSize || kbToBytes(info.size)).then((size) => ({
        ...info,
        width: info.width || this.data.videoInfo.width,
        height: info.height || this.data.videoInfo.height,
        size,
      })))
  },

  getVideoInfo(filePath) {
    if (!wx.getVideoInfo) {
      return Promise.resolve({})
    }

    return new Promise((resolve, reject) => {
      wx.getVideoInfo({
        src: filePath,
        success: resolve,
        fail: reject,
      })
    })
  },

  getFileSize(filePath, fallbackSize) {
    if (fallbackSize) return Promise.resolve(fallbackSize)

    return new Promise((resolve, reject) => {
      wx.getFileInfo({
        filePath,
        success: (res) => resolve(res.size || 0),
        fail: reject,
      })
    })
  },

  getSavableVideoPath(filePath) {
    if (!wx.getFileSystemManager || !wx.env || !wx.env.USER_DATA_PATH) {
      return Promise.resolve(filePath)
    }

    const fs = wx.getFileSystemManager()
    const targetPath = `${wx.env.USER_DATA_PATH}/video-compress-output.mp4`

    return new Promise((resolve, reject) => {
      fs.unlink({
        filePath: targetPath,
        complete: () => {
          fs.copyFile({
            srcPath: filePath,
            destPath: targetPath,
            success: () => resolve(targetPath),
            fail: reject,
          })
        },
      })
    })
  },

  prepareSavableVideo(filePath) {
    return this.getSavableVideoPath(filePath)
      .then((savablePath) => this.getCompressedVideoResult(savablePath)
        .then((info) => ({
          path: savablePath,
          info,
        })))
  },

  getCompressionRatio(compressedSize) {
    const originalSize = this.data.videoInfo && this.data.videoInfo.size
    const result = getCompressionRatio(originalSize, compressedSize)
    return result.ok ? result.data.text : '--'
  },

  showDesktopUnsupportedToast() {
    wx.showToast({
      title: '请在手机端使用视频压缩',
      icon: 'none',
    })
  },

  onSave() {
    if (!this.data.compressedPath) {
      wx.showToast({
        title: '请先压缩视频',
        icon: 'none',
      })
      return
    }

    if (this.data.isSaving) return

    this.setData({
      isSaving: true,
    })

    this.prepareSavableVideo(this.data.compressedPath)
      .then(({ path }) => saveVideoToAlbum({
        filePath: path,
        permissionText: '打开权限后就能保存压缩后的视频。',
      }))
      .then(() => {
        this.setData({
          isSaving: false,
        })
        wx.showToast({
          title: '已保存到相册',
          icon: 'success',
        })
      })
      .catch((error) => {
        this.setData({
          isSaving: false,
        })

        if ((error && error.handled) || isSaveCancel(error)) return

        wx.showToast({
          title: error && error.userMessage || '保存失败',
          icon: 'none',
        })
      })
  },

  onShareAppMessage() {
    return {
      title: '视频太大不好发？试试本地视频压缩工具',
      path: '/packageTools/pages/video-compress/video-compress',
    }
  },

  onShareTimeline() {
    return {
      title: '视频压缩工具：把相册视频压小一点再发送',
      query: '',
    }
  },
}))
