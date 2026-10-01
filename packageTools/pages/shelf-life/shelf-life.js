const { withToolPage } = require('../../../behaviors/tool-page')
const { calculateShelfLife } = require('../../../utils/tool-logic/shelf-life')
const unitOptions = [
  { id: 'day', label: '天' },
  { id: 'month', label: '月' },
  { id: 'year', label: '年' },
]

const STATUS_THEME_MAP = {
  pending: {
    badge: '待计算',
    note: '填好生产日期和保质期后，这里会显示到期参考日和当前状态。',
  },
  fresh: {
    badge: '未过期',
  },
  warning: {
    badge: '快到期',
  },
  today: {
    badge: '今天到期',
  },
  expired: {
    badge: '已过期',
  },
}

const getTodayString = () => formatDate(new Date())

const getDefaultResult = () => ({
  expiryDate: '--',
  badge: STATUS_THEME_MAP.pending.badge,
  statusText: '--',
  distanceText: '--',
  shelfLifeText: '--',
  statusTheme: 'pending',
})

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getUnitText(value, unitKey) {
  const unitMap = {
    day: '天',
    month: '个月',
    year: '年',
  }

  return `${value} ${unitMap[unitKey]}`
}

Page(withToolPage('shelf-life', {
  data: {
    manufactureDate: '',
    todayDate: getTodayString(),
    shelfLifeValue: '',
    unitKey: 'month',
    unitOptions,
    hasResult: false,
    result: getDefaultResult(),
  },

  updateDraft(patch) {
    this.setData({
      ...patch,
      hasResult: false,
      result: getDefaultResult(),
    })
  },

  onDateChange(event) {
    const { field } = event.currentTarget.dataset

    this.updateDraft({
      [field]: event.detail.value,
    })
  },

  onInput(event) {
    const { field } = event.currentTarget.dataset

    this.updateDraft({
      [field]: event.detail.value,
    })
  },

  onUnitSelect(event) {
    this.updateDraft({
      unitKey: event.currentTarget.dataset.unit,
    })
  },

  onCalculate() {
    const result = calculateShelfLife({
      manufactureDate: this.data.manufactureDate,
      referenceDate: this.data.todayDate,
      shelfLifeValue: this.data.shelfLifeValue,
      unitKey: this.data.unitKey,
    })

    if (!result.ok) {
      wx.showToast({ title: result.errorMessage, icon: 'none' })
      return
    }

    const data = result.data
    const diffFromReference = data.diffFromReference
    let statusText = ''
    let distanceText = ''
    if (data.statusTheme === 'fresh') {
      statusText = '当前还在保质期内'
      distanceText = `距离到期还有 ${diffFromReference} 天`
    } else if (data.statusTheme === 'warning') {
      statusText = '已经临近到期'
      distanceText = `距离到期还有 ${diffFromReference} 天`
    } else if (data.statusTheme === 'today') {
      statusText = '今天就是到期参考日'
      distanceText = '建议尽快食用或使用'
    } else {
      statusText = '已经超过保质期'
      distanceText = `已过期 ${Math.abs(diffFromReference)} 天`
    }

    this.setData({
      hasResult: true,
      result: {
        expiryDate: data.expiryDate,
        badge: STATUS_THEME_MAP[data.statusTheme].badge,
        statusText,
        distanceText,
        shelfLifeText: getUnitText(data.shelfLifeValue, data.unitKey),
        statusTheme: data.statusTheme,
      },
    })
    this.recordToolUse()
  },

  onReset() {
    this.setData({
      manufactureDate: '',
      todayDate: getTodayString(),
      shelfLifeValue: '',
      unitKey: 'month',
      hasResult: false,
      result: getDefaultResult(),
    })
  },

  onShareAppMessage() {
    return {
      title: '商品什么时候过期？输入生产日期和保质期就能算',
      path: '/packageTools/pages/shelf-life/shelf-life',
    }
  },

  onShareTimeline() {
    return {
      title: '保质期计算器：快速判断到期日和剩余天数',
      query: '',
    }
  },
}))
