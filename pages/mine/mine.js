// pages/mine/mine.js
const appConfig = require('../../config/app')
const { getToolById } = require('../../utils/tool-catalog')
const userData = require('../../services/user-data')

const dataEntries = [
  { id: 'favorites', title: '我的收藏', desc: '常用工具集中管理', icon: 'star', tone: 'amber', iconColor: '#9a6a19', path: '/packageUser/pages/favorites/favorites' },
  { id: 'history', title: '浏览记录', desc: '查看最近打开过的工具', icon: 'time', tone: 'sky', iconColor: '#2d6895', path: '/packageUser/pages/history/history' },
  { id: 'recent', title: '最近使用', desc: '只显示真正使用成功的工具', icon: 'app', tone: 'mint', iconColor: '#2f7567', path: '/packageUser/pages/recent/recent' },
  { id: 'data', title: '数据管理', desc: '管理本机收藏、记录和偏好', icon: 'setting', tone: 'deep', iconColor: '#24584d', path: '/packageUser/pages/data-management/data-management' },
]

const serviceEntries = [
  {
    id: 'guide',
    title: '使用指南',
    desc: '快速了解工具怎么用',
    icon: 'book-open',
    tone: 'deep',
    iconColor: '#24584d',
    type: 'page',
  },
  {
    id: 'about',
    title: '关于我们',
    desc: `版本 ${appConfig.brand.version}`,
    icon: 'info-circle',
    tone: 'green',
    iconColor: '#3f7a4b',
    type: 'about',
  },
]

Page({
  data: {
    brand: appConfig.brand,
    dataEntries,
    serviceEntries,
    summary: { favorites: 0, history: 0, recent: 0 },
  },

  onShow() {
    this.setData({ summary: userData.getSummary() })
  },

  onDataEntryTap(event) {
    const { path } = event.currentTarget.dataset
    if (!path) return
    wx.navigateTo({
      url: path,
      fail: () => wx.showToast({ title: '打开失败，请稍后重试', icon: 'none' }),
    })
  },

  onItemTap(event) {
    const { item } = event.currentTarget.dataset
    const target = item || {}

    if (target.type === 'page') {
      const guide = getToolById('guide')

      if (!guide || !guide.path) {
        wx.showToast({ title: '入口配置异常，请稍后重试', icon: 'none' })
        return
      }

      wx.navigateTo({
        url: guide.path,
        fail: () => wx.showToast({ title: '打开失败，请稍后重试', icon: 'none' }),
      })
      return
    }

    if (target.type === 'about') {
      this.showAbout()
    }
  },

  showAbout() {
    wx.showModal({
      title: appConfig.brand.name,
      content: `${appConfig.brand.nameEn}\n版本 ${appConfig.brand.version}\n${appConfig.brand.desc}`,
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#2b7a68',
    })
  },

  onShareAppMessage() {
    return {
      title: `${appConfig.brand.name}：${appConfig.brand.slogan}`,
      path: '/pages/index/index',
    }
  },
})
