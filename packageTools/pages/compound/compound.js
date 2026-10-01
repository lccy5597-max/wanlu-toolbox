const { withToolPage } = require('../../../behaviors/tool-page')
const { calculateCompound } = require('../../../utils/tool-logic/compound')
const quickRateOptions = ['1', '3', '5', '8', '10']
const quickYearOptions = ['1', '3', '5', '10', '20']

const getDefaultResult = () => ({
  totalAssetsCompact: '--',
  totalAssets: '--',
  totalInvested: '--',
  totalProfit: '--',
  profitRate: '--',
  monthlyRate: '--',
  principalFuture: '--',
  sipFuture: '--',
  planLabel: '',
  summary: '',
})

Page(withToolPage('compound', {
  data: {
    principalValue: '',
    monthlyValue: '',
    annualRateValue: '',
    yearsValue: '',
    quickRateOptions,
    quickYearOptions,
    hasResult: false,
    result: getDefaultResult(),
  },

  updateDraft(patch) {
    this.setData({
      ...patch,
      hasResult: false,
      result: getDefaultResult(),
    })
  },

  onInput(event) {
    const { field } = event.currentTarget.dataset

    this.updateDraft({
      [field]: event.detail.value,
    })
  },

  onQuickRateTap(event) {
    this.updateDraft({
      annualRateValue: event.currentTarget.dataset.rate,
    })
  },

  onQuickYearTap(event) {
    this.updateDraft({
      yearsValue: event.currentTarget.dataset.years,
    })
  },

  onCalculate() {
    const result = calculateCompound({
      principalValue: this.data.principalValue,
      monthlyValue: this.data.monthlyValue,
      annualRateValue: this.data.annualRateValue,
      yearsValue: this.data.yearsValue,
    })

    if (!result.ok) {
      wx.showToast({ title: result.errorMessage, icon: 'none' })
      return
    }

    const data = result.data
    this.setData({
      hasResult: true,
      result: {
        totalAssetsCompact: this.formatCompactMoney(data.totalAssets),
        totalAssets: this.formatMoney(data.totalAssets),
        totalInvested: this.formatMoney(data.totalInvested),
        totalProfit: this.formatMoney(data.totalProfit),
        profitRate: this.formatPercent(data.profitRate, 1),
        monthlyRate: this.formatPercent(data.monthlyRate * 100, 2),
        principalFuture: this.formatMoney(data.principalFuture),
        sipFuture: this.formatMoney(data.sipFuture),
        planLabel: `${data.months} 个月`,
        summary: '按月复利估算，并默认每月月末投入一次定投；这里先把年化收益率换算成等效月收益率，再计算整段持有结果。',
      },
    })
    this.recordToolUse()
  },

  formatMoney(value) {
    const fixed = Number(value || 0).toFixed(2)
    return `${fixed.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} 元`
  },

  formatCompactMoney(value) {
    const amount = Number(value || 0)

    if (amount >= 100000000) {
      return `${this.trimZero(amount / 100000000)} 亿`
    }

    if (amount >= 10000) {
      return `${this.trimZero(amount / 10000)} 万`
    }

    return this.trimZero(amount)
  },

  formatPercent(value, digits = 1) {
    return `${Number(value || 0).toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')}%`
  },

  trimZero(value) {
    return Number(value || 0).toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
  },

  onReset() {
    this.setData({
      principalValue: '',
      monthlyValue: '',
      annualRateValue: '',
      yearsValue: '',
      hasResult: false,
      result: getDefaultResult(),
    })
  },

  onShareAppMessage() {
    return {
      title: '长期复利和每月定投，算一下未来能有多少',
      path: '/packageTools/pages/compound/compound',
    }
  },

  onShareTimeline() {
    return {
      title: '复利 / 定投计算器：估算长期收益结果',
      query: '',
    }
  },
}))
