/**
 * 区块标题
 * 统一首页、工具页、发现页、我的页的「标题 + 更多」样式
 */
Component({
  properties: {
    title: {
      type: String,
      value: '',
    },
    subtitle: {
      type: String,
      value: '',
    },
    moreText: {
      type: String,
      value: '',
    },
    showMore: {
      type: Boolean,
      value: false,
    },
  },

  methods: {
    onMoreTap() {
      this.triggerEvent('more')
    },
  },
})
