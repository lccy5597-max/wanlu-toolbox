const BMI_LIMITS = {
  minHeightCm: 80,
  maxHeightCm: 250,
  minWeightKg: 20,
  maxWeightKg: 300,
  underweight: 18.5,
  normalUpper: 24,
  overweightUpper: 28,
  idealUpper: 23.9,
  markerMin: 14,
  markerMax: 34,
}

const fail = (errorCode, errorMessage) => ({
  ok: false,
  errorCode,
  errorMessage,
})

const isBlank = (value) => value == null || (typeof value === 'string' && !value.trim())

const classifyBmi = (bmi) => {
  if (bmi < BMI_LIMITS.underweight) return 'underweight'
  if (bmi < BMI_LIMITS.normalUpper) return 'normal'
  if (bmi < BMI_LIMITS.overweightUpper) return 'overweight'
  return 'obese'
}

const getMarkerPercent = (bmi) => {
  const clamped = Math.min(Math.max(bmi, BMI_LIMITS.markerMin), BMI_LIMITS.markerMax)
  return Math.round(((clamped - BMI_LIMITS.markerMin) / (BMI_LIMITS.markerMax - BMI_LIMITS.markerMin)) * 100)
}

const calculateBmi = ({ heightCm, weightKg }) => {
  if (isBlank(heightCm) || isBlank(weightKg)) {
    return fail('EMPTY_INPUT', '请填写身高和体重')
  }

  const height = Number(heightCm)
  const weight = Number(weightKg)
  if (!Number.isFinite(height) || !Number.isFinite(weight)) {
    return fail('INVALID_INPUT', '身高和体重必须是有限数值')
  }

  if (height < BMI_LIMITS.minHeightCm || height > BMI_LIMITS.maxHeightCm) {
    return fail('HEIGHT_OUT_OF_RANGE', '身高范围不太对')
  }

  if (weight < BMI_LIMITS.minWeightKg || weight > BMI_LIMITS.maxWeightKg) {
    return fail('WEIGHT_OUT_OF_RANGE', '体重范围不太对')
  }

  const meter = height / 100
  const rawBmi = weight / (meter * meter)
  const minWeight = BMI_LIMITS.underweight * meter * meter
  const maxWeight = BMI_LIMITS.idealUpper * meter * meter

  if (![rawBmi, minWeight, maxWeight].every(Number.isFinite)) {
    return fail('NON_FINITE_RESULT', 'BMI 结果超出可计算范围')
  }

  return {
    ok: true,
    data: {
      bmi: Number(rawBmi.toFixed(1)),
      category: classifyBmi(rawBmi),
      idealMinWeight: Number(minWeight.toFixed(1)),
      idealMaxWeight: Number(maxWeight.toFixed(1)),
      markerPercent: getMarkerPercent(rawBmi),
    },
  }
}

module.exports = {
  BMI_LIMITS,
  calculateBmi,
  classifyBmi,
  getMarkerPercent,
}
