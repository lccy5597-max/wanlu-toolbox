const LIMITS = {
  maxPrincipal: 1000000000,
  maxMonthly: 100000000,
  minAnnualRate: 0,
  maxAnnualRate: 100,
  minYears: 0.5,
  maxYears: 80,
}

const fail = (errorCode, errorMessage) => ({ ok: false, errorCode, errorMessage })
const optionalNumber = (value) => (value == null || value === '' ? 0 : Number(value))

const calculateCompound = ({ principalValue, monthlyValue, annualRateValue, yearsValue }) => {
  const principal = optionalNumber(principalValue)
  const monthly = optionalNumber(monthlyValue)
  const annualRate = Number(annualRateValue)
  const years = Number(yearsValue)

  if (!Number.isFinite(principal) || !Number.isFinite(monthly)) return fail('INVALID_AMOUNT', '金额必须是有限数值')
  if (principal < 0 || monthly < 0) return fail('NEGATIVE_AMOUNT', '金额不能是负数')
  if (principal === 0 && monthly === 0) return fail('EMPTY_INVESTMENT', '请至少填写本金或每月定投')
  if (principal > LIMITS.maxPrincipal || monthly > LIMITS.maxMonthly) return fail('AMOUNT_TOO_LARGE', '金额看起来有点大，检查一下')
  if (!Number.isFinite(annualRate) || annualRate < LIMITS.minAnnualRate || annualRate > LIMITS.maxAnnualRate) {
    return fail('INVALID_RATE', '年化收益率建议填 0 到 100')
  }
  if (!Number.isFinite(years) || years < LIMITS.minYears || years > LIMITS.maxYears) {
    return fail('INVALID_YEARS', '投资年限建议填 0.5 到 80 年')
  }

  const months = Math.max(Math.round(years * 12), 1)
  const annualRateDecimal = annualRate / 100
  const monthlyRate = annualRateDecimal > 0 ? Math.pow(1 + annualRateDecimal, 1 / 12) - 1 : 0
  const growthFactor = Math.pow(1 + monthlyRate, months)
  const principalFuture = principal * growthFactor
  const sipFuture = monthlyRate === 0 ? monthly * months : monthly * ((growthFactor - 1) / monthlyRate)
  const totalAssets = principalFuture + sipFuture
  const totalInvested = principal + monthly * months
  const totalProfit = totalAssets - totalInvested
  const profitRate = totalInvested > 0 ? totalProfit / totalInvested * 100 : 0
  const values = [months, monthlyRate, growthFactor, principalFuture, sipFuture, totalAssets, totalInvested, totalProfit, profitRate]
  if (!values.every(Number.isFinite)) return fail('CALCULATION_OVERFLOW', '复利结果超出可计算范围')

  return {
    ok: true,
    data: { principal, monthly, annualRate, years, months, monthlyRate, growthFactor, principalFuture, sipFuture, totalAssets, totalInvested, totalProfit, profitRate },
  }
}

module.exports = { LIMITS, calculateCompound }
