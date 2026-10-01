/**
 * 工具卡片
 *
 * 首页九宫格与工具页列表共用同一组件，避免工具清单样式在多处重复。
 * mode: grid（图标宫格） | list（横向列表）
 */

Component({
  properties: {
    tool: {
      type: Object,
      value: null,
    },
    mode: {
      type: String,
      value: 'grid',
    },
  },

  data: {
    pressed: false,
  },

  methods: {
    onPressStart() {
      this.setData({ pressed: true })
    },

    onPressEnd() {
      this.setData({ pressed: false })
    },

    onTap() {
      this.triggerEvent('tap', { tool: this.data.tool })
    },
  },
})
