const { withToolPage } = require('../../../behaviors/tool-page')
const { business: businessPolicy } = require('../../../utils/policy-config')
const {
  calculateAnalysis,
  calculateBreakEven,
  calculateCost,
  getComplementRate,
} = require('../../../utils/tool-logic/restaurant')

const modules = [
  { label: '建店成本', value: 'cost' },
  { label: '盈亏平衡', value: 'breakEven' },
  { label: '经营分析', value: 'analysis' },
]

Page(withToolPage('restaurant', {
  data: {
    modules,
    activeModule: 'cost',
    monthlyRent: '',
    rentPayMonths: '',
    rentDeposit: '',
    transferFee: '',
    franchiseFee: '',
    decorationAdCost: '',
    equipmentCost: '',
    openingStock: '',
    offlineGrossMarginRate: '',
    deliveryGrossMarginRate: '',
    offlineSalesRate: String(businessPolicy.offlineRatioDefault),
    deliverySalesRate: String(businessPolicy.takeawayRatioDefault),
    fixedRent: '',
    fixedLabor: '',
    fixedUtilities: '',
    fixedOther: '',
    monthlyRevenue: '',
    foodCost: '',
    laborCost: '',
    rentCost: '',
    platformCost: '',
    utilityCost: '',
    otherCost: '',
    hasResult: false,
    result: {
      primaryLabel: '预计投入',
      primaryValue: '--',
      badge: '待计算',
      notice: '',
      rows: [],
      tip: '填好数据后，这里会显示关键指标。',
    },
  },

  onModuleTap(event) {
    this.setData({
      activeModule: event.currentTarget.dataset.value,
      hasResult: false,
      result: this.getEmptyResult(event.currentTarget.dataset.value),
    })
  },

  onInput(event) {
    const { field } = event.currentTarget.dataset
    const value = event.detail.value

    if (field === 'offlineSalesRate') {
      this.setData({
        offlineSalesRate: value,
        deliverySalesRate: getComplementRate(value),
        hasResult: false,
        result: this.getEmptyResult(this.data.activeModule),
      })
      return
    }

    if (field === 'deliverySalesRate') {
      this.setData({
        deliverySalesRate: value,
        offlineSalesRate: getComplementRate(value),
        hasResult: false,
        result: this.getEmptyResult(this.data.activeModule),
      })
      return
    }

    this.setData({
      [field]: value,
      hasResult: false,
      result: this.getEmptyResult(this.data.activeModule),
    })
  },

  onCalculate() {
    if (this.data.activeModule === 'cost') {
      this.calculateCost()
      return
    }

    if (this.data.activeModule === 'breakEven') {
      this.calculateBreakEven()
      return
    }

    this.calculateAnalysis()
  },

  calculateCost() {
    const result = calculateCost(this.data, businessPolicy)
    if (!result.ok) {
      this.showToast(result.errorMessage)
      return
    }

    const data = result.data
    const rentRate = this.formatPercent(data.rentRate)
    this.setData({
      hasResult: true,
      result: {
        primaryLabel: '建店总成本',
        primaryValue: this.formatWan(data.total),
        badge: `房租 ${rentRate}`,
        rows: [
          { label: '房租启动成本', value: this.formatWan(data.rentStartupCost) },
          { label: '转让/加盟小计', value: this.formatWan(data.entryCost) },
          { label: '装修设备小计', value: this.formatWan(data.buildCost) },
          { label: '首批物料', value: this.formatWan(data.openingStock) },
          { label: '建议安全预算', value: this.formatWan(data.safetyBudget) },
        ],
        tip: '建店成本已按“月租 × 几个月一付 + 押金 + 各项杂费”估算，建议额外预留 10%-15% 应对施工延期和试营业波动。',
      },
    })
    this.recordToolUse()
  },

  calculateBreakEven() {
    const result = calculateBreakEven(this.data, businessPolicy)
    if (!result.ok) {
      this.showToast(result.errorMessage)
      return
    }

    const data = result.data
    const marginText = this.formatPercent(data.blendedGrossMarginPercent)
    const notice = data.showGrossMarginWarning
      ? `综合毛利率只有 ${marginText}，保本营业额会被放大；如果你想表达 50%，这里要填 50。`
      : ''
    this.setData({
      hasResult: true,
      result: {
        primaryLabel: '保本营业额',
        primaryValue: this.formatMoney(data.breakEvenRevenue),
        badge: '保本线',
        notice,
        rows: [
          { label: '月固定成本', value: this.formatMoney(data.fixedCost) },
          { label: '综合毛利率', value: marginText },
          { label: '保本公式', value: `${this.formatMoney(data.fixedCost)} ÷ ${marginText}` },
          { label: '低于保本营业额', value: '通常亏损' },
          { label: '建议安全营业额', value: this.formatMoney(data.safetyRevenue) },
          { label: '线下需贡献', value: this.formatMoney(data.offlineRevenue) },
          { label: '外卖需贡献', value: this.formatMoney(data.deliveryRevenue) },
          { label: '月营业额超过保本线后，每多卖 1 万', value: `约多赚 ${this.formatMoney(data.extraProfitPerWan)}` },
        ],
        tip: `保本营业额 = 月固定成本 ÷ 综合毛利率。按当前数据，月营业额做到 ${this.formatMoney(data.breakEvenRevenue)} 左右才是不赚不亏，超过保本线的部分会按 ${marginText} 贡献利润。`,
      },
    })
    this.recordToolUse()
  },

  calculateAnalysis() {
    const result = calculateAnalysis(this.data, businessPolicy)
    if (!result.ok) {
      this.showToast(result.errorMessage)
      return
    }

    const data = result.data
    this.setData({
      hasResult: true,
      result: {
        primaryLabel: '月净利润',
        primaryValue: this.formatMoney(data.profit),
        badge: data.health,
        rows: [
          { label: '净利率', value: this.formatPercent(data.profitRate) },
          { label: '食材成本率', value: this.formatPercent(data.foodRate) },
          { label: '人工成本率', value: this.formatPercent(data.laborRate) },
          { label: '房租占比', value: this.formatPercent(data.rentRate) },
        ],
        tip: data.tip,
      },
    })
    this.recordToolUse()
  },

  getEmptyResult(module) {
    if (module === 'breakEven') {
      return {
        primaryLabel: '保本营业额',
        primaryValue: '--',
        badge: '待计算',
        notice: '',
        rows: [],
        tip: '填好数据后，这里会显示保本营业额、亏损线和综合毛利率。',
      }
    }

    if (module === 'analysis') {
      return {
        primaryLabel: '月净利润',
        primaryValue: '--',
        badge: '待计算',
        notice: '',
        rows: [],
        tip: '填好数据后，这里会显示经营健康度。',
      }
    }

    return {
      primaryLabel: '预计投入',
      primaryValue: '--',
      badge: '待计算',
      notice: '',
      rows: [],
      tip: '填好数据后，这里会显示关键指标。',
    }
  },

  formatMoney(value) {
    if (Math.abs(value) >= 10000) {
      return `${(value / 10000).toFixed(2)} 万`
    }

    return `${value.toFixed(0)} 元`
  },

  formatWan(value) {
    return `${value.toFixed(2)} 万`
  },

  formatPercent(value) {
    if (!Number.isFinite(value)) return '--'
    return `${value.toFixed(1).replace(/\.0$/, '')}%`
  },

  showToast(title) {
    wx.showToast({
      title,
      icon: 'none',
    })
  },

  onShareAppMessage() {
    return {
      title: '想开餐饮店？先算算启动成本和保本营业额',
      path: '/packageTools/pages/restaurant/restaurant',
    }
  },

  onShareTimeline() {
    return {
      title: '餐饮投资计算器：开店成本、保本线和经营分析',
      query: '',
    }
  },
}))
