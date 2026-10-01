const { withToolPage } = require('../../../behaviors/tool-page')
const { buildCompareState, compareModes, modeTabs } = require('../../../utils/tool-logic/price-compare')

const getUnitOptions = (mode) => compareModes[mode].units

const createItem = (mode = 'weight') => {
  const unit = getUnitOptions(mode)[0]

  return {
    id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    price: '',
    amount: '',
    unitIndex: 0,
    unitName: unit.label,
    unitSymbol: unit.symbol,
    unitPrice: 0,
    unitPriceText: '--',
    amountText: '填写后自动换算',
    savingText: '',
    hasValid: false,
    isBest: false,
  }
}

const getInitialItems = () => [
  createItem(),
  createItem(),
]

Page(withToolPage('price-compare', {
  data: {
    modeTabs,
    activeMode: 'weight',
    unitOptions: getUnitOptions('weight'),
    unitTargetText: compareModes.weight.unitTargetText,
    items: getInitialItems(),
    comparedCount: 0,
    hasResult: false,
    resultTitle: '至少填写 2 个商品的价格和规格',
    resultSummary: '',
    resultRows: [
      { label: '最低单价', value: '--' },
      { label: '相比第二名', value: '--' },
    ],
  },

  onModeTap(event) {
    const { value } = event.currentTarget.dataset

    if (!value || value === this.data.activeMode) return

    const mode = compareModes[value]
    const firstUnit = mode.units[0]
    const items = this.data.items.map((item) => ({
      ...item,
      unitIndex: 0,
      unitName: firstUnit.label,
      unitSymbol: firstUnit.symbol,
    }))

    this.setData(this.getCompareState(value, items))
  },

  onNameInput(event) {
    this.updateItem(event.currentTarget.dataset.id, {
      name: event.detail.value,
    })
  },

  onPriceInput(event) {
    this.updateItem(event.currentTarget.dataset.id, {
      price: event.detail.value,
    })
  },

  onAmountInput(event) {
    this.updateItem(event.currentTarget.dataset.id, {
      amount: event.detail.value,
    })
  },

  onUnitChange(event) {
    const unitIndex = Number(event.detail.value)
    const unit = this.data.unitOptions[unitIndex]

    this.updateItem(event.currentTarget.dataset.id, {
      unitIndex,
      unitName: unit.label,
      unitSymbol: unit.symbol,
    })
  },

  updateItem(id, patch) {
    const items = this.data.items.map((item) => (
      item.id === id ? { ...item, ...patch } : item
    ))
    const nextState = this.getCompareState(this.data.activeMode, items)
    const becameReady = nextState.hasResult && !this.data.hasResult

    this.setData(nextState)
    if (becameReady) this.recordToolUse()
  },

  onAddItem() {
    if (this.data.items.length >= 6) {
      wx.showToast({
        title: '最多比较 6 个商品',
        icon: 'none',
      })
      return
    }

    const items = [
      ...this.data.items,
      createItem(this.data.activeMode),
    ]

    this.setData(this.getCompareState(this.data.activeMode, items))
  },

  onRemoveItem(event) {
    if (this.data.items.length <= 2) {
      wx.showToast({
        title: '至少保留 2 个商品',
        icon: 'none',
      })
      return
    }

    const { id } = event.currentTarget.dataset
    const items = this.data.items.filter((item) => item.id !== id)

    this.setData(this.getCompareState(this.data.activeMode, items))
  },

  onReset() {
    this.setData(this.getCompareState(this.data.activeMode, getInitialItems()))
  },

  getCompareState(activeMode, sourceItems) {
    const result = buildCompareState(activeMode, sourceItems)
    if (result.ok) return result.data

    return {
      activeMode,
      unitOptions: getUnitOptions(activeMode),
      unitTargetText: compareModes[activeMode].unitTargetText,
      items: sourceItems,
      comparedCount: 0,
      hasResult: false,
      resultTitle: result.errorMessage,
      resultSummary: '',
      resultRows: [
        { label: '最低单价', value: '--' },
        { label: '相比第二名', value: '--' },
      ],
    }
  },

  onShareAppMessage() {
    return {
      title: '同类商品哪个更划算？填价格和规格算单价',
      path: '/packageTools/pages/price-compare/price-compare',
    }
  },

  onShareTimeline() {
    return {
      title: '比价计算器：快速比较哪个规格更便宜',
      query: '',
    }
  },
}))
