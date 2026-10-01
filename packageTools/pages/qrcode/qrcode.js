const { isSaveCancel, saveImageToAlbum } = require('../../../utils/image-save')
const { chooseImages } = require('../../../utils/image-picker')
const { withToolPage } = require('../../../behaviors/tool-page')
const {
  EXPORT_SIZE,
  QUIET_ZONE,
  getLogoPlan,
  getMatrixPlan,
  prepareQrModel,
} = require('../../../utils/tool-logic/qrcode')

/**
 * 二维码生成
 *
 * 生成算法使用自研 utils/qrcode.js，不依赖第三方组件的私有属性。
 *
 * 渲染策略与其他图片工具保持一致：
 * 预览区只用普通 <image>（随页面滚动、不会被裁切），
 * 真正的绘制发生在一个固定定位的离屏 Canvas 上，
 * 画完后通过 canvasToTempFilePath 导出图片再展示/保存。
 * 这样可以规避 Canvas 2D 在 scroll-view 内的定位/DPR 兼容问题。
 */
const CANVAS_ID = '#exportCanvas'
const QR_COLOR = '#142a25'
const QR_BACKGROUND = '#ffffff'

Page(withToolPage('qrcode', {
  data: {
    inputValue: '',
    logoPath: '',
    hasGenerated: false,
    isRendering: false,
    isSaving: false,
    previewPath: '',
    qrVersion: '',
    qrEcc: '',
  },

  onUnload() {
    this._renderTaskId = (this._renderTaskId || 0) + 1
    this.exportCanvas = null
    this.exportCtx = null
    this.qrModel = null
  },

  onInput(event) {
    this._renderTaskId = (this._renderTaskId || 0) + 1
    this.qrModel = null
    this.setData({
      inputValue: event.detail.value || '',
      hasGenerated: false,
      isRendering: false,
      previewPath: '',
      qrVersion: '',
      qrEcc: '',
    })
  },

  onClearInput() {
    this._renderTaskId = (this._renderTaskId || 0) + 1
    this.qrModel = null
    this.setData({
      inputValue: '',
      hasGenerated: false,
      isRendering: false,
      previewPath: '',
      qrVersion: '',
      qrEcc: '',
    })
  },

  onGenerate() {
    if (this.data.isRendering) return

    const prepared = prepareQrModel(this.data.inputValue)
    if (!prepared.ok) {
      wx.showToast({
        title: prepared.errorMessage,
        icon: 'none',
      })
      return
    }

    const model = prepared.data.model
    const renderTaskId = (this._renderTaskId || 0) + 1
    this._renderTaskId = renderTaskId

    this.qrModel = model
    this.setData({
      hasGenerated: true,
      isRendering: true,
      previewPath: '',
      qrVersion: String(model.version),
      qrEcc: model.ecc,
    }, () => {
      this.renderExport(renderTaskId)
    })
  },

  // 重新生成：与生成共用逻辑，总是按当前输入重画
  onRegenerate() {
    this.onGenerate()
  },

  onChooseLogo() {
    if (this.data.isRendering) return

    chooseImages({
      sizeType: ['compressed'],
    }).then((files) => {
      const file = files[0]

      if (!file || !file.tempFilePath) return

      const shouldRender = this.data.hasGenerated
      const renderTaskId = shouldRender ? (this._renderTaskId || 0) + 1 : this._renderTaskId
      if (shouldRender) this._renderTaskId = renderTaskId

      this.setData({
        logoPath: file.tempFilePath,
        isRendering: shouldRender,
        previewPath: shouldRender ? '' : this.data.previewPath,
      }, () => {
        if (shouldRender) this.renderExport(renderTaskId)
      })
    }).catch(() => {
      // 选择失败无需处理，用户可见系统默认反馈
    })
  },

  onRemoveLogo() {
    if (this.data.isRendering) return

    const shouldRender = this.data.hasGenerated
    const renderTaskId = shouldRender ? (this._renderTaskId || 0) + 1 : this._renderTaskId
    if (shouldRender) this._renderTaskId = renderTaskId

    this.setData({
      logoPath: '',
      isRendering: shouldRender,
      previewPath: shouldRender ? '' : this.data.previewPath,
    }, () => {
      if (shouldRender) this.renderExport(renderTaskId)
    })
  },

  /** 获取（并缓存）离屏画布；固定 900px 缓冲，与屏幕 DPR 无关 */
  ensureExportCanvas() {
    if (this.exportCanvas && this.exportCtx) {
      return Promise.resolve({ canvas: this.exportCanvas, ctx: this.exportCtx })
    }

    return new Promise((resolve, reject) => {
      this.createSelectorQuery()
        .select(CANVAS_ID)
        .fields({ node: true })
        .exec((res) => {
          const canvas = res && res[0] && res[0].node

          if (!canvas) {
            reject(new Error('canvas not ready'))
            return
          }

          canvas.width = EXPORT_SIZE
          canvas.height = EXPORT_SIZE
          this.exportCanvas = canvas
          this.exportCtx = canvas.getContext('2d')
          resolve({ canvas: this.exportCanvas, ctx: this.exportCtx })
        })
    })
  },

  /** 重画离屏画布并导出预览图 */
  renderExport(renderTaskId) {
    const model = this.qrModel

    if (!model || renderTaskId !== this._renderTaskId) return

    this.ensureExportCanvas()
      .then(({ canvas, ctx }) => {
        if (renderTaskId !== this._renderTaskId) return
        if (!this.drawMatrix(ctx, EXPORT_SIZE)) throw new Error('invalid qr render plan')

        const finish = () => this.exportPreview(canvas, renderTaskId)

        if (!this.data.logoPath || typeof canvas.createImage !== 'function') {
          finish()
          return
        }

        const logoPlan = getLogoPlan(EXPORT_SIZE)
        if (!logoPlan.ok) throw new Error(logoPlan.errorMessage)
        const { logoSize, padding, boxSize, left } = logoPlan.data
        const image = canvas.createImage()

        image.onload = () => {
          if (renderTaskId !== this._renderTaskId) return
          // 先用白色底衬把中间码点盖住，再画 logo
          ctx.fillStyle = QR_BACKGROUND
          ctx.fillRect(left, left, boxSize, boxSize)
          ctx.drawImage(image, left + padding, left + padding, logoSize, logoSize)
          finish()
        }

        image.onerror = () => {
          if (renderTaskId !== this._renderTaskId) return
          // logo 加载失败时保留已绘制好的二维码本体
          finish()
        }

        image.src = this.data.logoPath
      })
      .catch(() => {
        if (renderTaskId !== this._renderTaskId) return
        this.setData({
          isRendering: false,
          hasGenerated: false,
        })
        wx.showToast({
          title: '画布初始化失败，请重试',
          icon: 'none',
        })
      })
  },

  /** 绘制二维码矩阵（含静默区），坐标系为 0..EXPORT_SIZE */
  drawMatrix(ctx, pixelSize) {
    const model = this.qrModel

    if (!model) return false
    const planResult = getMatrixPlan(model, pixelSize)
    if (!planResult.ok) return false
    const { scale, offset } = planResult.data

    ctx.fillStyle = QR_BACKGROUND
    ctx.fillRect(0, 0, pixelSize, pixelSize)
    ctx.fillStyle = QR_COLOR

    for (let y = 0; y < model.size; y += 1) {
      for (let x = 0; x < model.size; x += 1) {
        if (!model.modules[y][x]) continue

        ctx.fillRect(offset + (x + QUIET_ZONE) * scale, offset + (y + QUIET_ZONE) * scale, scale, scale)
      }
    }
    return true
  },

  /** 导出临时图片并刷新预览 */
  exportPreview(canvas, renderTaskId) {
    new Promise((resolve, reject) => {
      wx.canvasToTempFilePath({
        canvas,
        destWidth: EXPORT_SIZE,
        destHeight: EXPORT_SIZE,
        fileType: 'png',
        success: (res) => resolve(res.tempFilePath),
        fail: reject,
      }, this)
    }).then((filePath) => {
      if (renderTaskId !== this._renderTaskId) return
      this.setData({
        previewPath: filePath,
        isRendering: false,
      })
      this.recordToolUse()
    }).catch(() => {
      if (renderTaskId !== this._renderTaskId) return
      this.setData({
        isRendering: false,
        hasGenerated: false,
      })
      wx.showToast({
        title: '生成图片失败，请重试',
        icon: 'none',
      })
    })
  },

  onSave() {
    if (!this.data.hasGenerated || !this.data.previewPath) {
      wx.showToast({
        title: '请先生成二维码',
        icon: 'none',
      })
      return
    }

    if (this.data.isSaving || this.data.isRendering) return

    this.setData({
      isSaving: true,
    })

    saveImageToAlbum({
      filePath: this.data.previewPath,
      permissionText: '打开权限后就能保存二维码图片。',
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
          title: (error && error.userMessage) || '保存失败',
          icon: 'none',
        })
      })
  },

  onShareAppMessage() {
    return {
      title: '文字或链接快速生成二维码，还能加 logo',
      path: '/packageTools/pages/qrcode/qrcode',
    }
  },

  onShareTimeline() {
    return {
      title: '二维码生成工具：文字、链接一键转二维码',
      query: '',
    }
  },
}))
