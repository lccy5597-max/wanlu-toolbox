const formatPublishDate = (value) => {
  if (typeof value !== 'string' || !value) return ''
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) return ''
  return value.slice(0, 10)
}

const toArticleListItem = (source = {}) => {
  const cover = typeof source.cover === 'string' ? source.cover : ''
  const article = {
    id: typeof source.id === 'string' ? source.id : '',
    title: typeof source.title === 'string' ? source.title : '',
    excerpt: typeof source.excerpt === 'string' ? source.excerpt : '',
    category: typeof source.category === 'string' ? source.category : '',
    publishTime: typeof source.publishTime === 'string' ? source.publishTime : '',
    displayPublishTime: formatPublishDate(source.publishTime),
    cover,
    hasCover: Boolean(cover),
    coverVisible: Boolean(cover),
  }
  if (typeof source.author === 'string' && source.author) article.author = source.author
  return article
}

const mergeArticleItems = (currentItems = [], incomingItems = [], options = {}) => {
  const source = options.replace ? incomingItems : [...currentItems, ...incomingItems]
  const seen = new Set()
  const result = []

  for (const item of Array.isArray(source) ? source : []) {
    const normalized = toArticleListItem(item)
    if (!normalized.id || seen.has(normalized.id)) continue
    seen.add(normalized.id)
    result.push(normalized)
  }

  return result
}

const getContentListErrorView = (result = {}) => {
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
      title: '服务暂不可用',
      description: retryable ? '稍后可以重新加载' : '请稍后再试',
      retryable,
    }
  }

  if (type === 'business') {
    return {
      state: 'error',
      title: '内容加载失败',
      description: '请稍后再试',
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

module.exports = {
  formatPublishDate,
  getContentListErrorView,
  mergeArticleItems,
  toArticleListItem,
}
