/**
 * Stage 3 本地数据迁移。
 *
 * 事务原则：先读取并在内存中完成全部归一化，再写分区，最后写 meta。
 * 任一写入失败时，已经写过的分区按启动前快照回滚；旧结构不会因为半途中断而被删除。
 * 当前 schema 为 v1，同时兼容 v0/无包装结构，并迁移阶段2尺子旧缓存键。
 */
const storage = require('../services/storage')
const schema = require('./data-schema')

const partitionDefinitions = [
  [schema.STORAGE_KEYS.FAVORITES, schema.createFavorites, schema.normalizeFavorites],
  [schema.STORAGE_KEYS.HISTORY, schema.createHistory, schema.normalizeHistory],
  [schema.STORAGE_KEYS.USAGE, schema.createUsage, schema.normalizeUsage],
  [schema.STORAGE_KEYS.TOOL_STATE, schema.createToolState, schema.normalizeToolState],
]

const LEGACY_RULER_KEY = 'rulerCalibrationV1'
const stableJson = (value) => JSON.stringify(value)

const restoreSnapshot = (snapshot) => {
  if (!snapshot || !snapshot.key) return { ok: false }
  return snapshot.found
    ? storage.set(snapshot.key, snapshot.value)
    : storage.remove(snapshot.key)
}

const preparePartitions = (now, legacyRuler) => {
  const prepared = []

  for (const [key, createDefault, normalize] of partitionDefinitions) {
    const raw = storage.readRaw(key)
    if (!raw.ok) return { ok: false, error: raw.error, prepared: [] }

    const source = raw.found ? raw.value : createDefault()
    let value = normalize(source, now)

    if (key === schema.STORAGE_KEYS.TOOL_STATE && legacyRuler && legacyRuler.found) {
      const hasCalibration = Boolean(value.tools.ruler && value.tools.ruler.calibration)
      if (!hasCalibration) {
        const calibration = schema.sanitizeToolStateValue('ruler', { calibration: legacyRuler.value }).calibration
        if (calibration) {
          value = {
            ...value,
            tools: {
              ...value.tools,
              ruler: { calibration },
            },
          }
        }
      }
    }

    prepared.push({
      key,
      raw,
      value,
      needsWrite: !raw.found || stableJson(raw.value) !== stableJson(value),
    })
  }

  return { ok: true, prepared }
}

const rollbackWritten = (written) => {
  const results = []
  for (let index = written.length - 1; index >= 0; index -= 1) {
    results.push(restoreSnapshot(written[index].raw))
  }
  return results.every((item) => item && item.ok)
}

const initializeStorage = (now = Date.now()) => {
  const metaRaw = storage.readRaw(schema.STORAGE_KEYS.META)
  if (!metaRaw.ok) return { ok: false, migrated: false, error: metaRaw.error, partitions: [] }

  const legacyRuler = storage.readLegacyRaw(LEGACY_RULER_KEY)
  const preparedResult = preparePartitions(now, legacyRuler.ok ? legacyRuler : null)
  if (!preparedResult.ok) {
    return { ok: false, migrated: false, error: preparedResult.error, partitions: [] }
  }

  const currentMeta = metaRaw.found ? schema.normalizeMeta(metaRaw.value, now) : schema.createMeta(now)
  const metaNeedsWrite = !metaRaw.found
    || stableJson(metaRaw.value) !== stableJson(currentMeta)
    || preparedResult.prepared.some((item) => item.needsWrite)
  const nextMeta = metaNeedsWrite
    ? { ...currentMeta, schemaVersion: schema.SCHEMA_VERSION, updatedAt: now }
    : currentMeta

  const written = []
  const partitionResults = []

  for (const item of preparedResult.prepared) {
    if (!item.needsWrite) {
      partitionResults.push({ key: item.key, ok: true, changed: false })
      continue
    }

    const saved = storage.set(item.key, item.value)
    partitionResults.push({ key: item.key, ok: saved.ok, changed: saved.ok, error: saved.error })
    if (!saved.ok) {
      const rollbackOk = rollbackWritten(written)
      return {
        ok: false,
        migrated: false,
        error: saved.error,
        rollbackOk,
        meta: currentMeta,
        partitions: partitionResults,
      }
    }
    written.push(item)
  }

  if (metaNeedsWrite) {
    const metaSaved = storage.set(schema.STORAGE_KEYS.META, nextMeta)
    if (!metaSaved.ok) {
      const rollbackOk = rollbackWritten(written)
      return {
        ok: false,
        migrated: false,
        error: metaSaved.error,
        rollbackOk,
        meta: currentMeta,
        partitions: partitionResults,
      }
    }
  }

  const preparedToolState = preparedResult.prepared.find((item) => item.key === schema.STORAGE_KEYS.TOOL_STATE)
  const legacyMigrated = Boolean(
    legacyRuler.ok
    && legacyRuler.found
    && preparedToolState
    && preparedToolState.value
    && preparedToolState.value.tools
    && preparedToolState.value.tools.ruler
    && preparedToolState.value.tools.ruler.calibration
  )
  if (legacyMigrated) storage.removeLegacyRaw(LEGACY_RULER_KEY)

  return {
    ok: true,
    migrated: metaNeedsWrite,
    meta: nextMeta,
    partitions: partitionResults,
  }
}

module.exports = {
  LEGACY_RULER_KEY,
  initializeStorage,
  preparePartitions,
  restoreSnapshot,
}
