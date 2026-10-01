const userData = require('../../../services/user-data')
const actions = [
  { id:'favorites',title:'清空收藏',desc:'取消本机全部有效收藏',danger:false },
  { id:'history',title:'清空浏览记录',desc:'删除本机工具浏览记录',danger:false },
  { id:'recent',title:'清空最近使用',desc:'隐藏最近使用，不影响长期使用次数',danger:false },
  { id:'usage',title:'清空全部使用数据',desc:'重置工具成功使用次数与使用时间',danger:true },
  { id:'state',title:'清空工具偏好',desc:'恢复压缩档位等非敏感本地偏好',danger:false },
  { id:'all',title:'清空全部本地数据',desc:'清除收藏、记录、统计和工具偏好',danger:true },
]
Page({
  data:{actions,summary:{favorites:0,history:0,recent:0}}, onShow(){this.refresh()}, refresh(){this.setData({summary:userData.getSummary()})},
  onActionTap(e){const{id}=e.currentTarget.dataset,action=actions.find((x)=>x.id===id);if(!action)return;wx.showModal({title:action.title,content:id==='all'?'仅清除本机挽鹿工具箱保存的收藏、浏览记录、最近使用及工具偏好，不会删除手机相册中的图片或视频。':`确定${action.title}吗？${action.desc}。`,confirmText:'确认清除',confirmColor:'#c44736',success:(res)=>{if(!res.confirm)return;const r=this.executeAction(id);if(r&&r.ok){this.refresh();wx.showToast({title:'已清除',icon:'success'})}else wx.showToast({title:'清除失败，请重试',icon:'none'})}})},
  executeAction(id){if(id==='favorites')return userData.favorites.clearFavorites();if(id==='history')return userData.history.clearHistory();if(id==='recent')return userData.usage.clearRecent();if(id==='usage')return userData.usage.clearUsage();if(id==='state')return userData.toolState.clearAllToolState();if(id==='all')return userData.clearAllLocalData();return{ok:false}},
})
