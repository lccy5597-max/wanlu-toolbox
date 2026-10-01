const assert = require('assert')

const converter = require('../utils/tool-logic/converter')
const dateDiff = require('../utils/tool-logic/date-diff')
const bmi = require('../utils/tool-logic/bmi')
const mortgage = require('../utils/tool-logic/mortgage')
const salary = require('../utils/tool-logic/salary')
const { POLICY_META, incomeTax, mortgage: mortgagePolicy } = require('../utils/policy-config')

const assertNoNonFinite = (value, path = 'result') => {
  if (typeof value === 'number') {
    assert(Number.isFinite(value), `${path} contains non-finite number`)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoNonFinite(item, `${path}[${index}]`))
    return
  }
  if (value && typeof value === 'object') {
    Object.keys(value).forEach((key) => assertNoNonFinite(value[key], `${path}.${key}`))
  }
}

const converterOk = converter.convertValue({
  category: 'length',
  value: '1',
  fromUnitIndex: 2,
  toUnitIndex: 1,
})
assert.strictEqual(converterOk.ok, true)
assert.strictEqual(converterOk.data.formatted, '100')
assert.strictEqual(converter.convertValue({ category: 'length', value: 'Infinity', fromUnitIndex: 2, toUnitIndex: 1 }).ok, false)
assertNoNonFinite(converterOk)

const interval = dateDiff.calculateInterval({ startDate: '2024-02-28', endDate: '2024-03-01' })
assert.strictEqual(interval.ok, true)
assert.strictEqual(interval.data.days, 2)
const offset = dateDiff.calculateOffset({ baseDate: '2024-02-29', offsetDays: 1, direction: 'after' })
assert.strictEqual(offset.ok, true)
assert.strictEqual(offset.data.targetDate, '2024-03-01')
assertNoNonFinite(interval)
assertNoNonFinite(offset)

const bmiOk = bmi.calculateBmi({ heightCm: 170, weightKg: 65 })
assert.strictEqual(bmiOk.ok, true)
assert.strictEqual(bmiOk.data.category, 'normal')
assert.strictEqual(bmi.calculateBmi({ heightCm: Infinity, weightKg: 65 }).ok, false)
assertNoNonFinite(bmiOk)

const mortgageOk = mortgage.calculateMortgage({
  commercialAmount: 1000000,
  fundAmount: 0,
  years: 30,
  commercialRate: mortgagePolicy.defaultCommercialRate,
  fundRate: mortgagePolicy.defaultFundRate,
  repayType: 'interest',
}, mortgagePolicy)
assert.strictEqual(mortgageOk.ok, true)
assert.strictEqual(mortgageOk.data.schedule.length, 360)
assert.strictEqual(mortgage.calculateMortgage({
  commercialAmount: Infinity,
  fundAmount: 0,
  years: 30,
  commercialRate: 3.2,
  fundRate: 0,
  repayType: 'interest',
}, mortgagePolicy).ok, false)
assertNoNonFinite(mortgageOk)

const salaryOk = salary.calculateSalary({
  grossSalary: 10000,
  socialRates: incomeTax.socialInsuranceItems.map((item) => item.rate),
  fundRate: incomeTax.defaultHousingFundRate,
  specialDeduction: 0,
}, incomeTax)
assert.strictEqual(salaryOk.ok, true)
assert.strictEqual(salary.calculateSalary({
  grossSalary: Infinity,
  socialRates: [],
  fundRate: 0,
  specialDeduction: 0,
}, incomeTax).ok, false)
assertNoNonFinite(salaryOk)

assert(POLICY_META.version)
assert(POLICY_META.updatedAt)

console.log('Stage 4 Step 3 tool-logic smoke tests: PASS')
