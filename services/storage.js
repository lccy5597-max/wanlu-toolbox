/**
 * 挽鹿工具箱统一本地存储层。
 *
 * 约束：
 * - 所有业务 Storage Key 必须以 wl_ 开头；页面层禁止直接调用 wx.*StorageSync。
 * - 这里只保存非敏感、体积可控的结构化数据。
 * - 禁止保存 AppSecret、session_key、API Key、Token、密码、图片/视频/Base64/临时路径或敏感工具输入。
 * - 所有方法都吞掉底层存储异常并返回显式结果，避免 Storage 损坏导致页面白屏。
 */
const PREFIX = 'wl_'

const normalizeKey = (key) => {
  const value = String(key || '').trim()
  if (!value) throw new Error('storage key required')
  return value.startsWith(PREFIX) ? value : `${PREFIX}${value}`
}

const cloneFallback = (fallback) => {
  if (fallback === null || fallback === undefined) return fallback
  if (Array.isArray(fallback)) return fallback.slice()
  if (typeof fallback === 'object') return { ...fallback }
  return fallback
}

const readRaw = (key) => {
  try {
    const storageKey = normalizeKey(key)
    const value = wx.getStorageSync(storageKey)
    const found = value !== '' && value !== undefined
    return { ok: true, found, key: storageKey, value: found ? value : undefined }
  } catch (error) {
    return { ok: false, found: false, key: String(key || ''), value: undefined, error }
  }
}

const get = (key, fallback = null) => {
  const result = readRaw(key)
  return result.ok && result.found ? result.value : cloneFallback(fallback)
}

const set = (key, value) => {
  try {
    wx.setStorageSync(normalizeKey(key), value)
    return { ok: true, value }
  } catch (error) {
    return { ok: false, value, error }
  }
}

const remove = (key) => {
  try {
    wx.removeStorageSync(normalizeKey(key))
    return { ok: true }
  } catch (error) {
    return { ok: false, error }
  }
}

const update = (key, updater, fallback = null) => {
  if (typeof updater !== 'function') {
    return { ok: false, error: new Error('storage updater must be a function') }
  }

  const current = get(key, fallback)
  let next

  try {
    next = updater(current)
  } catch (error) {
    return { ok: false, error }
  }

  return set(key, next)
}

/** 仅供 migration 读取阶段2遗留的非 wl_ 键；业务代码禁止使用。 */
const readLegacyRaw = (key) => {
  try {
    const legacyKey = String(key || '').trim()
    if (!legacyKey || legacyKey.startsWith(PREFIX)) return { ok: false, found: false }
    const value = wx.getStorageSync(legacyKey)
    const found = value !== '' && value !== undefined
    return { ok: true, found, value: found ? value : undefined }
  } catch (error) {
    return { ok: false, found: false, error }
  }
}

const removeLegacyRaw = (key) => {
  try {
    const legacyKey = String(key || '').trim()
    if (!legacyKey || legacyKey.startsWith(PREFIX)) return { ok: false }
    wx.removeStorageSync(legacyKey)
    return { ok: true }
  } catch (error) {
    return { ok: false, error }
  }
}

module.exports = {
  PREFIX,
  normalizeKey,
  readRaw,
  get,
  set,
  remove,
  readLegacyRaw,
  removeLegacyRaw,
  update,
}
