const MIN_GRID_WIDTH = 10
const MAX_GRID_WIDTH = 100
const MAX_GRID_HEIGHT = 120
const MAX_EXPORT_SIDE = 4096

const fail = (errorCode, errorMessage) => ({ ok: false, errorCode, errorMessage })

const getGridDimensions = (selectedGridWidth, imageInfo) => {
  const rawWidth = Number(selectedGridWidth)
  const imageWidth = Number(imageInfo && imageInfo.width)
  const imageHeight = Number(imageInfo && imageInfo.height)
  if (!Number.isFinite(rawWidth)) return fail('INVALID_GRID_WIDTH', '网格宽度无效')
  const gridWidth = Math.round(rawWidth)
  if (gridWidth < MIN_GRID_WIDTH || gridWidth > MAX_GRID_WIDTH) return fail('GRID_WIDTH_OUT_OF_RANGE', `宽度请输入 ${MIN_GRID_WIDTH}–${MAX_GRID_WIDTH}`)
  if (!Number.isFinite(imageWidth) || !Number.isFinite(imageHeight) || imageWidth <= 0 || imageHeight <= 0) return fail('INVALID_IMAGE_SIZE', '图片尺寸无效')
  const gridHeight = Math.max(1, Math.round(gridWidth * imageHeight / imageWidth))
  if (!Number.isFinite(gridHeight) || gridHeight > MAX_GRID_HEIGHT) return fail('GRID_HEIGHT_OUT_OF_RANGE', '图片比例过长，请先裁剪原图')
  return { ok: true, data: { gridWidth, gridHeight } }
}

const getPatternExportLayout = (pattern, statsCount) => {
  const patternWidth = Number(pattern && pattern.width)
  const patternHeight = Number(pattern && pattern.height)
  const count = Number(statsCount)
  if (!Number.isInteger(patternWidth) || !Number.isInteger(patternHeight) || patternWidth <= 0 || patternHeight <= 0) return fail('INVALID_PATTERN_SIZE', '图纸尺寸无效')
  if (!Number.isInteger(count) || count < 0) return fail('INVALID_STATS_COUNT', '颜色统计无效')
  const margin = 40
  const headerHeight = 94
  const coordinateSize = 34
  const legendColumns = count > 80 ? 5 : (count > 36 ? 4 : (patternWidth < 20 ? 2 : 3))
  const legendRowHeight = 42
  const legendRows = Math.ceil(count / legendColumns)
  const legendHeight = count ? 54 + legendRows * legendRowHeight : 0
  const verticalRoom = MAX_EXPORT_SIDE - margin * 2 - headerHeight - coordinateSize - legendHeight
  const horizontalRoom = MAX_EXPORT_SIDE - margin * 2 - coordinateSize
  const cellSize = Math.floor(Math.min(36, horizontalRoom / patternWidth, verticalRoom / patternHeight))
  if (!Number.isFinite(cellSize) || cellSize < 12) return fail('PATTERN_TOO_LARGE', '图纸过大，请减少网格尺寸')
  const gridWidth = patternWidth * cellSize
  const gridHeight = patternHeight * cellSize
  const legendMinimumWidth = legendColumns * 230
  const width = Math.ceil(Math.min(MAX_EXPORT_SIDE, Math.max(margin * 2 + coordinateSize + gridWidth, margin * 2 + legendMinimumWidth)))
  const height = Math.ceil(margin * 2 + headerHeight + coordinateSize + gridHeight + legendHeight)
  const gridX = Math.max(margin + coordinateSize, Math.round((width - gridWidth + coordinateSize) / 2))
  const gridY = margin + headerHeight + coordinateSize
  const values = [width, height, gridX, gridY, gridWidth, gridHeight, cellSize]
  if (!values.every(Number.isFinite) || width <= 0 || height <= 0 || width > MAX_EXPORT_SIDE || height > MAX_EXPORT_SIDE) return fail('INVALID_EXPORT_LAYOUT', '导出布局超出范围')
  return { ok: true, data: { margin, headerHeight, coordinateSize, legendColumns, legendRowHeight, legendRows, legendHeight, cellSize, gridWidth, gridHeight, width, height, gridX, gridY } }
}

module.exports = {
  MAX_EXPORT_SIDE,
  MAX_GRID_HEIGHT,
  MAX_GRID_WIDTH,
  MIN_GRID_WIDTH,
  getGridDimensions,
  getPatternExportLayout,
}
