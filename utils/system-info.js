/**
 * 系统信息读取统一入口
 *
 * wx.getSystemInfoSync 已停止维护，新版本基础库推荐 wx.getWindowInfo / wx.getDeviceInfo。
 * 这里统一收敛读取逻辑，并对老版本基础库做回退，避免各页面重复写兼容代码。
 */

const EMPTY_INFO = {}

const callSafely = (getter) => {
  try {
    return (typeof getter === 'function' ? getter() : EMPTY_INFO) || EMPTY_INFO
  } catch (error) {
    return EMPTY_INFO
  }
}

/** 窗口信息：宽度、高度、像素比、安全区等 */
const getWindowInfo = () => (
  typeof wx.getWindowInfo === 'function'
    ? callSafely(wx.getWindowInfo)
    : callSafely(wx.getSystemInfoSync)
)

/** 设备信息：品牌、型号、平台等 */
const getDeviceInfo = () => (
  typeof wx.getDeviceInfo === 'function'
    ? callSafely(wx.getDeviceInfo)
    : callSafely(wx.getSystemInfoSync)
)

/** 设备像素比，取不到时给出保守值 */
const getPixelRatio = () => {
  const { pixelRatio } = getWindowInfo()
  const value = Number(pixelRatio)

  return Number.isFinite(value) && value > 0 ? value : 2
}

/** 平台标识，统一转小写 */
const getPlatform = () => String(getDeviceInfo().platform || '').toLowerCase()

module.exports = {
  getWindowInfo,
  getDeviceInfo,
  getPixelRatio,
  getPlatform,
}
