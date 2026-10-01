const { withToolPage } = require('../../../behaviors/tool-page')
const { pension: pensionPolicy } = require('../../../utils/policy-config')
const { calculateRetirementPension, getAccountMonthsByAge } = require('../../../utils/tool-logic/retirement-pension')

const retireAgeOptions = pensionPolicy.retireAgeOptions
const contributionLevelOptions = pensionPolicy.contributionLevels
const baseQuickOptions = pensionPolicy.baseQuickOptions
const getDefaultResult = () => ({
  monthlyTotal: '--',
  basePension: '--',
  accountPension: '--',
  yearlyTotal: '--',
  totalYears: '--',
  futureYears: '--',
  futureAccount: '--',
  accountMonths: '--',
  summary: '填好参数后，这里会显示预计每月养老金。',
})

function formatMoney(value) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return '--'
  }

  return `${number.toFixed(0)} 元`
}

function formatYear(value) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return '--'
  }

  return `${number.toFixed(1).replace(/\.0$/, '')} 年`
}

function formatRate(value) {
  return `${Number(value).toFixed(2)}`
}

Page(withToolPage('retirement-pension', {
  data: {
    retireAgeOptions,
    contributionLevelOptions,
    baseQuickOptions,
    currentAge: '',
    payYears: '',
    accountBalance: '',
    monthlyPayBase: '',
    contributionLevel: 'average',
    retireAge: '60',
    accountMonths: '139',
    estimateBase: pensionPolicy.defaultBase,
    extraMonthly: '',
    showAdvanced: false,
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
    const value = event.detail.value

    if (field === 'retireAge') {
      this.updateDraft({
        retireAge: value,
        accountMonths: String(getAccountMonthsByAge(value, pensionPolicy)),
      })
      return
    }

    this.updateDraft({
      [field]: value,
    })
  },

  onAgeTap(event) {
    const option = retireAgeOptions.find((item) => item.age === String(event.currentTarget.dataset.age))

    if (!option) {
      return
    }

    this.updateDraft({
      retireAge: option.age,
      accountMonths: String(option.months),
    })
  },

  onLevelTap(event) {
    this.updateDraft({
      contributionLevel: event.currentTarget.dataset.level,
    })
  },

  onQuickBaseTap(event) {
    this.updateDraft({
      estimateBase: String(event.currentTarget.dataset.value),
    })
  },

  onToggleAdvanced() {
    this.setData({
      showAdvanced: !this.data.showAdvanced,
    })
  },

  onCalculate() {
    const result = calculateRetirementPension({
      currentAge: this.data.currentAge,
      retireAge: this.data.retireAge,
      payYears: this.data.payYears,
      accountBalance: this.data.accountBalance,
      monthlyPayBase: this.data.monthlyPayBase,
      contributionLevel: this.data.contributionLevel,
      estimateBase: this.data.estimateBase,
      accountMonths: this.data.accountMonths,
      extraMonthly: this.data.extraMonthly,
    }, pensionPolicy)

    if (!result.ok) {
      wx.showToast({ title: result.errorMessage, icon: 'none' })
      return
    }

    const data = result.data
    this.setData({
      hasResult: true,
      result: {
        monthlyTotal: formatMoney(data.monthlyTotal),
        basePension: formatMoney(data.basePension),
        accountPension: formatMoney(data.accountPension),
        yearlyTotal: formatMoney(data.yearlyTotal),
        totalYears: formatYear(data.totalYears),
        futureYears: formatYear(data.futureYears),
        futureAccount: formatMoney(data.futureAccountBalance),
        accountMonths: `${data.accountMonths.toFixed(0)} 个月`,
        summary: `按估算基准 ${formatMoney(data.estimateBase)}、缴费指数 ${formatRate(data.estimatedIndex)}、退休前继续缴 ${formatYear(data.futureYears)} 粗略估算。`,
      },
    })
    this.recordToolUse()
  },

  onReset() {
    this.setData({
      currentAge: '',
      payYears: '',
      accountBalance: '',
      monthlyPayBase: '',
      contributionLevel: 'average',
      retireAge: '60',
      accountMonths: '139',
      estimateBase: pensionPolicy.defaultBase,
      extraMonthly: '',
      showAdvanced: false,
      hasResult: false,
      result: getDefaultResult(),
    })
  },

  onShareAppMessage() {
    return {
      title: '退休后每月养老金大概多少？先做个粗略估算',
      path: '/packageTools/pages/retirement-pension/retirement-pension',
    }
  },

  onShareTimeline() {
    return {
      title: '养老金估算器：粗略估算退休后每月金额',
      query: '',
    }
  },
}))
