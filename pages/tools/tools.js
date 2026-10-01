// pages/tools/tools.js
const { getCategories, getHotTools, tools: formalTools } = require('../../utils/tool-catalog')
const { normalizeSearchText, searchTools } = require('../../utils/tool-search')
const appConfig = require('../../config/app')

const app = getApp()

Page({
  data: {
    categories: [],
    activeCategory: 'all',
    keyword: '',
    inputKeyword: '',
    tools: [],
    hotCount: 0,
    totalCount: 0,
  },

  onLoad(options) {
    const inputKeyword = String((options && options.keyword) || '')
    const keyword = normalizeSearchText(inputKeyword)

    this.setData({
      categories: getCategories(),
      keyword,
      inputKeyword,
    })

    this.applyFilter()
  },

  onShow() {
    // 首页通过 globalData 传递搜索关键词
    if (app && app.globalData && typeof app.globalData.toolsKeyword === 'string') {
      const inputKeyword = app.globalData.toolsKeyword
      const keyword = normalizeSearchText(inputKeyword)

      app.globalData.toolsKeyword = ''

      this.setData({
        keyword,
        inputKeyword,
      })

      this.applyFilter()
    }
  },

  applyFilter() {
    const { activeCategory, keyword } = this.data
    const categoryTools = activeCategory === 'all'
      ? formalTools
      : formalTools.filter((tool) => tool.category === activeCategory)
    const visibleTools = searchTools(categoryTools, keyword)

    this.setData({
      tools: visibleTools,
      totalCount: visibleTools.length,
      hotCount: getHotTools().length,
    })
  },

  onCategoryTap(event) {
    const { id } = event.currentTarget.dataset

    if (!id || id === this.data.activeCategory) return

    this.setData({
      activeCategory: id,
    })

    this.applyFilter()
  },

  onSearchInput(event) {
    const inputKeyword = String((event.detail && event.detail.value) || '')
    const keyword = normalizeSearchText(inputKeyword)

    this.setData({
      keyword,
      inputKeyword,
    })

    this.applyFilter()
  },

  onSearchClear() {
    this.setData({
      keyword: '',
      inputKeyword: '',
    })

    this.applyFilter()
  },

  onToolTap(event) {
    const { tool } = event.detail || {}

    if (!tool) return

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

  onShareAppMessage() {
    return {
      title: '挽鹿工具箱：常用工具都在这里',
      path: '/pages/tools/tools',
    }
  },
})
