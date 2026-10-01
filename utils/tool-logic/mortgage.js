const { mortgage: defaultMortgagePolicy } = require('../policy-config')

// 计算边界依赖 utils/policy-config.js；政策参数本身不在本文件复制维护。
const fail = (errorCode, errorMessage) => ({
  ok: false,
  errorCode,
  errorMessage,
})

const parseOptionalAmount = (value, fieldName) => {
  if (value == null || value === '') return { ok: true, value: 0 }
  const number = Number(value)
  if (!Number.isFinite(number)) return fail('INVALID_AMOUNT', `${fieldName}必须是有限数值`)
  if (number < 0 || number > Number.MAX_SAFE_INTEGER) return fail('INVALID_AMOUNT', `${fieldName}超出可计算范围`)
  return { ok: true, value: number }
}

const parseRate = (value, fieldName) => {
  if (value == null || value === '') return fail('INVALID_RATE', `请填写${fieldName}`)
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) return fail('INVALID_RATE', `${fieldName}必须是非负有限数值`)
  return { ok: true, value: number }
}

const resultIsFinite = (result) => {
  if (!result || !Array.isArray(result.schedule)) return false
  const summary = [result.firstMonth, result.totalInterest, result.totalRepayment, result.monthlyDecrease]
  if (!summary.every(Number.isFinite)) return false
  return result.schedule.every((item) => (
    Number.isFinite(item.period) &&
    Number.isFinite(item.payment) &&
    Number.isFinite(item.principal) &&
    Number.isFinite(item.interest)
  ))
}

const buildFlatSchedule = (monthlyPayment, principal, months) => {
  const principalPerMonth = principal / months
  return Array.from({ length: months }, (_, index) => ({
    period: index + 1,
    payment: monthlyPayment,
    principal: principalPerMonth,
    interest: 0,
  }))
}

const calculateEqualInterest = (principal, monthlyRate, months) => {
  if (monthlyRate === 0) {
    const monthlyPayment = principal / months
    return {
      firstMonth: monthlyPayment,
      totalInterest: 0,
      totalRepayment: principal,
      monthlyDecrease: 0,
      schedule: buildFlatSchedule(monthlyPayment, principal, months),
    }
  }

  const pow = Math.pow(1 + monthlyRate, months)
  const denominator = pow - 1
  if (!Number.isFinite(pow) || !Number.isFinite(denominator) || denominator === 0) return null

  const monthlyPayment = principal * monthlyRate * pow / denominator
  const totalRepayment = monthlyPayment * months
  const totalInterest = totalRepayment - principal
  const schedule = []
  let remaining = principal

  for (let index = 1; index <= months; index += 1) {
    const interest = remaining * monthlyRate
    const principalPaid = monthlyPayment - interest
    remaining -= principalPaid
    schedule.push({
      period: index,
      payment: monthlyPayment,
      principal: principalPaid,
      interest,
    })
  }

  return {
    firstMonth: monthlyPayment,
    totalInterest,
    totalRepayment,
    monthlyDecrease: 0,
    schedule,
  }
}

const calculateEqualPrincipal = (principal, monthlyRate, months) => {
  const principalPerMonth = principal / months
  const firstMonth = principalPerMonth + principal * monthlyRate
  const monthlyDecrease = principalPerMonth * monthlyRate
  const totalInterest = principal * monthlyRate * (months + 1) / 2
  const schedule = []

  for (let index = 1; index <= months; index += 1) {
    const remaining = principal - principalPerMonth * (index - 1)
    const interest = remaining * monthlyRate
    schedule.push({
      period: index,
      payment: principalPerMonth + interest,
      principal: principalPerMonth,
      interest,
    })
  }

  return {
    firstMonth,
    totalInterest,
    totalRepayment: principal + totalInterest,
    monthlyDecrease,
    schedule,
  }
}

const calculateLoanPart = (principal, annualRate, months, repayType) => {
  const monthlyRate = annualRate / 100 / 12
  return repayType === 'principal'
    ? calculateEqualPrincipal(principal, monthlyRate, months)
    : calculateEqualInterest(principal, monthlyRate, months)
}

const mergeLoanParts = (parts, months) => {
  const summary = parts.reduce((acc, item) => ({
    firstMonth: acc.firstMonth + item.firstMonth,
    totalInterest: acc.totalInterest + item.totalInterest,
    totalRepayment: acc.totalRepayment + item.totalRepayment,
    monthlyDecrease: acc.monthlyDecrease + item.monthlyDecrease,
  }), {
    firstMonth: 0,
    totalInterest: 0,
    totalRepayment: 0,
    monthlyDecrease: 0,
  })

  const schedule = Array.from({ length: months }, (_, index) => (
    parts.reduce((acc, item) => ({
      period: index + 1,
      payment: acc.payment + item.schedule[index].payment,
      principal: acc.principal + item.schedule[index].principal,
      interest: acc.interest + item.schedule[index].interest,
    }), {
      period: index + 1,
      payment: 0,
      principal: 0,
      interest: 0,
    })
  ))

  return {
    ...summary,
    schedule,
  }
}

const calculateMortgage = (input, rules = defaultMortgagePolicy) => {
  const commercial = parseOptionalAmount(input.commercialAmount, '商业贷款金额')
  if (!commercial.ok) return commercial
  const fund = parseOptionalAmount(input.fundAmount, '公积金贷款金额')
  if (!fund.ok) return fund

  const totalPrincipal = commercial.value + fund.value
  if (!Number.isFinite(totalPrincipal) || totalPrincipal <= 0 || totalPrincipal > Number.MAX_SAFE_INTEGER) {
    return fail('INVALID_PRINCIPAL', '请填写有效贷款金额')
  }

  const years = Number(input.years)
  if (
    !Number.isFinite(years) ||
    !Number.isInteger(years) ||
    years < Number(rules.minYears) ||
    years > Number(rules.maxYears)
  ) {
    return fail('INVALID_YEARS', `贷款年限需为 ${rules.minYears}-${rules.maxYears} 年整数`)
  }

  const repayType = input.repayType
  if (repayType !== 'interest' && repayType !== 'principal') {
    return fail('INVALID_REPAY_TYPE', '请选择有效还款方式')
  }

  const loans = []
  if (commercial.value > 0) {
    const rate = parseRate(input.commercialRate, '商业贷利率')
    if (!rate.ok) return rate
    loans.push({ amount: commercial.value, annualRate: rate.value })
  }

  if (fund.value > 0) {
    const rate = parseRate(input.fundRate, '公积金利率')
    if (!rate.ok) return rate
    loans.push({ amount: fund.value, annualRate: rate.value })
  }

  const months = years * 12
  const parts = loans.map((item) => calculateLoanPart(item.amount, item.annualRate, months, repayType))
  if (parts.some((item) => !item || !resultIsFinite(item))) {
    return fail('CALCULATION_OVERFLOW', '贷款参数超出可计算范围')
  }

  const summary = mergeLoanParts(parts, months)
  if (!resultIsFinite(summary)) {
    return fail('CALCULATION_OVERFLOW', '贷款参数超出可计算范围')
  }

  return {
    ok: true,
    data: {
      ...summary,
      months,
      totalPrincipal,
    },
  }
}

const calculateLoanFromPrice = ({ totalPrice, downPaymentRate }) => {
  const price = Number(totalPrice)
  const rate = Number(downPaymentRate)
  if (!Number.isFinite(price) || price <= 0) return fail('INVALID_PRICE', '房屋总价无效')
  if (!Number.isFinite(rate) || rate < 0 || rate >= 100) return fail('INVALID_DOWN_PAYMENT_RATE', '首付比例无效')

  const downPaymentAmount = price * rate / 100
  const loanAmount = price * (100 - rate) / 100
  if (!Number.isFinite(downPaymentAmount) || !Number.isFinite(loanAmount)) {
    return fail('CALCULATION_OVERFLOW', '金额超出可计算范围')
  }

  return { ok: true, data: { downPaymentAmount, loanAmount } }
}

const calculatePriceFromLoan = ({ loanAmount, downPaymentRate }) => {
  const loan = Number(loanAmount)
  const rate = Number(downPaymentRate)
  if (!Number.isFinite(loan) || loan <= 0) return fail('INVALID_AMOUNT', '贷款金额无效')
  if (!Number.isFinite(rate) || rate < 0 || rate >= 100) return fail('INVALID_DOWN_PAYMENT_RATE', '首付比例无效')

  const totalPrice = loan / ((100 - rate) / 100)
  const downPaymentAmount = totalPrice * rate / 100
  if (!Number.isFinite(totalPrice) || !Number.isFinite(downPaymentAmount)) {
    return fail('CALCULATION_OVERFLOW', '金额超出可计算范围')
  }

  return { ok: true, data: { totalPrice, downPaymentAmount, loanAmount: loan } }
}

module.exports = {
  calculateEqualInterest,
  calculateEqualPrincipal,
  calculateLoanFromPrice,
  calculateLoanPart,
  calculateMortgage,
  calculatePriceFromLoan,
  mergeLoanParts,
}
