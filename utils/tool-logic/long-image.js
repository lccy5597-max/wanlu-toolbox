const MAX_IMAGE_COUNT = 9
const MAX_EXPORT_WIDTH = 1440
const MAX_EXPORT_HEIGHT = 16000
const MIN_EXPORT_WIDTH = 480

const fail = (errorCode, errorMessage) => ({ ok: false, errorCode, errorMessage })

const createRenderPlan = (images) => {
  if (!Array.isArray(images) || images.length < 2) return fail('NOT_ENOUGH_IMAGES', '请至少选择 2 张图片')
  if (images.length > MAX_IMAGE_COUNT) return fail('TOO_MANY_IMAGES', `最多选择 ${MAX_IMAGE_COUNT} 张图片`)
  const normalized = []
  for (const item of images) {
    const width = Number(item && item.width)
    const height = Number(item && item.height)
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return fail('INVALID_IMAGE_SIZE', '图片尺寸无效')
    normalized.push({ ...item, width, height })
  }

  const first = normalized[0]
  const baseWidth = Math.min(Math.max(first.width, MIN_EXPORT_WIDTH), MAX_EXPORT_WIDTH)
  const sourceItems = normalized.map((item) => {
    const drawHeight = Math.max(1, Math.round(item.height * baseWidth / item.width))
    if (!Number.isFinite(drawHeight)) return null
    return { image: item, sourceY: 0, sourceHeight: item.height, drawHeight }
  })
  if (sourceItems.some((item) => !item)) return fail('INVALID_RENDER_PLAN', '拼接尺寸无效')

  const baseHeight = sourceItems.reduce((sum, item) => sum + item.drawHeight, 0)
  if (!Number.isFinite(baseHeight) || baseHeight <= 0) return fail('INVALID_RENDER_PLAN', '拼接尺寸无效')
  const scale = baseHeight > MAX_EXPORT_HEIGHT ? MAX_EXPORT_HEIGHT / baseHeight : 1
  const width = Math.floor(baseWidth * scale)
  if (!Number.isFinite(width) || width < MIN_EXPORT_WIDTH || width > MAX_EXPORT_WIDTH) return fail('EXPORT_TOO_TALL', '图片太长，请减少图片或裁掉重叠区域')

  const items = []
  let offsetY = 0
  sourceItems.forEach((item, index) => {
    const isLast = index === sourceItems.length - 1
    const drawHeight = isLast
      ? Math.max(1, Math.round(baseHeight * scale) - offsetY)
      : Math.max(1, Math.round(item.drawHeight * scale))
    items.push({ ...item, drawY: offsetY, drawHeight })
    offsetY += drawHeight
  })
  if (!Number.isFinite(offsetY) || offsetY <= 0 || offsetY > MAX_EXPORT_HEIGHT) return fail('EXPORT_TOO_TALL', '图片太长，请减少图片或裁掉重叠区域')
  return { ok: true, data: { width, height: offsetY, items, scaled: scale < 1 } }
}

module.exports = {
  MAX_EXPORT_HEIGHT,
  MAX_EXPORT_WIDTH,
  MAX_IMAGE_COUNT,
  MIN_EXPORT_WIDTH,
  createRenderPlan,
}
