const unitGroups = {
  length: {
    label: '长度',
    icon: 'measurement',
    defaults: [2, 1],
    units: [
      { label: '毫米', symbol: 'mm', factor: 0.001 },
      { label: '厘米', symbol: 'cm', factor: 0.01 },
      { label: '米', symbol: 'm', factor: 1 },
      { label: '千米', symbol: 'km', factor: 1000 },
      { label: '英寸', symbol: 'in', factor: 0.0254 },
      { label: '英尺', symbol: 'ft', factor: 0.3048 },
    ],
    commonRows: [
      { label: '1 米', value: '100 厘米' },
      { label: '1 千米', value: '1000 米' },
      { label: '1 英寸', value: '2.54 厘米' },
    ],
  },
  area: {
    label: '面积',
    icon: 'area',
    defaults: [0, 3],
    units: [
      { label: '平方米', symbol: 'm²', factor: 1 },
      { label: '平方厘米', symbol: 'cm²', factor: 0.0001 },
      { label: '平方千米', symbol: 'km²', factor: 1000000 },
      { label: '亩', symbol: '亩', factor: 666.6666667 },
      { label: '公顷', symbol: 'ha', factor: 10000 },
      { label: '平方英尺', symbol: 'ft²', factor: 0.09290304 },
    ],
    commonRows: [
      { label: '1 亩', value: '约 666.67 平方米' },
      { label: '1 公顷', value: '15 亩' },
      { label: '1 平方千米', value: '100 公顷' },
    ],
  },
  weight: {
    label: '重量',
    icon: 'root-list',
    defaults: [2, 1],
    units: [
      { label: '毫克', symbol: 'mg', factor: 0.000001 },
      { label: '克', symbol: 'g', factor: 0.001 },
      { label: '千克', symbol: 'kg', factor: 1 },
      { label: '吨', symbol: 't', factor: 1000 },
      { label: '斤', symbol: '斤', factor: 0.5 },
      { label: '磅', symbol: 'lb', factor: 0.45359237 },
    ],
    commonRows: [
      { label: '1 千克', value: '2 斤' },
      { label: '1 吨', value: '1000 千克' },
      { label: '1 磅', value: '约 0.4536 千克' },
    ],
  },
  volume: {
    label: '体积',
    icon: 'cola',
    defaults: [2, 1],
    units: [
      { label: '毫升', symbol: 'ml', factor: 0.001 },
      { label: '升', symbol: 'L', factor: 1 },
      { label: '立方米', symbol: 'm³', factor: 1000 },
      { label: '茶匙', symbol: 'tsp', factor: 0.00492892 },
      { label: '汤匙', symbol: 'tbsp', factor: 0.0147868 },
      { label: '液量盎司', symbol: 'fl oz', factor: 0.0295735 },
    ],
    commonRows: [
      { label: '1 升', value: '1000 毫升' },
      { label: '1 立方米', value: '1000 升' },
      { label: '1 汤匙', value: '约 15 毫升' },
    ],
  },
  temperature: {
    label: '温度',
    icon: 'celsius',
    defaults: [0, 1],
    units: [
      { label: '摄氏度', symbol: '°C', key: 'celsius' },
      { label: '华氏度', symbol: '°F', key: 'fahrenheit' },
      { label: '开尔文', symbol: 'K', key: 'kelvin' },
    ],
    commonRows: [
      { label: '0 °C', value: '32 °F' },
      { label: '100 °C', value: '212 °F' },
      { label: '273.15 K', value: '0 °C' },
    ],
  },
}

const categoryTabs = Object.keys(unitGroups).map((value) => ({
  value,
  label: unitGroups[value].label,
}))

const fail = (errorCode, errorMessage) => ({
  ok: false,
  errorCode,
  errorMessage,
})

const formatNumber = (value) => {
  if (!Number.isFinite(value)) return null
  if (Math.abs(value) < 1e-10) return '0'

  const precision = Math.abs(value) >= 1000 ? 2 : 6
  return String(Number(value.toFixed(precision)))
}

const convertTemperature = (value, fromKey, toKey) => {
  let celsius = value

  if (fromKey === 'fahrenheit') celsius = (value - 32) * 5 / 9
  if (fromKey === 'kelvin') celsius = value - 273.15
  if (toKey === 'fahrenheit') return celsius * 9 / 5 + 32
  if (toKey === 'kelvin') return celsius + 273.15
  return celsius
}

const convertValue = ({ category, value, fromUnitIndex, toUnitIndex }) => {
  const group = unitGroups[category]
  if (!group) return fail('INVALID_CATEGORY', '请选择有效换算类型')

  if (value == null || (typeof value === 'string' && !value.trim())) {
    return fail('EMPTY_INPUT', '请输入数值')
  }

  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return fail('INVALID_INPUT', '请输入有限数值')
  }

  const fromIndex = Number(fromUnitIndex)
  const toIndex = Number(toUnitIndex)
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) {
    return fail('INVALID_UNIT', '请选择有效单位')
  }

  const fromUnit = group.units[fromIndex]
  const toUnit = group.units[toIndex]
  if (!fromUnit || !toUnit) return fail('INVALID_UNIT', '请选择有效单位')

  const result = category === 'temperature'
    ? convertTemperature(numericValue, fromUnit.key, toUnit.key)
    : numericValue * fromUnit.factor / toUnit.factor

  if (!Number.isFinite(result)) {
    return fail('NON_FINITE_RESULT', '换算结果超出可计算范围')
  }

  const formatted = formatNumber(result)
  if (formatted === null) {
    return fail('NON_FINITE_RESULT', '换算结果超出可计算范围')
  }

  return {
    ok: true,
    data: {
      value: result,
      formatted,
      category,
      fromUnitIndex: fromIndex,
      toUnitIndex: toIndex,
    },
  }
}

module.exports = {
  categoryTabs,
  convertValue,
  formatNumber,
  unitGroups,
}
