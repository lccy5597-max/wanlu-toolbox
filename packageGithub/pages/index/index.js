const { githubService } = require('../../../services/github')
const {
  buildGithubRankingView,
  getGithubPeriodTabs,
  isGithubPeriod,
  mapGithubRankingError,
} = require('../../../utils/github-ranking-view-model')

const DEFAULT_PERIOD = 'daily'
const PAGE = 1
const PAGE_SIZE = 5

const createTransportFailure = () => ({
  ok: false,
  error: {
    type: 'transport',
    retryable: true,
  },
})

const createGithubPageDefinition = ({ service = githubService } = {}) => {
  if (!service || typeof service.getRankings !== 'function') {
    throw new TypeError('github_service_get_rankings_required')
  }

  return {
    data: {
      tabs: getGithubPeriodTabs(),
      selectedPeriod: DEFAULT_PERIOD,
      items: [],
      status: 'initial',
      errorView: null,
      isLoading: false,
      hasLoaded: false,
    },

    onLoad() {
      this._isPageActive = true
      this._requestSeq = 0
      return this.loadPeriod(DEFAULT_PERIOD, { force: true })
    },

    onUnload() {
      this._isPageActive = false
      this._requestSeq = (this._requestSeq || 0) + 1
    },

    async loadPeriod(period, options = {}) {
      if (this._isPageActive === false || !isGithubPeriod(period)) return
      const force = Boolean(options.force)
      if (!force && this.data.isLoading && this.data.selectedPeriod === period) return

      const taskId = (this._requestSeq || 0) + 1
      this._requestSeq = taskId
      this.setData({
        selectedPeriod: period,
        status: 'loading',
        items: [],
        errorView: null,
        isLoading: true,
      })

      let result
      try {
        result = await service.getRankings(period, { page: PAGE, pageSize: PAGE_SIZE })
      } catch (error) {
        result = createTransportFailure()
      }

      if (this._isPageActive === false || taskId !== this._requestSeq || this.data.selectedPeriod !== period) return

      if (!result || result.ok !== true) {
        const errorView = mapGithubRankingError(result)
        this.setData({
          status: errorView.state,
          items: [],
          errorView,
          isLoading: false,
          hasLoaded: true,
        })
        return
      }

      const payload = result.data || {}
      const items = buildGithubRankingView(Array.isArray(payload.items) ? payload.items.slice(0, PAGE_SIZE) : [])
      this.setData({
        status: items.length ? 'success' : 'empty',
        items,
        errorView: null,
        isLoading: false,
        hasLoaded: true,
      })
    },

    onPeriodTap(event) {
      const period = event && event.currentTarget && event.currentTarget.dataset
        ? event.currentTarget.dataset.period
        : ''
      if (!isGithubPeriod(period)) return
      if (period === this.data.selectedPeriod && this.data.status !== 'initial') return
      return this.loadPeriod(period)
    },

    onRetry() {
      if (this.data.isLoading || !this.data.errorView || !this.data.errorView.retryable) return
      return this.loadPeriod(this.data.selectedPeriod, { force: true })
    },

    onBack() {
      if (typeof wx === 'undefined') return
      if (typeof getCurrentPages === 'function' && getCurrentPages().length > 1 && typeof wx.navigateBack === 'function') {
        wx.navigateBack()
        return
      }
      if (typeof wx.switchTab === 'function') {
        wx.switchTab({ url: '/pages/index/index' })
      }
    },
  }
}

if (typeof Page === 'function') Page(createGithubPageDefinition())

module.exports = {
  DEFAULT_PERIOD,
  PAGE,
  PAGE_SIZE,
  createGithubPageDefinition,
}
