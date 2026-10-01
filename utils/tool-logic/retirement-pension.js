const { pension: defaultPensionPolicy } = require('../policy-config')

const fail = (errorCode, errorMessage) => ({ ok: false, errorCode, errorMessage })
const optionalNumber = (value) => (value == null || value === '' ? 0 : Number(value))
const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const getAccountMonthsByAge = (age, rules = defaultPensionPolicy) => {
  const ageNumber = Number(age)
  if (!Number.isFinite(ageNumber) || !Array.isArray(rules.retireAgeOptions) || !rules.retireAgeOptions.length) return null
  const matched = [...rules.retireAgeOptions].reverse().find((item) => ageNumber >= Number(item.age))
  return matched ? Number(matched.months) : Number(rules.retireAgeOptions[0].months)
}

const calculateRetirementPension = (input, rules = defaultPensionPolicy) => {
  const currentAge = Number(input.currentAge)
  const retireAge = Number(input.retireAge)
  const payYears = optionalNumber(input.payYears)
  const accountBalance = optionalNumber(input.accountBalance)
  const monthlyPayBase = optionalNumber(input.monthlyPayBase)
  const estimateBase = Number(input.estimateBase)
  const accountMonths = Number(input.accountMonths)
  const extraMonthly = optionalNumber(input.extraMonthly)

  const numericValues = [currentAge, retireAge, payYears, accountBalance, monthlyPayBase, estimateBase, accountMonths, extraMonthly]
  if (!numericValues.every(Number.isFinite)) return fail('INVALID_INPUT', '请输入有限数值')
  if (currentAge <= 0 || currentAge > 90) return fail('INVALID_CURRENT_AGE', '请填写当前年龄')
  if (retireAge <= 0 || retireAge > 90) return fail('INVALID_RETIRE_AGE', '请选择退休年龄')
  if (payYears < 0 || payYears > 80) return fail('INVALID_PAY_YEARS', '请填写已缴年限')
  if (accountBalance < 0 || accountBalance > Number.MAX_SAFE_INTEGER) return fail('INVALID_ACCOUNT_BALANCE', '账户余额不能为负或超出范围')
  if (monthlyPayBase < 0 || monthlyPayBase > Number.MAX_SAFE_INTEGER) return fail('INVALID_PAY_BASE', '缴费基数不能为负或超出范围')
  if (estimateBase <= 0 || estimateBase > Number.MAX_SAFE_INTEGER) return fail('INVALID_ESTIMATE_BASE', '请填写估算基准')
  if (accountMonths <= 0 || accountMonths > 300) return fail('INVALID_ACCOUNT_MONTHS', '计发月数需大于 0 且不超过 300')
  if (extraMonthly < 0 || extraMonthly > Number.MAX_SAFE_INTEGER) return fail('INVALID_EXTRA_MONTHLY', '其他月待遇不能为负或超出范围')

  const levels = Array.isArray(rules.contributionLevels) ? rules.contributionLevels : []
  const level = levels.find((item) => item.id === input.contributionLevel)
  if (!level || !Number.isFinite(Number(level.index))) return fail('INVALID_CONTRIBUTION_LEVEL', '请选择有效缴费水平')

  const personalRate = Number(rules.personalAccountRate)
  const basePensionRate = Number(rules.basePensionRate)
  const minIndex = Number(rules.minContributionIndex)
  const maxIndex = Number(rules.maxContributionIndex)
  if (![personalRate, basePensionRate, minIndex, maxIndex].every(Number.isFinite)) return fail('INVALID_POLICY', '养老金规则无效')

  const futureYears = Math.max(retireAge - currentAge, 0)
  const totalYears = payYears + futureYears
  if (!Number.isFinite(totalYears) || totalYears <= 0) return fail('INVALID_TOTAL_YEARS', '缴费年限不能为 0')

  const estimatedIndex = monthlyPayBase > 0 ? clamp(monthlyPayBase / estimateBase, minIndex, maxIndex) : Number(level.index)
  const futureMonthlyAccount = monthlyPayBase > 0 ? monthlyPayBase * personalRate : estimateBase * Number(level.index) * personalRate
  const futureAccountBalance = accountBalance + futureMonthlyAccount * 12 * futureYears
  const basePension = estimateBase * (1 + estimatedIndex) / 2 * totalYears * basePensionRate
  const accountPension = futureAccountBalance / accountMonths
  const monthlyTotal = basePension + accountPension + extraMonthly
  const yearlyTotal = monthlyTotal * 12
  const values = [futureYears, totalYears, estimatedIndex, futureMonthlyAccount, futureAccountBalance, basePension, accountPension, monthlyTotal, yearlyTotal]
  if (!values.every(Number.isFinite)) return fail('CALCULATION_OVERFLOW', '养老金估算结果超出可计算范围')

  return {
    ok: true,
    data: { currentAge, retireAge, payYears, accountBalance, monthlyPayBase, estimateBase, accountMonths, extraMonthly, contributionLevel: level.id, futureYears, totalYears, estimatedIndex, futureMonthlyAccount, futureAccountBalance, basePension, accountPension, monthlyTotal, yearlyTotal },
  }
}

module.exports = { calculateRetirementPension, getAccountMonthsByAge }
