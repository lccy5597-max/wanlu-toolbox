const { withToolPage } = require('../../../behaviors/tool-page')
const { retirementAge: retirementPolicy } = require('../../../utils/policy-config')
const { calculateRetirementAge } = require('../../../utils/tool-logic/retirement-age')

const workerTypes = retirementPolicy.workerTypes

const getTodayString = () => formatDate(new Date())

const getDefaultResult = () => ({
  retireDate: '--',
  retireAgeText: '--',
  flexibleDate: '--',
  flexibleAgeText: '--',
  delayText: '--',
  oldRetireDate: '--',
  workerTypeText: '--',
  ruleText: '选择出生日期和人员类型后开始计算',
  summary: '结果会按渐进式延迟退休规则粗略估算。',
})

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

Page(withToolPage('retirement-age', {
  data: {
    workerTypes,
    birthDate: '',
    todayDate: getTodayString(),
    workerType: 'male',
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

  onDateChange(event) {
    this.updateDraft({
      birthDate: event.detail.value,
    })
  },

  onTypeTap(event) {
    this.updateDraft({
      workerType: event.currentTarget.dataset.type,
    })
  },

  onCalculate() {
    const result = calculateRetirementAge({
      birthDate: this.data.birthDate,
      workerType: this.data.workerType,
    }, retirementPolicy)

    if (!result.ok) {
      wx.showToast({ title: result.errorMessage, icon: 'none' })
      return
    }

    const data = result.data
    this.setData({
      hasResult: true,
      result: {
        retireDate: data.retireDate,
        retireAgeText: data.retireAgeText,
        flexibleDate: data.flexibleDate,
        flexibleAgeText: data.flexibleAgeText,
        delayText: `${data.delayMonths} 个月`,
        oldRetireDate: data.oldRetireDate,
        workerTypeText: data.workerTypeText,
        ruleText: data.ruleText,
        summary: '结果按普通职工法定退休年龄估算，特殊工种、病退、灵活就业和地方办理细则可能不同。',
      },
    })
    this.recordToolUse()
  },

  onReset() {
    this.setData({
      birthDate: '',
      workerType: 'male',
      hasResult: false,
      result: getDefaultResult(),
    })
  },

  onShareAppMessage() {
    return {
      title: '输入出生日期，估算自己的退休时间',
      path: '/packageTools/pages/retirement-age/retirement-age',
    }
  },

  onShareTimeline() {
    return {
      title: '退休年龄计算器：估算法定退休年月',
      query: '',
    }
  },
}))
