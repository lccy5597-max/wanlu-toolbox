const MAX_EXPORT_SIDE = 4096

const opacityOptions = [
  { id: 'light', title: '浅', value: 0.12 },
  { id: 'medium', title: '中', value: 0.18 },
  { id: 'strong', title: '深', value: 0.26 },
]

const fail = (errorCode, errorMessage) => ({ ok: false, errorCode, errorMessage })

const normalizeWatermarkText = (value) => String(value == null ? '' : value)
  .split(/\n/)
  .map((item) => item.trim())
  .filter(Boolean)
  .slice(0, 3)

const getTargetSize = (imageInfo) => {
  const width = Number(imageInfo && imageInfo.width)
  const height = Number(imageInfo && imageInfo.height)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return fail('INVALID_IMAGE_SIZE', '图片尺寸无效')
  const maxSide = Math.max(width, height)
  const scale = maxSide > MAX_EXPORT_SIDE ? MAX_EXPORT_SIDE / maxSide : 1
  const targetWidth = Math.max(1, Math.round(width * scale))
  const targetHeight = Math.max(1, Math.round(height * scale))
  if (![targetWidth, targetHeight].every(Number.isFinite)) return fail('INVALID_TARGET_SIZE', '目标尺寸无效')
  return { ok: true, data: { width: targetWidth, height: targetHeight, scaled: scale < 1 } }
}

const getOpacity = (opacityId) => {
  const option = opacityOptions.find((item) => item.id === opacityId)
  if (!option) return fail('INVALID_OPACITY', '请选择有效透明度')
  return { ok: true, data: option.value }
}

const getWatermarkLayout = ({ target, lines, opacity }) => {
  const width = Number(target && target.width)
  const height = Number(target && target.height)
  const alpha = Number(opacity)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return fail('INVALID_TARGET_SIZE', '目标尺寸无效')
  if (!Array.isArray(lines) || !lines.length || lines.some((line) => typeof line !== 'string' || !line.trim())) return fail('INVALID_TEXT', '水印文字无效')
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) return fail('INVALID_OPACITY', '水印透明度无效')
  const fontSize = Math.max(24, Math.round(Math.min(width, height) * 0.045))
  const lineHeight = Math.max(1, Math.round(fontSize * 1.35))
  const blockHeight = lineHeight * lines.length
  const stepX = Math.max(260, Math.round(width * 0.42))
  const stepY = Math.max(190, Math.round(height * 0.24))
  const diagonal = Math.ceil(Math.sqrt(width * width + height * height))
  const values = [fontSize, lineHeight, blockHeight, stepX, stepY, diagonal]
  if (!values.every(Number.isFinite)) return fail('INVALID_LAYOUT', '水印布局参数无效')
  return { ok: true, data: { fontSize, lineHeight, blockHeight, stepX, stepY, diagonal, opacity: alpha } }
}

module.exports = {
  MAX_EXPORT_SIDE,
  getOpacity,
  getTargetSize,
  getWatermarkLayout,
  normalizeWatermarkText,
  opacityOptions,
}
