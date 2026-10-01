/**
 * AI 服务接口定义。
 * 首发版不发起任何网络请求；这里只固定能力名称与返回结构，便于后续接入服务端时保持页面层稳定。
 */
const CAPABILITIES = Object.freeze([
  'chat',
  'writing',
  'polish',
  'summary',
  'title',
  'videoScript',
  'toolRecommend',
])

const getCapabilities = () => CAPABILITIES.slice()

const createUnavailableResult = (capability) => Promise.resolve({
  ok: false,
  reason: 'service_not_connected',
  capability,
  data: null,
})

module.exports = {
  CAPABILITIES,
  getCapabilities,
  request: createUnavailableResult,
}
