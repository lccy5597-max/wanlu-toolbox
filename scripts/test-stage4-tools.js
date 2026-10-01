const assert = require('assert')
const fs = require('fs')
const path = require('path')

const converter = require('../utils/tool-logic/converter')
const dateDiff = require('../utils/tool-logic/date-diff')
const bmi = require('../utils/tool-logic/bmi')
const mortgage = require('../utils/tool-logic/mortgage')
const salary = require('../utils/tool-logic/salary')
const priceCompare = require('../utils/tool-logic/price-compare')
const compound = require('../utils/tool-logic/compound')
const retirementPension = require('../utils/tool-logic/retirement-pension')
const retirementAge = require('../utils/tool-logic/retirement-age')
const shelfLife = require('../utils/tool-logic/shelf-life')
const relationship = require('../utils/tool-logic/relationship')
const bmr = require('../utils/tool-logic/bmr')
const restaurant = require('../utils/tool-logic/restaurant')
const imageCompress = require('../utils/tool-logic/image-compress')
const imageResize = require('../utils/tool-logic/image-resize')
const qrCode = require('../utils/tool-logic/qrcode')
const imageWatermark = require('../utils/tool-logic/image-watermark')
const longImage = require('../utils/tool-logic/long-image')
const nineGrid = require('../utils/tool-logic/nine-grid')
const pindou = require('../utils/tool-logic/pindou')
const pindouEngine = require('../utils/pindou-engine')
const videoCompress = require('../utils/tool-logic/video-compress')
const {
  POLICY_META,
  incomeTax,
  mortgage: mortgagePolicy,
  pension: pensionPolicy,
  retirementAge: retirementAgePolicy,
  business: businessPolicy,
} = require('../utils/policy-config')

let passed = 0

const test = (name, fn) => {
  try {
    fn()
    passed += 1
  } catch (error) {
    error.message = `${name}: ${error.message}`
    throw error
  }
}

const cloneJson = (value) => JSON.parse(JSON.stringify(value))
const snapshot = (value) => JSON.stringify(value)
const approx = (actual, expected, tolerance = 1e-9) => {
  assert(Number.isFinite(actual), `expected finite number, received ${actual}`)
  assert(Math.abs(actual - expected) <= tolerance, `expected ${actual} ≈ ${expected}`)
}
const assertFiniteTree = (value, path = 'result') => {
  if (typeof value === 'number') {
    assert(Number.isFinite(value), `${path} contains non-finite number`)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertFiniteTree(item, `${path}[${index}]`))
    return
  }
  if (value && typeof value === 'object') {
    Object.keys(value).forEach((key) => assertFiniteTree(value[key], `${path}.${key}`))
  }
}
const assertStableThreeRuns = (fn) => {
  const first = fn()
  const second = fn()
  const third = fn()
  assert.deepStrictEqual(second, first)
  assert.deepStrictEqual(third, first)
}
const assertNotMutated = (input, fn) => {
  const before = snapshot(input)
  fn(input)
  assert.strictEqual(snapshot(input), before)
}

// converter
const convert = (overrides = {}) => converter.convertValue({
  category: 'length',
  value: 1,
  fromUnitIndex: 2,
  toUnitIndex: 1,
  ...overrides,
})

test('converter integer conversion', () => {
  const result = convert()
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.data.value, 100)
  assert.strictEqual(result.data.formatted, '100')
})
test('converter decimal conversion', () => {
  const result = convert({ value: 1.5, fromUnitIndex: 3, toUnitIndex: 2 })
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.data.value, 1500)
})
test('converter same-unit conversion', () => {
  const result = convert({ category: 'weight', value: 1.25, fromUnitIndex: 2, toUnitIndex: 2 })
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.data.value, 1.25)
})
test('converter zero', () => {
  const result = convert({ value: 0 })
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.data.formatted, '0')
})
test('converter tiny finite decimal', () => {
  const result = convert({ value: 1e-12, fromUnitIndex: 2, toUnitIndex: 2 })
  assert.strictEqual(result.ok, true)
  assert(Number.isFinite(result.data.value))
  assert.strictEqual(result.data.formatted, '0')
})
test('converter large finite value', () => {
  const result = convert({ value: 1e100, fromUnitIndex: 2, toUnitIndex: 2 })
  assert.strictEqual(result.ok, true)
  assert(Number.isFinite(result.data.value))
})
test('converter Celsius to Fahrenheit', () => {
  const result = convert({ category: 'temperature', value: 0, fromUnitIndex: 0, toUnitIndex: 1 })
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.data.value, 32)
})
test('converter Kelvin to Celsius', () => {
  const result = convert({ category: 'temperature', value: 273.15, fromUnitIndex: 2, toUnitIndex: 0 })
  assert.strictEqual(result.ok, true)
  approx(result.data.value, 0, 1e-10)
})
test('converter negative finite temperature', () => {
  const result = convert({ category: 'temperature', value: -40, fromUnitIndex: 0, toUnitIndex: 1 })
  assert.strictEqual(result.ok, true)
  approx(result.data.value, -40)
})
test('converter small-value display precision is stable', () => {
  const result = convert({ value: 1 / 3, fromUnitIndex: 2, toUnitIndex: 2 })
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.data.formatted, '0.333333')
})
test('converter large-value display precision is stable', () => {
  const result = convert({ value: 1234.567, fromUnitIndex: 2, toUnitIndex: 2 })
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.data.formatted, '1234.57')
})
for (const [name, value] of [
  ['empty', ''],
  ['blank', '   '],
  ['nonnumeric', 'abc'],
  ['NaN number', NaN],
  ['NaN string', 'NaN'],
  ['Infinity number', Infinity],
  ['Infinity string', 'Infinity'],
  ['negative Infinity', -Infinity],
]) {
  test(`converter rejects ${name}`, () => {
    const result = convert({ value })
    assert.strictEqual(result.ok, false)
    assert(!result.data)
  })
}
test('converter rejects invalid category', () => assert.strictEqual(convert({ category: 'bad' }).ok, false))
test('converter rejects invalid source unit', () => assert.strictEqual(convert({ fromUnitIndex: -1 }).ok, false))
test('converter rejects invalid target unit', () => assert.strictEqual(convert({ toUnitIndex: 99 }).ok, false))
test('converter rejects null as empty input', () => assert.strictEqual(convert({ value: null }).ok, false))
test('converter never returns successful non-finite result', () => {
  const result = convert({ value: Number.MAX_VALUE, fromUnitIndex: 0, toUnitIndex: 3 })
  if (result.ok) assertFiniteTree(result.data)
})
test('converter repeated execution is stable', () => {
  assertStableThreeRuns(() => convert({ category: 'volume', value: 3.25, fromUnitIndex: 1, toUnitIndex: 0 }))
})
test('converter does not mutate input', () => {
  const input = { category: 'length', value: '12.5', fromUnitIndex: 2, toUnitIndex: 1 }
  assertNotMutated(input, converter.convertValue)
})

// date-diff
const interval = (startDate, endDate) => dateDiff.calculateInterval({ startDate, endDate })
const offset = (baseDate, offsetDays, direction = 'after') => dateDiff.calculateOffset({ baseDate, offsetDays, direction })

test('date-diff same day', () => {
  const result = interval('2026-09-29', '2026-09-29')
  assert.strictEqual(result.ok, true)
  assert.deepStrictEqual({ days: result.data.days, inclusive: result.data.inclusiveDays, direction: result.data.direction }, { days: 0, inclusive: 1, direction: 'same' })
})
test('date-diff adjacent days', () => assert.strictEqual(interval('2026-09-28', '2026-09-29').data.days, 1))
test('date-diff same month', () => assert.strictEqual(interval('2026-09-01', '2026-09-29').data.days, 28))
test('date-diff cross month', () => assert.strictEqual(interval('2026-01-31', '2026-02-01').data.days, 1))
test('date-diff cross year', () => assert.strictEqual(interval('2025-12-31', '2026-01-01').data.days, 1))
test('date-diff leap day span', () => assert.strictEqual(interval('2024-02-28', '2024-03-01').data.days, 2))
test('date-diff accepts leap day', () => assert.strictEqual(dateDiff.parseDateString('2024-02-29').ok, true))
test('date-diff rejects non-leap Feb 29', () => assert.strictEqual(dateDiff.parseDateString('2023-02-29').ok, false))
test('date-diff month end offset', () => assert.strictEqual(offset('2026-01-31', 1).data.targetDate, '2026-02-01'))
test('date-diff year end offset', () => assert.strictEqual(offset('2025-12-31', 1).data.targetDate, '2026-01-01'))
test('date-diff leap day offset', () => assert.strictEqual(offset('2024-02-28', 1).data.targetDate, '2024-02-29'))
test('date-diff reverse interval keeps signed direction', () => {
  const result = interval('2026-10-03', '2026-09-29')
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.data.days, 4)
  assert.strictEqual(result.data.signedDays, -4)
  assert.strictEqual(result.data.direction, 'reverse')
})
test('date-diff rejects empty start', () => assert.strictEqual(interval('', '2026-01-01').ok, false))
test('date-diff rejects empty end', () => assert.strictEqual(interval('2026-01-01', '').ok, false))
test('date-diff rejects malformed date', () => assert.strictEqual(interval('2026/01/01', '2026-01-02').ok, false))
test('date-diff rejects nonexistent date', () => assert.strictEqual(interval('2026-04-31', '2026-05-01').ok, false))
test('date-diff rejects invalid type', () => assert.strictEqual(interval({}, '2026-01-01').ok, false))
test('date-diff rejects negative offset', () => assert.strictEqual(offset('2026-01-01', -1).ok, false))
test('date-diff rejects decimal offset', () => assert.strictEqual(offset('2026-01-01', 1.5).ok, false))
test('date-diff rejects oversized offset', () => assert.strictEqual(offset('2026-01-01', 36501).ok, false))
test('date-diff rejects invalid direction', () => assert.strictEqual(offset('2026-01-01', 1, 'sideways').ok, false))
test('date-diff rejects NaN and Infinity offsets', () => {
  assert.strictEqual(offset('2026-01-01', NaN).ok, false)
  assert.strictEqual(offset('2026-01-01', Infinity).ok, false)
  assert.strictEqual(offset('2026-01-01', -Infinity).ok, false)
})
test('date-diff civil-day math is timezone-independent', () => {
  const first = dateDiff.parseDateString('2026-03-01')
  const second = dateDiff.parseDateString('2026-03-02')
  assert.strictEqual(first.ok && second.ok, true)
  assert.strictEqual(second.data.dayNumber - first.data.dayNumber, 1)
})
test('date-diff repeated execution is stable', () => assertStableThreeRuns(() => interval('2024-02-29', '2025-03-01')))
test('date-diff does not mutate input', () => {
  const input = { startDate: '2024-02-29', endDate: '2025-03-01' }
  assertNotMutated(input, dateDiff.calculateInterval)
})

// bmi
const calcBmi = (heightCm, weightKg) => bmi.calculateBmi({ heightCm, weightKg })

test('bmi normal calculation', () => {
  const result = calcBmi(170, 65)
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.data.bmi, 22.5)
  assert.strictEqual(result.data.category, 'normal')
})
test('bmi decimal input', () => {
  const result = calcBmi('170.5', '65.25')
  assert.strictEqual(result.ok, true)
  assertFiniteTree(result.data)
})
test('bmi threshold 18.5 category', () => assert.strictEqual(bmi.classifyBmi(18.5), 'normal'))
test('bmi threshold below 24 category', () => assert.strictEqual(bmi.classifyBmi(23.999), 'normal'))
test('bmi threshold 24 category', () => assert.strictEqual(bmi.classifyBmi(24), 'overweight'))
test('bmi threshold below 28 category', () => assert.strictEqual(bmi.classifyBmi(27.999), 'overweight'))
test('bmi threshold 28 category', () => assert.strictEqual(bmi.classifyBmi(28), 'obese'))
test('bmi minimum allowed dimensions remain finite', () => {
  const result = calcBmi(bmi.BMI_LIMITS.minHeightCm, bmi.BMI_LIMITS.minWeightKg)
  assert.strictEqual(result.ok, true)
  assertFiniteTree(result.data)
})
test('bmi maximum allowed dimensions remain finite', () => {
  const result = calcBmi(bmi.BMI_LIMITS.maxHeightCm, bmi.BMI_LIMITS.maxWeightKg)
  assert.strictEqual(result.ok, true)
  assertFiniteTree(result.data)
})
for (const [name, heightCm, weightKg] of [
  ['zero height', 0, 65],
  ['zero weight', 170, 0],
  ['negative height', -170, 65],
  ['negative weight', 170, -65],
  ['empty height', '', 65],
  ['empty weight', 170, ''],
  ['nonnumeric height', 'abc', 65],
  ['NaN height', NaN, 65],
  ['Infinity height', Infinity, 65],
  ['Infinity weight', 170, Infinity],
]) {
  test(`bmi rejects ${name}`, () => assert.strictEqual(calcBmi(heightCm, weightKg).ok, false))
}
test('bmi successful output contains only legal category and finite values', () => {
  const result = calcBmi(180, 80)
  assert.strictEqual(result.ok, true)
  assert(['underweight', 'normal', 'overweight', 'obese'].includes(result.data.category))
  assertFiniteTree(result.data)
})
test('bmi repeated execution is stable', () => assertStableThreeRuns(() => calcBmi(172.3, 68.4)))
test('bmi does not mutate input', () => {
  const input = { heightCm: '172.3', weightKg: '68.4' }
  assertNotMutated(input, bmi.calculateBmi)
})

// mortgage
const mortgageInput = (overrides = {}) => ({
  commercialAmount: 1000000,
  fundAmount: 0,
  years: 30,
  commercialRate: mortgagePolicy.defaultCommercialRate,
  fundRate: mortgagePolicy.defaultFundRate,
  repayType: 'interest',
  ...overrides,
})
const calcMortgage = (overrides = {}, rules = mortgagePolicy) => mortgage.calculateMortgage(mortgageInput(overrides), rules)

test('mortgage equal-interest normal case', () => {
  const result = calcMortgage()
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.data.schedule.length, 360)
  assertFiniteTree(result.data)
  approx(result.data.totalRepayment, result.data.totalPrincipal + result.data.totalInterest, 1e-5)
})
test('mortgage equal-interest known-value regression', () => {
  const result = calcMortgage()
  assert.strictEqual(result.ok, true)
  approx(result.data.firstMonth, 4324.668652111663, 1e-6)
  approx(result.data.totalInterest, 556880.7147601985, 1e-5)
  approx(result.data.totalRepayment, 1556880.7147601985, 1e-5)
})
test('mortgage equal-principal normal case', () => {
  const result = calcMortgage({ repayType: 'principal' })
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.data.schedule.length, 360)
  assert(result.data.monthlyDecrease > 0)
  assert(result.data.schedule[0].payment > result.data.schedule[result.data.schedule.length - 1].payment)
  assertFiniteTree(result.data)
})
test('mortgage equal-principal known-value regression', () => {
  const result = calcMortgage({ repayType: 'principal' })
  assert.strictEqual(result.ok, true)
  approx(result.data.firstMonth, 5444.444444444444, 1e-6)
  approx(result.data.totalInterest, 481333.3333333333, 1e-5)
  approx(result.data.totalRepayment, 1481333.3333333333, 1e-5)
})
test('mortgage combined loan', () => {
  const result = calcMortgage({ commercialAmount: 700000, fundAmount: 300000, fundRate: mortgagePolicy.defaultFundRate })
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.data.totalPrincipal, 1000000)
  assert.strictEqual(result.data.schedule.length, 360)
})
test('mortgage zero interest equal-interest', () => {
  const result = calcMortgage({ commercialRate: 0, years: 10 })
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.data.totalInterest, 0)
  assert.strictEqual(result.data.totalRepayment, 1000000)
  assert.strictEqual(result.data.schedule.length, 120)
})
test('mortgage zero interest equal-principal', () => {
  const result = calcMortgage({ commercialRate: 0, years: 10, repayType: 'principal' })
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.data.totalInterest, 0)
  assert.strictEqual(result.data.totalRepayment, 1000000)
})
test('mortgage minimum one-year term', () => {
  const result = calcMortgage({ years: mortgagePolicy.minYears })
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.data.schedule.length, mortgagePolicy.minYears * 12)
})
test('mortgage maximum policy term', () => {
  const result = calcMortgage({ years: mortgagePolicy.maxYears })
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.data.schedule.length, mortgagePolicy.maxYears * 12)
})
test('mortgage decimal interest rate', () => assert.strictEqual(calcMortgage({ commercialRate: 3.125 }).ok, true))
test('mortgage large finite principal', () => {
  const result = calcMortgage({ commercialAmount: 10000000 })
  assert.strictEqual(result.ok, true)
  assertFiniteTree(result.data)
})
test('mortgage rejects zero total principal', () => assert.strictEqual(calcMortgage({ commercialAmount: 0, fundAmount: 0 }).ok, false))
test('mortgage rejects negative principal', () => assert.strictEqual(calcMortgage({ commercialAmount: -1 }).ok, false))
test('mortgage rejects negative interest', () => assert.strictEqual(calcMortgage({ commercialRate: -0.1 }).ok, false))
test('mortgage rejects zero term', () => assert.strictEqual(calcMortgage({ years: 0 }).ok, false))
test('mortgage rejects negative term', () => assert.strictEqual(calcMortgage({ years: -1 }).ok, false))
test('mortgage rejects non-integer term', () => assert.strictEqual(calcMortgage({ years: 1.5 }).ok, false))
test('mortgage rejects NaN term', () => assert.strictEqual(calcMortgage({ years: NaN }).ok, false))
test('mortgage rejects Infinity term', () => assert.strictEqual(calcMortgage({ years: Infinity }).ok, false))
test('mortgage rejects NaN principal', () => assert.strictEqual(calcMortgage({ commercialAmount: NaN }).ok, false))
test('mortgage rejects Infinity principal', () => assert.strictEqual(calcMortgage({ commercialAmount: Infinity }).ok, false))
test('mortgage rejects Infinity fund principal', () => assert.strictEqual(calcMortgage({ commercialAmount: 0, fundAmount: Infinity }).ok, false))
test('mortgage rejects Infinity interest', () => assert.strictEqual(calcMortgage({ commercialRate: Infinity }).ok, false))
test('mortgage rejects nonnumeric interest', () => assert.strictEqual(calcMortgage({ commercialRate: 'abc' }).ok, false))
test('mortgage rejects invalid repayment type', () => assert.strictEqual(calcMortgage({ repayType: 'balloon' }).ok, false))
test('mortgage protects against finite calculation overflow', () => assert.strictEqual(calcMortgage({ commercialRate: 1e308 }).ok, false))
test('mortgage uses supplied policy year boundaries', () => {
  const rules = { ...mortgagePolicy, minYears: 2, maxYears: 2 }
  assert.strictEqual(calcMortgage({ years: 1 }, rules).ok, false)
  assert.strictEqual(calcMortgage({ years: 2 }, rules).ok, true)
})
test('mortgage policy metadata exists', () => {
  assert(POLICY_META.version)
  assert(POLICY_META.updatedAt)
  assert.strictEqual(typeof mortgagePolicy.defaultCommercialRate, 'string')
  assert.strictEqual(typeof mortgagePolicy.defaultFundRate, 'string')
})
test('mortgage uses default policy config when rules are omitted', () => {
  const input = mortgageInput({ years: mortgagePolicy.minYears })
  const result = mortgage.calculateMortgage(input)
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.data.months, mortgagePolicy.minYears * 12)
})
test('mortgage money output has stable two-decimal display projection', () => {
  const result = calcMortgage({ commercialAmount: 1234567, commercialRate: 3.125, years: 20 })
  assert.strictEqual(result.ok, true)
  ;['firstMonth', 'totalInterest', 'totalRepayment', 'monthlyDecrease'].forEach((key) => {
    const display = result.data[key].toFixed(2)
    assert(/^-?\d+\.\d{2}$/.test(display), `${key} did not produce stable 2-decimal projection`)
  })
})
test('mortgage repeated execution is stable', () => assertStableThreeRuns(() => calcMortgage({ years: 20, commercialRate: 3.2 })))
test('mortgage does not mutate input', () => {
  const input = mortgageInput({ years: 20 })
  assertNotMutated(input, (value) => mortgage.calculateMortgage(value, mortgagePolicy))
})
test('mortgage does not mutate policy config', () => {
  const before = snapshot(mortgagePolicy)
  calcMortgage()
  assert.strictEqual(snapshot(mortgagePolicy), before)
})

// salary
const defaultSocialRates = () => incomeTax.socialInsuranceItems.map((item) => item.rate)
const salaryInput = (overrides = {}) => ({
  grossSalary: 10000,
  socialRates: defaultSocialRates(),
  fundRate: incomeTax.defaultHousingFundRate,
  specialDeduction: 0,
  ...overrides,
})
const calcSalary = (overrides = {}, rules = incomeTax) => salary.calculateSalary(salaryInput(overrides), rules)

test('salary normal case', () => {
  const result = calcSalary()
  assert.strictEqual(result.ok, true)
  assertFiniteTree(result.data)
  assert(result.data.takeHome > 0)
})
test('salary decimal gross salary', () => {
  const result = calcSalary({ grossSalary: 12345.67 })
  assert.strictEqual(result.ok, true)
  assertFiniteTree(result.data)
})
test('salary threshold with no contributions', () => {
  const result = calcSalary({ grossSalary: incomeTax.threshold, socialRates: [], fundRate: 0 })
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.data.taxableIncome, 0)
  assert.strictEqual(result.data.tax, 0)
})
test('salary first tax bracket upper boundary', () => {
  const taxable = incomeTax.brackets[0].limit
  const result = salary.calculateTaxAmount(taxable, incomeTax.brackets)
  assert.strictEqual(result.ok, true)
  approx(result.data.tax, 90)
})
test('salary first tax bracket transition is stable', () => {
  const result = salary.calculateTaxAmount(incomeTax.brackets[0].limit + 0.01, incomeTax.brackets)
  assert.strictEqual(result.ok, true)
  approx(result.data.tax, 90.001, 1e-9)
})
test('salary all configured tax brackets produce finite tax', () => {
  incomeTax.brackets.slice(0, -1).forEach((bracket) => {
    const result = salary.calculateTaxAmount(bracket.limit, incomeTax.brackets)
    assert.strictEqual(result.ok, true)
    assertFiniteTree(result.data)
  })
  const high = salary.calculateTaxAmount(1000000, incomeTax.brackets)
  assert.strictEqual(high.ok, true)
  assertFiniteTree(high.data)
})
test('salary every finite tax-bracket transition is finite and monotonic', () => {
  incomeTax.brackets.slice(0, -1).forEach((bracket) => {
    const below = salary.calculateTaxAmount(bracket.limit - 0.01, incomeTax.brackets)
    const at = salary.calculateTaxAmount(bracket.limit, incomeTax.brackets)
    const above = salary.calculateTaxAmount(bracket.limit + 0.01, incomeTax.brackets)
    assert.strictEqual(below.ok && at.ok && above.ok, true)
    assertFiniteTree(below.data)
    assertFiniteTree(at.data)
    assertFiniteTree(above.data)
    assert(below.data.tax <= at.data.tax + 1e-9)
    assert(at.data.tax <= above.data.tax + 1e-9)
  })
})
test('salary special deduction may reduce taxable income to zero', () => {
  const result = calcSalary({ grossSalary: 6000, socialRates: [], fundRate: 0, specialDeduction: 10000 })
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.data.taxableIncome, 0)
  assert.strictEqual(result.data.tax, 0)
  assert.strictEqual(result.data.takeHome, 6000)
})
test('salary high finite income remains finite', () => {
  const result = calcSalary({ grossSalary: 1000000000, socialRates: [], fundRate: 0 })
  assert.strictEqual(result.ok, true)
  assertFiniteTree(result.data)
})
test('salary money values have stable two-decimal display projection', () => {
  const result = calcSalary({ grossSalary: 12345.67 })
  assert.strictEqual(result.ok, true)
  ;['takeHome', 'tax', 'contribution', 'socialAmount', 'fundAmount', 'taxableIncome'].forEach((key) => {
    const display = result.data[key].toFixed(2)
    assert(/^\d+\.\d{2}$/.test(display), `${key} did not produce stable 2-decimal projection`)
  })
})
test('salary rejects zero gross salary', () => assert.strictEqual(calcSalary({ grossSalary: 0 }).ok, false))
test('salary rejects negative gross salary', () => assert.strictEqual(calcSalary({ grossSalary: -1 }).ok, false))
test('salary rejects nonnumeric gross salary', () => assert.strictEqual(calcSalary({ grossSalary: 'abc' }).ok, false))
test('salary rejects NaN gross salary', () => assert.strictEqual(calcSalary({ grossSalary: NaN }).ok, false))
test('salary rejects Infinity gross salary', () => assert.strictEqual(calcSalary({ grossSalary: Infinity }).ok, false))
test('salary rejects negative social rate', () => assert.strictEqual(calcSalary({ socialRates: [-1] }).ok, false))
test('salary rejects Infinity social rate', () => assert.strictEqual(calcSalary({ socialRates: [Infinity] }).ok, false))
test('salary rejects social rate above 100', () => assert.strictEqual(calcSalary({ socialRates: [101] }).ok, false))
test('salary rejects social total above 100', () => assert.strictEqual(calcSalary({ socialRates: [60, 50] }).ok, false))
test('salary rejects negative fund rate', () => assert.strictEqual(calcSalary({ fundRate: -1 }).ok, false))
test('salary rejects Infinity fund rate', () => assert.strictEqual(calcSalary({ fundRate: Infinity }).ok, false))
test('salary rejects NaN fund rate', () => assert.strictEqual(calcSalary({ fundRate: NaN }).ok, false))
test('salary rejects nonnumeric fund rate', () => assert.strictEqual(calcSalary({ fundRate: 'abc' }).ok, false))
test('salary rejects contribution total above 100', () => assert.strictEqual(calcSalary({ socialRates: [60], fundRate: 50 }).ok, false))
test('salary rejects negative special deduction', () => assert.strictEqual(calcSalary({ specialDeduction: -1 }).ok, false))
test('salary rejects Infinity special deduction', () => assert.strictEqual(calcSalary({ specialDeduction: Infinity }).ok, false))
test('salary rejects NaN special deduction', () => assert.strictEqual(calcSalary({ specialDeduction: NaN }).ok, false))
test('salary rejects nonnumeric special deduction', () => assert.strictEqual(calcSalary({ specialDeduction: 'abc' }).ok, false))
test('salary policy threshold is consumed from supplied rules', () => {
  const rules = cloneJson(incomeTax)
  rules.brackets[rules.brackets.length - 1].limit = Infinity
  rules.threshold = 6000
  const result = calcSalary({ grossSalary: 6000, socialRates: [], fundRate: 0 }, rules)
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.data.taxableIncome, 0)
})
test('salary policy metadata exists', () => {
  assert(POLICY_META.version)
  assert(POLICY_META.updatedAt)
  assert(Number.isFinite(Number(incomeTax.threshold)))
  assert(Array.isArray(incomeTax.brackets) && incomeTax.brackets.length > 0)
})
test('salary uses default policy config when rules are omitted', () => {
  const input = salaryInput({ grossSalary: incomeTax.threshold, socialRates: [], fundRate: 0 })
  const result = salary.calculateSalary(input)
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.data.taxableIncome, 0)
  assert.strictEqual(result.data.tax, 0)
})
test('salary repeated execution is stable', () => assertStableThreeRuns(() => calcSalary({ grossSalary: 18500.25, specialDeduction: 1500 })))
test('salary does not mutate input', () => {
  const input = salaryInput({ grossSalary: 18500.25, specialDeduction: 1500 })
  assertNotMutated(input, (value) => salary.calculateSalary(value, incomeTax))
})
test('salary does not mutate policy config', () => {
  const before = snapshot(incomeTax)
  calcSalary()
  assert.strictEqual(snapshot(incomeTax), before)
})

// price-compare
const compareItems = (overrides = {}) => ([
  { id: 'a', name: 'A', price: 10, amount: 100, unitIndex: 0 },
  { id: 'b', name: 'B', price: 18, amount: 200, unitIndex: 0 },
].map((item, index) => ({ ...item, ...(overrides[index] || {}) })))
const compare = (mode = 'weight', items = compareItems()) => priceCompare.buildCompareState(mode, items)

test('price-compare normal comparison', () => {
  const result = compare()
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.data.hasResult, true)
  assert.strictEqual(result.data.items.find((item) => item.id === 'b').isBest, true)
  assertFiniteTree(result.data.items.map((item) => ({ unitPrice: item.unitPrice })))
})
test('price-compare identical unit price ties', () => {
  const result = compare('weight', compareItems({ 1: { price: 20, amount: 200 } }))
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.data.items.filter((item) => item.isBest).length, 2)
})
test('price-compare supports kg and g normalization', () => {
  const result = compare('weight', [
    { id: 'a', price: 10, amount: 500, unitIndex: 0 },
    { id: 'b', price: 18, amount: 1, unitIndex: 1 },
  ])
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.data.items[1].isBest, true)
})
test('price-compare zero price is not valid result', () => {
  const result = compare('weight', compareItems({ 0: { price: 0 } }))
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.data.hasResult, false)
})
test('price-compare tiny positive amount remains finite when computable', () => {
  const result = compare('count', [
    { id: 'a', price: 1, amount: 1e-100, unitIndex: 0 },
    { id: 'b', price: 2, amount: 1, unitIndex: 0 },
  ])
  assert.strictEqual(result.ok, true)
  result.data.items.filter((item) => item.hasValid).forEach((item) => assert(Number.isFinite(item.unitPrice)))
})
for (const [name, patch] of [
  ['negative price', { price: -1 }],
  ['negative amount', { amount: -1 }],
  ['NaN price', { price: NaN }],
  ['Infinity price', { price: Infinity }],
  ['Infinity amount', { amount: Infinity }],
  ['empty price', { price: '' }],
  ['nonnumeric amount', { amount: 'abc' }],
]) {
  test(`price-compare rejects ${name} as valid item`, () => {
    const result = compare('weight', compareItems({ 0: patch }))
    assert.strictEqual(result.ok, true)
    assert.strictEqual(result.data.items[0].hasValid, false)
    assert.strictEqual(result.data.hasResult, false)
  })
}
test('price-compare rejects invalid mode', () => assert.strictEqual(compare('bad').ok, false))
test('price-compare large finite values do not leak non-finite result', () => {
  const result = compare('count', [
    { id: 'a', price: 1e100, amount: 1e50, unitIndex: 0 },
    { id: 'b', price: 2e100, amount: 2e50, unitIndex: 0 },
  ])
  assert.strictEqual(result.ok, true)
  assertFiniteTree(result.data.items.map((item) => ({ unitPrice: item.unitPrice })))
})
test('price-compare repeated execution is stable', () => assertStableThreeRuns(() => compare()))
test('price-compare does not mutate input', () => {
  const input = compareItems()
  assertNotMutated(input, (value) => priceCompare.buildCompareState('weight', value))
})

// compound
const compoundInput = (overrides = {}) => ({ principalValue: 10000, monthlyValue: 1000, annualRateValue: 6, yearsValue: 10, ...overrides })
const calcCompound = (overrides = {}) => compound.calculateCompound(compoundInput(overrides))
test('compound normal case', () => { const r = calcCompound(); assert.strictEqual(r.ok, true); assertFiniteTree(r.data); assert(r.data.totalAssets > r.data.totalInvested) })
test('compound principal-only zero-rate case', () => { const r = calcCompound({ monthlyValue: 0, annualRateValue: 0, yearsValue: 1 }); assert.strictEqual(r.ok, true); assert.strictEqual(r.data.totalAssets, 10000) })
test('compound monthly-only zero-rate case', () => { const r = calcCompound({ principalValue: 0, monthlyValue: 1000, annualRateValue: 0, yearsValue: 1 }); assert.strictEqual(r.ok, true); assert.strictEqual(r.data.totalAssets, 12000) })
test('compound allows zero principal with monthly investment', () => assert.strictEqual(calcCompound({ principalValue: 0 }).ok, true))
test('compound rejects zero principal and zero monthly', () => assert.strictEqual(calcCompound({ principalValue: 0, monthlyValue: 0 }).ok, false))
test('compound rejects negative principal', () => assert.strictEqual(calcCompound({ principalValue: -1 }).ok, false))
test('compound rejects negative monthly', () => assert.strictEqual(calcCompound({ monthlyValue: -1 }).ok, false))
test('compound accepts zero annual rate', () => assert.strictEqual(calcCompound({ annualRateValue: 0 }).ok, true))
test('compound accepts upper annual rate boundary', () => assert.strictEqual(calcCompound({ annualRateValue: 100 }).ok, true))
test('compound rejects annual rate above boundary', () => assert.strictEqual(calcCompound({ annualRateValue: 100.01 }).ok, false))
test('compound rejects negative annual rate', () => assert.strictEqual(calcCompound({ annualRateValue: -0.01 }).ok, false))
test('compound rejects NaN annual rate', () => assert.strictEqual(calcCompound({ annualRateValue: NaN }).ok, false))
test('compound rejects Infinity annual rate', () => assert.strictEqual(calcCompound({ annualRateValue: Infinity }).ok, false))
test('compound accepts minimum years', () => assert.strictEqual(calcCompound({ yearsValue: compound.LIMITS.minYears }).ok, true))
test('compound accepts maximum years', () => assert.strictEqual(calcCompound({ yearsValue: compound.LIMITS.maxYears }).ok, true))
test('compound rejects zero years', () => assert.strictEqual(calcCompound({ yearsValue: 0 }).ok, false))
test('compound rejects negative years', () => assert.strictEqual(calcCompound({ yearsValue: -1 }).ok, false))
test('compound rejects Infinity years', () => assert.strictEqual(calcCompound({ yearsValue: Infinity }).ok, false))
test('compound rejects nonnumeric amount', () => assert.strictEqual(calcCompound({ principalValue: 'abc' }).ok, false))
test('compound rejects NaN principal', () => assert.strictEqual(calcCompound({ principalValue: NaN }).ok, false))
test('compound rejects Infinity principal', () => assert.strictEqual(calcCompound({ principalValue: Infinity }).ok, false))
test('compound rejects amount above configured limit', () => assert.strictEqual(calcCompound({ principalValue: compound.LIMITS.maxPrincipal + 1 }).ok, false))
test('compound repeated execution is stable', () => assertStableThreeRuns(() => calcCompound({ annualRateValue: 3.5, yearsValue: 20 })))
test('compound does not mutate input', () => { const input = compoundInput(); assertNotMutated(input, compound.calculateCompound) })

// retirement-pension
const pensionInput = (overrides = {}) => ({
  currentAge: 35,
  retireAge: 60,
  payYears: 5,
  accountBalance: 100000,
  monthlyPayBase: 10000,
  contributionLevel: 'average',
  estimateBase: pensionPolicy.defaultBase,
  accountMonths: 139,
  extraMonthly: 0,
  ...overrides,
})
const calcPension = (overrides = {}, rules = pensionPolicy) => retirementPension.calculateRetirementPension(pensionInput(overrides), rules)
test('retirement-pension normal case', () => { const r = calcPension(); assert.strictEqual(r.ok, true); assertFiniteTree(r.data); assert(r.data.monthlyTotal > 0) })
test('retirement-pension current age equals retire age', () => { const r = calcPension({ currentAge: 60, retireAge: 60, payYears: 20 }); assert.strictEqual(r.ok, true); assert.strictEqual(r.data.futureYears, 0) })
test('retirement-pension already older than retire age keeps future years zero', () => { const r = calcPension({ currentAge: 65, retireAge: 60, payYears: 20 }); assert.strictEqual(r.ok, true); assert.strictEqual(r.data.futureYears, 0) })
test('retirement-pension supports zero account balance', () => assert.strictEqual(calcPension({ accountBalance: 0 }).ok, true))
test('retirement-pension supports blank monthly pay base via contribution level', () => assert.strictEqual(calcPension({ monthlyPayBase: '' }).ok, true))
test('retirement-pension account months mapping', () => {
  assert.strictEqual(retirementPension.getAccountMonthsByAge(50, pensionPolicy), 195)
  assert.strictEqual(retirementPension.getAccountMonthsByAge(55, pensionPolicy), 170)
  assert.strictEqual(retirementPension.getAccountMonthsByAge(60, pensionPolicy), 139)
  assert.strictEqual(retirementPension.getAccountMonthsByAge(65, pensionPolicy), 101)
})
for (const [name, patch] of [
  ['zero current age', { currentAge: 0 }], ['age above 90', { currentAge: 91 }], ['NaN age', { currentAge: NaN }], ['Infinity age', { currentAge: Infinity }],
  ['zero retire age', { retireAge: 0 }], ['negative pay years', { payYears: -1 }], ['pay years above 80', { payYears: 81 }],
  ['negative balance', { accountBalance: -1 }], ['Infinity balance', { accountBalance: Infinity }], ['negative monthly base', { monthlyPayBase: -1 }],
  ['zero estimate base', { estimateBase: 0 }], ['zero account months', { accountMonths: 0 }], ['account months above 300', { accountMonths: 301 }],
  ['negative extra monthly', { extraMonthly: -1 }], ['invalid contribution level', { contributionLevel: 'bad' }],
]) {
  test(`retirement-pension rejects ${name}`, () => assert.strictEqual(calcPension(patch).ok, false))
}
test('retirement-pension supplied policy changes calculation parameters', () => {
  const rules = { ...pensionPolicy, personalAccountRate: 0.1 }
  const base = calcPension()
  const changed = calcPension({}, rules)
  assert.strictEqual(base.ok && changed.ok, true)
  assert(changed.data.futureAccountBalance > base.data.futureAccountBalance)
})
test('retirement-pension policy metadata exists', () => { assert(POLICY_META.version); assert(POLICY_META.updatedAt) })
test('retirement-pension repeated execution is stable', () => assertStableThreeRuns(() => calcPension()))
test('retirement-pension does not mutate input', () => { const input = pensionInput(); assertNotMutated(input, (value) => retirementPension.calculateRetirementPension(value, pensionPolicy)) })
test('retirement-pension does not mutate policy config', () => { const before = snapshot(pensionPolicy); calcPension(); assert.strictEqual(snapshot(pensionPolicy), before) })

// retirement-age
const calcRetirementAge = (birthDate, workerType = 'male', rules = retirementAgePolicy) => retirementAge.calculateRetirementAge({ birthDate, workerType }, rules)
test('retirement-age male normal case', () => { const r = calcRetirementAge('1965-01-15'); assert.strictEqual(r.ok, true); assert.strictEqual(r.data.delayMonths, 1) })
test('retirement-age pre-policy old retirement gets zero delay', () => { const r = calcRetirementAge('1964-12-15'); assert.strictEqual(r.ok, true); assert.strictEqual(r.data.delayMonths, 0) })
test('retirement-age covers all worker types', () => { retirementAgePolicy.workerTypes.forEach((type) => assert.strictEqual(calcRetirementAge('1975-01-15', type.id).ok, true)) })
test('retirement-age accepts leap-day birth', () => assert.strictEqual(calcRetirementAge('1964-02-29').ok, true))
test('retirement-age rejects non-leap Feb 29', () => assert.strictEqual(calcRetirementAge('1965-02-29').ok, false))
test('retirement-age rejects blank birth date', () => assert.strictEqual(calcRetirementAge('').ok, false))
test('retirement-age rejects malformed birth date', () => assert.strictEqual(calcRetirementAge('1965/01/01').ok, false))
test('retirement-age rejects NaN-like birth input', () => assert.strictEqual(calcRetirementAge('NaN').ok, false))
test('retirement-age rejects Infinity-like birth input', () => assert.strictEqual(calcRetirementAge('Infinity').ok, false))
test('retirement-age rejects invalid worker type', () => assert.strictEqual(calcRetirementAge('1965-01-01', 'bad').ok, false))
test('retirement-age supports extreme valid early year deterministically', () => assert.strictEqual(calcRetirementAge('0001-01-01').ok, true))
test('retirement-age delay is capped by worker policy', () => {
  retirementAgePolicy.workerTypes.forEach((type) => {
    const r = calcRetirementAge('2000-01-01', type.id)
    assert.strictEqual(r.ok, true)
    assert(r.data.delayMonths <= type.maxDelayMonths)
  })
})
test('retirement-age repeated execution is stable', () => assertStableThreeRuns(() => calcRetirementAge('1975-06-30', 'female50')))
test('retirement-age does not mutate input', () => { const input = { birthDate: '1975-06-30', workerType: 'female50' }; assertNotMutated(input, (value) => retirementAge.calculateRetirementAge(value, retirementAgePolicy)) })
test('retirement-age does not mutate policy config', () => { const before = snapshot(retirementAgePolicy); calcRetirementAge('1975-01-01'); assert.strictEqual(snapshot(retirementAgePolicy), before) })

// shelf-life
const calcShelf = (overrides = {}) => shelfLife.calculateShelfLife({ manufactureDate: '2026-01-01', referenceDate: '2026-01-01', shelfLifeValue: 30, unitKey: 'day', ...overrides })
test('shelf-life one day expires on manufacture date', () => { const r = calcShelf({ shelfLifeValue: 1 }); assert.strictEqual(r.ok, true); assert.strictEqual(r.data.expiryDate, '2026-01-01') })
test('shelf-life crosses year for day units', () => { const r = calcShelf({ manufactureDate: '2025-12-31', referenceDate: '2025-12-31', shelfLifeValue: 2 }); assert.strictEqual(r.data.expiryDate, '2026-01-01') })
test('shelf-life month-end clamp non-leap', () => { const r = calcShelf({ manufactureDate: '2026-01-31', referenceDate: '2026-01-31', shelfLifeValue: 1, unitKey: 'month' }); assert.strictEqual(r.data.expiryDate, '2026-02-27') })
test('shelf-life month-end clamp leap year', () => { const r = calcShelf({ manufactureDate: '2024-01-31', referenceDate: '2024-01-31', shelfLifeValue: 1, unitKey: 'month' }); assert.strictEqual(r.data.expiryDate, '2024-02-28') })
test('shelf-life leap-day plus one year follows current clamp-minus-one rule', () => { const r = calcShelf({ manufactureDate: '2024-02-29', referenceDate: '2024-02-29', shelfLifeValue: 1, unitKey: 'year' }); assert.strictEqual(r.data.expiryDate, '2025-02-27') })
test('shelf-life fresh status', () => assert.strictEqual(calcShelf({ referenceDate: '2026-01-01', shelfLifeValue: 30 }).data.statusTheme, 'fresh'))
test('shelf-life warning status', () => assert.strictEqual(calcShelf({ referenceDate: '2026-01-24', shelfLifeValue: 30 }).data.statusTheme, 'warning'))
test('shelf-life today status', () => assert.strictEqual(calcShelf({ referenceDate: '2026-01-30', shelfLifeValue: 30 }).data.statusTheme, 'today'))
test('shelf-life expired status', () => assert.strictEqual(calcShelf({ referenceDate: '2026-01-31', shelfLifeValue: 30 }).data.statusTheme, 'expired'))
for (const [name, patch] of [
  ['empty manufacture date', { manufactureDate: '' }], ['invalid manufacture date', { manufactureDate: '2026-02-30' }], ['empty reference date', { referenceDate: '' }],
  ['zero life', { shelfLifeValue: 0 }], ['negative life', { shelfLifeValue: -1 }], ['decimal life', { shelfLifeValue: 1.5 }], ['NaN life', { shelfLifeValue: NaN }],
  ['Infinity life', { shelfLifeValue: Infinity }], ['oversized life', { shelfLifeValue: 10000 }], ['invalid unit', { unitKey: 'week' }],
]) {
  test(`shelf-life rejects ${name}`, () => assert.strictEqual(calcShelf(patch).ok, false))
}
test('shelf-life repeated execution is stable', () => assertStableThreeRuns(() => calcShelf({ manufactureDate: '2024-02-29', shelfLifeValue: 24, unitKey: 'month' })))
test('shelf-life does not mutate input', () => { const input = { manufactureDate: '2024-02-29', referenceDate: '2026-01-01', shelfLifeValue: 24, unitKey: 'month' }; assertNotMutated(input, shelfLife.calculateShelfLife) })

// relationship
test('relationship resolves single relation', () => { const r = relationship.resolveRelationship('爸爸'); assert.strictEqual(r.ok, true); assert.strictEqual(r.data.title, '爸爸') })
test('relationship resolves alias', () => { const r = relationship.resolveRelationship('父亲'); assert.strictEqual(r.ok, true); assert.strictEqual(r.data.title, '爸爸') })
test('relationship resolves multi-level relation', () => { const r = relationship.resolveRelationship('爸爸的姐姐的儿子'); assert.strictEqual(r.ok, true); assert(r.data.title.includes('表')) })
test('relationship resolves spouse relation', () => { const r = relationship.resolveRelationship('丈夫的妈妈'); assert.strictEqual(r.ok, true); assert.strictEqual(r.data.title, '婆婆') })
test('relationship rejects empty relation', () => assert.strictEqual(relationship.resolveRelationship('').ok, false))
test('relationship rejects unknown token', () => assert.strictEqual(relationship.resolveRelationship('火星人').ok, false))
test('relationship rejects unsupported relation path', () => assert.strictEqual(relationship.resolveRelationship('爸爸的老公').ok, false))
test('relationship normalizes spaces', () => assert.strictEqual(relationship.resolveRelationship(' 爸爸 的 姐姐 ').ok, true))
test('relationship silent/internal calculation cannot record usage', () => assert.strictEqual(relationship.shouldRecordRelationshipUsage({ success: true, alreadyRecorded: false, countAsUserAction: false }), false))
test('relationship first successful user action records once', () => assert.strictEqual(relationship.shouldRecordRelationshipUsage({ success: true, alreadyRecorded: false, countAsUserAction: true }), true))
test('relationship already-recorded build does not record twice', () => assert.strictEqual(relationship.shouldRecordRelationshipUsage({ success: true, alreadyRecorded: true, countAsUserAction: true }), false))
test('relationship failed result never records usage', () => assert.strictEqual(relationship.shouldRecordRelationshipUsage({ success: false, alreadyRecorded: false, countAsUserAction: true }), false))
test('relationship continuous build produces at most one usage decision', () => {
  let recorded = false; let count = 0
  for (const value of ['爸爸', '爸爸的姐姐', '爸爸的姐姐的儿子']) {
    const success = relationship.resolveRelationship(value).ok
    if (relationship.shouldRecordRelationshipUsage({ success, alreadyRecorded: recorded, countAsUserAction: true })) { recorded = true; count += 1 }
  }
  assert.strictEqual(count, 1)
})
test('relationship repeated execution is stable', () => assertStableThreeRuns(() => relationship.resolveRelationship('爸爸的姐姐的儿子')))
test('relationship does not mutate input wrapper', () => { const input = { value: '爸爸的姐姐' }; assertNotMutated(input, (value) => relationship.resolveRelationship(value.value)) })

// bmr
const bmrInput = (overrides = {}) => ({ gender: 'male', age: 30, height: 175, weight: 70, activityKey: 'sedentary', ...overrides })
const calcBmr = (overrides = {}) => bmr.calculateBmr(bmrInput(overrides))
test('bmr male normal case', () => { const r = calcBmr(); assert.strictEqual(r.ok, true); assert.strictEqual(r.data.bmr, 1649); assertFiniteTree(r.data) })
test('bmr female normal case', () => { const r = calcBmr({ gender: 'female' }); assert.strictEqual(r.ok, true); assert.strictEqual(r.data.bmr, 1483) })
test('bmr supports all configured activities', () => { bmr.activityOptions.forEach((option) => { const r = calcBmr({ activityKey: option.id }); assert.strictEqual(r.ok, true); assert.strictEqual(r.data.activityLabel, option.label) }) })
test('bmr accepts adult age boundaries', () => { assert.strictEqual(calcBmr({ age: 18 }).ok, true); assert.strictEqual(calcBmr({ age: 100 }).ok, true) })
test('bmr rejects under-18 input to match adult-only UI guidance', () => assert.strictEqual(calcBmr({ age: 17 }).ok, false))
test('bmr accepts height boundaries', () => { assert.strictEqual(calcBmr({ height: 100 }).ok, true); assert.strictEqual(calcBmr({ height: 250 }).ok, true) })
test('bmr accepts weight boundaries', () => { assert.strictEqual(calcBmr({ weight: 20 }).ok, true); assert.strictEqual(calcBmr({ weight: 300 }).ok, true) })
for (const [name, patch] of [
  ['zero age', { age: 0 }], ['negative age', { age: -1 }], ['NaN age', { age: NaN }], ['Infinity age', { age: Infinity }],
  ['zero height', { height: 0 }], ['zero weight', { weight: 0 }], ['nonnumeric weight', { weight: 'abc' }],
  ['invalid gender', { gender: 'other' }], ['invalid activity', { activityKey: 'extreme' }],
]) {
  test(`bmr rejects ${name}`, () => assert.strictEqual(calcBmr(patch).ok, false))
}
test('bmr repeated execution is stable', () => assertStableThreeRuns(() => calcBmr({ gender: 'female', activityKey: 'moderate', age: 35.5, height: 165.5, weight: 60.5 })))
test('bmr does not mutate input', () => { const input = bmrInput(); assertNotMutated(input, bmr.calculateBmr) })

// restaurant
const restaurantCostInput = (overrides = {}) => ({ monthlyRent: 2, rentPayMonths: 3, rentDeposit: 2, transferFee: 5, franchiseFee: 0, decorationAdCost: 10, equipmentCost: 8, openingStock: 3, ...overrides })
const restaurantBreakEvenInput = (overrides = {}) => ({ offlineGrossMarginRate: 60, deliveryGrossMarginRate: 45, offlineSalesRate: 60, deliverySalesRate: 40, fixedRent: 10000, fixedLabor: 20000, fixedUtilities: 5000, fixedOther: 5000, ...overrides })
const restaurantAnalysisInput = (overrides = {}) => ({ monthlyRevenue: 100000, foodCost: 35000, laborCost: 20000, rentCost: 10000, platformCost: 5000, utilityCost: 3000, otherCost: 2000, ...overrides })
test('restaurant cost normal case', () => { const r = restaurant.calculateCost(restaurantCostInput(), businessPolicy); assert.strictEqual(r.ok, true); assertFiniteTree(r.data); assert(r.data.total > 0) })
test('restaurant cost rejects all-zero input', () => assert.strictEqual(restaurant.calculateCost(restaurantCostInput({ monthlyRent: 0, rentPayMonths: 0, rentDeposit: 0, transferFee: 0, decorationAdCost: 0, equipmentCost: 0, openingStock: 0 }), businessPolicy).ok, false))
test('restaurant cost rejects negative cost', () => assert.strictEqual(restaurant.calculateCost(restaurantCostInput({ equipmentCost: -1 }), businessPolicy).ok, false))
test('restaurant cost rejects Infinity', () => assert.strictEqual(restaurant.calculateCost(restaurantCostInput({ monthlyRent: Infinity }), businessPolicy).ok, false))
test('restaurant break-even normal case', () => { const r = restaurant.calculateBreakEven(restaurantBreakEvenInput(), businessPolicy); assert.strictEqual(r.ok, true); assertFiniteTree(r.data); assert(r.data.breakEvenRevenue > 0) })
test('restaurant P1 regression rejects gross margin above 100 percent', () => assert.strictEqual(restaurant.calculateBreakEven(restaurantBreakEvenInput({ offlineGrossMarginRate: 150 }), businessPolicy).ok, false))
test('restaurant rejects negative gross margin', () => assert.strictEqual(restaurant.calculateBreakEven(restaurantBreakEvenInput({ offlineGrossMarginRate: -1 }), businessPolicy).ok, false))
test('restaurant rejects Infinity gross margin', () => assert.strictEqual(restaurant.calculateBreakEven(restaurantBreakEvenInput({ offlineGrossMarginRate: Infinity }), businessPolicy).ok, false))
test('restaurant rejects NaN gross margin', () => assert.strictEqual(restaurant.calculateBreakEven(restaurantBreakEvenInput({ offlineGrossMarginRate: NaN }), businessPolicy).ok, false))
test('restaurant rejects invalid sales mix total', () => assert.strictEqual(restaurant.calculateBreakEven(restaurantBreakEvenInput({ offlineSalesRate: 70, deliverySalesRate: 40 }), businessPolicy).ok, false))
test('restaurant rejects zero fixed cost', () => assert.strictEqual(restaurant.calculateBreakEven(restaurantBreakEvenInput({ fixedRent: 0, fixedLabor: 0, fixedUtilities: 0, fixedOther: 0 }), businessPolicy).ok, false))
test('restaurant analysis normal case', () => { const r = restaurant.calculateAnalysis(restaurantAnalysisInput(), businessPolicy); assert.strictEqual(r.ok, true); assertFiniteTree(r.data) })
test('restaurant analysis allows legitimate loss', () => { const r = restaurant.calculateAnalysis(restaurantAnalysisInput({ foodCost: 120000 }), businessPolicy); assert.strictEqual(r.ok, true); assert(r.data.profit < 0); assert.strictEqual(r.data.health, '亏损') })
test('restaurant analysis rejects zero revenue', () => assert.strictEqual(restaurant.calculateAnalysis(restaurantAnalysisInput({ monthlyRevenue: 0 }), businessPolicy).ok, false))
test('restaurant analysis rejects negative cost', () => assert.strictEqual(restaurant.calculateAnalysis(restaurantAnalysisInput({ foodCost: -1 }), businessPolicy).ok, false))
test('restaurant analysis rejects Infinity cost', () => assert.strictEqual(restaurant.calculateAnalysis(restaurantAnalysisInput({ foodCost: Infinity }), businessPolicy).ok, false))
test('restaurant analysis rejects NaN cost', () => assert.strictEqual(restaurant.calculateAnalysis(restaurantAnalysisInput({ foodCost: NaN }), businessPolicy).ok, false))
test('restaurant analysis rejects NaN revenue', () => assert.strictEqual(restaurant.calculateAnalysis(restaurantAnalysisInput({ monthlyRevenue: NaN }), businessPolicy).ok, false))
test('restaurant complement rejects percentage above 100', () => assert.strictEqual(restaurant.getComplementRate(150), ''))
test('restaurant complement normal value', () => assert.strictEqual(restaurant.getComplementRate(60), '40'))
test('restaurant repeated execution is stable', () => assertStableThreeRuns(() => restaurant.calculateBreakEven(restaurantBreakEvenInput(), businessPolicy)))
test('restaurant does not mutate input', () => { const input = restaurantBreakEvenInput(); assertNotMutated(input, (value) => restaurant.calculateBreakEven(value, businessPolicy)) })
test('restaurant does not mutate business policy', () => { const before = snapshot(businessPolicy); restaurant.calculateAnalysis(restaurantAnalysisInput(), businessPolicy); assert.strictEqual(snapshot(businessPolicy), before) })

// image-compress
test('image-compress landscape target keeps ratio', () => {
  const r = imageCompress.getTargetSize({ width: 4000, height: 2000 }, '1920')
  assert.strictEqual(r.ok, true)
  assert.deepStrictEqual({ width: r.data.width, height: r.data.height }, { width: 1920, height: 960 })
})
test('image-compress portrait target keeps ratio', () => {
  const r = imageCompress.getTargetSize({ width: 1000, height: 3000 }, '1280')
  assert.strictEqual(r.ok, true)
  assert.deepStrictEqual({ width: r.data.width, height: r.data.height }, { width: 427, height: 1280 })
})
test('image-compress square target keeps ratio', () => {
  const r = imageCompress.getTargetSize({ width: 800, height: 800 }, '1280')
  assert.strictEqual(r.ok, true)
  assert.deepStrictEqual({ width: r.data.width, height: r.data.height }, { width: 800, height: 800 })
})
test('image-compress one-pixel image remains valid', () => {
  const r = imageCompress.getTargetSize({ width: 1, height: 1 }, 'original')
  assert.strictEqual(r.ok, true)
  assert.strictEqual(r.data.width, 1)
  assert.strictEqual(r.data.height, 1)
})
test('image-compress original mode explicitly caps over-4096 image', () => {
  const r = imageCompress.getTargetSize({ width: 8192, height: 4096 }, 'original')
  assert.strictEqual(r.ok, true)
  assert.strictEqual(r.data.width, 4096)
  assert.strictEqual(r.data.height, 2048)
  assert.strictEqual(r.data.platformLimited, true)
  assert(imageCompress.widthOptions[0].label.includes('4096'))
})
test('image-compress extreme portrait remains finite and positive', () => {
  const r = imageCompress.getTargetSize({ width: 1, height: 100000 }, 'original')
  assert.strictEqual(r.ok, true)
  assert(r.data.width > 0 && r.data.height > 0)
  assertFiniteTree(r.data)
})
for (const [name, imageInfo] of [
  ['zero width', { width: 0, height: 100 }],
  ['zero height', { width: 100, height: 0 }],
  ['negative width', { width: -1, height: 100 }],
  ['NaN width', { width: NaN, height: 100 }],
  ['Infinity height', { width: 100, height: Infinity }],
]) {
  test(`image-compress rejects ${name}`, () => assert.strictEqual(imageCompress.getTargetSize(imageInfo, '1280').ok, false))
}
test('image-compress rejects invalid max width', () => assert.strictEqual(imageCompress.getTargetSize({ width: 100, height: 100 }, 'bad').ok, false))
test('image-compress clear quality attempts cascade', () => assert.deepStrictEqual(imageCompress.getQualityAttempts('clear').data, [0.9, 0.75, 0.55]))
test('image-compress balanced quality attempts cascade', () => assert.deepStrictEqual(imageCompress.getQualityAttempts('balanced').data, [0.75, 0.55]))
test('image-compress small quality attempts once', () => assert.deepStrictEqual(imageCompress.getQualityAttempts('small').data, [0.55]))
test('image-compress rejects invalid quality', () => assert.strictEqual(imageCompress.getQualityAttempts('ultra').ok, false))
test('image-compress compression ratio is finite and bounded', () => {
  const r = imageCompress.getCompressionRatio(1000, 250)
  assert.strictEqual(r.ok, true)
  assert.strictEqual(r.data.percent, 75)
  assert.strictEqual(r.data.text, '节省 75%')
})
test('image-compress larger output reports already small', () => assert.strictEqual(imageCompress.getCompressionRatio(1000, 1200).data.text, '已是较小'))
test('image-compress rejects invalid file sizes', () => {
  assert.strictEqual(imageCompress.getCompressionRatio(0, 100).ok, false)
  assert.strictEqual(imageCompress.getCompressionRatio(Infinity, 100).ok, false)
  assert.strictEqual(imageCompress.getCompressionRatio(100, NaN).ok, false)
})
test('image-compress repeated execution is stable', () => assertStableThreeRuns(() => imageCompress.getTargetSize({ width: 4032, height: 3024 }, '1920')))
test('image-compress does not mutate input', () => {
  const input = { width: 4032, height: 3024, size: 123456 }
  assertNotMutated(input, (value) => imageCompress.getTargetSize(value, '1920'))
})

// image-resize
test('image-resize accepts minimum target size', () => assert.strictEqual(imageResize.getTargetSize(50, 50).ok, true))
test('image-resize accepts maximum target size', () => assert.strictEqual(imageResize.getTargetSize(4096, 4096).ok, true))
test('image-resize rounds decimal target size', () => {
  const r = imageResize.getTargetSize(800.4, 600.6)
  assert.strictEqual(r.ok, true)
  assert.deepStrictEqual(r.data, { width: 800, height: 601 })
})
for (const [name, width, height] of [
  ['blank width', '', 800], ['blank height', 800, ''], ['zero width', 0, 800], ['negative height', 800, -1],
  ['NaN width', NaN, 800], ['Infinity height', 800, Infinity], ['too small', 49, 800], ['too large', 4097, 800],
]) {
  test(`image-resize rejects ${name}`, () => assert.strictEqual(imageResize.getCustomSize(width, height).ok, false))
}
test('image-resize cover 16:9 to square crops center without non-finite values', () => {
  const r = imageResize.getDrawPlan({ width: 1920, height: 1080 }, { width: 1080, height: 1080 }, 'cover')
  assert.strictEqual(r.ok, true)
  assert.deepStrictEqual(r.data, { sourceX: 420, sourceY: 0, sourceWidth: 1080, sourceHeight: 1080, destX: 0, destY: 0, destWidth: 1080, destHeight: 1080 })
  assertFiniteTree(r.data)
})
test('image-resize contain 16:9 in square letterboxes vertically', () => {
  const r = imageResize.getDrawPlan({ width: 1920, height: 1080 }, { width: 1080, height: 1080 }, 'contain')
  assert.strictEqual(r.ok, true)
  assert.strictEqual(r.data.destWidth, 1080)
  assert.strictEqual(r.data.destHeight, 608)
  assert.strictEqual(r.data.destY, 236)
})
test('image-resize stretch fills target exactly', () => {
  const r = imageResize.getDrawPlan({ width: 400, height: 300 }, { width: 1000, height: 500 }, 'stretch')
  assert.strictEqual(r.ok, true)
  assert.strictEqual(r.data.destWidth, 1000)
  assert.strictEqual(r.data.destHeight, 500)
})
test('image-resize portrait cover crops vertically', () => {
  const r = imageResize.getDrawPlan({ width: 1080, height: 1920 }, { width: 1080, height: 1080 }, 'cover')
  assert.strictEqual(r.ok, true)
  assert.strictEqual(r.data.sourceY, 420)
  assert.strictEqual(r.data.sourceHeight, 1080)
})
test('image-resize 4:3 source to 4:3 target preserves full source', () => {
  const r = imageResize.getDrawPlan({ width: 400, height: 300 }, { width: 800, height: 600 }, 'cover')
  assert.strictEqual(r.ok, true)
  assert.deepStrictEqual({ x: r.data.sourceX, y: r.data.sourceY, w: r.data.sourceWidth, h: r.data.sourceHeight }, { x: 0, y: 0, w: 400, h: 300 })
})
test('image-resize square source to square target stays finite', () => {
  const r = imageResize.getDrawPlan({ width: 300, height: 300 }, { width: 1080, height: 1080 }, 'contain')
  assert.strictEqual(r.ok, true)
  assertFiniteTree(r.data)
})
test('image-resize rejects zero source size before division', () => assert.strictEqual(imageResize.getDrawPlan({ width: 0, height: 100 }, { width: 100, height: 100 }, 'cover').ok, false))
test('image-resize rejects invalid fit mode', () => assert.strictEqual(imageResize.getDrawPlan({ width: 100, height: 100 }, { width: 100, height: 100 }, 'tile').ok, false))
test('image-resize repeated execution is stable', () => assertStableThreeRuns(() => imageResize.getDrawPlan({ width: 4032, height: 3024 }, { width: 1080, height: 1080 }, 'cover')))
test('image-resize does not mutate source or target', () => {
  const input = { source: { width: 4032, height: 3024 }, target: { width: 1080, height: 1080 } }
  assertNotMutated(input, (value) => imageResize.getDrawPlan(value.source, value.target, 'cover'))
})

// qrcode
test('qrcode prepares normal text model', () => {
  const r = qrCode.prepareQrModel('hello')
  assert.strictEqual(r.ok, true)
  assert(r.data.model.size > 0)
  assert.strictEqual(r.data.model.ecc, 'H')
})
test('qrcode prepares Chinese text model', () => assert.strictEqual(qrCode.prepareQrModel('挽鹿工具箱').ok, true))
test('qrcode prepares URL model', () => assert.strictEqual(qrCode.prepareQrModel('https://wanluu.com/path?a=1').ok, true))
test('qrcode rejects empty text', () => assert.strictEqual(qrCode.prepareQrModel('').ok, false))
test('qrcode rejects blank text', () => assert.strictEqual(qrCode.prepareQrModel('   ').ok, false))
test('qrcode rejects non-string input', () => assert.strictEqual(qrCode.prepareQrModel(12345).ok, false))
test('qrcode rejects text beyond UI max length', () => assert.strictEqual(qrCode.prepareQrModel('a'.repeat(qrCode.MAX_INPUT_CHARS + 1)).ok, false))
test('qrcode max-length input returns an explicit bounded result', () => {
  const r = qrCode.prepareQrModel('a'.repeat(qrCode.MAX_INPUT_CHARS))
  assert.strictEqual(typeof r.ok, 'boolean')
  if (r.ok) {
    const plan = qrCode.getMatrixPlan(r.data.model, qrCode.EXPORT_SIZE)
    assert.strictEqual(plan.ok, true)
    assertFiniteTree(plan.data)
  } else {
    assert.strictEqual(r.errorCode, 'QR_CAPACITY_EXCEEDED')
  }
})
test('qrcode matrix plan is finite for generated model', () => {
  const model = qrCode.prepareQrModel('matrix test').data.model
  const r = qrCode.getMatrixPlan(model, qrCode.EXPORT_SIZE)
  assert.strictEqual(r.ok, true)
  assertFiniteTree(r.data)
  assert(r.data.offset >= 0)
})
test('qrcode rejects zero export size', () => assert.strictEqual(qrCode.getMatrixPlan({ size: 21 }, 0).ok, false))
test('qrcode rejects negative, NaN and Infinity export sizes', () => {
  for (const size of [-1, NaN, Infinity]) assert.strictEqual(qrCode.getMatrixPlan({ size: 21 }, size).ok, false)
})
test('qrcode rejects export size too small for modules', () => assert.strictEqual(qrCode.getMatrixPlan({ size: 177 }, 10).ok, false))
test('qrcode rejects invalid model size', () => assert.strictEqual(qrCode.getMatrixPlan({ size: Infinity }, 900).ok, false))
test('qrcode logo plan is centered and finite', () => {
  const r = qrCode.getLogoPlan()
  assert.strictEqual(r.ok, true)
  assertFiniteTree(r.data)
  assert(r.data.left >= 0)
})
for (const ratio of [0, -0.1, 0.31, NaN, Infinity]) {
  test(`qrcode rejects invalid logo ratio ${String(ratio)}`, () => assert.strictEqual(qrCode.getLogoPlan(900, ratio).ok, false))
}
test('qrcode repeated parameter execution is stable', () => assertStableThreeRuns(() => qrCode.getLogoPlan(900, 0.2)))
test('qrcode P1 page has render re-entry guard and request token', () => {
  const source = fs.readFileSync(path.join(__dirname, '../packageTools/pages/qrcode/qrcode.js'), 'utf8')
  assert(source.includes('if (this.data.isRendering) return'))
  assert(source.includes('_renderTaskId'))
  assert(source.includes('renderTaskId !== this._renderTaskId'))
})

// image-watermark
test('image-watermark normalizes and trims text lines', () => assert.deepStrictEqual(imageWatermark.normalizeWatermarkText(' A \n B \n\n C '), ['A', 'B', 'C']))
test('image-watermark limits text to three lines', () => assert.deepStrictEqual(imageWatermark.normalizeWatermarkText('1\n2\n3\n4'), ['1', '2', '3']))
test('image-watermark empty text normalizes empty', () => assert.deepStrictEqual(imageWatermark.normalizeWatermarkText('   '), []))
test('image-watermark small image keeps dimensions', () => {
  const r = imageWatermark.getTargetSize({ width: 320, height: 240 })
  assert.strictEqual(r.ok, true)
  assert.deepStrictEqual({ width: r.data.width, height: r.data.height }, { width: 320, height: 240 })
})
test('image-watermark large landscape is capped proportionally', () => {
  const r = imageWatermark.getTargetSize({ width: 8192, height: 4096 })
  assert.strictEqual(r.ok, true)
  assert.deepStrictEqual({ width: r.data.width, height: r.data.height }, { width: 4096, height: 2048 })
})
test('image-watermark large portrait is capped proportionally', () => {
  const r = imageWatermark.getTargetSize({ width: 2000, height: 8000 })
  assert.strictEqual(r.ok, true)
  assert.deepStrictEqual({ width: r.data.width, height: r.data.height }, { width: 1024, height: 4096 })
})
for (const imageInfo of [{ width: 0, height: 1 }, { width: 1, height: -1 }, { width: NaN, height: 10 }, { width: 10, height: Infinity }]) {
  test(`image-watermark rejects invalid size ${JSON.stringify(imageInfo)}`, () => assert.strictEqual(imageWatermark.getTargetSize(imageInfo).ok, false))
}
test('image-watermark opacity presets resolve', () => imageWatermark.opacityOptions.forEach((option) => assert.strictEqual(imageWatermark.getOpacity(option.id).ok, true)))
test('image-watermark rejects unknown opacity preset', () => assert.strictEqual(imageWatermark.getOpacity('opaque').ok, false))
test('image-watermark layout accepts opacity zero and one', () => {
  assert.strictEqual(imageWatermark.getWatermarkLayout({ target: { width: 800, height: 600 }, lines: ['用途'], opacity: 0 }).ok, true)
  assert.strictEqual(imageWatermark.getWatermarkLayout({ target: { width: 800, height: 600 }, lines: ['用途'], opacity: 1 }).ok, true)
})
test('image-watermark layout rejects opacity outside range', () => {
  assert.strictEqual(imageWatermark.getWatermarkLayout({ target: { width: 800, height: 600 }, lines: ['用途'], opacity: -0.01 }).ok, false)
  assert.strictEqual(imageWatermark.getWatermarkLayout({ target: { width: 800, height: 600 }, lines: ['用途'], opacity: 1.01 }).ok, false)
})
test('image-watermark layout rejects NaN and Infinity opacity', () => {
  assert.strictEqual(imageWatermark.getWatermarkLayout({ target: { width: 800, height: 600 }, lines: ['用途'], opacity: NaN }).ok, false)
  assert.strictEqual(imageWatermark.getWatermarkLayout({ target: { width: 800, height: 600 }, lines: ['用途'], opacity: Infinity }).ok, false)
})
test('image-watermark layout remains finite for extreme aspect ratio', () => {
  const r = imageWatermark.getWatermarkLayout({ target: { width: 4096, height: 1 }, lines: ['A', 'B'], opacity: 0.18 })
  assert.strictEqual(r.ok, true)
  assertFiniteTree(r.data)
})
test('image-watermark repeated execution is stable', () => assertStableThreeRuns(() => imageWatermark.getWatermarkLayout({ target: { width: 1920, height: 1080 }, lines: ['用途'], opacity: 0.18 })))
test('image-watermark does not mutate target', () => {
  const input = { target: { width: 1920, height: 1080 }, lines: ['用途'] }
  assertNotMutated(input, (value) => imageWatermark.getWatermarkLayout({ target: value.target, lines: value.lines, opacity: 0.18 }))
})

// long-image
const longImages = (overrides = []) => [
  { id: 'a', path: 'a.jpg', width: 1080, height: 1920 },
  { id: 'b', path: 'b.jpg', width: 1080, height: 1080 },
].map((item, index) => ({ ...item, ...(overrides[index] || {}) }))
test('long-image creates normal vertical stitch plan', () => {
  const r = longImage.createRenderPlan(longImages())
  assert.strictEqual(r.ok, true)
  assert.strictEqual(r.data.items.length, 2)
  assert.strictEqual(r.data.width, 1080)
  assert.strictEqual(r.data.height, 3000)
  assertFiniteTree({ width: r.data.width, height: r.data.height, items: r.data.items.map((item) => ({ drawY: item.drawY, drawHeight: item.drawHeight })) })
})
test('long-image normalizes mixed source widths to first target width', () => {
  const r = longImage.createRenderPlan(longImages({ 1: { width: 2160, height: 1080 } }))
  assert.strictEqual(r.ok, true)
  assert.strictEqual(r.data.items[1].drawHeight, 540)
})
test('long-image small first image uses current minimum export width', () => {
  const r = longImage.createRenderPlan([{ width: 100, height: 100 }, { width: 100, height: 100 }])
  assert.strictEqual(r.ok, true)
  assert.strictEqual(r.data.width, 480)
})
test('long-image scales very tall valid plan under max canvas height', () => {
  const r = longImage.createRenderPlan([{ width: 1440, height: 10000 }, { width: 1440, height: 10000 }])
  assert.strictEqual(r.ok, true)
  assert.strictEqual(r.data.scaled, true)
  assert(r.data.height <= longImage.MAX_EXPORT_HEIGHT)
})
test('long-image rejects empty list', () => assert.strictEqual(longImage.createRenderPlan([]).ok, false))
test('long-image rejects one image', () => assert.strictEqual(longImage.createRenderPlan([{ width: 1000, height: 1000 }]).ok, false))
test('long-image rejects more than nine images', () => assert.strictEqual(longImage.createRenderPlan(Array.from({ length: 10 }, () => ({ width: 1000, height: 1000 }))).ok, false))
test('long-image accepts nine valid images', () => {
  const r = longImage.createRenderPlan(Array.from({ length: 9 }, (_, index) => ({ id: String(index), width: 1080, height: 720 })))
  assert.strictEqual(r.ok, true)
  assert.strictEqual(r.data.items.length, 9)
  assert(r.data.height <= longImage.MAX_EXPORT_HEIGHT)
})
for (const bad of [{ width: 0, height: 100 }, { width: -1, height: 100 }, { width: NaN, height: 100 }, { width: 100, height: Infinity }]) {
  test(`long-image rejects invalid image ${JSON.stringify(bad)}`, () => assert.strictEqual(longImage.createRenderPlan([bad, { width: 100, height: 100 }]).ok, false))
}
test('long-image rejects plan that would shrink below safe minimum width', () => {
  const r = longImage.createRenderPlan([{ width: 480, height: 100000 }, { width: 480, height: 100000 }])
  assert.strictEqual(r.ok, false)
})
test('long-image repeated execution is stable', () => assertStableThreeRuns(() => longImage.createRenderPlan(longImages())))
test('long-image does not mutate image list', () => {
  const input = longImages()
  assertNotMutated(input, longImage.createRenderPlan)
})

// nine-grid
test('nine-grid square image has one center crop option', () => assert.deepStrictEqual(nineGrid.createCropOptions({ width: 900, height: 900 }).map((item) => item.value), ['center']))
test('nine-grid landscape image has left center right options', () => assert.deepStrictEqual(nineGrid.createCropOptions({ width: 1600, height: 900 }).map((item) => item.value), ['left', 'center', 'right']))
test('nine-grid portrait image has top center bottom options', () => assert.deepStrictEqual(nineGrid.createCropOptions({ width: 900, height: 1600 }).map((item) => item.value), ['top', 'center', 'bottom']))
test('nine-grid landscape right crop stays in bounds', () => assert.deepStrictEqual(nineGrid.getCropRect({ width: 1600, height: 900 }, 'right'), { x: 700, y: 0, size: 900 }))
test('nine-grid portrait bottom crop stays in bounds', () => assert.deepStrictEqual(nineGrid.getCropRect({ width: 900, height: 1600 }, 'bottom'), { x: 0, y: 700, size: 900 }))
test('nine-grid rejects invalid crop mode for orientation', () => assert.strictEqual(nineGrid.createTilePlan({ width: 1600, height: 900 }, 'top').ok, false))
test('nine-grid 1000px crop preserves full fractional source coverage', () => {
  const r = nineGrid.createTilePlan({ width: 1000, height: 1000 }, 'center')
  assert.strictEqual(r.ok, true)
  assert.strictEqual(r.data.tileSize, 333)
  assert.strictEqual(r.data.tiles.length, 9)
  const last = r.data.tiles[8]
  approx(last.sourceX + last.sourceWidth, 1000, 1e-9)
  approx(last.sourceY + last.sourceHeight, 1000, 1e-9)
})
test('nine-grid no longer forces small images up to 300px per tile', () => {
  const r = nineGrid.createTilePlan({ width: 600, height: 600 }, 'center')
  assert.strictEqual(r.ok, true)
  assert.strictEqual(r.data.tileSize, 200)
})
test('nine-grid 3px image produces one-pixel tiles', () => assert.strictEqual(nineGrid.createTilePlan({ width: 3, height: 3 }, 'center').data.tileSize, 1))
test('nine-grid 899px image does not upsample tile output', () => assert.strictEqual(nineGrid.createTilePlan({ width: 899, height: 899 }, 'center').data.tileSize, 299))
test('nine-grid 3072px crop produces 1024px tiles', () => assert.strictEqual(nineGrid.createTilePlan({ width: 3072, height: 3072 }, 'center').data.tileSize, 1024))
test('nine-grid rejects image smaller than 3px crop', () => assert.strictEqual(nineGrid.createTilePlan({ width: 2, height: 2 }, 'center').ok, false))
test('nine-grid caps large output tile at 1024px', () => assert.strictEqual(nineGrid.createTilePlan({ width: 6000, height: 6000 }, 'center').data.tileSize, 1024))
for (const imageInfo of [{ width: 0, height: 100 }, { width: 100, height: 0 }, { width: NaN, height: 100 }, { width: 100, height: Infinity }]) {
  test(`nine-grid rejects invalid size ${JSON.stringify(imageInfo)}`, () => assert.strictEqual(nineGrid.createTilePlan(imageInfo, 'center').ok, false))
}
test('nine-grid preview style stays finite', () => {
  const style = nineGrid.getPreviewStyle({ width: 1600, height: 900 }, 'center')
  assert(style.includes('width:177.778%'))
  assert(!style.includes('NaN'))
  assert(!style.includes('Infinity'))
})
test('nine-grid every source tile stays inside crop rectangle', () => {
  const r = nineGrid.createTilePlan({ width: 1600, height: 900 }, 'center')
  assert.strictEqual(r.ok, true)
  const crop = r.data.cropRect
  r.data.tiles.forEach((tile) => {
    assert(tile.sourceX >= crop.x - 1e-9)
    assert(tile.sourceY >= crop.y - 1e-9)
    assert(tile.sourceX + tile.sourceWidth <= crop.x + crop.size + 1e-9)
    assert(tile.sourceY + tile.sourceHeight <= crop.y + crop.size + 1e-9)
  })
})
test('nine-grid repeated execution is stable', () => assertStableThreeRuns(() => nineGrid.createTilePlan({ width: 1000, height: 800 }, 'center')))
test('nine-grid does not mutate image info', () => {
  const input = { width: 1000, height: 800, size: 123 }
  assertNotMutated(input, (value) => nineGrid.createTilePlan(value, 'center'))
})

// pindou
test('pindou grid dimensions preserve source aspect ratio', () => {
  const r = pindou.getGridDimensions(32, { width: 1600, height: 900 })
  assert.strictEqual(r.ok, true)
  assert.deepStrictEqual(r.data, { gridWidth: 32, gridHeight: 18 })
})
test('pindou portrait grid dimensions preserve source aspect ratio', () => {
  const r = pindou.getGridDimensions(32, { width: 900, height: 1600 })
  assert.strictEqual(r.ok, true)
  assert.strictEqual(r.data.gridHeight, 57)
})
test('pindou accepts grid width boundaries', () => {
  assert.strictEqual(pindou.getGridDimensions(10, { width: 100, height: 100 }).ok, true)
  assert.strictEqual(pindou.getGridDimensions(100, { width: 100, height: 100 }).ok, true)
})
test('pindou rejects grid width below range', () => assert.strictEqual(pindou.getGridDimensions(9, { width: 100, height: 100 }).ok, false))
test('pindou rejects grid width above range', () => assert.strictEqual(pindou.getGridDimensions(101, { width: 100, height: 100 }).ok, false))
test('pindou rejects NaN and Infinity grid width', () => {
  assert.strictEqual(pindou.getGridDimensions(NaN, { width: 100, height: 100 }).ok, false)
  assert.strictEqual(pindou.getGridDimensions(Infinity, { width: 100, height: 100 }).ok, false)
})
test('pindou rejects invalid source dimensions before ratio division', () => {
  assert.strictEqual(pindou.getGridDimensions(32, { width: 0, height: 100 }).ok, false)
  assert.strictEqual(pindou.getGridDimensions(32, { width: 100, height: Infinity }).ok, false)
})
test('pindou rejects excessive grid height', () => assert.strictEqual(pindou.getGridDimensions(100, { width: 100, height: 1000 }).ok, false))
test('pindou export layout is finite and inside 4096 canvas', () => {
  const r = pindou.getPatternExportLayout({ width: 32, height: 32 }, 16)
  assert.strictEqual(r.ok, true)
  assertFiniteTree(r.data)
  assert(r.data.width <= pindou.MAX_EXPORT_SIDE)
  assert(r.data.height <= pindou.MAX_EXPORT_SIDE)
})
test('pindou export layout adapts legend columns', () => {
  assert.strictEqual(pindou.getPatternExportLayout({ width: 32, height: 32 }, 20).data.legendColumns, 3)
  assert.strictEqual(pindou.getPatternExportLayout({ width: 32, height: 32 }, 40).data.legendColumns, 4)
  assert.strictEqual(pindou.getPatternExportLayout({ width: 32, height: 32 }, 90).data.legendColumns, 5)
})
test('pindou export layout rejects impossible giant pattern', () => assert.strictEqual(pindou.getPatternExportLayout({ width: 500, height: 500 }, 16).ok, false))
test('pindou export layout rejects invalid pattern dimensions', () => assert.strictEqual(pindou.getPatternExportLayout({ width: 0, height: 32 }, 16).ok, false))
test('pindou engine generates deterministic pattern from simple pixels', () => {
  const imageData = { data: new Uint8ClampedArray([
    255, 0, 0, 255, 0, 255, 0, 255,
    0, 0, 255, 255, 255, 255, 255, 255,
  ]) }
  const first = pindouEngine.generatePattern(imageData, 2, 2, { colorLimit: 0, removeWhite: false })
  const second = pindouEngine.generatePattern(imageData, 2, 2, { colorLimit: 0, removeWhite: false })
  assert.deepStrictEqual(second, first)
  assert.strictEqual(first.cells.length, 4)
  assert(first.totalBeads > 0)
})
test('pindou engine transparent image produces empty pattern', () => {
  const imageData = { data: new Uint8ClampedArray(16) }
  const r = pindouEngine.generatePattern(imageData, 2, 2, { removeWhite: false })
  assert.strictEqual(r.cells.length, 0)
  assert.strictEqual(r.totalBeads, 0)
})
test('pindou replacePatternColor does not mutate source cells', () => {
  const cells = [1, 2, 1, -1]
  const before = cells.slice()
  const next = pindouEngine.replacePatternColor(cells, 1, 3)
  assert.deepStrictEqual(cells, before)
  assert.deepStrictEqual(next, [3, 2, 3, -1])
})
test('pindou repeated grid calculation is stable', () => assertStableThreeRuns(() => pindou.getGridDimensions(52, { width: 1200, height: 800 })))
test('pindou does not mutate image info', () => {
  const input = { width: 1200, height: 800 }
  assertNotMutated(input, (value) => pindou.getGridDimensions(52, value))
})

// video-compress
test('video-compress high quality attempts all levels', () => assert.deepStrictEqual(videoCompress.getQualityAttempts('high').data, ['high', 'medium', 'low']))
test('video-compress medium quality attempts medium and low', () => assert.deepStrictEqual(videoCompress.getQualityAttempts('medium').data, ['medium', 'low']))
test('video-compress low quality attempts once', () => assert.deepStrictEqual(videoCompress.getQualityAttempts('low').data, ['low']))
test('video-compress rejects invalid quality', () => assert.strictEqual(videoCompress.getQualityAttempts('ultra').ok, false))
test('video-compress validates normal landscape metadata', () => assert.strictEqual(videoCompress.validateVideoInfo({ width: 1920, height: 1080, duration: 12.5, size: 1000000 }).ok, true))
test('video-compress validates normal portrait metadata', () => assert.strictEqual(videoCompress.validateVideoInfo({ width: 1080, height: 1920, duration: 12.5, size: 1000000 }).ok, true))
test('video-compress rejects negative duration', () => assert.strictEqual(videoCompress.validateVideoInfo({ width: 1080, height: 1920, duration: -1, size: 1000 }).ok, false))
test('video-compress rejects NaN and Infinity duration', () => {
  assert.strictEqual(videoCompress.validateVideoInfo({ width: 1080, height: 1920, duration: NaN, size: 1000 }).ok, false)
  assert.strictEqual(videoCompress.validateVideoInfo({ width: 1080, height: 1920, duration: Infinity, size: 1000 }).ok, false)
})
test('video-compress rejects NaN and Infinity source size', () => {
  assert.strictEqual(videoCompress.validateVideoInfo({ width: 1080, height: 1920, duration: 1, size: NaN }).ok, false)
  assert.strictEqual(videoCompress.validateVideoInfo({ width: 1080, height: 1920, duration: 1, size: Infinity }).ok, false)
})
test('video-compress rejects NaN width', () => assert.strictEqual(videoCompress.validateVideoInfo({ width: NaN, height: 1920, duration: 1, size: 1000 }).ok, false))
test('video-compress rejects Infinity height', () => assert.strictEqual(videoCompress.validateVideoInfo({ width: 1080, height: Infinity, duration: 1, size: 1000 }).ok, false))
test('video-compress requireDimensions rejects zero dimensions', () => assert.strictEqual(videoCompress.validateVideoInfo({ width: 0, height: 0, duration: 1, size: 1000 }, { requireDimensions: true }).ok, false))
test('video-compress validates finite compression result', () => assert.strictEqual(videoCompress.validateCompressionResult({ size: 500000, width: 1280, height: 720 }).ok, true))
test('video-compress rejects zero result size', () => assert.strictEqual(videoCompress.validateCompressionResult({ size: 0, width: 1280, height: 720 }).ok, false))
test('video-compress rejects Infinity result size', () => assert.strictEqual(videoCompress.validateCompressionResult({ size: Infinity, width: 1280, height: 720 }).ok, false))
test('video-compress ratio reports finite saving', () => {
  const r = videoCompress.getCompressionRatio(1000, 600)
  assert.strictEqual(r.ok, true)
  assert.deepStrictEqual(r.data, { percent: 40, text: '节省 40%' })
})
test('video-compress non-smaller result reports close size', () => assert.strictEqual(videoCompress.getCompressionRatio(1000, 1200).data.text, '体积接近'))
test('video-compress rejects invalid ratio inputs', () => {
  assert.strictEqual(videoCompress.getCompressionRatio(0, 100).ok, false)
  assert.strictEqual(videoCompress.getCompressionRatio(Infinity, 100).ok, false)
  assert.strictEqual(videoCompress.getCompressionRatio(100, NaN).ok, false)
})
test('video-compress repeated quality attempts are stable', () => assertStableThreeRuns(() => videoCompress.getQualityAttempts('medium')))
test('video-compress does not mutate metadata input', () => {
  const input = { width: 1920, height: 1080, duration: 12.5, size: 1000000 }
  assertNotMutated(input, videoCompress.validateVideoInfo)
})

console.log(`Stage 4 tools tests: PASS (${passed} cases)`)
