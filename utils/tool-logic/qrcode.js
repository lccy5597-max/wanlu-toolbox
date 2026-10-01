const { generate } = require('../qrcode')

const QUIET_ZONE = 4
const EXPORT_SIZE = 900
const LOGO_RATIO = 0.2
const MAX_INPUT_CHARS = 500

const fail = (errorCode, errorMessage) => ({ ok: false, errorCode, errorMessage })

const prepareQrModel = (value) => {
  if (typeof value !== 'string') return fail('INVALID_INPUT_TYPE', '二维码内容必须是文本')
  const text = value.trim()
  if (!text) return fail('EMPTY_INPUT', '请先填写内容')
  if (text.length > MAX_INPUT_CHARS) return fail('INPUT_TOO_LONG', '内容过长，请精简后再试')
  let model
  try {
    model = generate(text, { ecc: 'H' })
  } catch (error) {
    model = null
  }
  if (!model) return fail('QR_CAPACITY_EXCEEDED', '内容过长，请精简后再试')
  return { ok: true, data: { text, model } }
}

const getMatrixPlan = (model, pixelSize = EXPORT_SIZE) => {
  const size = Number(model && model.size)
  const pixels = Number(pixelSize)
  if (!Number.isInteger(size) || size <= 0) return fail('INVALID_MODEL', '二维码模型无效')
  if (!Number.isFinite(pixels) || pixels <= 0) return fail('INVALID_EXPORT_SIZE', '导出尺寸无效')
  const totalModules = size + QUIET_ZONE * 2
  const scale = Math.floor(pixels / totalModules)
  if (!Number.isFinite(scale) || scale < 1) return fail('EXPORT_SIZE_TOO_SMALL', '导出尺寸不足')
  const contentSize = totalModules * scale
  const offset = Math.floor((pixels - contentSize) / 2)
  return { ok: true, data: { totalModules, scale, contentSize, offset, pixelSize: pixels } }
}

const getLogoPlan = (exportSize = EXPORT_SIZE, logoRatio = LOGO_RATIO) => {
  const size = Number(exportSize)
  const ratio = Number(logoRatio)
  if (!Number.isFinite(size) || size <= 0) return fail('INVALID_EXPORT_SIZE', '导出尺寸无效')
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 0.3) return fail('INVALID_LOGO_RATIO', 'Logo 比例无效')
  const logoSize = Math.max(1, Math.round(size * 0.68 * ratio))
  const padding = Math.max(0, Math.round(logoSize * 0.12))
  const boxSize = logoSize + padding * 2
  const left = Math.round((size - boxSize) / 2)
  if (![logoSize, padding, boxSize, left].every(Number.isFinite) || left < 0) return fail('INVALID_LOGO_PLAN', 'Logo 参数无效')
  return { ok: true, data: { logoSize, padding, boxSize, left } }
}

module.exports = {
  EXPORT_SIZE,
  LOGO_RATIO,
  MAX_INPUT_CHARS,
  QUIET_ZONE,
  getLogoPlan,
  getMatrixPlan,
  prepareQrModel,
}
