const MAX_EXPORT_SIZE = 3072

const fail = (errorCode, errorMessage) => ({ ok: false, errorCode, errorMessage })

const validSize = (imageInfo) => {
  const width = Number(imageInfo && imageInfo.width)
  const height = Number(imageInfo && imageInfo.height)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  return { width, height }
}

const createCropOptions = (imageInfo) => {
  const size = validSize(imageInfo)
  if (!size) return []
  const { width, height } = size
  if (width === height) return [{ label: '原图', value: 'center', desc: '已是正方形' }]
  if (height > width) {
    return [
      { label: '顶部', value: 'top', desc: '保留上半部分' },
      { label: '居中', value: 'center', desc: '推荐' },
      { label: '底部', value: 'bottom', desc: '保留下半部分' },
    ]
  }
  return [
    { label: '左侧', value: 'left', desc: '保留左半部分' },
    { label: '居中', value: 'center', desc: '推荐' },
    { label: '右侧', value: 'right', desc: '保留右半部分' },
  ]
}

const getCropRect = (imageInfo, cropMode) => {
  const sizeInfo = validSize(imageInfo)
  if (!sizeInfo) return null
  const { width, height } = sizeInfo
  const size = Math.min(width, height)
  if (width === height) return cropMode === 'center' ? { x: 0, y: 0, size } : null
  if (height > width) {
    if (!['top', 'center', 'bottom'].includes(cropMode)) return null
    if (cropMode === 'top') return { x: 0, y: 0, size }
    if (cropMode === 'bottom') return { x: 0, y: height - size, size }
    return { x: 0, y: Math.round((height - size) / 2), size }
  }
  if (!['left', 'center', 'right'].includes(cropMode)) return null
  if (cropMode === 'left') return { x: 0, y: 0, size }
  if (cropMode === 'right') return { x: width - size, y: 0, size }
  return { x: Math.round((width - size) / 2), y: 0, size }
}

const getPreviewStyle = (imageInfo, cropMode) => {
  const sizeInfo = validSize(imageInfo)
  const cropRect = getCropRect(imageInfo, cropMode)
  if (!sizeInfo || !cropRect || cropRect.size <= 0) return ''
  const imageWidthPercent = (sizeInfo.width / cropRect.size) * 100
  const imageHeightPercent = (sizeInfo.height / cropRect.size) * 100
  const leftPercent = (-cropRect.x / cropRect.size) * 100
  const topPercent = (-cropRect.y / cropRect.size) * 100
  if (![imageWidthPercent, imageHeightPercent, leftPercent, topPercent].every(Number.isFinite)) return ''
  return [
    `width:${imageWidthPercent.toFixed(3)}%`,
    `height:${imageHeightPercent.toFixed(3)}%`,
    `left:${leftPercent.toFixed(3)}%`,
    `top:${topPercent.toFixed(3)}%`,
  ].join(';')
}

const createTilePlan = (imageInfo, cropMode) => {
  const cropRect = getCropRect(imageInfo, cropMode)
  if (!cropRect) return fail('INVALID_CROP', '裁切参数无效')
  if (cropRect.size < 3) return fail('IMAGE_TOO_SMALL', '图片尺寸太小，无法切成九宫格')
  const tileSize = Math.max(1, Math.floor(Math.min(cropRect.size, MAX_EXPORT_SIZE) / 3))
  const sourceTileSize = cropRect.size / 3
  const tiles = Array.from({ length: 9 }, (_, index) => {
    const row = Math.floor(index / 3)
    const column = index % 3
    return {
      index,
      row,
      column,
      sourceX: cropRect.x + column * sourceTileSize,
      sourceY: cropRect.y + row * sourceTileSize,
      sourceWidth: sourceTileSize,
      sourceHeight: sourceTileSize,
      destWidth: tileSize,
      destHeight: tileSize,
    }
  })
  const values = tiles.flatMap((tile) => [tile.sourceX, tile.sourceY, tile.sourceWidth, tile.sourceHeight, tile.destWidth, tile.destHeight])
  if (!values.every(Number.isFinite)) return fail('INVALID_TILE_PLAN', '九宫格参数无效')
  return { ok: true, data: { cropRect, tileSize, sourceTileSize, tiles } }
}

module.exports = {
  MAX_EXPORT_SIZE,
  createCropOptions,
  createTilePlan,
  getCropRect,
  getPreviewStyle,
}
