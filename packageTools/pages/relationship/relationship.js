const { withToolPage } = require('../../../behaviors/tool-page')
const {
  APPEND_STOP_TEXT,
  APPEND_STOP_TOAST,
  getDraftMeta,
  getEmptyResult,
  getExampleQueries,
  getRelationGroups,
  normalizeInput,
  resolveRelationship,
  shouldRecordRelationshipUsage,
} = require('../../../utils/tool-logic/relationship')

Page(withToolPage('relationship', {
  data: {
    selfGender: 'female',
    appendStopText: APPEND_STOP_TEXT,
    relationInput: '',
    relationSteps: [],
    relationPath: '',
    canAppendMore: true,
    relationGroups: getRelationGroups('female'),
    exampleQueries: getExampleQueries('female'),
    result: getEmptyResult(),
  },

  setDraftState(relationInput, options = {}) {
    const draft = getDraftMeta(relationInput)

    this.setData({
      relationInput: draft.normalized,
      relationSteps: draft.relationSteps,
      relationPath: draft.relationPath,
      canAppendMore: draft.canAppendMore,
      ...(options.result ? { result: options.result } : {}),
    })
  },

  resetResult() {
    this.setData({
      result: getEmptyResult(),
    })
  },

  onGenderSelect(event) {
    const selfGender = event.currentTarget.dataset.gender
    this._usageRecordedForBuild = false

    this.setData({
      selfGender,
      relationGroups: getRelationGroups(selfGender),
      exampleQueries: getExampleQueries(selfGender),
      result: getEmptyResult(),
    })
  },

  onAppendToken(event) {
    const { token } = event.currentTarget.dataset

    if (this.data.relationSteps.length && !this.data.canAppendMore) {
      wx.showToast({
        title: APPEND_STOP_TOAST,
        icon: 'none',
      })
      return
    }

    const currentValue = normalizeInput(this.data.relationInput)
    const nextValue = currentValue ? `${currentValue}的${token}` : token
    const nextDraft = getDraftMeta(nextValue)

    if (!nextDraft.canUseDraft) {
      wx.showToast({
        title: APPEND_STOP_TOAST,
        icon: 'none',
      })
      return
    }

    this.setDraftState(nextValue, {
      result: getEmptyResult(),
    })
    // 构建器中的自动中间计算只更新结果，不计 Usage。
    this.onCalculate(true)
  },

  onDeleteStep() {
    const currentValue = normalizeInput(this.data.relationInput)

    if (!currentValue) return

    const parts = currentValue.split('的').filter(Boolean)
    parts.pop()

    this.setDraftState(parts.join('的'), {
      result: getEmptyResult(),
    })

    if (parts.length) {
      this.onCalculate(true)
      return
    }

    this.resetResult()
  },

  onClear() {
    this._usageRecordedForBuild = false
    this.setDraftState('', {
      result: getEmptyResult(),
    })
  },

  onExampleTap(event) {
    const { query } = event.currentTarget.dataset
    this._usageRecordedForBuild = false

    this.setDraftState(query, {
      result: getEmptyResult(),
    })
    const success = this.onCalculate(true)
    this.recordRelationshipUsage(success, true)
  },

  recordRelationshipUsage(success, countAsUserAction) {
    if (!shouldRecordRelationshipUsage({
      success,
      alreadyRecorded: Boolean(this._usageRecordedForBuild),
      countAsUserAction,
    })) return

    this._usageRecordedForBuild = true
    this.recordToolUse()
  },

  onCalculate(silent = false) {
    const result = resolveRelationship(this.data.relationInput)
    if (!result.ok) {
      if (!silent) {
        wx.showToast({ title: result.errorMessage, icon: 'none' })
      }
      return false
    }

    this.setData({
      result: {
        hasResult: true,
        title: result.data.title,
        relationPath: result.data.relationPath,
        badge: result.data.badge,
      },
    })
    if (!silent) this.recordRelationshipUsage(true, true)
    return true
  },

  onShareAppMessage() {
    return {
      title: '亲戚关系怎么称呼？点一点就能算出来',
      path: '/packageTools/pages/relationship/relationship',
    }
  },

  onShareTimeline() {
    return {
      title: '亲戚关系计算器：不再被称呼绕晕',
      query: '',
    }
  },
}))
