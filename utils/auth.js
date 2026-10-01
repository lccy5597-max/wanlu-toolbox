/**
 * 账号服务接口（首发版离线实现）
 *
 * 设计约束：
 * 1. 本文件不发起任何网络请求，不接数据库，不接支付。
 * 2. 本文件不保存、不引用 AppSecret / Token / 任何密钥。
 * 3. 对外只暴露稳定的调用签名，未来接入真实微信登录时，
 *    只需替换本文件内部实现，页面调用方无需改动：
 *      - getLoginStatus()  同步读取当前登录态
 *      - login()           登录（Promise）
 *      - logout()          退出登录（Promise）
 *      - getUserProfile()  获取/更新头像昵称（Promise）
 *
 * 真实接入时的标准流程（仅作注释记录，当前不执行）：
 *   1. wx.login() 获取临时凭证 code；
 *   2. code 提交给自建服务端，由服务端换取 openid / session_key 并下发会话；
 *   3. 前端只缓存服务端返回的非敏感会话信息；
 *   4. 头像昵称通过 <button open-type="chooseAvatar"> 与 <input type="nickname"> 采集，
 *      wx.getUserProfile 已不对新用户开放头像昵称授权，不要再依赖它。
 */

const appConfig = require('../config/app')
const storage = require('../services/storage')

/**
 * 会话缓存键。
 * 只允许缓存非敏感信息（如昵称、头像地址、登录时间），
 * 严禁缓存 AppSecret、session_key、服务端 Token 明文。
 */
const SESSION_KEY = 'wl_auth_session'

/** 未登录态：页面唯一数据来源，避免各页面自己拼状态 */
const ANONYMOUS_PROFILE = {
  logged: false,
  nickname: '访客',
  desc: '当前公开工具无需登录即可使用',
  avatarUrl: '',
  avatarText: '挽',
}

/** 用户体系是否已在前端开启（由 config/app.js 的 features.user 控制） */
function isSupported() {
  return appConfig.isEnabled('user')
}

function readSession() {
  const session = storage.get(SESSION_KEY, null)
  return session && typeof session === 'object' ? session : null
}

function clearSession() {
  storage.remove(SESSION_KEY)
}

/**
 * 获取当前展示用的用户信息
 * @returns {{logged:boolean, nickname:string, desc:string, avatarUrl:string, avatarText:string}}
 */
function getProfile() {
  // 用户体系关闭时始终返回访客态，不伪造任何账号数据
  if (!isSupported()) {
    return Object.assign({}, ANONYMOUS_PROFILE)
  }

  const session = readSession()
  if (!session || !session.logged) {
    return Object.assign({}, ANONYMOUS_PROFILE)
  }

  return {
    logged: true,
    nickname: session.nickname || '微信用户',
    desc: '账号服务已连接',
    avatarUrl: session.avatarUrl || '',
    avatarText: '',
  }
}

/**
 * 获取当前登录状态
 * @returns {{logged:boolean, available:boolean, reason:string, profile:object}}
 */
function getLoginStatus() {
  const profile = getProfile()
  const available = isSupported()

  return {
    logged: profile.logged,
    available,
    reason: available ? 'ok' : 'disabled',
    profile,
  }
}

/**
 * 登录
 * 首发版不提供登录，只返回稳定的不可用结果。
 * @returns {Promise<{ok:boolean, reason:string, message:string, profile?:object}>}
 */
function login() {
  if (!isSupported()) {
    return Promise.resolve({
      ok: false,
      reason: 'disabled',
      message: '当前版本无需登录即可使用公开工具',
    })
  }

  // 真实实现位置：wx.login -> 服务端换会话 -> 缓存非敏感会话
  return Promise.resolve({
    ok: false,
    reason: 'not_implemented',
    message: '账号服务未连接',
  })
}

/**
 * 退出登录
 * 当前仅清理本地缓存（无缓存时为空操作），保证接口语义完整。
 * @returns {Promise<{ok:boolean}>}
 */
function logout() {
  clearSession()

  return Promise.resolve({ ok: true, reason: isSupported() ? 'ok' : 'disabled' })
}

/**
 * 获取 / 更新用户头像昵称
 * 首发版不采集用户资料，返回不可用结果。
 * @returns {Promise<{ok:boolean, reason:string, message:string, profile?:object}>}
 */
function getUserProfile() {
  if (!isSupported()) {
    return Promise.resolve({
      ok: false,
      reason: 'disabled',
      message: '当前版本不采集用户资料',
    })
  }

  return Promise.resolve({
    ok: false,
    reason: 'not_implemented',
    message: '账号服务未连接',
  })
}

module.exports = {
  SESSION_KEY,
  getLoginStatus,
  getProfile,
  login,
  logout,
  getUserProfile,
}
