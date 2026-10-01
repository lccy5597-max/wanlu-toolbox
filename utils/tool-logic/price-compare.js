const compareModes = {
  weight: {
    label: '重量',
    unitTargetText: '元 / 100g',
    displayAmount: 100,
    displayUnit: 'g',
    baseUnit: 'g',
    units: [
      { label: '克', symbol: 'g', factor: 1 },
      { label: '千克', symbol: 'kg', factor: 1000 },
      { label: '斤', symbol: '斤', factor: 500 },
    ],
  },
  volume: {
    label: '容量',
    unitTargetText: '元 / 100ml',
    displayAmount: 100,
    displayUnit: 'ml',
    baseUnit: 'ml',
    units: [
      { label: '毫升', symbol: 'ml', factor: 1 },
      { label: '升', symbol: 'L', factor: 1000 },
    ],
  },
  count: {
    label: '数量',
    unitTargetText: '元 / 件',
    displayAmount: 1,
    displayUnit: '件',
    baseUnit: '件',
    units: [
      { label: '件', symbol: '件', factor: 1 },
      { label: '个', symbol: '个', factor: 1 },
      { label: '包', symbol: '包', factor: 1 },
      { label: '片', symbol: '片', factor: 1 },
    ],
  },
}

const PRICE_EPSILON = 0.000001
const modeTabs = Object.keys(compareModes).map((value) => ({ value, label: compareModes[value].label }))

const fail = (errorCode, errorMessage) => ({ ok: false, errorCode, errorMessage })

const formatNumber = (value, digits = 2) => {
  if (!Number.isFinite(value)) return null
  return String(Number(value.toFixed(digits)))
}

const formatPrice = (value) => {
  if (!Number.isFinite(value)) return null
  if (value >= 100) return formatNumber(value, 2)
  if (value >= 10) return formatNumber(value, 3)
  return formatNumber(value, 4)
}

const normalizeItem = (item, mode) => {
  const unitIndex = Number(item.unitIndex)
  const unit = Number.isInteger(unitIndex) && mode.units[unitIndex] ? mode.units[unitIndex] : mode.units[0]
  const price = Number(item.price)
  const amount = Number(item.amount)
  const baseAmount = amount * unit.factor
  const hasValid = (
    Number.isFinite(price) && price > 0 &&
    Number.isFinite(amount) && amount > 0 &&
    Number.isFinite(baseAmount) && baseAmount > 0
  )
  const unitPrice = hasValid ? price / baseAmount * mode.displayAmount : 0
  const safeValid = hasValid && Number.isFinite(unitPrice) && unitPrice > 0

  return {
    ...item,
    unitIndex: mode.units.indexOf(unit),
    unitName: unit.label,
    unitSymbol: unit.symbol,
    unitPrice: safeValid ? unitPrice : 0,
    unitPriceText: safeValid ? formatPrice(unitPrice) : '--',
    amountText: safeValid ? `折合 ${formatNumber(baseAmount, 2)} ${mode.baseUnit}` : '填写后自动换算',
    hasValid: safeValid,
    isBest: false,
    savingText: '',
  }
}

const getAdvantageText = (diffPrice, diffPercent, unitTargetText) => {
  if (Math.abs(diffPrice) < PRICE_EPSILON) return '和第二名单价相同'
  const percentText = formatNumber(diffPercent, diffPercent >= 10 ? 0 : 1)
  return `便宜 ${formatPrice(diffPrice)} ${unitTargetText}，约 ${percentText}%`
}

const getResultTitle = (hasResult, bestItem, tiedBestCount) => {
  if (!hasResult) return '至少填写 2 个商品的价格和规格'
  if (tiedBestCount > 1) return `${tiedBestCount} 个商品单价持平`
  return `建议选第 ${bestItem.itemNumber} 个商品`
}

const buildCompareState = (activeMode, sourceItems) => {
  const mode = compareModes[activeMode]
  if (!mode) return fail('INVALID_MODE', '请选择有效比较类型')
  if (!Array.isArray(sourceItems)) return fail('INVALID_ITEMS', '商品列表无效')

  const itemsWithName = sourceItems
    .map((item) => normalizeItem(item || {}, mode))
    .map((item, index) => ({
      ...item,
      itemNumber: index + 1,
      displayName: item.name || `第 ${index + 1} 个商品`,
    }))
  const validItems = itemsWithName.filter((item) => item.hasValid)
  const rankedItems = [...validItems].sort((a, b) => a.unitPrice - b.unitPrice)
  const bestItem = rankedItems[0]
  const secondItem = rankedItems[1]
  const hasResult = validItems.length >= 2
  const bestPrice = bestItem ? bestItem.unitPrice : 0
  const tiedBestCount = hasResult
    ? validItems.filter((item) => Math.abs(item.unitPrice - bestPrice) < PRICE_EPSILON).length
    : 0
  const secondDiff = hasResult && secondItem ? secondItem.unitPrice - bestPrice : 0
  const secondDiffPercent = hasResult && bestPrice > 0 ? secondDiff / bestPrice * 100 : 0
  if (![bestPrice, secondDiff, secondDiffPercent].every(Number.isFinite)) {
    return fail('NON_FINITE_RESULT', '比较结果超出可计算范围')
  }
  const advantageText = getAdvantageText(secondDiff, secondDiffPercent, mode.unitTargetText)
  const items = itemsWithName.map((item) => {
    const isBest = hasResult && item.hasValid && Math.abs(item.unitPrice - bestPrice) < PRICE_EPSILON
    let savingText = ''
    if (isBest) {
      savingText = tiedBestCount > 1 ? '并列最低' : '最划算'
    } else if (hasResult && item.hasValid) {
      const percent = (item.unitPrice / bestPrice - 1) * 100
      if (!Number.isFinite(percent)) return { ...item, isBest: false, savingText: '' }
      savingText = `贵 ${formatNumber(percent, percent >= 10 ? 0 : 1)}%`
    }
    return { ...item, isBest, savingText }
  })

  return {
    ok: true,
    data: {
      activeMode,
      unitOptions: mode.units,
      unitTargetText: mode.unitTargetText,
      items,
      comparedCount: validItems.length,
      hasResult,
      resultTitle: getResultTitle(hasResult, bestItem, tiedBestCount),
      resultSummary: hasResult ? advantageText : '',
      resultRows: [
        { label: '最低单价', value: hasResult ? `${formatPrice(bestItem.unitPrice)} ${mode.unitTargetText}` : '--' },
        { label: '相比第二名', value: hasResult ? advantageText : '--' },
      ],
    },
  }
}

module.exports = {
  PRICE_EPSILON,
  buildCompareState,
  compareModes,
  formatNumber,
  formatPrice,
  modeTabs,
  normalizeItem,
}
