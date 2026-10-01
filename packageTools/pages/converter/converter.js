const { withToolPage } = require('../../../behaviors/tool-page')
const { categoryTabs, convertValue, unitGroups } = require('../../../utils/tool-logic/converter')

const getCategoryState = (category, fromValue = '') => {
  const group = unitGroups[category]
  const [fromUnitIndex, toUnitIndex] = group.defaults
  const fromUnit = group.units[fromUnitIndex]
  const toUnit = group.units[toUnitIndex]

  return {
    unitOptions: group.units,
    commonRows: group.commonRows,
    fromUnitIndex,
    toUnitIndex,
    fromUnitName: fromUnit.label,
    fromUnitSymbol: fromUnit.symbol,
    toUnitName: toUnit.label,
    toUnitSymbol: toUnit.symbol,
    fromValue,
    toValue: '--',
  }
}

Page(withToolPage('converter', {
  data: {
    categoryTabs,
    activeCategory: 'length',
    ...getCategoryState('length'),
  },

  applySafeToolState(state) {
    const category = state && state.activeCategory
    if (!category || !unitGroups[category]) return
    this.setData({
      activeCategory: category,
      ...getCategoryState(category, this.data.fromValue),
    })
  },

  onCategoryTap(event) {
    const { value } = event.currentTarget.dataset
    this.updateSafeToolState({ activeCategory: value })

    this.setData({
      activeCategory: value,
      ...getCategoryState(value, this.data.fromValue),
    }, () => {
      this.calculate()
    })
  },

  onValueInput(event) {
    const fromValue = event.detail.value
    if (fromValue === '') this._usageRecordedForInput = false
    this.setData({
      fromValue,
    }, () => {
      this.calculate()
    })
  },

  onFromUnitChange(event) {
    this.setData({
      fromUnitIndex: Number(event.detail.value),
    }, () => {
      this.updateUnitMeta()
      this.calculate()
    })
  },

  onToUnitChange(event) {
    this.setData({
      toUnitIndex: Number(event.detail.value),
    }, () => {
      this.updateUnitMeta()
      this.calculate()
    })
  },

  onSwapTap() {
    const { fromUnitIndex, toUnitIndex, toValue } = this.data
    const nextValue = toValue !== '--' ? toValue : this.data.fromValue

    this.setData({
      fromUnitIndex: toUnitIndex,
      toUnitIndex: fromUnitIndex,
      fromValue: nextValue,
    }, () => {
      this.updateUnitMeta()
      this.calculate()
    })
  },

  onClearTap() {
    this._usageRecordedForInput = false
    this.setData({
      fromValue: '',
      toValue: '--',
    })
  },

  updateUnitMeta() {
    const group = unitGroups[this.data.activeCategory]
    const fromUnit = group.units[this.data.fromUnitIndex]
    const toUnit = group.units[this.data.toUnitIndex]

    this.setData({
      fromUnitName: fromUnit.label,
      fromUnitSymbol: fromUnit.symbol,
      toUnitName: toUnit.label,
      toUnitSymbol: toUnit.symbol,
    })
  },

  calculate() {
    const result = convertValue({
      category: this.data.activeCategory,
      value: this.data.fromValue,
      fromUnitIndex: this.data.fromUnitIndex,
      toUnitIndex: this.data.toUnitIndex,
    })

    if (!result.ok) {
      this.setData({
        toValue: '--',
      })
      return
    }

    this.setData({
      toValue: result.data.formatted,
    })

    if (!this._usageRecordedForInput) {
      this._usageRecordedForInput = true
      this.recordToolUse()
    }
  },

  onShareAppMessage() {
    return {
      title: '长度、面积、重量、温度，常用单位快速换算',
      path: '/packageTools/pages/converter/converter',
    }
  },

  onShareTimeline() {
    return {
      title: '单位换算工具：常用数据一键换算',
      query: '',
    }
  },
}))
