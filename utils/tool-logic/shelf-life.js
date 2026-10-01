const MS_PER_DAY = 24 * 60 * 60 * 1000
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const UNIT_KEYS = ['day', 'month', 'year']
const fail = (errorCode, errorMessage) => ({ ok: false, errorCode, errorMessage })

const createUtcDate = (year, month, day) => {
  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(year, month - 1, day)
  return date
}
const parseCivilDate = (value) => {
  const match = DATE_PATTERN.exec(String(value || '').trim())
  if (!match) return fail('INVALID_DATE', '日期格式无效')
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3])
  const date = createUtcDate(year, month, day)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return fail('INVALID_DATE', '日期无效')
  return { ok: true, data: { year, month, day, dayNumber: Math.round(date.getTime() / MS_PER_DAY) } }
}
const formatDayNumber = (dayNumber) => {
  const date = new Date(dayNumber * MS_PER_DAY)
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}
const daysInMonth = (year, month) => createUtcDate(year, month + 1, 0).getUTCDate()
const addMonthsCivil = (date, months) => {
  const total = date.year * 12 + date.month - 1 + months
  const year = Math.floor(total / 12)
  const month = ((total % 12) + 12) % 12 + 1
  return { year, month, day: Math.min(date.day, daysInMonth(year, month)) }
}
const addYearsCivil = (date, years) => ({ year: date.year + years, month: date.month, day: Math.min(date.day, daysInMonth(date.year + years, date.month)) })
const civilDayNumber = (date) => Math.round(createUtcDate(date.year, date.month, date.day).getTime() / MS_PER_DAY)

const calculateShelfLife = ({ manufactureDate, referenceDate, shelfLifeValue, unitKey }) => {
  const manufacture = parseCivilDate(manufactureDate)
  if (!manufacture.ok) return fail('INVALID_MANUFACTURE_DATE', '请选择有效生产日期')
  const reference = parseCivilDate(referenceDate)
  if (!reference.ok) return fail('INVALID_REFERENCE_DATE', '请选择有效参考日期')
  const life = Number(shelfLifeValue)
  if (!Number.isFinite(life) || !Number.isInteger(life) || life <= 0) return fail('INVALID_SHELF_LIFE', '保质期请填写正整数')
  if (life > 9999) return fail('SHELF_LIFE_TOO_LARGE', '保质期数值看起来有点大')
  if (!UNIT_KEYS.includes(unitKey)) return fail('INVALID_UNIT', '请选择有效保质期单位')

  let expiryDayNumber
  if (unitKey === 'day') {
    expiryDayNumber = manufacture.data.dayNumber + life - 1
  } else if (unitKey === 'month') {
    expiryDayNumber = civilDayNumber(addMonthsCivil(manufacture.data, life)) - 1
  } else {
    expiryDayNumber = civilDayNumber(addYearsCivil(manufacture.data, life)) - 1
  }
  if (!Number.isFinite(expiryDayNumber)) return fail('CALCULATION_OVERFLOW', '到期日期超出可计算范围')
  const diffFromReference = expiryDayNumber - reference.data.dayNumber
  const statusTheme = diffFromReference > 7 ? 'fresh' : diffFromReference > 0 ? 'warning' : diffFromReference === 0 ? 'today' : 'expired'
  return { ok: true, data: { expiryDate: formatDayNumber(expiryDayNumber), diffFromReference, shelfLifeValue: life, unitKey, statusTheme } }
}

module.exports = { calculateShelfLife, parseCivilDate }
