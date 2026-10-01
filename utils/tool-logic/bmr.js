const activityOptions = [
  { id: 'sedentary', label: '久坐少动', desc: '办公学习为主，几乎不运动', factor: 1.2, icon: 'home' },
  { id: 'light', label: '轻度活动', desc: '每周运动 1 到 3 天', factor: 1.375, icon: 'activity' },
  { id: 'moderate', label: '中度活动', desc: '每周运动 3 到 5 天', factor: 1.55, icon: 'heart' },
  { id: 'active', label: '高度活动', desc: '每周运动 6 到 7 天', factor: 1.725, icon: 'rocket' },
]
const fail = (errorCode, errorMessage) => ({ ok: false, errorCode, errorMessage })

const calculateBmr = ({ gender, age, height, weight, activityKey }) => {
  const ageValue = Number(age); const heightValue = Number(height); const weightValue = Number(weight)
  if (![ageValue, heightValue, weightValue].every(Number.isFinite)) return fail('INVALID_INPUT', '请填写有限数值')
  if (gender !== 'male' && gender !== 'female') return fail('INVALID_GENDER', '请选择有效性别')
  // 页面明确标注为成年人参考，因此输入边界与产品说明保持一致。
  if (ageValue < 18 || ageValue > 100) return fail('AGE_OUT_OF_RANGE', '年龄范围不太对')
  if (heightValue < 100 || heightValue > 250) return fail('HEIGHT_OUT_OF_RANGE', '身高范围不太对')
  if (weightValue < 20 || weightValue > 300) return fail('WEIGHT_OUT_OF_RANGE', '体重范围不太对')
  const activity = activityOptions.find((item) => item.id === activityKey)
  if (!activity) return fail('INVALID_ACTIVITY', '请选择有效活动水平')

  const rawBmr = gender === 'male' ? 10 * weightValue + 6.25 * heightValue - 5 * ageValue + 5 : 10 * weightValue + 6.25 * heightValue - 5 * ageValue - 161
  const tdee = rawBmr * activity.factor
  const maintain = Math.round(tdee)
  const cut = Math.max(Math.round(tdee - 450), Math.round(rawBmr))
  const gain = Math.round(tdee + 250)
  const bmr = Math.round(rawBmr)
  if (![rawBmr, tdee, maintain, cut, gain, bmr].every(Number.isFinite)) return fail('CALCULATION_OVERFLOW', 'BMR 结果超出可计算范围')
  return { ok: true, data: { gender, age: ageValue, height: heightValue, weight: weightValue, activityKey, activityLabel: activity.label, rawBmr, bmr, tdee, maintain, cut, gain } }
}

module.exports = { activityOptions, calculateBmr }
