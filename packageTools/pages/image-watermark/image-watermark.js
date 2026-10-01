const { withToolPage } = require('../../../behaviors/tool-page')
const { isSaveCancel, saveImageToAlbum } = require('../../../utils/image-save')
const { chooseImages } = require('../../../utils/image-picker')
const {
  getOpacity,
  getTargetSize,
  getWatermarkLayout,
  normalizeWatermarkText,
  opacityOptions,
} = require('../../../utils/tool-logic/image-watermark')

const formatFileSize = (size) => {
  if (!size) return '--'

  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(2)} MB`
  }

  return `${(size / 1024).toFixed(1)} KB`
}

Page(withToolPage('image-watermark', {
  data: {
    opacityOptions,
    opacityId: 'medium',
    watermarkText: '',
    originalPath: '',
    outputPath: '',
    originalSize: '--',
    outputSize: '--',
    originalDimensions: '--',
    outputDimensions: '--',
    hasImage: false,
    hasResult: false,
    isProcessing: false,
    isSaving: false,
    imageInfo: null,
  },

  onChooseImage() {
    if (this.data.isProcessing || this.data.isSaving) return

    chooseImages().then((files) => {
      const file = files[0]

      if (!file || !file.tempFilePath) return

      this.loadImage(file.tempFilePath, file.size)
    })
  },

  loadImage(filePath, knownSize) {
    wx.getImageInfo({
      src: filePath,
      success: (info) => {
        this.getFileSize(filePath, knownSize)
          .then((size) => {
            this.setData({
              originalPath: filePath,
              outputPath: '',
              originalSize: formatFileSize(size),
              outputSize: '--',
              originalDimensions: `${info.width} × ${info.height}`,
              outputDimensions: '--',
              hasImage: true,
              hasResult: false,
              imageInfo: {
                width: info.width,
                height: info.height,
                size,
              },
            })
          })
          .catch(() => {
            wx.showToast({
              title: '读取图片失败',
              icon: 'none',
            })
          })
      },
      fail: () => {
        wx.showToast({
          title: '读取图片失败',
          icon: 'none',
        })
      },
    })
  },

  onWatermarkInput(event) {
    this.setData({
      watermarkText: event.detail.value,
      hasResult: false,
      outputPath: '',
      outputSize: '--',
      outputDimensions: '--',
    })
  },

  onOpacityTap(event) {
    if (this.data.isProcessing) return

    this.setData({
      opacityId: event.currentTarget.dataset.id,
      hasResult: false,
      outputPath: '',
      outputSize: '--',
      outputDimensions: '--',
    })
  },

  onGenerate() {
    if (!this.data.originalPath || !this.data.imageInfo) {
      wx.showToast({
        title: '请先选择图片',
        icon: 'none',
      })
      return
    }

    if (!normalizeWatermarkText(this.data.watermarkText).length) {
      wx.showToast({
        title: '请填写水印文字',
        icon: 'none',
      })
      return
    }

    if (this.data.isProcessing) return

    this.setData({
      isProcessing: true,
    })

    this.getCanvas()
      .then(({ canvas, ctx }) => this.renderWatermark(canvas, ctx))
      .then((result) => {
        this.setData({
          outputPath: result.path,
          outputSize: formatFileSize(result.size),
          outputDimensions: `${result.width} × ${result.height}`,
          hasResult: true,
          isProcessing: false,
        })
        this.recordToolUse()
      })
      .catch(() => {
        this.setData({
          isProcessing: false,
        })
        wx.showToast({
          title: '生成失败',
          icon: 'none',
        })
      })
  },

  getCanvas() {
    return new Promise((resolve, reject) => {
      this.createSelectorQuery()
        .select('#watermarkCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          const canvas = res && res[0] && res[0].node

          if (!canvas) {
            reject(new Error('canvas not found'))
            return
          }

          resolve({
            canvas,
            ctx: canvas.getContext('2d'),
          })
        })
    })
  },

  renderWatermark(canvas, ctx) {
    return this.loadCanvasImage(canvas, this.data.originalPath)
      .then((image) => {
        const targetResult = getTargetSize(this.data.imageInfo)
        if (!targetResult.ok) return Promise.reject(new Error(targetResult.errorMessage))
        const target = targetResult.data

        canvas.width = target.width
        canvas.height = target.height

        ctx.clearRect(0, 0, target.width, target.height)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, target.width, target.height)
        ctx.drawImage(image, 0, 0, this.data.imageInfo.width, this.data.imageInfo.height, 0, 0, target.width, target.height)
        if (!this.drawRepeatedWatermark(ctx, target)) return Promise.reject(new Error('invalid watermark layout'))

        return this.exportImage(canvas, target)
      })
  },

  loadCanvasImage(canvas, src) {
    return new Promise((resolve, reject) => {
      const image = canvas.createImage()

      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = src
    })
  },

  drawRepeatedWatermark(ctx, target) {
    const lines = normalizeWatermarkText(this.data.watermarkText)
    const opacityResult = getOpacity(this.data.opacityId)
    if (!opacityResult.ok) return false
    const layoutResult = getWatermarkLayout({ target, lines, opacity: opacityResult.data })
    if (!layoutResult.ok) return false
    const { opacity, fontSize, lineHeight, blockHeight, stepX, stepY, diagonal } = layoutResult.data

    ctx.save()
    ctx.globalAlpha = opacity
    ctx.fillStyle = '#1f2d35'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `500 ${fontSize}px sans-serif`
    ctx.rotate(-Math.PI / 6)

    for (let x = -diagonal; x <= diagonal * 1.4; x += stepX) {
      for (let y = -diagonal; y <= diagonal * 1.4; y += stepY) {
        lines.forEach((line, index) => {
          ctx.fillText(line, x, y + index * lineHeight - blockHeight / 2)
        })
      }
    }

    ctx.restore()
    return true
  },

  exportImage(canvas, target) {
    return new Promise((resolve, reject) => {
      wx.canvasToTempFilePath({
        canvas,
        destWidth: target.width,
        destHeight: target.height,
        fileType: 'jpg',
        quality: 0.96,
        success: (res) => {
          this.getFileSize(res.tempFilePath)
            .then((size) => {
              resolve({
                path: res.tempFilePath,
                size,
                width: target.width,
                height: target.height,
              })
            })
            .catch(reject)
        },
        fail: reject,
      }, this)
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

  onPreviewResult() {
    if (!this.data.outputPath) return

    wx.previewImage({
      current: this.data.outputPath,
      urls: [this.data.outputPath],
    })
  },

  onSave() {
    if (!this.data.outputPath) {
      wx.showToast({
        title: '请先生成图片',
        icon: 'none',
      })
      return
    }

    if (this.data.isSaving) return

    this.setData({
      isSaving: true,
    })

    saveImageToAlbum({
      filePath: this.data.outputPath,
      permissionText: '打开权限后就能保存加水印后的图片。',
    })
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
      title: '证件照和材料图加用途水印，降低被挪用风险',
      path: '/packageTools/pages/image-watermark/image-watermark',
    }
  },

  onShareTimeline() {
    return {
      title: '图片加水印工具：给证件和材料图标注用途',
      query: '',
    }
  },
}))
