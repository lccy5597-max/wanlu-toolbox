/**
 * 空状态 / 占位状态
 *
 * 阶段限制：AI、GitHub、内容、会员等模块尚未接入真实服务，
 * 统一用本组件展示「暂无数据 / 空状态」，避免各页面各写一套。
 */
Component({
  properties: {
    icon: {
      type: String,
      value: 'info-circle',
    },
    iconColor: {
      type: String,
      value: '#b6c0c4',
    },
    title: {
      type: String,
      value: '暂无内容',
    },
    desc: {
      type: String,
      value: '',
    },
    size: {
      type: String,
      value: 'normal', // normal | compact
    },
  },
})
