const MAX_EXPORT_SIDE = 4096

const qualityOptions = [
  { label: '清晰', value: 'clear', quality: 0.9, desc: '细节更多' },
  { label: '均衡', value: 'balanced', quality: 0.75, desc: '推荐' },
  { label: '极小', value: 'small', quality: 0.55, desc: '体积更小' },
]

const widthOptions = [
  { label: '原尺寸（最长边≤4096）', value: 'original' },
  { label: '1920', value: '1920' },
  { label: '1280', value: '1280' },
  { label: '800', value: '800' },
]

const fail = (errorCode, errorMessage) => ({ ok: false, errorCode, errorMessage })

const getImageSize = (imageInfo) => {
  const width = Number(imageInfo && imageInfo.width)
  const height = Number(imageInfo && imageInfo.height)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return fail('INVALID_IMAGE_SIZE', '图片尺寸无效')
  }
  return { ok: true, data: { width, height } }
}

const getTargetSize = (imageInfo, maxWidth) => {
  const imageSize = getImageSize(imageInfo)
  if (!imageSize.ok) return imageSize

  const { width, height } = imageSize.data
  const sourceMaxSide = Math.max(width, height)
  let requestedLimit
  if (maxWidth === 'original') {
    requestedLimit = sourceMaxSide
  } else {
    requestedLimit = Number(maxWidth)
    if (!Number.isFinite(requestedLimit) || requestedLimit <= 0) {
      return fail('INVALID_MAX_WIDTH', '请选择有效压缩尺寸')
    }
  }

  const maxSide = Math.min(requestedLimit, MAX_EXPORT_SIDE)
  if (!Number.isFinite(maxSide) || maxSide <= 0) return fail('INVALID_TARGET_SIZE', '目标尺寸无效')

  if (sourceMaxSide <= maxSide) {
    return {
      ok: true,
      data: {
        width: Math.max(1, Math.round(width)),
        height: Math.max(1, Math.round(height)),
        scaled: false,
        platformLimited: false,
      },
    }
  }

  const scale = maxSide / sourceMaxSide
  const targetWidth = Math.max(1, Math.round(width * scale))
  const targetHeight = Math.max(1, Math.round(height * scale))
  if (![targetWidth, targetHeight].every(Number.isFinite)) return fail('INVALID_TARGET_SIZE', '目标尺寸无效')

  return {
    ok: true,
    data: {
      width: targetWidth,
      height: targetHeight,
      scaled: true,
      platformLimited: maxWidth === 'original' && sourceMaxSide > MAX_EXPORT_SIDE,
    },
  }
}

const getQualityForMode = (qualityMode) => {
  const option = qualityOptions.find((item) => item.value === qualityMode)
  if (!option) return fail('INVALID_QUALITY', '请选择有效压缩质量')
  return { ok: true, data: { quality: option.quality, qualityMode: option.value } }
}

const getQualityAttempts = (qualityMode) => {
  const selected = getQualityForMode(qualityMode)
  if (!selected.ok) return selected
  const selectedQuality = selected.data.quality
  const qualities = qualityOptions
    .map((item) => item.quality)
    .filter((quality) => quality <= selectedQuality)
    .sort((left, right) => right - left)
  return { ok: true, data: Array.from(new Set([selectedQuality, ...qualities])) }
}

const getCompressionRatio = (originalSize, compressedSize) => {
  const original = Number(originalSize)
  const compressed = Number(compressedSize)
  if (!Number.isFinite(original) || original <= 0 || !Number.isFinite(compressed) || compressed <= 0) {
    return fail('INVALID_FILE_SIZE', '文件大小无效')
  }
  if (compressed >= original) return { ok: true, data: { text: '已是较小', percent: 0 } }
  const percent = Math.max(0, Math.min(100, Math.round((1 - compressed / original) * 100)))
  return { ok: true, data: { text: `节省 ${percent}%`, percent } }
}

module.exports = {
  MAX_EXPORT_SIDE,
  getCompressionRatio,
  getQualityAttempts,
  getQualityForMode,
  getTargetSize,
  qualityOptions,
  widthOptions,
}
