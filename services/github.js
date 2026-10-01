/**
 * GitHub 榜单服务接口定义。
 * 首发版不联网；未来统一由挽鹿工具箱后端代理 GitHub 数据并完成中文化、缓存与清洗。
 */
const ENDPOINTS = Object.freeze({
  daily: '/api/github/daily',
  weekly: '/api/github/weekly',
  all: '/api/github/all',
})

const createEmptyResult = (type) => Promise.resolve({
  ok: false,
  reason: 'service_not_connected',
  type,
  items: [],
})

module.exports = {
  ENDPOINTS,
  getDaily: () => createEmptyResult('daily'),
  getWeekly: () => createEmptyResult('weekly'),
  getAll: () => createEmptyResult('all'),
}
