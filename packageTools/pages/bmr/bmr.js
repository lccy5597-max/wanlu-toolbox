const { withToolPage } = require('../../../behaviors/tool-page')
const { activityOptions, calculateBmr } = require('../../../utils/tool-logic/bmr')

const getDefaultResult = () => ({
  bmr: '--',
  tdee: '--',
  cut: '--',
  maintain: '--',
  gain: '--',
  activityLabel: '',
  summary: '',
})

Page(withToolPage('bmr', {
  data: {
    gender: 'male',
    ageValue: '',
    heightValue: '',
    weightValue: '',
    activityKey: 'sedentary',
    activityOptions,
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

  onGenderSelect(event) {
    this.updateDraft({
      gender: event.currentTarget.dataset.gender,
    })
  },

  onInput(event) {
    const { field } = event.currentTarget.dataset

    this.updateDraft({
      [field]: event.detail.value,
    })
  },

  onActivitySelect(event) {
    this.updateDraft({
      activityKey: event.currentTarget.dataset.key,
    })
  },

  onCalculate() {
    const result = calculateBmr({
      gender: this.data.gender,
      age: this.data.ageValue,
      height: this.data.heightValue,
      weight: this.data.weightValue,
      activityKey: this.data.activityKey,
    })

    if (!result.ok) {
      wx.showToast({ title: result.errorMessage, icon: 'none' })
      return
    }

    const data = result.data
    this.setData({
      hasResult: true,
      result: {
        bmr: String(data.bmr),
        tdee: String(data.maintain),
        cut: String(data.cut),
        maintain: String(data.maintain),
        gain: String(data.gain),
        activityLabel: data.activityLabel,
        summary: `按${data.activityLabel}估算，你每天总消耗约 ${data.maintain} 千卡。`,
      },
    })
    this.recordToolUse()
  },

  onReset() {
    this.setData({
      gender: 'male',
      ageValue: '',
      heightValue: '',
      weightValue: '',
      activityKey: 'sedentary',
      hasResult: false,
      result: getDefaultResult(),
    })
  },

  onShareAppMessage() {
    return {
      title: '算一下每天基础代谢和热量消耗',
      path: '/packageTools/pages/bmr/bmr',
    }
  },

  onShareTimeline() {
    return {
      title: '基础代谢率计算器：估算每日热量消耗',
      query: '',
    }
  },
}))
