const { contentService } = require('../../../services/content')
const {
  getContentDetailErrorView,
  getInvalidArticleView,
  parseArticleDetailRoute,
  toArticleDetailViewModel,
} = require('../../../utils/content-detail-view-model')

const createTransportFailure = () => ({
  ok: false,
  error: {
    type: 'transport',
    retryable: true,
  },
})

const createContractFailure = () => ({
  ok: false,
  error: {
    type: 'contract',
    retryable: false,
  },
})

const createArticleDetailPageDefinition = ({ service = contentService } = {}) => {
  if (!service || typeof service.getArticleDetail !== 'function') {
    throw new TypeError('content_service_get_article_detail_required')
  }

  return {
    data: {
      article: null,
      articleId: '',
      status: 'initial',
      errorView: null,
      isLoading: false,
      hasLoaded: false,
      isFallback: false,
    },

    onLoad(options) {
      this._isPageActive = true
      this._requestSeq = 0

      const route = parseArticleDetailRoute(options)
      if (!route.ok) {
        this.setData({
          article: null,
          articleId: '',
          status: 'invalid',
          errorView: getInvalidArticleView(),
          isLoading: false,
          hasLoaded: true,
          isFallback: false,
        })
        return
      }

      this.setData({ articleId: route.id })
      return this.loadArticle()
    },

    onUnload() {
      this._isPageActive = false
      this._requestSeq = (this._requestSeq || 0) + 1
    },

    async loadArticle(options = {}) {
      const force = Boolean(options.force)
      if (this._isPageActive === false) return
      if (!this.data.articleId) return
      if (!force && this.data.isLoading) return

      const taskId = (this._requestSeq || 0) + 1
      this._requestSeq = taskId
      this.setData({
        status: 'loading',
        errorView: null,
        isLoading: true,
      })

      let result
      try {
        result = await service.getArticleDetail(this.data.articleId)
      } catch (error) {
        result = createTransportFailure()
      }

      if (this._isPageActive === false || taskId !== this._requestSeq) return

      if (!result || result.ok !== true) {
        const errorView = getContentDetailErrorView(result)
        this.setData({
          article: null,
          status: errorView.state,
          errorView,
          isLoading: false,
          hasLoaded: true,
          isFallback: false,
        })
        return
      }

      let article
      try {
        article = toArticleDetailViewModel(result.data)
      } catch (error) {
        const errorView = getContentDetailErrorView(createContractFailure())
        this.setData({
          article: null,
          status: errorView.state,
          errorView,
          isLoading: false,
          hasLoaded: true,
          isFallback: false,
        })
        return
      }

      this.setData({
        article,
        status: 'success',
        errorView: null,
        isLoading: false,
        hasLoaded: true,
        isFallback: Boolean(article.isFallback),
      })
    },

    onRetry() {
      if (this.data.isLoading || !this.data.errorView || !this.data.errorView.retryable) return
      return this.loadArticle()
    },

    onCoverError() {
      if (this._isPageActive === false || !this.data.article || !this.data.article.coverVisible) return
      this.setData({
        article: { ...this.data.article, coverVisible: false },
      })
    },
  }
}

if (typeof Page === 'function') Page(createArticleDetailPageDefinition())

module.exports = {
  createArticleDetailPageDefinition,
}
