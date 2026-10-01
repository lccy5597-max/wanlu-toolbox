/**
 * 挽鹿工具箱 —— 项目静态体检脚本
 *
 * 用法： node scripts/check-project.js
 *
 * 这是一个**纯静态**检查工具，不依赖任何第三方包，不修改任何文件。
 * 它用来在提交前 / 每个阶段结束时快速确认：
 *   1. 页面注册、文件是否存在
 *   2. 组件引用路径是否有效
 *   3. WXML 自定义标签是否已声明
 *   4. WXML 事件处理器是否都有对应的 JS 实现
 *   5. WXSS 里引用的 CSS 变量是否真的被定义过（无效变量会让整条声明静默失效）
 *   6. 页面跳转路径是否合法（switchTab 只能跳 tab 页）
 *   7. 废弃 API 是否复燃（wx.getSystemInfoSync）
 *   8. 是否残留旧品牌文案 / 上游 AppID / 非公共 AppID 配置
 *   9. 是否把密钥类敏感信息写进了源码
 *  10. 隐私接口是否被放进了页面生命周期里自动调用（应该在用户点击后才调）
 *  11. 首发版是否仍存在摄像头能力
 *  12. 正式构建文件里是否出现明显半成品文案
 *
 * ERROR 视为必须修；WARN 需要人工判断是否可以忽略。
 */

const fs = require('fs')
const path = require('path')
const { runStage4StaticChecks } = require('./stage4-static-rules')

const ROOT = path.resolve(__dirname, '..')

let errorCount = 0
let warnCount = 0
const errors = []
const warns = []

function error(msg) {
  errorCount += 1
  errors.push(msg)
}

function warn(msg) {
  warnCount += 1
  warns.push(msg)
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    return null
  }
}

function read(file) {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch (e) {
    return null
  }
}

/** 递归遍历目录，返回符合条件的文件绝对路径 */
function walk(dir, filter, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // 不必扫描构建产物与 node_modules
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      walk(full, filter, out)
    } else if (filter(entry.name, full)) {
      out.push(full)
    }
  }
  return out
}

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/')

// 首发正式包明确排除的内部源码。这里必须与 project.config.json 的 packOptions.ignore 保持一致。
const BUILD_EXCLUDED_PREFIXES = [
  'packageTools/pages/wooden-fish/',
  'packageTools/pages/zodiac/',
]

const isBuildExcluded = (filePath) => BUILD_EXCLUDED_PREFIXES.some((prefix) => filePath.startsWith(prefix))

/** 去掉 CSS 注释，避免注释里举例的变量名被当成真实引用 */
function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/**
 * 判断一个字符串字面量是否"像密钥"。
 * 本地缓存键名（如 'wl_auth_session'）不是密钥，不应误报。
 */
function looksSecret(value) {
  const v = String(value)
  if (v.length < 16) return false
  if (v.includes('${')) return false
  const hasDigit = /[0-9]/.test(v)
  const hasUpper = /[A-Z]/.test(v)
  // 纯小写 + 下划线的长串大概率是 storage key / 常量名，而非密钥
  return hasDigit || hasUpper || v.length >= 24
}

// ---------------------------------------------------------------- 收集文件

const appJson = readJson(path.join(ROOT, 'app.json'))
if (!appJson) {
  console.error('无法解析 app.json，后续检查中止')
  process.exit(1)
}

// 主包页面 + 分包页面
const allPages = []
const pageRootOf = {} // 页面路径 -> 所属包根

for (const p of appJson.pages || []) {
  allPages.push(p)
  pageRootOf[p] = ROOT
}

const subRoots = []
for (const sub of appJson.subPackages || []) {
  subRoots.push(sub.root)
  for (const p of sub.pages || []) {
    const full = sub.root.replace(/\/$/, '') + '/' + p
    allPages.push(full)
    pageRootOf[full] = ROOT
  }
}

const tabPages = []
const tabPageSet = new Set()
for (const item of (appJson.tabBar && appJson.tabBar.list) || []) {
  tabPages.push(item.pagePath)
  tabPageSet.add(item.pagePath)
}

const allWxml = walk(ROOT, (n) => n.endsWith('.wxml')).filter((f) => !isBuildExcluded(rel(f)))
const allWxss = walk(ROOT, (n) => n.endsWith('.wxss')).filter((f) => !isBuildExcluded(rel(f)))
const allJs = walk(ROOT, (n) => n.endsWith('.js') && !n.includes('node_modules'))
  .filter((f) => !isBuildExcluded(rel(f)))
const allJsonFiles = walk(ROOT, (n) => n.endsWith('.json')).filter((f) => !isBuildExcluded(rel(f)))

console.log('='.repeat(60))
console.log('挽鹿工具箱 · 项目静态体检')
console.log('='.repeat(60))
console.log(
  `扫描范围：页面 ${allPages.length} 个 / wxml ${allWxml.length} / wxss ${allWxss.length} / js(过滤前) ${allJs.length}`
)
console.log('')

// ------------------------------------------------- 1. 页面注册与文件完整性

console.log('---- [1] 页面注册与文件完整性 ----')
let missing = 0
for (const p of allPages) {
  for (const ext of ['.js', '.json', '.wxml', '.wxss']) {
    const f = path.join(ROOT, p + ext)
    if (!fs.existsSync(f)) {
      error(`页面 ${p} 缺少文件 ${p + ext}`)
      missing += 1
    }
  }
}
// 反向：存在 xxx.wxml 但没在 app.json 注册（排除 components 与 tdesign）
const registered = new Set(allPages)
for (const w of allWxml) {
  const abs = w.replace(/\.wxml$/, '')
  const rp = rel(abs)
  if (rp.startsWith('components/')) continue
  if (rp.includes('miniprogram_npm')) continue
  if (!registered.has(rp)) {
    warn(`存在页面文件但未在 app.json 注册：${rp}`)
  }
}
console.log(missing === 0 ? 'OK  所有已注册页面的四个文件齐全' : `发现 ${missing} 处缺失`)

// ------------------------------------------------- 2. usingComponents 路径

console.log('---- [2] usingComponents 引用路径 ----')
let badComp = 0
for (const jf of allJsonFiles) {
  if (rel(jf).includes('miniprogram_npm')) continue
  if (rel(jf).includes('node_modules')) continue
  const obj = readJson(jf)
  if (!obj || !obj.usingComponents) continue
  const dir = path.dirname(jf)
  for (const [tag, ref] of Object.entries(obj.usingComponents)) {
    if (typeof ref !== 'string') continue
    if (ref.startsWith('/')) {
      const abs = path.join(ROOT, ref)
      if (!fs.existsSync(abs + '.wxml')) {
        error(`${rel(jf)} 组件 ${tag} 绝对路径无效：${ref}`)
        badComp += 1
      }
    } else {
      const abs = path.join(dir, ref)
      if (!fs.existsSync(abs + '.wxml')) {
        error(`${rel(jf)} 组件 ${tag} 相对路径无效：${ref}`)
        badComp += 1
      }
    }
  }
}
console.log(badComp === 0 ? 'OK  所有组件引用路径有效' : `发现 ${badComp} 处无效引用`)

// ------------------------------------------------- 3. WXML 自定义标签声明

console.log('---- [3] WXML 自定义标签声明 ----')
const BUILTIN_TAGS = new Set([
  'view','text','image','button','input','textarea','scroll-view','swiper','swiper-item','block',
  'template','import','include','slot','form','label','picker','picker-view','picker-view-column',
  'slider','switch','checkbox','checkbox-group','radio','radio-group','icon','progress','rich-text',
  'canvas','video','camera','map','navigator','web-view','audio','open-data','movable-area',
  'movable-view','cover-view','cover-image','match-media','page-container','share-element',
  'keyboard-accessory','ad','official-account','editor','functional-page-navigator','live-player',
  'live-pusher','voip-room','store','page-meta','navigation-bar','tabs','grid-view','list-view',
  'sticky-section','sticky-header','snapshot','span','grid-view','root-portal','span'
])
let undeclared = 0
for (const wf of allWxml) {
  if (rel(wf).includes('miniprogram_npm')) continue
  const content = read(wf) || ''
  const jf = wf.replace(/\.wxml$/, '.json')
  const json = readJson(jf) || {}
  const declared = new Set(Object.keys(json.usingComponents || {}))
  // 全局组件
  let globalDeclared = new Set()
  if (appJson.usingComponents) globalDeclared = new Set(Object.keys(appJson.usingComponents))
  // 分包内 wxml 里的自定义标签，可能声明在同包别的 json 里，这里只查本页 json + 全局
  const found = new Set()
  const re = /<([a-zA-Z][\w-]*)[\s/>]/g
  let m
  while ((m = re.exec(content))) {
    const tag = m[1]
    if (BUILTIN_TAGS.has(tag)) continue
    found.add(tag)
  }
  for (const tag of found) {
    if (!declared.has(tag) && !globalDeclared.has(tag)) {
      error(`${rel(wf)} 使用了未声明的自定义标签 <${tag}>`)
      undeclared += 1
    }
  }
}
console.log(undeclared === 0 ? 'OK  所有自定义标签均已声明' : `发现 ${undeclared} 处未声明`)

// ------------------------------------------------- 4. 事件处理器是否有实现

console.log('---- [4] WXML 事件处理器实现 ----')
let missingHandler = 0
const toolPageBehaviorJs = read(path.join(ROOT, 'behaviors/tool-page.js')) || ''
for (const wf of allWxml) {
  if (rel(wf).includes('miniprogram_npm')) continue
  const content = read(wf) || ''
  const jf = wf.replace(/\.wxml$/, '.js')
  const js = read(jf)
  if (js === null) continue
  const implementationSource = js.includes('withToolPage(')
    ? `${js}\n${toolPageBehaviorJs}`
    : js
  const handlers = new Set()
  const re = /\b(bind|catch|capture-bind|capture-catch|mut-bind):?([a-zA-Z]+)\s*=\s*"([^"]+)"/g
  let m
  while ((m = re.exec(content))) {
    const expr = m[3].trim()
    // 只处理直接方法名，三元/内联语句跳过
    if (!/^[A-Za-z_$][\w$]*$/.test(expr)) continue
    handlers.add(expr)
  }
  for (const h of handlers) {
    const defined =
      new RegExp(`(^|[\\s,;{])${h}\\s*\\(`, 'm').test(implementationSource) ||
      new RegExp(`(^|[\\s,;{])${h}\\s*:`, 'm').test(implementationSource) ||
      new RegExp(`${h}\\s*=\\s*function`).test(implementationSource)
    if (!defined) {
      error(`${rel(wf)} 绑定了 ${h}，但 ${rel(jf)} 中找不到实现`)
      missingHandler += 1
    }
  }
}
console.log(
  missingHandler === 0 ? 'OK  所有事件处理器都有 JS 实现' : `发现 ${missingHandler} 处缺失实现`
)

// ------------------------------------------------- 5. CSS 变量定义检查

console.log('---- [5] CSS 变量引用是否都有定义 ----')
const definedVars = new Set()
for (const wf of allWxss) {
  const c = stripCssComments(read(wf) || '')
  let m
  const reDef = /(--[\w-]+)\s*:/g
  while ((m = reDef.exec(c))) definedVars.add(m[1])
}
const UNCHECK_VAR_FILES = /miniprogram_npm/
let badVars = 0
const badVarDetail = new Map()
for (const wf of allWxss) {
  if (UNCHECK_VAR_FILES.test(rel(wf))) continue
  const c = stripCssComments(read(wf) || '')
  let m
  const reUse = /var\(\s*(--[\w-]+)/g
  while ((m = reUse.exec(c))) {
    if (!definedVars.has(m[1])) {
      badVars += 1
      const key = rel(wf)
      if (!badVarDetail.has(key)) badVarDetail.set(key, new Set())
      badVarDetail.get(key).add(m[1])
    }
  }
}
if (badVars === 0) {
  console.log('OK  所有 WXSS 引用的 CSS 变量均已定义')
} else {
  for (const [f, vars] of badVarDetail) {
    error(`${f} 引用了未定义的 CSS 变量：${[...vars].join(', ')}（整条声明会静默失效）`)
  }
}

// ------------------------------------------------- 6. 跳转路径合法性

console.log('---- [6] 页面跳转路径 ----')
const NAV_APIS = ['navigateTo', 'redirectTo', 'switchTab', 'reLaunch']
let badNav = 0
for (const jf of allJs) {
  if (rel(jf).includes('miniprogram_npm')) continue
  if (rel(jf).includes('node_modules')) continue
  const c = read(jf) || ''
  for (const api of NAV_APIS) {
    const re = new RegExp(`wx\\.${api}\\s*\\(\\s*\\{[\\s\\S]{0,200}?url\\s*:\\s*['"\`]([^'"\`]+)['"\`]`, 'g')
    let m
    while ((m = re.exec(c))) {
      let url = m[1]
      // 处理模板字符串拼接的路径（形如 `/packageX/pages/${xxx}/index`），跳过动态部分
      if (url.includes('${')) continue
      url = url.replace(/^\//, '').split('?')[0]
      if (url.startsWith('plugin://') || url.includes('://')) continue
      if (!registered.has(url)) {
        error(`${rel(jf)} 跳转到未注册页面：${url}`)
        badNav += 1
      } else if (api === 'switchTab' && !tabPageSet.has(url)) {
        error(`${rel(jf)} 用 switchTab 跳转非 tab 页：${url}`)
        badNav += 1
      } else if (api === 'navigateTo' && tabPageSet.has(url)) {
        error(`${rel(jf)} 用 navigateTo 跳转 tab 页（应用 switchTab）：${url}`)
        badNav += 1
      }
    }
  }
}
console.log(badNav === 0 ? 'OK  所有跳转路径合法且跳转方式正确' : `发现 ${badNav} 处问题`)

// ------------------------------------------------- 7. 废弃 API

console.log('---- [7] 废弃 API 检查 ----')
let deprecated = 0
for (const jf of allJs) {
  if (rel(jf).includes('miniprogram_npm')) continue
  if (rel(jf).includes('node_modules')) continue
  if (rel(jf).startsWith('scripts/')) continue
  const c = read(jf) || ''
  if (/wx\.getSystemInfoSync/.test(c) && !rel(jf).endsWith('utils/system-info.js')) {
    error(`${rel(jf)} 使用了已废弃的 wx.getSystemInfoSync，请改用 utils/system-info.js`)
    deprecated += 1
  }
}
console.log(deprecated === 0 ? 'OK  无废弃 getSystemInfoSync 调用' : `发现 ${deprecated} 处`)

// ------------------------------------------------- 8. 品牌与 AppID 残留

console.log('---- [8] 旧品牌 / 上游 AppID 残留 ----')
// 注意：pindou / 拼豆 是被保留的「拼豆图纸」工具名，不是上游品牌，不参与匹配
const OLD_BRAND = [/拼豆助手/i, /LittleWhite1995/i, /tools-applet/i]
let brandHit = 0
const scanTextFiles = [...allWxml, ...allJs, ...allJsonFiles, ...allWxss]
for (const f of scanTextFiles) {
  if (rel(f).includes('miniprogram_npm')) continue
  if (rel(f).includes('node_modules')) continue
  if (rel(f) === 'LICENSE' || rel(f).endsWith('.md')) continue
  if (rel(f).startsWith('scripts/')) continue // 本脚本自身含有 pattern 字符串
  const c = read(f) || ''
  for (const pat of OLD_BRAND) {
    if (pat.test(c)) {
      warn(`${rel(f)} 可能残留旧品牌关键字 ${pat}`)
      brandHit += 1
      break
    }
  }
}
const projectConfig = readJson(path.join(ROOT, 'project.config.json')) || {}
const privateProjectConfig = readJson(path.join(ROOT, 'project.private.config.json')) || {}
const gitignoreText = read(path.join(ROOT, '.gitignore')) || ''
const PUBLIC_APPID_PLACEHOLDER = 'wx0000000000000000'

if (projectConfig.appid !== PUBLIC_APPID_PLACEHOLDER) {
  error('project.config.json 必须使用公共占位 AppID，真实 AppID 只能放 project.private.config.json')
}

if (!gitignoreText.split(/\r?\n/).includes('project.private.config.json')) {
  error('project.private.config.json 未被 .gitignore 明确忽略')
}

if (privateProjectConfig.libVersion && projectConfig.libVersion !== privateProjectConfig.libVersion) {
  error(`基础库版本不一致：project.config.json=${projectConfig.libVersion || '空'} / project.private.config.json=${privateProjectConfig.libVersion}`)
}

for (const f of [path.join(ROOT, 'project.config.json'), path.join(ROOT, 'project.private.config.json')]) {
  if (!fs.existsSync(f)) continue
  const c = read(f) || ''
  if (/touristappid/i.test(c)) {
    error(`${rel(f)} 中仍存在 touristappid`)
  }
}
console.log('OK  已扫描（残留数以 WARN 形式列出）')

// ------------------------------------------------- 9. 敏感信息

console.log('---- [9] 敏感信息扫描 ----')
const SENSITIVE = [
  { name: 'AppSecret', re: /(?:app)?secret\s*[:=]\s*['"]([A-Za-z0-9]{16,})['"]/i },
  { name: 'session_key', re: /session_key\s*[:=]\s*['"]([^'"]{8,})['"]/i },
  { name: 'API Key', re: /api[_-]?key\s*[:=]\s*['"]([^'"]{8,})['"]/i },
  { name: 'Access Token', re: /access[_-]?token\s*[:=]\s*['"]([^'"]{16,})['"]/i },
  { name: '私钥文件', re: /BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY/ },
  { name: '数据库口令', re: /(?:password|passwd|pwd)\s*[:=]\s*['"]([^'"\s]{8,})['"]/i }
]
let secretHit = 0
for (const f of [...allJs, ...allJsonFiles, ...allWxml]) {
  if (rel(f).includes('miniprogram_npm')) continue
  if (rel(f).includes('node_modules')) continue
  if (rel(f).startsWith('scripts/')) continue
  const c = read(f) || ''
  for (const s of SENSITIVE) {
    let m
    const re = new RegExp(s.re.source, s.re.flags + 'g')
    while ((m = re.exec(c))) {
      const value = m[2] !== undefined ? m[2] : m[1]
      if (!looksSecret(value)) continue
      error(`${rel(f)} 疑似包含 ${s.name} 明文，前端源码禁止写入密钥`)
      secretHit += 1
    }
  }
}
console.log(secretHit === 0 ? 'OK  未发现密钥类明文' : `发现 ${secretHit} 处疑似密钥`)

// ------------------------------------------------- 10. 隐私接口调用时机

console.log('---- [10] 隐私接口调用时机 ----')
const PRIVACY_APIS = ['chooseMedia', 'chooseImage', 'saveImageToPhotosAlbum', 'authorize', 'getLocation']
let lifeCycleHit = 0
for (const jf of allJs) {
  if (rel(jf).includes('miniprogram_npm')) continue
  if (rel(jf).includes('node_modules')) continue
  if (rel(jf).startsWith('utils/') || rel(jf).startsWith('scripts/')) continue
  const c = read(jf) || ''
  // 粗粒度：找出 onLoad / onShow / attached 方法体，检查内部是否直接出现隐私 API
  const re = /(onLoad|onShow|attached)\s*\([^)]*\)\s*\{/g
  let m
  while ((m = re.exec(c))) {
    const start = m.index + m[0].length
    let depth = 1
    let i = start
    while (i < c.length && depth > 0) {
      if (c[i] === '{') depth += 1
      else if (c[i] === '}') depth -= 1
      i += 1
    }
    const body = c.slice(start, i)
    for (const api of PRIVACY_APIS) {
      if (body.includes(`wx.${api}`)) {
        error(
          `${rel(jf)} 在生命周期 ${m[1]} 里直接调用 wx.${api}，隐私接口必须由用户点击触发`
        )
        lifeCycleHit += 1
      }
    }
  }
}
console.log(lifeCycleHit === 0 ? 'OK  隐私接口均未在生命周期内自动调用' : `发现 ${lifeCycleHit} 处`)

// ------------------------------------------------- 11. 首发版摄像头能力

console.log('---- [11] 首发版摄像头能力 ----')
let cameraHit = 0
for (const f of [...allJs, ...allJsonFiles, ...allWxml]) {
  const rp = rel(f)
  if (rp.includes('miniprogram_npm') || rp.includes('node_modules') || rp.startsWith('scripts/')) continue
  const c = read(f) || ''
  const hasCameraSource = /sourceType\s*:\s*\[[^\]]*['"]camera['"]/s.test(c)
  const hasCameraApi = /scope\.camera|wx\.createCameraContext|<camera(?:\s|>)/i.test(c)

  if (hasCameraSource || hasCameraApi) {
    error(`${rp} 首发版仍包含摄像头能力`)
    cameraHit += 1
  }
}
const imagePickerSource = read(path.join(ROOT, 'utils/image-picker.js')) || ''
if (/options\.sourceType/.test(imagePickerSource)) {
  error('utils/image-picker.js 不得允许调用方通过 options.sourceType 扩大媒体来源；首发版必须强制仅 album')
  cameraHit += 1
}
console.log(cameraHit === 0 ? 'OK  首发版未发现摄像头能力' : `发现 ${cameraHit} 处`)

// ------------------------------------------------- 12. 半成品文案

console.log('---- [12] 半成品文案 ----')
const INCOMPLETE_COPY = [
  /即将上线/,
  /敬请期待/,
  /功能开发中/,
  /暂未开放/,
  /尚未启用/,
  /后续版本开放/,
  /正式版本开放/,
  /测试功能/,
  /\bDemo\b/i,
]
let incompleteHit = 0
for (const f of [...allWxml, ...allJs, ...allJsonFiles]) {
  const rp = rel(f)
  if (rp.includes('miniprogram_npm') || rp.includes('node_modules') || rp.startsWith('scripts/')) continue
  const c = read(f) || ''

  for (const pattern of INCOMPLETE_COPY) {
    if (pattern.test(c)) {
      error(`${rp} 存在半成品文案 ${pattern}`)
      incompleteHit += 1
      break
    }
  }
}
console.log(incompleteHit === 0 ? 'OK  正式构建代码无半成品文案' : `发现 ${incompleteHit} 处`)

// ------------------------------------------------- 13. Stage 3 本地数据架构

console.log('---- [13] Stage 3 本地数据架构 ----')
let stage3Hit = 0
const stage3SchemaPath = path.join(ROOT, 'utils/data-schema.js')
const stage3Schema = fs.existsSync(stage3SchemaPath) ? require(stage3SchemaPath) : null
const expectedStorageKeys = ['wl_meta_v1', 'wl_favorites_v1', 'wl_history_v1', 'wl_tool_usage_v1', 'wl_tool_state_v1']

if (!stage3Schema) {
  error('Stage 3 缺少 utils/data-schema.js')
  stage3Hit += 1
} else {
  const values = Object.values(stage3Schema.STORAGE_KEYS || {})
  for (const key of expectedStorageKeys) {
    if (!values.includes(key)) { error(`Stage 3 缺少 Storage Key ${key}`); stage3Hit += 1 }
  }
  if (values.some((key) => !String(key).startsWith('wl_'))) {
    error('Stage 3 存在非 wl_ 前缀的业务 Storage Key'); stage3Hit += 1
  }
  if (stage3Schema.USAGE_SYNC_MODEL !== 'aggregate-no-tombstone') {
    error('wl_tool_usage_v1 必须明确采用 aggregate-no-tombstone 同步模型'); stage3Hit += 1
  }
  const meta = stage3Schema.createMeta(1)
  if (meta.schemaVersion !== 1 || !Object.prototype.hasOwnProperty.call(meta, 'recentClearedAt')) {
    error('wl_meta_v1 必须包含 schemaVersion 与 recentClearedAt'); stage3Hit += 1
  }
  for (const creator of ['createFavorites', 'createHistory', 'createUsage', 'createToolState']) {
    const doc = stage3Schema[creator]()
    if (!doc || doc.version !== 1) { error(`${creator} 返回的数据结构必须包含 version=1`); stage3Hit += 1 }
  }
  const usageSample = stage3Schema.normalizeUsage({
    tools: {
      sample: {
        firstUsedAt: 1,
        lastUsedAt: 2,
        lastSuccessAt: 2,
        useCount: 1,
        createdAt: 1,
        updatedAt: 2,
        deletedAt: 2,
      },
    },
  })
  if (usageSample.tools.sample && Object.prototype.hasOwnProperty.call(usageSample.tools.sample, 'deletedAt')) {
    error('wl_tool_usage_v1 是 aggregate-no-tombstone 模型，usage 记录不得包含 deletedAt'); stage3Hit += 1
  }
  const whitelistText = JSON.stringify(stage3Schema.TOOL_STATE_WHITELIST || {}).toLowerCase()
  const forbiddenStateFields = ['path', 'base64', 'salary', 'mortgage', 'bmi', 'weight', 'height', 'health', 'content', 'html', 'watermarktext', 'qrcode']
  if (forbiddenStateFields.some((field) => whitelistText.includes(field))) {
    error('Tool State 白名单疑似包含敏感输入或文件路径字段'); stage3Hit += 1
  }
}

for (const jf of allJs) {
  const rp = rel(jf)
  const isPageSource = rp.startsWith('pages/') || rp.startsWith('packageTools/pages/') || rp.startsWith('packageUser/pages/')
  if (!isPageSource || rp.includes('node_modules') || rp.includes('miniprogram_npm')) continue
  const c = read(jf) || ''
  if (/wx\.(?:get|set|remove)StorageSync\s*\(/.test(c)) {
    error(`${rp} 直接调用 StorageSync，必须经过统一数据层`); stage3Hit += 1
  }
}

const authSource = read(path.join(ROOT, 'utils/auth.js')) || ''
const authKeyMatch = authSource.match(/const\s+SESSION_KEY\s*=\s*['"]([^'"]+)['"]/) 
if (authKeyMatch && !authKeyMatch[1].startsWith('wl_')) {
  error('账号接口预留的本地 Storage Key 必须使用 wl_ 前缀'); stage3Hit += 1
}

const stage3Sources = [...allJs, ...allJsonFiles]
  .filter((f) => !rel(f).includes('node_modules') && !rel(f).includes('miniprogram_npm') && !rel(f).startsWith('.workbuddy/') && !rel(f).startsWith('scripts/'))
  .map((f) => read(f) || '')
  .join('\n')
if (/wl_recent_/i.test(stage3Sources)) { error('最近使用不得建立独立 wl_recent_* 数据库'); stage3Hit += 1 }

const usageSource = read(path.join(ROOT, 'services/tool-usage.js')) || ''
if (!/lastUsedAt\)\s*>\s*clearedAt/.test(usageSource) || !/recentClearedAt/.test(usageSource)) {
  error('getRecentTools 必须按 lastUsedAt > recentClearedAt 派生最近使用'); stage3Hit += 1
}
const dataMergeSource = read(path.join(ROOT, 'utils/data-merge.js')) || ''
if (!/createUsageMergePlan/.test(dataMergeSource) || !/requiresCountResolution/.test(dataMergeSource) || !/resolved:\s*false/.test(dataMergeSource) || /const\s+mergeUsage\s*=/.test(dataMergeSource)) {
  error('usage 跨设备统计必须保持待决议合并计划，Stage 3 不得简单覆盖或相加 useCount'); stage3Hit += 1
}
const favoritesSource = read(path.join(ROOT, 'services/favorites.js')) || ''
if (!/findIndex/.test(favoritesSource) || !/deletedAt:\s*now/.test(favoritesSource) || !/deletedAt:\s*null/.test(favoritesSource)) {
  error('收藏服务必须使用单记录 Tombstone 更新模型'); stage3Hit += 1
}

const toolPackage = (appJson.subPackages || []).find((item) => item.root === 'packageTools')
for (const p of (toolPackage && toolPackage.pages) || []) {
  const id = p.split('/')[1]
  const js = read(path.join(ROOT, 'packageTools', `${p}.js`)) || ''
  const wxml = read(path.join(ROOT, 'packageTools', `${p}.wxml`)) || ''
  if (!js.includes(`withToolPage('${id}'`)) { error(`${p} 未接入统一 tool-page 能力层`); stage3Hit += 1 }
  if (!wxml.includes('<favorite-action')) { error(`${p} 未接入统一 favorite-action 收藏组件`); stage3Hit += 1 }
  const usageOptionalTools = new Set(['guide', 'ruler'])
  if (!usageOptionalTools.has(id) && !/recordToolUse\s*\(/.test(js)) { error(`${p} 缺少核心操作成功后的 recordToolUse`); stage3Hit += 1 }
}

const userPackage = (appJson.subPackages || []).find((item) => item.root === 'packageUser')
const expectedUserPages = ['pages/favorites/favorites', 'pages/history/history', 'pages/recent/recent', 'pages/data-management/data-management']
const actualUserPages = (userPackage && userPackage.pages) || []
if (JSON.stringify(actualUserPages) !== JSON.stringify(expectedUserPages)) {
  error('packageUser 必须只注册 favorites/history/recent/data-management 四个功能页'); stage3Hit += 1
}

const stripJsComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
for (const jf of allJs) {
  const rp = rel(jf)
  if (rp.includes('node_modules') || rp.includes('miniprogram_npm') || rp.startsWith('scripts/') || rp.startsWith('.workbuddy/')) continue
  const c = stripJsComments(read(jf) || '')
  const isDormantModerationAdapter = rp === 'utils/image-moderation.js'
  const hasRemoteApi = /wx\.(?:login|request|downloadFile|connectSocket)\s*\(/.test(c)
    || (!isDormantModerationAdapter && /wx\.uploadFile\s*\(/.test(c))
  if (hasRemoteApi) {
    error(`${rp} Stage 3 不允许接入真实登录或远程请求`); stage3Hit += 1
  }
}

for (const wf of allWxml) {
  const rp = rel(wf)
  if (rp.includes('miniprogram_npm') || rp.includes('node_modules')) continue
  const c = read(wf) || ''
  const openViews = (c.match(/<view\b[^>]*>/g) || []).length
  const closeViews = (c.match(/<\/view>/g) || []).length
  if (openViews !== closeViews) {
    error(`${rp} view 标签数量不平衡：${openViews}/${closeViews}`); stage3Hit += 1
  }
}

console.log(stage3Hit === 0 ? 'OK  Stage 3 数据层、统一工具能力与边界规则通过' : `发现 ${stage3Hit} 处`)

// ------------------------------------------------- 14. Stage 4 防回退规则

console.log('---- [14] Stage 4 架构 / 安全 / 隐私防回退 ----')
const stage4Static = runStage4StaticChecks(ROOT)
stage4Static.errors.forEach((message) => error(message))
stage4Static.warnings.forEach((message) => warn(message))
console.log(
  stage4Static.errors.length === 0 && stage4Static.warnings.length === 0
    ? 'OK  Stage 4 搜索、Discovery、Storage、权限、远程请求与正式工具边界通过'
    : `发现 ${stage4Static.errors.length} 个 ERROR / ${stage4Static.warnings.length} 个 WARNING`,
)

// ------------------------------------------------- 汇总

console.log('')
console.log('='.repeat(60))
console.log(`合计 ERROR = ${errorCount}，WARNING = ${warnCount}`)
console.log('='.repeat(60))

if (errors.length) {
  console.log('')
  console.log('===== ERROR 明细 =====')
  errors.forEach((e, i) => console.log(`${String(i + 1).padStart(3, ' ')}. ${e}`))
}
if (warns.length) {
  console.log('')
  console.log('===== WARNING 明细 =====')
  warns.forEach((w, i) => console.log(`${String(i + 1).padStart(3, ' ')}. ${w}`))
}
if (!errors.length && !warns.length) {
  console.log('全部通过，无 error 无 warning。')
}

process.exit(errorCount > 0 ? 1 : 0)
