// pages/index/index.js
const appConfig = require('../../config/app')
const {
  getHotTools,
  getQuickTools,
  getToolsByCategory,
  tools: formalTools,
} = require('../../utils/tool-catalog')
const { normalizeSearchText, searchTools } = require('../../utils/tool-search')

const app = getApp()

// 「更多工具」入口，补齐第一屏第 8 个格子
const MORE_ENTRY = {
  id: '__more',
  name: '更多工具',
  description: '查看全部工具',
  icon: 'app',
  iconColor: '#5f6d72',
  tone: 'deep',
  isMore: true,
}

Page({
  data: {
    brand: appConfig.brand,
    quickTools: [],
    hotTools: [],
    inputSearchKeyword: '',
    searchKeyword: '',
    searchResults: [],
    isSearching: false,
    imageToolCount: 0,
    calcToolCount: 0,
    totalToolCount: 0,
  },

  onLoad() {
    // tabBar 页面会复用实例，onShow 负责刷新，onLoad 只做一次静态数据准备
    this.refreshStats()
  },

  onShow() {
    // 从工具页返回时不需要重建列表，这里仅同步可能存在的使用数据
    if (!this.data.hotTools.length) {
      this.setData({
        quickTools: [...getQuickTools(), MORE_ENTRY],
        hotTools: getHotTools(6),
      })
    }
  },

  onPullDownRefresh() {
    this.refreshStats()
    wx.stopPullDownRefresh()
  },

  refreshStats() {
    this.setData({
      quickTools: [...getQuickTools(), MORE_ENTRY],
      hotTools: getHotTools(6),
      imageToolCount: getToolsByCategory('image').length,
      calcToolCount: getToolsByCategory('calc').length,
      totalToolCount: getToolsByCategory('all').length,
    })
  },

  onSearchInput(event) {
    const value = event && event.detail ? event.detail.value : ''
    this.refreshSearchResults(value)
  },

  onSearchSubmit(event) {
    const value = event && event.detail ? event.detail.value : ''
    this.refreshSearchResults(value)
  },

  onSearchClear() {
    this.refreshSearchResults('')
  },

  refreshSearchResults(value) {
    const inputSearchKeyword = String(value == null ? '' : value)
    const searchKeyword = normalizeSearchText(inputSearchKeyword)

    this.setData({
      inputSearchKeyword,
      searchKeyword,
      isSearching: Boolean(searchKeyword),
      searchResults: searchKeyword ? searchTools(formalTools, searchKeyword) : [],
    })
  },

  // tabBar 页面不能 navigateTo，这里用临时变量 + switchTab 传递关键词
  openToolsPage(keyword) {
    if (app && app.globalData) {
      app.globalData.toolsKeyword = keyword
    }

    wx.switchTab({
      url: '/pages/tools/tools',
    })
  },

  onToolTap(event) {
    const { tool } = event.detail || {}

    if (!tool) return

    if (tool.isMore) {
      this.openToolsPage('')
      return
    }

    if (!tool.path) {
      wx.showToast({
        title: '工具配置异常，请稍后重试',
        icon: 'none',
      })
      return
    }

    wx.navigateTo({
      url: tool.path,
      fail: () => {
        wx.showToast({
          title: '打开失败，请稍后重试',
          icon: 'none',
        })
      },
    })
  },

  onViewAllTools() {
    this.openToolsPage('')
  },

  onShareAppMessage() {
    return {
      title: `${appConfig.brand.name}：${appConfig.brand.slogan}`,
      path: '/pages/index/index',
    }
  },
})
