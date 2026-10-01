Component({
  properties: {
    favorite: {
      type: Boolean,
      value: false,
    },
  },

  methods: {
    onTap() {
      this.triggerEvent('toggle')
    },
  },
})
