const history = require('../../../services/history')
const { getToolById } = require('../../../utils/tool-catalog')
const pad = (v) => String(v).padStart(2, '0')
const formatTime = (timestamp) => {
  const time = Number(timestamp) || 0; if (!time) return ''
  const now = Date.now(), diff = Math.max(0, now - time)
  if (diff < 60000) return '刚刚'; if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  const date = new Date(time), today = new Date(now)
  if (date.toDateString() === today.toDateString()) return `今天 ${pad(date.getHours())}:${pad(date.getMinutes())}`
  const yesterday = new Date(now - 86400000)
  if (date.toDateString() === yesterday.toDateString()) return `昨天 ${pad(date.getHours())}:${pad(date.getMinutes())}`
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
Page({
  data:{items:[]}, onShow(){this.refresh()},
  refresh(){this.setData({items:history.getHistory().map((r)=>{const t=getToolById(r.entityId);return !t||t.enabled===false?null:{...t,viewCount:r.viewCount,timeText:formatTime(r.lastViewedAt)}}).filter(Boolean)})},
  onToolTap(e){const{path}=e.currentTarget.dataset;if(path)wx.navigateTo({url:path})},
  onRemove(e){const r=history.removeHistory(e.currentTarget.dataset.id);if(r.ok)this.refresh();else wx.showToast({title:'删除失败',icon:'none'})},
  onClear(){if(!this.data.items.length)return;wx.showModal({title:'清空浏览记录',content:'确定清空全部浏览记录吗？',confirmText:'清空',confirmColor:'#c44736',success:(res)=>{if(!res.confirm)return;const r=history.clearHistory();if(r.ok)this.refresh();else wx.showToast({title:'清空失败',icon:'none'})}})},
})
