/** 仅保存白名单内的非敏感工具偏好。 */
const storage = require('./storage')
const {
  STORAGE_KEYS,
  createToolState,
  normalizeToolState,
  sanitizeToolStateValue,
} = require('../utils/data-schema')

const readDoc = () => normalizeToolState(storage.get(STORAGE_KEYS.TOOL_STATE, createToolState()))
const saveDoc = (doc) => storage.set(STORAGE_KEYS.TOOL_STATE, normalizeToolState(doc))

const getToolState = (toolId) => {
  const id = String(toolId || '').trim()
  if (!id) return {}
  return { ...(readDoc().tools[id] || {}) }
}

const setToolState = (toolId, patch) => {
  const id = String(toolId || '').trim()
  if (!id || !patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return { ok: false, reason: 'invalid_state' }
  }
  const doc = readDoc()
  const current = doc.tools[id] || {}
  const next = sanitizeToolStateValue(id, { ...current, ...patch })
  if (!Object.keys(next).length) {
    return { ok: false, reason: 'no_allowed_fields' }
  }
  doc.tools[id] = next
  const saved = saveDoc(doc)
  return { ok: saved.ok, state: saved.ok ? next : current, reason: saved.ok ? 'ok' : 'write_failed' }
}

const clearToolState = (toolId) => {
  const id = String(toolId || '').trim()
  if (!id) return { ok: false, reason: 'invalid_id' }
  const doc = readDoc()
  if (!Object.prototype.hasOwnProperty.call(doc.tools, id)) return { ok: true, changed: false }
  delete doc.tools[id]
  const saved = saveDoc(doc)
  return { ok: saved.ok, changed: saved.ok }
}

const clearAllToolState = () => {
  const saved = storage.set(STORAGE_KEYS.TOOL_STATE, createToolState())
  return { ok: saved.ok }
}

module.exports = {
  getToolState,
  setToolState,
  clearToolState,
  clearAllToolState,
}
