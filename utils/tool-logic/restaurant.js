const { business: defaultBusinessPolicy } = require('../policy-config')

const fail = (errorCode, errorMessage) => ({ ok: false, errorCode, errorMessage })
const optionalNonNegative = (value, fieldName) => {
  const number = value == null || value === '' ? 0 : Number(value)
  if (!Number.isFinite(number) || number < 0 || number > Number.MAX_SAFE_INTEGER) return fail('INVALID_NUMBER', `${fieldName}需为非负有限数值`)
  return { ok: true, value: number }
}
const rate = (value, fieldName) => {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0 || number > 100) return fail('INVALID_RATE', `${fieldName}需为 0 到 100`) 
  return { ok: true, value: number }
}
const finitePolicy = (value) => Number.isFinite(Number(value)) ? Number(value) : null

const calculateCost = (input, rules = defaultBusinessPolicy) => {
  const fields = [
    ['monthlyRent', '每月房租'], ['rentPayMonths', '付款月数'], ['rentDeposit', '押金'], ['transferFee', '转让费用'],
    ['franchiseFee', '加盟学习费'], ['decorationAdCost', '装修广告费'], ['equipmentCost', '设备费用'], ['openingStock', '首批物料'],
  ]
  const values = {}
  for (const [key, label] of fields) {
    const parsed = optionalNonNegative(input[key], label)
    if (!parsed.ok) return parsed
    values[key] = parsed.value
  }
  const rentStartupCost = values.monthlyRent * values.rentPayMonths + values.rentDeposit
  const entryCost = values.transferFee + values.franchiseFee
  const buildCost = values.decorationAdCost + values.equipmentCost
  const total = rentStartupCost + entryCost + buildCost + values.openingStock
  const buffer = finitePolicy(rules.safetyBufferRatio)
  if (!Number.isFinite(total) || !Number.isFinite(buffer) || buffer <= 0) return fail('CALCULATION_OVERFLOW', '建店成本超出可计算范围')
  if (total <= 0) return fail('EMPTY_COST', '请填写至少一项建店成本')
  const rentRate = rentStartupCost / total * 100
  const safetyBudget = total * buffer
  if (![rentRate, safetyBudget].every(Number.isFinite)) return fail('CALCULATION_OVERFLOW', '建店成本超出可计算范围')
  return { ok: true, data: { ...values, rentStartupCost, entryCost, buildCost, total, rentRate, safetyBudget } }
}

const calculateBreakEven = (input, rules = defaultBusinessPolicy) => {
  const offlineMargin = rate(input.offlineGrossMarginRate, '线下毛利率'); if (!offlineMargin.ok) return offlineMargin
  const deliveryMargin = rate(input.deliveryGrossMarginRate, '外卖毛利率'); if (!deliveryMargin.ok) return deliveryMargin
  const offlineSales = rate(input.offlineSalesRate, '线下销售占比'); if (!offlineSales.ok) return offlineSales
  const deliverySales = rate(input.deliverySalesRate, '外卖销售占比'); if (!deliverySales.ok) return deliverySales
  if (Math.abs(offlineSales.value + deliverySales.value - 100) > 0.001) return fail('INVALID_SALES_MIX', '线下和外卖销售占比合计需为 100%')

  let fixedCost = 0
  for (const [key, label] of [['fixedRent', '月租金'], ['fixedLabor', '月人工'], ['fixedUtilities', '水电杂费'], ['fixedOther', '其他固定成本']]) {
    const parsed = optionalNonNegative(input[key], label); if (!parsed.ok) return parsed; fixedCost += parsed.value
  }
  if (!Number.isFinite(fixedCost) || fixedCost <= 0) return fail('INVALID_FIXED_COST', '请填写固定成本')
  const blendedGrossMargin = (offlineMargin.value * offlineSales.value + deliveryMargin.value * deliverySales.value) / 10000
  if (!Number.isFinite(blendedGrossMargin) || blendedGrossMargin <= 0 || blendedGrossMargin > 1) return fail('INVALID_MARGIN', '请填写有效毛利率')
  const buffer = finitePolicy(rules.safetyBufferRatio)
  const warningRate = finitePolicy(rules.grossMarginWarningRate)
  if (!Number.isFinite(buffer) || buffer <= 0 || !Number.isFinite(warningRate)) return fail('INVALID_POLICY', '经营分析规则无效')
  const breakEvenRevenue = fixedCost / blendedGrossMargin
  const safetyRevenue = breakEvenRevenue * buffer
  const extraProfitPerWan = 10000 * blendedGrossMargin
  const offlineRevenue = breakEvenRevenue * offlineSales.value / 100
  const deliveryRevenue = breakEvenRevenue * deliverySales.value / 100
  const blendedGrossMarginPercent = blendedGrossMargin * 100
  const values = [breakEvenRevenue, safetyRevenue, extraProfitPerWan, offlineRevenue, deliveryRevenue, blendedGrossMarginPercent]
  if (!values.every(Number.isFinite)) return fail('CALCULATION_OVERFLOW', '保本结果超出可计算范围')
  return { ok: true, data: { fixedCost, offlineGrossMarginRate: offlineMargin.value, deliveryGrossMarginRate: deliveryMargin.value, offlineSalesRate: offlineSales.value, deliverySalesRate: deliverySales.value, blendedGrossMargin, blendedGrossMarginPercent, breakEvenRevenue, safetyRevenue, extraProfitPerWan, offlineRevenue, deliveryRevenue, showGrossMarginWarning: blendedGrossMargin < warningRate } }
}

const getHealthLabel = (profitRate, rules = defaultBusinessPolicy) => {
  if (profitRate >= Number(rules.netProfitHealthyRate) * 100) return '经营健康'
  if (profitRate >= Number(rules.netProfitWarningRate) * 100) return '有利润'
  if (profitRate >= 0) return '微利'
  return '亏损'
}
const getAnalysisTip = (profitRate, foodRate, laborRate, rentRate, rules = defaultBusinessPolicy) => {
  if (profitRate < 0) return '当前为亏损状态，优先检查食材、人工、房租和平台费用是否过高。'
  if (foodRate > Number(rules.costRateRedLines.material) * 100) return '食材成本率偏高，可以检查菜单定价、损耗和采购价格。'
  if (laborRate > Number(rules.costRateRedLines.labor) * 100) return '人工占比偏高，可以检查排班效率和高峰时段配置。'
  if (rentRate > Number(rules.costRateRedLines.rent) * 100) return '房租占比偏高，需要更谨慎评估客流和翻台效率。'
  return '成本结构相对稳，建议继续观察客流、复购和单品毛利。'
}
const calculateAnalysis = (input, rules = defaultBusinessPolicy) => {
  const revenueParsed = optionalNonNegative(input.monthlyRevenue, '月营业额'); if (!revenueParsed.ok) return revenueParsed
  const revenue = revenueParsed.value
  if (revenue <= 0) return fail('INVALID_REVENUE', '请填写月营业额')
  const costs = {}
  for (const [key, label] of [['foodCost', '食材成本'], ['laborCost', '人工成本'], ['rentCost', '房租成本'], ['platformCost', '平台费用'], ['utilityCost', '水电杂费'], ['otherCost', '其他支出']]) {
    const parsed = optionalNonNegative(input[key], label); if (!parsed.ok) return parsed; costs[key] = parsed.value
  }
  const totalCost = Object.values(costs).reduce((sum, value) => sum + value, 0)
  const profit = revenue - totalCost
  const profitRate = profit / revenue * 100
  const foodRate = costs.foodCost / revenue * 100
  const laborRate = costs.laborCost / revenue * 100
  const rentRate = costs.rentCost / revenue * 100
  const values = [totalCost, profit, profitRate, foodRate, laborRate, rentRate]
  if (!values.every(Number.isFinite)) return fail('CALCULATION_OVERFLOW', '经营分析结果超出可计算范围')
  return { ok: true, data: { revenue, ...costs, totalCost, profit, profitRate, foodRate, laborRate, rentRate, health: getHealthLabel(profitRate, rules), tip: getAnalysisTip(profitRate, foodRate, laborRate, rentRate, rules) } }
}
const getComplementRate = (value) => {
  if (value === '') return ''
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0 || number > 100) return ''
  return String(100 - number)
}

module.exports = { calculateAnalysis, calculateBreakEven, calculateCost, getAnalysisTip, getComplementRate, getHealthLabel }
