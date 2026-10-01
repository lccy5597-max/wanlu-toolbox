const { contentService } = require('../../../services/content')
const {
  getContentListErrorView,
  mergeArticleItems,
} = require('../../../utils/content-list-view-model')
const { buildArticleDetailRoute } = require('../../../utils/content-detail-view-model')

const PAGE_SIZE = 10

const createTransportFailure = () => ({
  ok: false,
  error: {
    type: 'transport',
    retryable: true,
  },
})

const createArticlesPageDefinition = ({ service = contentService } = {}) => {
  if (!service || typeof service.getArticles !== 'function') {
    throw new TypeError('content_service_get_articles_required')
  }

  return {
    data: {
      items: [],
      status: 'initial',
      errorView: null,
      loadMoreError: null,
      isLoading: false,
      isLoadingMore: false,
      hasLoaded: false,
      page: 1,
      pageSize: PAGE_SIZE,
      hasMore: false,
      isFallback: false,
    },

    onLoad() {
      this._isPageActive = true
      this._requestSeq = 0
      return this.loadFirstPage()
    },

    onUnload() {
      this._isPageActive = false
      this._requestSeq = (this._requestSeq || 0) + 1
    },

    async loadFirstPage(options = {}) {
      const force = Boolean(options.force)
      if (this._isPageActive === false) return
      if (!force && (this.data.isLoading || this.data.isLoadingMore)) return

      const taskId = (this._requestSeq || 0) + 1
      this._requestSeq = taskId
      this.setData({
        status: 'loading',
        isLoading: true,
        isLoadingMore: false,
        errorView: null,
        loadMoreError: null,
      })

      let result
      try {
        result = await service.getArticles({ page: 1, pageSize: PAGE_SIZE })
      } catch (error) {
        result = createTransportFailure()
      }

      if (this._isPageActive === false || taskId !== this._requestSeq) return

      if (!result || result.ok !== true) {
        const errorView = getContentListErrorView(result)
        this.setData({
          status: errorView.state,
          errorView,
          isLoading: false,
          hasLoaded: true,
          page: 1,
          hasMore: false,
          isFallback: false,
        })
        return
      }

      const payload = result.data || {}
      const pagination = payload.pagination || {}
      const items = mergeArticleItems([], payload.items || [], { replace: true })
      this.setData({
        items,
        status: items.length ? 'success' : 'empty',
        errorView: null,
        isLoading: false,
        hasLoaded: true,
        page: Number.isInteger(pagination.page) ? pagination.page : 1,
        hasMore: Boolean(pagination.hasMore),
        isFallback: Boolean(payload.isFallback),
      })
    },

    onRetry() {
      if (this.data.status === 'unavailable' || this.data.isLoading || this.data.isLoadingMore) return
      return this.loadFirstPage()
    },

    async loadMore() {
      if (this._isPageActive === false) return
      if (!this.data.hasLoaded || !this.data.hasMore) return
      if (this.data.isLoading || this.data.isLoadingMore) return

      const nextPage = this.data.page + 1
      const taskId = (this._requestSeq || 0) + 1
      this._requestSeq = taskId
      this.setData({
        isLoadingMore: true,
        loadMoreError: null,
      })

      let result
      try {
        result = await service.getArticles({ page: nextPage, pageSize: PAGE_SIZE })
      } catch (error) {
        result = createTransportFailure()
      }

      if (this._isPageActive === false || taskId !== this._requestSeq) return

      if (!result || result.ok !== true) {
        this.setData({
          isLoadingMore: false,
          loadMoreError: getContentListErrorView(result),
        })
        return
      }

      const payload = result.data || {}
      const pagination = payload.pagination || {}
      const items = mergeArticleItems(this.data.items, payload.items || [])
      this.setData({
        items,
        status: items.length ? 'success' : 'empty',
        isLoadingMore: false,
        loadMoreError: null,
        page: Number.isInteger(pagination.page) ? pagination.page : nextPage,
        hasMore: Boolean(pagination.hasMore),
        isFallback: this.data.isFallback || Boolean(payload.isFallback),
      })
    },

    onReachBottom() {
      return this.loadMore()
    },

    onLoadMoreRetry() {
      if (!this.data.loadMoreError || !this.data.loadMoreError.retryable) return
      return this.loadMore()
    },

    onArticleTap(event) {
      const id = event && event.currentTarget && event.currentTarget.dataset
        ? event.currentTarget.dataset.id
        : ''
      let url
      try {
        url = buildArticleDetailRoute(id)
      } catch (error) {
        return
      }
      if (typeof wx === 'undefined' || typeof wx.navigateTo !== 'function') return
      wx.navigateTo({
        url,
        fail: (error) => console.error('[content] article detail navigation failed', error),
      })
    },

    onCoverError(event) {
      if (this._isPageActive === false) return
      const id = event && event.currentTarget && event.currentTarget.dataset
        ? event.currentTarget.dataset.id
        : ''
      if (!id) return
      this.setData({
        items: this.data.items.map((item) => (item.id === id ? { ...item, coverVisible: false } : item)),
      })
    },
  }
}

if (typeof Page === 'function') Page(createArticlesPageDefinition())

module.exports = {
  PAGE_SIZE,
  createArticlesPageDefinition,
}
