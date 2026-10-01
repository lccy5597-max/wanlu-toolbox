const favorites = require('../../../services/favorites')
const { getToolById } = require('../../../utils/tool-catalog')

const toItem = (record) => {
  const tool = getToolById(record.entityId)
  if (!tool || tool.enabled === false) return null
  return { ...tool, favoriteUpdatedAt: record.updatedAt }
}

Page({
  data: { items: [] },
  onShow() { this.refresh() },
  refresh() { this.setData({ items: favorites.getFavorites().map(toItem).filter(Boolean) }) },
  onToolTap(event) { const { path } = event.currentTarget.dataset; if (path) wx.navigateTo({ url: path }) },
  onRemove(event) {
    const result = favorites.removeFavorite(event.currentTarget.dataset.id)
    if (result.ok) this.refresh()
    else wx.showToast({ title: '取消收藏失败', icon: 'none' })
  },
  onClear() {
    if (!this.data.items.length) return
    wx.showModal({ title: '清空收藏', content: '确定清空全部收藏吗？', confirmText: '清空', confirmColor: '#c44736', success: (res) => {
      if (!res.confirm) return
      const result = favorites.clearFavorites()
      if (result.ok) this.refresh(); else wx.showToast({ title: '清空失败', icon: 'none' })
    } })
  },
})
