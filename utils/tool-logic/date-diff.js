const MS_PER_DAY = 24 * 60 * 60 * 1000
const MAX_SPAN_DAYS = 36500
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

const fail = (errorCode, errorMessage) => ({
  ok: false,
  errorCode,
  errorMessage,
})

const formatDateParts = ({ year, month, day }) => (
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
)

const formatLocalDate = (date) => {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return ''
  return formatDateParts({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  })
}

const createUtcCivilDate = (year, month, day) => {
  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(year, month - 1, day)
  return date
}

const parseDateString = (value) => {
  const text = String(value || '').trim()
  const match = DATE_PATTERN.exec(text)
  if (!match) return fail('INVALID_DATE', '日期格式无效')

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = createUtcCivilDate(year, month, day)

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return fail('INVALID_DATE', '日期无效')
  }

  return {
    ok: true,
    data: {
      year,
      month,
      day,
      dateText: formatDateParts({ year, month, day }),
      dayNumber: Math.round(date.getTime() / MS_PER_DAY),
    },
  }
}

const dateTextFromDayNumber = (dayNumber) => {
  const date = new Date(dayNumber * MS_PER_DAY)
  return formatDateParts({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  })
}

const getWeekday = (dayNumber) => new Date(dayNumber * MS_PER_DAY).getUTCDay()

const countWeekdaysInclusive = (startDayNumber, endDayNumber) => {
  const step = endDayNumber >= startDayNumber ? 1 : -1
  const total = Math.abs(endDayNumber - startDayNumber) + 1
  let count = 0
  let cursor = startDayNumber

  for (let index = 0; index < total; index += 1) {
    const weekday = getWeekday(cursor)
    if (weekday >= 1 && weekday <= 5) count += 1
    cursor += step
  }

  return count
}

const calculateInterval = ({ startDate, endDate, maxDays = MAX_SPAN_DAYS }) => {
  const start = parseDateString(startDate)
  if (!start.ok) return fail('INVALID_START_DATE', '请选择有效开始日期')

  const end = parseDateString(endDate)
  if (!end.ok) return fail('INVALID_END_DATE', '请选择有效结束日期')

  const signedDays = end.data.dayNumber - start.data.dayNumber
  const days = Math.abs(signedDays)
  if (days > maxDays) return fail('SPAN_TOO_LARGE', '日期跨度有点大')

  return {
    ok: true,
    data: {
      signedDays,
      days,
      inclusiveDays: days + 1,
      weeks: Math.floor(days / 7),
      restDays: days % 7,
      weekdayCount: countWeekdaysInclusive(start.data.dayNumber, end.data.dayNumber),
      direction: signedDays === 0 ? 'same' : (signedDays > 0 ? 'forward' : 'reverse'),
    },
  }
}

const calculateOffset = ({ baseDate, offsetDays, direction, maxDays = MAX_SPAN_DAYS }) => {
  const base = parseDateString(baseDate)
  if (!base.ok) return fail('INVALID_BASE_DATE', '请选择有效基准日期')

  const offsetText = String(offsetDays == null ? '' : offsetDays).trim()
  const offset = Number(offsetDays)
  if (!offsetText || !Number.isFinite(offset) || !Number.isInteger(offset) || offset < 0) {
    return fail('INVALID_OFFSET', '天数请填写非负整数')
  }

  if (offset > maxDays) return fail('OFFSET_TOO_LARGE', '天数有点大')
  if (direction !== 'before' && direction !== 'after') {
    return fail('INVALID_DIRECTION', '请选择有效方向')
  }

  const sign = direction === 'before' ? -1 : 1
  const targetDayNumber = base.data.dayNumber + sign * offset

  return {
    ok: true,
    data: {
      targetDate: dateTextFromDayNumber(targetDayNumber),
      baseDate: base.data.dateText,
      offsetDays: offset,
      direction,
    },
  }
}

module.exports = {
  MAX_SPAN_DAYS,
  calculateInterval,
  calculateOffset,
  formatLocalDate,
  parseDateString,
}
