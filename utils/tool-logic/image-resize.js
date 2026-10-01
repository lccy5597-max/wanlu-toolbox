const MIN_EXPORT_SIDE = 50
const MAX_EXPORT_SIDE = 4096

const fail = (errorCode, errorMessage) => ({ ok: false, errorCode, errorMessage })

const parseDimension = (value) => {
  if (value === '' || value == null) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const getTargetSize = (widthValue, heightValue) => {
  const width = parseDimension(widthValue)
  const height = parseDimension(heightValue)
  if (width == null || height == null) return fail('INVALID_SIZE', '请输入有效宽高')
  if (width < MIN_EXPORT_SIDE || height < MIN_EXPORT_SIDE || width > MAX_EXPORT_SIDE || height > MAX_EXPORT_SIDE) {
    return fail('SIZE_OUT_OF_RANGE', `宽高需在 ${MIN_EXPORT_SIDE}–${MAX_EXPORT_SIDE}px`)
  }
  const roundedWidth = Math.round(width)
  const roundedHeight = Math.round(height)
  if (roundedWidth < MIN_EXPORT_SIDE || roundedHeight < MIN_EXPORT_SIDE) return fail('SIZE_OUT_OF_RANGE', '尺寸过小')
  return { ok: true, data: { width: roundedWidth, height: roundedHeight } }
}

const getCustomSize = (widthValue, heightValue) => getTargetSize(widthValue, heightValue)

const getDrawPlan = (source, target, fitMode) => {
  const sourceWidth = Number(source && source.width)
  const sourceHeight = Number(source && source.height)
  const targetResult = getTargetSize(target && target.width, target && target.height)
  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0) {
    return fail('INVALID_SOURCE_SIZE', '原图尺寸无效')
  }
  if (!targetResult.ok) return targetResult
  if (!['cover', 'contain', 'stretch'].includes(fitMode)) return fail('INVALID_FIT_MODE', '请选择有效适配方式')

  const { width: targetWidth, height: targetHeight } = targetResult.data
  if (fitMode === 'stretch') {
    return {
      ok: true,
      data: {
        sourceX: 0,
        sourceY: 0,
        sourceWidth,
        sourceHeight,
        destX: 0,
        destY: 0,
        destWidth: targetWidth,
        destHeight: targetHeight,
      },
    }
  }

  if (fitMode === 'contain') {
    const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight)
    const destWidth = Math.max(1, Math.round(sourceWidth * scale))
    const destHeight = Math.max(1, Math.round(sourceHeight * scale))
    return {
      ok: true,
      data: {
        sourceX: 0,
        sourceY: 0,
        sourceWidth,
        sourceHeight,
        destX: Math.round((targetWidth - destWidth) / 2),
        destY: Math.round((targetHeight - destHeight) / 2),
        destWidth,
        destHeight,
      },
    }
  }

  const sourceRatio = sourceWidth / sourceHeight
  const targetRatio = targetWidth / targetHeight
  let cropX = 0
  let cropY = 0
  let cropWidth = sourceWidth
  let cropHeight = sourceHeight
  if (sourceRatio > targetRatio) {
    cropWidth = Math.max(1, Math.round(sourceHeight * targetRatio))
    cropX = Math.round((sourceWidth - cropWidth) / 2)
  } else {
    cropHeight = Math.max(1, Math.round(sourceWidth / targetRatio))
    cropY = Math.round((sourceHeight - cropHeight) / 2)
  }
  const values = [cropX, cropY, cropWidth, cropHeight, targetWidth, targetHeight]
  if (!values.every(Number.isFinite)) return fail('INVALID_DRAW_PLAN', '裁切参数无效')
  return {
    ok: true,
    data: {
      sourceX: cropX,
      sourceY: cropY,
      sourceWidth: cropWidth,
      sourceHeight: cropHeight,
      destX: 0,
      destY: 0,
      destWidth: targetWidth,
      destHeight: targetHeight,
    },
  }
}

module.exports = {
  MAX_EXPORT_SIDE,
  MIN_EXPORT_SIDE,
  getCustomSize,
  getDrawPlan,
  getTargetSize,
}
