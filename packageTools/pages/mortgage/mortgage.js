const { withToolPage } = require('../../../behaviors/tool-page')
const { mortgage: mortgagePolicy } = require('../../../utils/policy-config')
const {
  calculateLoanFromPrice,
  calculateMortgage,
  calculatePriceFromLoan,
} = require('../../../utils/tool-logic/mortgage')

const loanTypes = [
  { label: '商业贷', value: 'commercial' },
  { label: '公积金', value: 'fund' },
  { label: '组合贷', value: 'combined' },
]

const repayTypes = [
  { label: '等额本息', value: 'interest' },
  { label: '等额本金', value: 'principal' },
]

const quickYears = mortgagePolicy.quickYears
const downPaymentOptions = mortgagePolicy.downPaymentOptions

Page(withToolPage('mortgage', {
  data: {
    loanTypes,
    repayTypes,
    quickYears,
    downPaymentOptions,
    loanType: 'commercial',
    repayType: 'interest',
    houseTotalPrice: '',
    downPaymentRate: mortgagePolicy.defaultDownPaymentRate,
    helperDownPaymentAmount: '',
    helperLoanAmount: '',
    commercialAmount: '',
    fundAmount: '',
    years: '',
    commercialRate: mortgagePolicy.defaultCommercialRate,
    fundRate: mortgagePolicy.defaultFundRate,
    hasResult: false,
    result: {
      firstMonth: '--',
      totalInterest: '--',
      totalRepayment: '--',
      monthlyDecrease: '',
      months: 0,
    },
    schedule: [],
  },

  onLoanTypeTap(event) {
    const { value } = event.currentTarget.dataset
    const data = { loanType: value }

    if (value === 'commercial') {
      data.fundAmount = ''
    }

    if (value === 'fund') {
      data.commercialAmount = ''
    }

    this.setData(data, () => {
      if (this.data.helperLoanAmount) {
        this.syncHelperLoanAmount()
      }
      this.clearResult()
    })
  },

  onRepayTypeTap(event) {
    this.setData({
      repayType: event.currentTarget.dataset.value,
    }, () => {
      this.clearResult()
    })
  },

  onInput(event) {
    const { field } = event.currentTarget.dataset
    const value = event.detail.value

    if (field === 'commercialAmount' || field === 'fundAmount') {
      this.setData({
        [field]: value,
      }, () => {
        this.updateHouseTotalFromLoan(field)
        this.clearResult()
      })
      return
    }

    this.setData({
      [field]: value,
    }, () => {
      this.clearResult()
    })
  },

  onQuickYearTap(event) {
    this.setData({
      years: event.currentTarget.dataset.year,
    }, () => {
      this.clearResult()
    })
  },

  onDownPaymentTap(event) {
    const rate = event.currentTarget.dataset.rate

    this.setData({
      downPaymentRate: rate,
    }, () => {
      this.updateHelperLoanAmount()
      this.clearResult()
    })
  },

  onDownPaymentInput(event) {
    this.setData({
      downPaymentRate: event.detail.value,
    }, () => {
      this.updateHelperLoanAmount()
      this.clearResult()
    })
  },

  onHouseTotalInput(event) {
    this.setData({
      houseTotalPrice: event.detail.value,
    }, () => {
      this.updateHelperLoanAmount()
      this.clearResult()
    })
  },

  updateHelperLoanAmount() {
    const result = calculateLoanFromPrice({
      totalPrice: this.data.houseTotalPrice,
      downPaymentRate: this.data.downPaymentRate,
    })

    if (!result.ok) {
      this.setData({
        helperDownPaymentAmount: '',
        helperLoanAmount: '',
      })
      return
    }

    const helperDownPaymentAmount = this.trimNumber(result.data.downPaymentAmount)
    const helperLoanAmount = this.trimNumber(result.data.loanAmount)
    this.setData({
      helperDownPaymentAmount,
      helperLoanAmount,
    }, () => {
      this.syncHelperLoanAmount()
    })
  },

  syncHelperLoanAmount() {
    const { helperLoanAmount } = this.data

    if (!helperLoanAmount) {
      return
    }

    const patch = {}

    if (this.data.loanType === 'fund') {
      patch.fundAmount = helperLoanAmount
    } else {
      patch.commercialAmount = helperLoanAmount
    }

    this.setData(patch)
  },

  updateHouseTotalFromLoan(field) {
    const commercialAmount = Number(this.data.commercialAmount || 0)
    const fundAmount = Number(this.data.fundAmount || 0)
    const loanAmount = this.data.loanType === 'combined'
      ? commercialAmount + fundAmount
      : Number(this.data[field] || 0)
    const result = calculatePriceFromLoan({
      loanAmount,
      downPaymentRate: this.data.downPaymentRate,
    })

    if (!result.ok) return

    this.setData({
      houseTotalPrice: this.trimNumber(result.data.totalPrice),
      helperDownPaymentAmount: this.trimNumber(result.data.downPaymentAmount),
      helperLoanAmount: this.trimNumber(result.data.loanAmount),
    })
  },

  onCalculate() {
    const result = calculateMortgage({
      commercialAmount: Number(this.data.commercialAmount) * 10000,
      fundAmount: Number(this.data.fundAmount) * 10000,
      years: this.data.years,
      commercialRate: this.data.commercialRate,
      fundRate: this.data.fundRate,
      repayType: this.data.repayType,
    }, mortgagePolicy)

    if (!result.ok) {
      wx.showToast({
        title: result.errorMessage,
        icon: 'none',
      })
      return
    }

    const summary = result.data
    this.setData({
      hasResult: true,
      result: {
        firstMonth: this.formatMoney(summary.firstMonth),
        totalInterest: this.formatMoney(summary.totalInterest),
        totalRepayment: this.formatMoney(summary.totalRepayment),
        monthlyDecrease: summary.monthlyDecrease > 0 ? this.formatMoney(summary.monthlyDecrease) : '',
        months: summary.months,
      },
      schedule: summary.schedule.map((item) => ({
        period: item.period,
        payment: this.formatMoney(item.payment),
        principal: this.formatMoney(item.principal),
        interest: this.formatMoney(item.interest),
      })),
    })
    this.recordToolUse()
  },

  formatMoney(value) {
    if (value >= 10000) {
      return `${(value / 10000).toFixed(2)} 万`
    }

    return `${value.toFixed(2)} 元`
  },

  trimNumber(value) {
    return Number(value.toFixed(2)).toString()
  },

  clearResult() {
    this.setData({
      hasResult: false,
      result: {
        firstMonth: '--',
        totalInterest: '--',
        totalRepayment: '--',
        monthlyDecrease: '',
        months: 0,
      },
      schedule: [],
    })
  },

  onReset() {
    this.clearResult()
  },

  onShareAppMessage() {
    return {
      title: '房贷月供怎么算？等额本息和等额本金对比一下',
      path: '/packageTools/pages/mortgage/mortgage',
    }
  },

  onShareTimeline() {
    return {
      title: '房贷计算器：快速估算月供和总利息',
      query: '',
    }
  },
}))
