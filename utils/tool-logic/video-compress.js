const qualityOptions = [
  { label: '清晰', value: 'high', desc: '画质优先' },
  { label: '均衡', value: 'medium', desc: '推荐' },
  { label: '更小', value: 'low', desc: '体积优先' },
]
const qualityOrder = qualityOptions.map((item) => item.value)

const fail = (errorCode, errorMessage) => ({ ok: false, errorCode, errorMessage })

const getQualityAttempts = (selectedQuality) => {
  const startIndex = qualityOrder.indexOf(selectedQuality)
  if (startIndex < 0) return fail('INVALID_QUALITY', '请选择有效视频质量')
  return { ok: true, data: qualityOrder.slice(startIndex) }
}

const validateVideoInfo = (info, { requireDimensions = false } = {}) => {
  const width = Number(info && info.width)
  const height = Number(info && info.height)
  const duration = Number(info && info.duration)
  const size = Number(info && info.size)
  if (requireDimensions && (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)) return fail('INVALID_DIMENSIONS', '视频尺寸无效')
  if (info && info.width != null && (!Number.isFinite(width) || width <= 0)) return fail('INVALID_WIDTH', '视频宽度无效')
  if (info && info.height != null && (!Number.isFinite(height) || height <= 0)) return fail('INVALID_HEIGHT', '视频高度无效')
  if (info && info.duration != null && (!Number.isFinite(duration) || duration < 0)) return fail('INVALID_DURATION', '视频时长无效')
  if (info && info.size != null && (!Number.isFinite(size) || size < 0)) return fail('INVALID_SIZE', '视频大小无效')
  return { ok: true, data: { width: Number.isFinite(width) ? width : 0, height: Number.isFinite(height) ? height : 0, duration: Number.isFinite(duration) ? duration : 0, size: Number.isFinite(size) ? size : 0 } }
}

const validateCompressionResult = (result) => {
  const size = Number(result && result.size)
  const width = Number(result && result.width)
  const height = Number(result && result.height)
  if (!Number.isFinite(size) || size <= 0) return fail('INVALID_RESULT_SIZE', '压缩结果大小无效')
  if (result && result.width != null && (!Number.isFinite(width) || width <= 0)) return fail('INVALID_RESULT_WIDTH', '压缩结果宽度无效')
  if (result && result.height != null && (!Number.isFinite(height) || height <= 0)) return fail('INVALID_RESULT_HEIGHT', '压缩结果高度无效')
  return { ok: true, data: { size, width: Number.isFinite(width) ? width : 0, height: Number.isFinite(height) ? height : 0 } }
}

const getCompressionRatio = (originalSize, compressedSize) => {
  const original = Number(originalSize)
  const compressed = Number(compressedSize)
  if (!Number.isFinite(original) || original <= 0 || !Number.isFinite(compressed) || compressed <= 0) return fail('INVALID_FILE_SIZE', '视频大小无效')
  const percent = Math.max(0, Math.min(100, Math.round((1 - compressed / original) * 100)))
  return { ok: true, data: { percent, text: percent > 0 ? `节省 ${percent}%` : '体积接近' } }
}

module.exports = {
  getCompressionRatio,
  getQualityAttempts,
  qualityOptions,
  validateCompressionResult,
  validateVideoInfo,
}
