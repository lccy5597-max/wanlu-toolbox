const { withToolPage } = require('../../../behaviors/tool-page')
const { calculateInterval, calculateOffset, formatLocalDate } = require('../../../utils/tool-logic/date-diff')

const getTodayString = () => formatLocalDate(new Date())

const getDefaultIntervalResult = () => ({
  daysText: '--',
  inclusiveText: '--',
  weekText: '--',
  weekdayText: '--',
  directionText: '选择日期后开始计算',
})

const getDefaultOffsetResult = () => ({
  targetDate: '--',
  baseDate: '--',
  offsetText: '--',
  directionText: '--',
})

const getWeekText = (weeks, restDays) => {
  if (!weeks) return `${restDays} 天`
  if (!restDays) return `${weeks} 周`
  return `${weeks} 周 ${restDays} 天`
}

const getIntervalDirectionText = (direction) => {
  if (direction === 'forward') return '结束日期晚于开始日期'
  if (direction === 'reverse') return '结束日期早于开始日期'
  return '两个日期是同一天'
}

Page(withToolPage('date-diff', {
  data: {
    startDate: getTodayString(),
    endDate: getTodayString(),
    baseDate: getTodayString(),
    offsetDays: '30',
    offsetDirection: 'after',
    hasIntervalResult: false,
    hasOffsetResult: false,
    intervalResult: getDefaultIntervalResult(),
    offsetResult: getDefaultOffsetResult(),
  },

  updateIntervalDraft(patch) {
    this.setData({
      ...patch,
      hasIntervalResult: false,
      intervalResult: getDefaultIntervalResult(),
    })
  },

  updateOffsetDraft(patch) {
    this.setData({
      ...patch,
      hasOffsetResult: false,
      offsetResult: getDefaultOffsetResult(),
    })
  },

  onDateChange(event) {
    const { field, scope } = event.currentTarget.dataset
    const patch = {
      [field]: event.detail.value,
    }

    if (scope === 'offset') {
      this.updateOffsetDraft(patch)
      return
    }

    this.updateIntervalDraft(patch)
  },

  onInput(event) {
    const { field } = event.currentTarget.dataset

    this.updateOffsetDraft({
      [field]: event.detail.value,
    })
  },

  onDirectionTap(event) {
    this.updateOffsetDraft({
      offsetDirection: event.currentTarget.dataset.direction,
    })
  },

  onCalculateInterval() {
    const result = calculateInterval({
      startDate: this.data.startDate,
      endDate: this.data.endDate,
    })

    if (!result.ok) {
      wx.showToast({
        title: result.errorMessage,
        icon: 'none',
      })
      return
    }

    const data = result.data
    this.setData({
      hasIntervalResult: true,
      intervalResult: {
        daysText: `${data.days} 天`,
        inclusiveText: `${data.inclusiveDays} 天`,
        weekText: getWeekText(data.weeks, data.restDays),
        weekdayText: `${data.weekdayCount} 天`,
        directionText: getIntervalDirectionText(data.direction),
      },
    })
    this.recordToolUse()
  },

  onCalculateOffset() {
    const result = calculateOffset({
      baseDate: this.data.baseDate,
      offsetDays: this.data.offsetDays,
      direction: this.data.offsetDirection,
    })

    if (!result.ok) {
      wx.showToast({
        title: result.errorMessage,
        icon: 'none',
      })
      return
    }

    const data = result.data
    this.setData({
      hasOffsetResult: true,
      offsetResult: {
        targetDate: data.targetDate,
        baseDate: data.baseDate,
        offsetText: `${data.offsetDays} 天`,
        directionText: data.direction === 'before' ? '之前' : '之后',
      },
    })
    this.recordToolUse()
  },

  onResetInterval() {
    this.setData({
      startDate: getTodayString(),
      endDate: getTodayString(),
      hasIntervalResult: false,
      intervalResult: getDefaultIntervalResult(),
    })
  },

  onResetOffset() {
    this.setData({
      baseDate: getTodayString(),
      offsetDays: '30',
      offsetDirection: 'after',
      hasOffsetResult: false,
      offsetResult: getDefaultOffsetResult(),
    })
  },

  onShareAppMessage() {
    return {
      title: '两个日期相差几天？也能反推前后日期',
      path: '/packageTools/pages/date-diff/date-diff',
    }
  },

  onShareTimeline() {
    return {
      title: '日期间隔计算器：算天数、推日期',
      query: '',
    }
  },
}))
