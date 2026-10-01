/** Stage 3 本地用户数据总入口：不联网、不登录、不申请任何权限。 */
const storage = require('./storage')
const migrations = require('../utils/data-migrations')
const schema = require('../utils/data-schema')
const favorites = require('./favorites')
const history = require('./history')
const usage = require('./tool-usage')
const toolState = require('./tool-state')

const initialize = () => {
  try {
    return migrations.initializeStorage()
  } catch (error) {
    return { ok: false, migrated: false, error }
  }
}

const getSummary = () => ({
  favorites: favorites.getFavorites().length,
  history: history.getHistory().length,
  recent: usage.getRecentTools(0).length,
})

const clearAllLocalData = () => {
  const keys = Object.values(schema.STORAGE_KEYS)
  const results = keys.map((key) => storage.remove(key))
  const initialized = migrations.initializeStorage()
  return {
    ok: results.every((item) => item.ok) && initialized.ok,
    initialized,
  }
}

module.exports = {
  initialize,
  getSummary,
  clearAllLocalData,
  favorites,
  history,
  usage,
  toolState,
}
