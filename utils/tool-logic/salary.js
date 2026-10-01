const { incomeTax: defaultIncomeTaxPolicy } = require('../policy-config')

// 税率、起征点和默认缴费比例来自 utils/policy-config.js；本文件只实现参数化计算。
const fail = (errorCode, errorMessage) => ({
  ok: false,
  errorCode,
  errorMessage,
})

const parseRateList = (rates) => {
  if (!Array.isArray(rates)) return fail('INVALID_SOCIAL_RATE', '五险比例无效')

  const values = []
  for (const rate of rates) {
    const value = rate == null || rate === '' ? 0 : Number(rate)
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      return fail('INVALID_SOCIAL_RATE', '五险比例需为 0 到 100 的有限数值')
    }
    values.push(value)
  }

  const totalRate = values.reduce((total, value) => total + value, 0)
  if (!Number.isFinite(totalRate) || totalRate > 100) {
    return fail('INVALID_SOCIAL_RATE', '五险个人比例合计不能超过 100%')
  }

  return { ok: true, data: { values, totalRate } }
}

const calculateTaxAmount = (taxableIncome, brackets) => {
  if (!Number.isFinite(taxableIncome) || taxableIncome < 0) {
    return fail('INVALID_TAXABLE_INCOME', '应纳税所得额无效')
  }
  if (taxableIncome <= 0) return { ok: true, data: { tax: 0 } }
  if (!Array.isArray(brackets) || !brackets.length) return fail('INVALID_TAX_RULE', '个税规则无效')

  const bracket = brackets.find((item) => taxableIncome <= item.limit)
  if (!bracket || !Number.isFinite(Number(bracket.rate)) || !Number.isFinite(Number(bracket.deduction))) {
    return fail('INVALID_TAX_RULE', '个税规则无效')
  }

  const tax = Math.max(taxableIncome * Number(bracket.rate) - Number(bracket.deduction), 0)
  if (!Number.isFinite(tax)) return fail('CALCULATION_OVERFLOW', '个税结果超出可计算范围')
  return { ok: true, data: { tax } }
}

const calculateSocialPreview = ({ grossSalary, socialRates }) => {
  const gross = grossSalary == null || grossSalary === '' ? 0 : Number(grossSalary)
  if (!Number.isFinite(gross) || gross < 0 || gross > Number.MAX_SAFE_INTEGER) {
    return fail('INVALID_GROSS_SALARY', '税前月薪无效')
  }

  const rates = parseRateList(socialRates)
  if (!rates.ok) return rates

  const amounts = rates.data.values.map((rate) => gross * rate / 100)
  if (!amounts.every(Number.isFinite)) return fail('CALCULATION_OVERFLOW', '五险预览超出可计算范围')

  return {
    ok: true,
    data: {
      amounts,
      totalRate: rates.data.totalRate,
      totalAmount: amounts.reduce((total, amount) => total + amount, 0),
    },
  }
}

const calculateSalary = (input, rules = defaultIncomeTaxPolicy) => {
  const grossSalary = Number(input.grossSalary)
  if (!Number.isFinite(grossSalary) || grossSalary <= 0 || grossSalary > Number.MAX_SAFE_INTEGER) {
    return fail('INVALID_GROSS_SALARY', '请填写有效税前月薪')
  }

  const rates = parseRateList(input.socialRates)
  if (!rates.ok) return rates

  const fundRate = input.fundRate == null || input.fundRate === '' ? 0 : Number(input.fundRate)
  if (!Number.isFinite(fundRate) || fundRate < 0 || fundRate > 100) {
    return fail('INVALID_FUND_RATE', '公积金比例需为 0 到 100 的有限数值')
  }

  if (rates.data.totalRate + fundRate > 100) {
    return fail('INVALID_CONTRIBUTION_RATE', '五险与公积金个人比例合计不能超过 100%')
  }

  const specialDeduction = input.specialDeduction == null || input.specialDeduction === ''
    ? 0
    : Number(input.specialDeduction)
  if (!Number.isFinite(specialDeduction) || specialDeduction < 0 || specialDeduction > Number.MAX_SAFE_INTEGER) {
    return fail('INVALID_DEDUCTION', '专项附加扣除需为非负有限数值')
  }

  const threshold = Number(rules.threshold)
  if (!Number.isFinite(threshold) || threshold < 0) return fail('INVALID_TAX_RULE', '个税起征点规则无效')

  const socialAmount = grossSalary * rates.data.totalRate / 100
  const fundAmount = grossSalary * fundRate / 100
  const contribution = socialAmount + fundAmount
  const taxableIncome = Math.max(grossSalary - contribution - specialDeduction - threshold, 0)
  const taxResult = calculateTaxAmount(taxableIncome, rules.brackets)
  if (!taxResult.ok) return taxResult

  const tax = taxResult.data.tax
  const takeHome = Math.max(grossSalary - contribution - tax, 0)
  const netRatePercent = Math.round(takeHome / grossSalary * 100)
  const values = [socialAmount, fundAmount, contribution, taxableIncome, tax, takeHome, netRatePercent]
  if (!values.every(Number.isFinite)) return fail('CALCULATION_OVERFLOW', '工资结果超出可计算范围')

  return {
    ok: true,
    data: {
      grossSalary,
      socialRate: rates.data.totalRate,
      fundRate,
      specialDeduction,
      socialAmount,
      fundAmount,
      contribution,
      taxableIncome,
      tax,
      takeHome,
      netRatePercent,
    },
  }
}

module.exports = {
  calculateSalary,
  calculateSocialPreview,
  calculateTaxAmount,
  parseRateList,
}
