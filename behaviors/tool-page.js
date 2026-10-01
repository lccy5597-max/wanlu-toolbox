const favorites = require('../services/favorites')
const history = require('../services/history')
const usage = require('../services/tool-usage')
const toolState = require('../services/tool-state')

const toolPageMethods = {
  getToolId() {
    return this.__wlToolId || (this.data && this.data.__wlToolId) || ''
  },

  refreshToolFavorite() {
    const toolId = this.getToolId()
    if (!toolId) return false
    const favorite = favorites.isFavorite(toolId)
    this.setData({ toolFavorite: favorite })
    return favorite
  },

  onToggleToolFavorite() {
    const toolId = this.getToolId()
    if (!toolId) return
    const result = favorites.toggleFavorite(toolId)
    if (!result.ok) {
      wx.showToast({
        title: result.reason === 'limit_reached' ? '收藏数量已达上限' : '收藏状态保存失败',
        icon: 'none',
      })
      return
    }
    this.setData({ toolFavorite: Boolean(result.favorite) })
  },

  getSafeToolState() {
    const toolId = this.getToolId()
    return toolId ? toolState.getToolState(toolId) : {}
  },

  updateSafeToolState(patch) {
    const toolId = this.getToolId()
    if (!toolId) return { ok: false, reason: 'invalid_id' }
    return toolState.setToolState(toolId, patch)
  },

  clearSafeToolState() {
    const toolId = this.getToolId()
    if (!toolId) return { ok: false, reason: 'invalid_id' }
    return toolState.clearToolState(toolId)
  },

  recordToolUse() {
    const toolId = this.getToolId()
    if (!toolId) return { ok: false, reason: 'invalid_id' }
    return usage.recordToolUse(toolId)
  },
}

/**
 * 给正式工具页统一注入：浏览记录、收藏状态和安全偏好恢复。
 * 工具页只需声明 toolId；核心操作成功后调用 this.recordToolUse()。
 */
const withToolPage = (toolId, options = {}) => {
  const id = String(toolId || '').trim()
  if (!id) throw new Error('withToolPage requires toolId')

  const originalOnLoad = options.onLoad

  return {
    ...toolPageMethods,
    ...options,
    data: {
      ...(options.data || {}),
      __wlToolId: id,
      toolFavorite: false,
    },
    onLoad(query) {
      this.__wlToolId = id
      history.recordView(id)
      this.setData({ toolFavorite: favorites.isFavorite(id) })

      if (typeof originalOnLoad === 'function') {
        originalOnLoad.call(this, query)
      }

      const safeState = toolState.getToolState(id)
      if (typeof this.applySafeToolState === 'function') {
        this.applySafeToolState(safeState)
      }
    },
  }
}

module.exports = {
  toolPageMethods,
  withToolPage,
}
