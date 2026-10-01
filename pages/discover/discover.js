// pages/discover/discover.js
const appConfig = require('../../config/app')
const discovery = require('../../services/discovery')
const { buildDiscoveryViewModel } = require('../../utils/discovery-view-model')

const app = getApp()

const readDiscoveryList = (getter, options, errorState) => {
  try {
    const result = getter(options)
    return Array.isArray(result) ? result : []
  } catch (error) {
    errorState.failed = true
    console.error('[discover] local discovery read failed', error)
    return []
  }
}

Page({
  data: {
    brand: appConfig.brand,
    isLoading: true,
    hasError: false,
    mode: 'empty',
    behaviorCount: 0,
    toolSections: [],
    categories: [],
  },

  onShow() {
    this.refreshDiscovery()
  },

  refreshDiscovery() {
    const errorState = { failed: false }
    const frequent = readDiscoveryList(discovery.getFrequentTools, { limit: 4 }, errorState)
    const recent = readDiscoveryList(discovery.getRecentDiscoveryTools, { limit: 4 }, errorState)
    const favorites = readDiscoveryList(discovery.getFavoriteDiscoveryTools, { limit: 4 }, errorState)
    const featured = readDiscoveryList(discovery.getFeaturedTools, { limit: 8 }, errorState)
    const recommended = readDiscoveryList(discovery.getRecommendedTools, { limit: 12 }, errorState)
    const viewModel = buildDiscoveryViewModel({ frequent, recent, favorites, featured, recommended })

    this.setData({
      ...viewModel,
      isLoading: false,
      hasError: errorState.failed,
    })
  },

  onRetry() {
    this.refreshDiscovery()
  },

  onToolTap(event) {
    const { tool } = event.detail || {}
    if (!tool || !tool.path) {
      console.error('[discover] invalid tool navigation target', tool)
      wx.showToast({ title: '工具配置异常，请稍后重试', icon: 'none' })
      return
    }

    wx.navigateTo({
      url: tool.path,
      fail: () => wx.showToast({ title: '打开失败，请稍后重试', icon: 'none' }),
    })
  },

  onCategoryTap() {
    if (app && app.globalData) app.globalData.toolsKeyword = ''
    wx.switchTab({ url: '/pages/tools/tools' })
  },

  onShareAppMessage() {
    return {
      title: `${appConfig.brand.name} · 发现`,
      path: '/pages/discover/discover',
    }
  },
})
