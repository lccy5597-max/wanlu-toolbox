const { formatPublishDate } = require('./content-list-view-model')

const ARTICLE_DETAIL_ROUTE = '/packageContent/pages/article-detail/article-detail'

const normalizeArticleId = (value) => (typeof value === 'string' ? value.trim() : '')

const buildArticleDetailRoute = (id) => {
  const normalized = normalizeArticleId(id)
  if (!normalized) throw new Error('article_id_required')
  return `${ARTICLE_DETAIL_ROUTE}?id=${encodeURIComponent(normalized)}`
}

const parseArticleDetailRoute = (options = {}) => {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return { ok: false, id: '', reason: 'invalid_article_id' }
  }

  const raw = normalizeArticleId(options.id)
  if (!raw) return { ok: false, id: '', reason: 'invalid_article_id' }

  let decoded = raw
  try {
    decoded = decodeURIComponent(raw)
  } catch (error) {
    decoded = raw
  }

  const id = normalizeArticleId(decoded)
  return id
    ? { ok: true, id }
    : { ok: false, id: '', reason: 'invalid_article_id' }
}

const toArticleDetailViewModel = (source = {}) => {
  const content = typeof source.content === 'string' ? source.content : ''
  if (!content.trim()) throw new Error('article_content_required')

  const cover = typeof source.cover === 'string' ? source.cover : ''
  const article = {
    id: typeof source.id === 'string' ? source.id : '',
    title: typeof source.title === 'string' ? source.title : '',
    category: typeof source.category === 'string' ? source.category : '',
    publishTime: typeof source.publishTime === 'string' ? source.publishTime : '',
    displayPublishTime: formatPublishDate(source.publishTime),
    cover,
    hasCover: Boolean(cover),
    coverVisible: Boolean(cover),
    content,
    source: source.source === 'cache' ? 'cache' : 'network',
    isFallback: source.isFallback === true,
    cachedAt: Number.isFinite(source.cachedAt) ? source.cachedAt : null,
  }
  if (typeof source.author === 'string' && source.author) article.author = source.author
  return article
}

const getContentDetailErrorView = (result = {}) => {
  const error = result && result.error && typeof result.error === 'object' ? result.error : {}
  const type = error.type || ''
  const retryable = Boolean(error.retryable)

  if (type === 'client_disabled') {
    return {
      state: 'unavailable',
      title: '内容服务暂未启用',
      description: '当前暂不可浏览远程资讯',
      retryable: false,
    }
  }

  if (type === 'business' && Number(result.code) === 20004) {
    return {
      state: 'not_found',
      title: '文章不存在',
      description: '该内容可能已下线或地址已失效',
      retryable: false,
    }
  }

  if (type === 'transport') {
    return {
      state: 'error',
      title: '网络异常',
      description: '请检查网络后重试',
      retryable: true,
    }
  }

  if (type === 'http') {
    return {
      state: 'error',
      title: '内容加载失败',
      description: retryable ? '稍后可以重新加载' : '请稍后再试',
      retryable,
    }
  }

  return {
    state: 'error',
    title: '内容加载失败',
    description: '请稍后再试',
    retryable,
  }
}

const getInvalidArticleView = () => ({
  state: 'invalid',
  title: '文章地址无效',
  description: '请返回后重新选择文章',
  retryable: false,
})

module.exports = {
  ARTICLE_DETAIL_ROUTE,
  buildArticleDetailRoute,
  getContentDetailErrorView,
  getInvalidArticleView,
  normalizeArticleId,
  parseArticleDetailRoute,
  toArticleDetailViewModel,
}
