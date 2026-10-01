const usage = require('../../../services/tool-usage')
const { getToolById } = require('../../../utils/tool-catalog')
const pad = (v) => String(v).padStart(2, '0')
const formatTime = (timestamp) => {
  const time = Number(timestamp) || 0; if (!time) return ''
  const diff = Math.max(0, Date.now() - time)
  if (diff < 60000) return '刚刚'; if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  const date = new Date(time), today = new Date()
  if (date.toDateString() === today.toDateString()) return `今天 ${pad(date.getHours())}:${pad(date.getMinutes())}`
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
Page({
  data:{items:[]}, onShow(){this.refresh()},
  refresh(){this.setData({items:usage.getRecentTools(100).map((r)=>{const t=getToolById(r.toolId);return !t||t.enabled===false?null:{...t,useCount:r.useCount,timeText:formatTime(r.lastUsedAt)}}).filter(Boolean)})},
  onToolTap(e){const{path}=e.currentTarget.dataset;if(path)wx.navigateTo({url:path})},
  onClear(){if(!this.data.items.length)return;wx.showModal({title:'清空最近使用',content:'只清空最近使用列表，不会删除工具的长期使用次数。',confirmText:'清空',confirmColor:'#c44736',success:(res)=>{if(!res.confirm)return;const r=usage.clearRecent();if(r.ok)this.refresh();else wx.showToast({title:'清空失败',icon:'none'})}})},
})
