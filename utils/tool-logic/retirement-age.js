const { retirementAge: defaultRetirementPolicy } = require('../policy-config')

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const fail = (errorCode, errorMessage) => ({ ok: false, errorCode, errorMessage })
const isLeapYear = (year) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
const daysInMonth = (year, month) => [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] || 0

const parseCivilDate = (value) => {
  const match = DATE_PATTERN.exec(String(value || '').trim())
  if (!match) return fail('INVALID_DATE', '请选择有效出生日期')
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return fail('INVALID_DATE', '请选择有效出生日期')
  return { ok: true, data: { year, month, day } }
}

const addMonths = (date, months) => {
  const monthCount = date.year * 12 + (date.month - 1) + months
  const year = Math.floor(monthCount / 12)
  const month = ((monthCount % 12) + 12) % 12 + 1
  const day = Math.min(date.day, daysInMonth(year, month))
  return { year, month, day }
}
const monthIndex = (date) => date.year * 12 + (date.month - 1)
const formatYearMonth = (date) => `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}`
const formatAgeByMonths = (totalMonths) => {
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  return months ? `${years} 岁 ${months} 个月` : `${years} 岁`
}

const getPolicyDelayMonths = (oldRetireDate, workerType, rules = defaultRetirementPolicy) => {
  const startMonthIndex = Number(rules.policyStartYear) * 12 + Number(rules.policyStartMonthIndex)
  const oldMonthIndex = monthIndex(oldRetireDate)
  if (!Number.isFinite(startMonthIndex) || !Number.isFinite(oldMonthIndex)) return null
  if (oldMonthIndex < startMonthIndex) return 0
  const stepMonths = Number(workerType.stepMonths)
  const maxDelayMonths = Number(workerType.maxDelayMonths)
  if (!Number.isFinite(stepMonths) || stepMonths <= 0 || !Number.isFinite(maxDelayMonths) || maxDelayMonths < 0) return null
  return Math.min(Math.floor((oldMonthIndex - startMonthIndex) / stepMonths) + 1, maxDelayMonths)
}

const calculateRetirementAge = ({ birthDate, workerType }, rules = defaultRetirementPolicy) => {
  const birth = parseCivilDate(birthDate)
  if (!birth.ok) return birth
  const type = Array.isArray(rules.workerTypes) ? rules.workerTypes.find((item) => item.id === workerType) : null
  if (!type) return fail('INVALID_WORKER_TYPE', '请选择人员类型')
  const baseAgeMonths = Number(type.baseAgeMonths)
  const flexibleDelayMonths = Number(rules.flexibleDelayMonths)
  if (!Number.isFinite(baseAgeMonths) || baseAgeMonths < 0 || !Number.isFinite(flexibleDelayMonths) || flexibleDelayMonths < 0) return fail('INVALID_POLICY', '退休规则无效')

  const oldRetireDate = addMonths(birth.data, baseAgeMonths)
  const delayMonths = getPolicyDelayMonths(oldRetireDate, type, rules)
  if (!Number.isFinite(delayMonths)) return fail('INVALID_POLICY', '退休规则无效')
  const retireDate = addMonths(oldRetireDate, delayMonths)
  const retireAgeMonths = baseAgeMonths + delayMonths
  const flexibleAgeMonths = retireAgeMonths + flexibleDelayMonths
  const flexibleRetireDate = addMonths(retireDate, flexibleDelayMonths)

  return {
    ok: true,
    data: {
      birthDate: birth.data,
      workerType: type.id,
      workerTypeText: type.label,
      oldRetireDate: formatYearMonth(oldRetireDate),
      retireDate: formatYearMonth(retireDate),
      retireAgeMonths,
      retireAgeText: formatAgeByMonths(retireAgeMonths),
      flexibleDate: formatYearMonth(flexibleRetireDate),
      flexibleAgeMonths,
      flexibleAgeText: formatAgeByMonths(flexibleAgeMonths),
      delayMonths,
      ruleText: delayMonths ? `按规则延迟 ${delayMonths} 个月，最终不超过 ${type.finalAgeText}` : `原退休时间早于 ${rules.policyStartYear} 年，按原年龄估算`,
    },
  }
}

module.exports = { addMonths, calculateRetirementAge, formatAgeByMonths, formatYearMonth, getPolicyDelayMonths, parseCivilDate }
