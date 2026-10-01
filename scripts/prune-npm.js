/**
 * miniprogram_npm 裁剪脚本（构建 npm 之后执行）
 *
 * 背景：
 *   「工具 → 构建 npm」会把 tdesign-miniprogram 全量组件复制进
 *   miniprogram_npm/，体积约 3.7MB，导致主包超出微信 2MB 上限。
 *   本项目实际只使用少量 TDesign 组件（见 SEED_COMPONENTS），
 *   因此按「依赖闭包」裁剪：保留种子组件 + 其递归依赖 + common/，
 *   删除其余全部组件目录。
 *
 * 用法（每次在微信开发者工具里重新「构建 npm」后都要再跑一次）：
 *   node scripts/prune-npm.js            # 裁剪
 *   node scripts/prune-npm.js --dry      # 只预览，不删除
 *
 * 安全性：
 *   - 闭包通过组件 json 的 usingComponents 与 js 的 require 双路解析
 *   - common/（共享样式/behaviors）整体保留，避免漏删运行时依赖
 *   - 脚本本身通过 project.config.json packOptions.ignore 排除上传
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const TDESIGN_ROOT = path.join(ROOT, 'miniprogram_npm', 'tdesign-miniprogram')
const DRY = process.argv.includes('--dry')

// 项目实际使用的 TDesign 组件（与各页面 json 的 usingComponents 保持同步）
const SEED_COMPONENTS = ['button', 'icon', 'search']

// 整体保留的共享目录（组件运行时的 behaviors / 样式 / 工具函数）
// 注意：miniprogram_npm/ 是上游 dist 内嵌的第三方依赖（如 tslib），
// 组件源码通过裸模块名 `from "tslib"` 引用，删除会导致运行时报错。
const ALWAYS_KEEP = ['common', 'miniprogram_npm']

const existsDir = (p) => fs.existsSync(p) && fs.statSync(p).isDirectory()

const scanRefs = (componentDir, componentName) => {
  const refs = new Set()
  const addRef = (ref) => {
    if (!ref) return
    // 组件引用：../icon/icon 形式 -> icon 目录
    const m = ref.match(/^\.\.\/([a-zA-Z0-9_-]+)\/\1$/)
    if (m) {
      refs.add(m[1])
      return
    }
    // 其余相对引用（../common/*、./props 等）由 ALWAYS_KEEP 或同目录文件覆盖；
    // 裸模块引用（如 tslib）由上游内嵌 miniprogram_npm/ 覆盖。
  }

  const scanImportSpecifiers = (src) => {
    // 构建产物为 ES Module 形态：import x from "../icon/icon"
    const re = /(?:from\s*|import\s*)["']([^"']+)["']/g
    let m
    while ((m = re.exec(src))) addRef(m[1])
  }

  const jsonPath = path.join(componentDir, `${componentName}.json`)
  if (fs.existsSync(jsonPath)) {
    try {
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
      for (const ref of Object.values(json.usingComponents || {})) addRef(ref)
    } catch (error) {
      console.warn(`[prune-npm] 解析失败(忽略): ${jsonPath}`, error.message)
    }
  }

  const jsPath = path.join(componentDir, `${componentName}.js`)
  if (fs.existsSync(jsPath)) {
    const src = fs.readFileSync(jsPath, 'utf8')
    scanImportSpecifiers(src)
    const re = /require\(\s*["']([^"']+)["']\s*\)/g
    let m
    while ((m = re.exec(src))) addRef(m[1])
  }
  return refs
}

const computeClosure = () => {
  const keep = new Set([...SEED_COMPONENTS, ...ALWAYS_KEEP])
  const queue = [...SEED_COMPONENTS]
  while (queue.length) {
    const name = queue.shift()
    const dir = path.join(TDESIGN_ROOT, name)
    if (!existsDir(dir)) {
      console.error(`[prune-npm] ✗ 依赖目录不存在: ${name}（组件被上游移除或改名？）`)
      process.exitCode = 1
      continue
    }
    for (const ref of scanRefs(dir, name)) {
      if (!keep.has(ref) && existsDir(path.join(TDESIGN_ROOT, ref))) {
        keep.add(ref)
        queue.push(ref)
      }
    }
  }
  return keep
}

const dirSize = (p) => {
  let total = 0
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    const full = path.join(p, e.name)
    total += e.isDirectory() ? dirSize(full) : fs.statSync(full).size
  }
  return total
}

const main = () => {
  if (!existsDir(TDESIGN_ROOT)) {
    console.error('[prune-npm] 未找到 miniprogram_npm/tdesign-miniprogram，请先在开发者工具执行「构建 npm」')
    process.exit(1)
  }

  const keep = computeClosure()
  const all = fs.readdirSync(TDESIGN_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !ALWAYS_KEEP.includes(e.name))
    .map((e) => e.name)

  const remove = all.filter((n) => !keep.has(n))
  let removedBytes = 0
  const totalBefore = dirSize(TDESIGN_ROOT)

  console.log(`[prune-npm] 保留组件: ${[...keep].sort().join(', ')}`)
  for (const name of remove) {
    const size = dirSize(path.join(TDESIGN_ROOT, name))
    removedBytes += size
    if (DRY) {
      console.log(`[prune-npm] (dry) 将删除 ${name}/ (${(size / 1024).toFixed(0)}KB)`)
    } else {
      fs.rmSync(path.join(TDESIGN_ROOT, name), { recursive: true, force: true })
      console.log(`[prune-npm] 已删除 ${name}/ (${(size / 1024).toFixed(0)}KB)`)
    }
  }

  const totalAfter = DRY ? totalBefore - removedBytes : dirSize(TDESIGN_ROOT)
  console.log(
    `[prune-npm] 完成：${DRY ? '预览' : '裁剪'} ${(removedBytes / 1024).toFixed(0)}KB，` +
    `tdesign 目录 ${(totalBefore / 1024).toFixed(0)}KB -> ${(totalAfter / 1024).toFixed(0)}KB`,
  )
}

main()
