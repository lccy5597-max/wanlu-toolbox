// app.js
const { brand, features } = require('./config/app')
const userData = require('./services/user-data')

App({
  globalData: {
    brand,
    features,
  },

  onLaunch() {
    // Stage 3 本地数据初始化/迁移：纯本地、无权限、失败不阻断小程序启动。
    userData.initialize()
    this.checkUpdate()
  },

  // 小程序版本更新提示，避免用户长期停留在旧版本
  checkUpdate() {
    if (typeof wx.getUpdateManager !== 'function') return

    const updateManager = wx.getUpdateManager()

    updateManager.onCheckForUpdate(() => {})

    updateManager.onUpdateReady(() => {
      wx.showModal({
        title: '更新提示',
        content: '新版本已经准备好，是否重启应用？',
        confirmText: '重启',
        success: (res) => {
          if (res.confirm) {
            updateManager.applyUpdate()
          }
        },
      })
    })

    updateManager.onUpdateFailed(() => {})
  },
})
