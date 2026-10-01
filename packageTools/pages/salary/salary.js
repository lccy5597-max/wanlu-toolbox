const { withToolPage } = require('../../../behaviors/tool-page')
const { incomeTax } = require('../../../utils/policy-config')
const { calculateSalary, calculateSocialPreview } = require('../../../utils/tool-logic/salary')

const defaultSocialItems = incomeTax.socialInsuranceItems.map((item) => ({
  ...item,
  amount: '--',
}))

const getDefaultResult = () => ({
  takeHome: '--',
  tax: '--',
  contribution: '--',
  social: '--',
  fund: '--',
  taxable: '--',
  netRate: '待计算',
})

Page(withToolPage('salary', {
  data: {
    grossSalary: '',
    socialItems: defaultSocialItems,
    socialTotalRate: incomeTax.defaultSocialTotalRate,
    fundRate: incomeTax.defaultHousingFundRate,
    specialDeduction: '',
    quickFundRates: incomeTax.quickHousingFundRates,
    hasResult: false,
    result: getDefaultResult(),
  },

  updateDraft(patch, callback) {
    this.setData({
      ...patch,
      hasResult: false,
      result: getDefaultResult(),
    }, callback)
  },

  onInput(event) {
    const { field } = event.currentTarget.dataset

    this.updateDraft({
      [field]: event.detail.value,
    }, () => {
      if (field === 'grossSalary') {
        this.updateSocialPreview()
      }
    })
  },

  onQuickFundTap(event) {
    this.updateDraft({
      fundRate: event.currentTarget.dataset.rate,
    })
  },

  onSocialRateInput(event) {
    const { index } = event.currentTarget.dataset
    const activeIndex = Number(index)
    const socialItems = this.data.socialItems.map((item, itemIndex) => (
      itemIndex === activeIndex
        ? { ...item, rate: event.detail.value }
        : item
    ))

    this.updateDraft({
      socialItems,
    }, () => {
      this.updateSocialPreview()
    })
  },

  onCalculate() {
    const result = calculateSalary({
      grossSalary: this.data.grossSalary,
      socialRates: this.data.socialItems.map((item) => item.rate),
      fundRate: this.data.fundRate,
      specialDeduction: this.data.specialDeduction,
    }, incomeTax)

    if (!result.ok) {
      wx.showToast({
        title: result.errorMessage,
        icon: 'none',
      })
      return
    }

    this.updateSocialPreview()

    const data = result.data
    this.setData({
      hasResult: true,
      result: {
        takeHome: this.formatMoney(data.takeHome),
        tax: this.formatMoney(data.tax),
        contribution: this.formatMoney(data.contribution),
        social: this.formatMoney(data.socialAmount),
        fund: this.formatMoney(data.fundAmount),
        taxable: this.formatMoney(data.taxableIncome),
        netRate: `${data.netRatePercent}% 到手`,
      },
    })
    this.recordToolUse()
  },

  updateSocialPreview() {
    const result = calculateSocialPreview({
      grossSalary: this.data.grossSalary,
      socialRates: this.data.socialItems.map((item) => item.rate),
    })

    const socialItems = this.data.socialItems.map((item, index) => ({
      ...item,
      amount: result.ok && Number(this.data.grossSalary) > 0
        ? this.formatMoney(result.data.amounts[index])
        : '--',
    }))
    const socialTotalRate = result.ok
      ? result.data.totalRate.toFixed(1).replace(/\.0$/, '')
      : '--'

    this.setData({
      socialItems,
      socialTotalRate,
    })
  },

  formatMoney(value) {
    return `${value.toFixed(2)} 元`
  },

  onReset() {
    this.updateDraft({})
  },

  onShareAppMessage() {
    return {
      title: '税后工资到手多少？五险一金和个税一起算',
      path: '/packageTools/pages/salary/salary',
    }
  },

  onShareTimeline() {
    return {
      title: '工资计算器：估算税后到手收入',
      query: '',
    }
  },
}))
