// packageGithub/pages/index/index.js
const appConfig = require('../../../config/app')

/** 预留分包首页：阶段 2 仅搭建骨架，不接任何外部服务。 */
Page({
  data: {
    brand: appConfig.brand,
  },

  onBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }

    wx.switchTab({
      url: '/pages/index/index',
    })
  },
})
