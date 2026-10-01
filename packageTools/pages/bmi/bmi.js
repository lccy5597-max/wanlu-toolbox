const { withToolPage } = require('../../../behaviors/tool-page')
const { calculateBmi } = require('../../../utils/tool-logic/bmi')

const bmiPresentation = {
  underweight: {
    level: '偏瘦',
    desc: '可以适当增加优质蛋白和力量训练，让身体状态更稳。',
    tone: 'low',
  },
  normal: {
    level: '正常',
    desc: '当前 BMI 位于本工具采用的成年人参考区间，继续保持规律饮食和运动。',
    tone: 'normal',
  },
  overweight: {
    level: '超重',
    desc: '建议关注腰围、饮食结构和日常活动量，慢慢调回舒适区。',
    tone: 'high',
  },
  obese: {
    level: '肥胖',
    desc: '建议结合身体状况制定减重计划，必要时咨询专业医生。',
    tone: 'alert',
  },
}
Page(withToolPage('bmi', {
  data: {
    heightValue: '',
    weightValue: '',
    hasResult: false,
    bmiValue: '--',
    bmiLevel: '',
    bmiDesc: '',
    idealRange: '',
    markerStyle: 'left: 0%',
    resultTone: 'normal',
  },

  clearResult(patch = {}) {
    this.setData({
      ...patch,
      hasResult: false,
      bmiValue: '--',
      bmiLevel: '',
      bmiDesc: '',
      idealRange: '',
      markerStyle: 'left: 0%',
      resultTone: 'normal',
    })
  },

  onHeightInput(event) {
    this.clearResult({ heightValue: event.detail.value })
  },

  onWeightInput(event) {
    this.clearResult({ weightValue: event.detail.value })
  },

  onCalculate() {
    const result = calculateBmi({
      heightCm: this.data.heightValue,
      weightKg: this.data.weightValue,
    })

    if (!result.ok) {
      wx.showToast({
        title: result.errorMessage,
        icon: 'none',
      })
      return
    }

    const data = result.data
    const presentation = bmiPresentation[data.category]
    this.setData({
      hasResult: true,
      bmiValue: data.bmi.toFixed(1),
      bmiLevel: presentation.level,
      bmiDesc: presentation.desc,
      resultTone: presentation.tone,
      idealRange: `${data.idealMinWeight.toFixed(1)} - ${data.idealMaxWeight.toFixed(1)} kg`,
      markerStyle: `left: ${data.markerPercent}%`,
    })
    this.recordToolUse()
  },

  onReset() {
    this.clearResult({
      heightValue: '',
      weightValue: '',
    })
  },

  onShareAppMessage() {
    return {
      title: '输入身高体重，快速算一下自己的 BMI',
      path: '/packageTools/pages/bmi/bmi',
    }
  },

  onShareTimeline() {
    return {
      title: 'BMI 计算器：看看体重状态是否在健康区间',
      query: '',
    }
  },
}))
