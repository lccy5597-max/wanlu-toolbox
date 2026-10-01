/**
 * wanluu.com 内容服务接口与文章数据模型。
 *
 * 正式链路：wanluu.com -> WordPress REST API / 自建 API -> 服务端统一清洗
 * -> 挽鹿工具箱后端 API -> 小程序原生列表/详情页。
 * 首发版不发起网络请求，不使用 WebView 作为默认文章承载方式。
 */
const ENDPOINTS = Object.freeze({
  list: '/api/content/list',
  detail: '/api/content/detail',
  categories: '/api/content/categories',
  recommend: '/api/content/recommend',
})

const ARTICLE_FIELDS = Object.freeze([
  'id',
  'title',
  'excerpt',
  'cover',
  'category',
  'categoryId',
  'publishTime',
  'author',
  'viewCount',
  'content',
  'sourceUrl',
  'tags',
  'isRecommended',
])

const normalizeArticle = (source = {}) => ({
  id: source.id || '',
  title: source.title || '',
  excerpt: source.excerpt || '',
  cover: source.cover || '',
  category: source.category || '',
  categoryId: source.categoryId || '',
  publishTime: source.publishTime || '',
  author: source.author || '',
  viewCount: Number(source.viewCount) || 0,
  content: source.content || '',
  sourceUrl: source.sourceUrl || '',
  tags: Array.isArray(source.tags) ? source.tags.slice() : [],
  isRecommended: Boolean(source.isRecommended),
})

const createEmptyResult = (type) => Promise.resolve({
  ok: false,
  reason: 'service_not_connected',
  type,
  data: type === 'detail' ? null : [],
})

module.exports = {
  ENDPOINTS,
  ARTICLE_FIELDS,
  normalizeArticle,
  getList: () => createEmptyResult('list'),
  getDetail: () => createEmptyResult('detail'),
  getCategories: () => createEmptyResult('categories'),
  getRecommend: () => createEmptyResult('recommend'),
}
