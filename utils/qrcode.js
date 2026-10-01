/**
 * 二维码生成器（纯 JS，无第三方依赖）
 *
 * 之所以自己实现：
 * 原实现依赖 TDesign `t-qrcode` 组件的内部属性 `canvasNode`，
 * 属于私有实现细节，组件库一升级就会失效。这里改为：
 *   纯算法生成矩阵 -> 业务侧在 Canvas 2D 上自行绘制
 *
 * 能力：
 * - 字节模式（Byte mode），支持中文（UTF-8）
 * - 版本 1 ~ 40 自动选择
 * - 纠错等级 L / M / Q / H
 * - 自动挑选惩罚分最低的掩码
 *
 * 输出：
 * { size, modules, version, ecc }
 * modules 为二维布尔数组，true 表示深色模块。
 */

const LEVEL_INDEX = { L: 0, M: 1, Q: 2, H: 3 }
const LEVEL_LIST = ['L', 'M', 'Q', 'H']
// 纠错等级在格式信息中的编码
const FORMAT_BITS = [1, 0, 3, 2]

const PENALTY_N1 = 3
const PENALTY_N2 = 3
const PENALTY_N3 = 40
const PENALTY_N4 = 10

// 每个版本、每个纠错等级下：每块纠错码字数
// 已与 ISO/IEC 18004 标准表逐项校验（版本 1~40 × L/M/Q/H）
const ECC_CODEWORDS_PER_BLOCK = [
  // L
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  // M
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  // Q
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  // H
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
]

// 每个版本、每个纠错等级下的分块数量
const NUM_ERROR_CORRECTION_BLOCKS = [
  // L
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  // M
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  // Q
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  // H
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
]

/** 文本转 UTF-8 字节数组 */
const toUtf8Bytes = (text) => {
  const source = String(text == null ? '' : text)
  const bytes = []

  for (let i = 0; i < source.length; i += 1) {
    let code = source.charCodeAt(i)

    if (code >= 0xd800 && code <= 0xdbff && i + 1 < source.length) {
      const low = source.charCodeAt(i + 1)

      if (low >= 0xdc00 && low <= 0xdfff) {
        code = (code - 0xd800) * 0x400 + (low - 0xdc00) + 0x10000
        i += 1
      }
    }

    if (code < 0x80) {
      bytes.push(code)
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      )
    }
  }

  return bytes
}

/** 取整数第 i 位（i=0 为最高位） */
const getBit = (value, i) => ((value >>> i) & 1) !== 0

/** GF(256) 乘法 */
const gfMultiply = (x, y) => {
  let z = 0

  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }

  return z & 0xff
}

/** 生成 RS 除数多项式系数 */
const rsComputeDivisor = (degree) => {
  const result = new Array(degree).fill(0)
  result[degree - 1] = 1
  let root = 1

  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < result.length; j += 1) {
      result[j] = gfMultiply(result[j], root)

      if (j + 1 < result.length) {
        result[j] ^= result[j + 1]
      }
    }

    root = gfMultiply(root, 2)
  }

  return result
}

/** 计算 RS 余数（纠错码字） */
const rsComputeRemainder = (data, divisor) => {
  const result = new Array(divisor.length).fill(0)

  data.forEach((value) => {
    const factor = value ^ result.shift()

    result.push(0)
    divisor.forEach((coef, i) => {
      result[i] ^= gfMultiply(coef, factor)
    })
  })

  return result
}

/** 版本可用数据位数（含全部结构开销前的原始模块数） */
const getNumRawDataModules = (version) => {
  let result = (16 * version + 128) * version + 64

  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2

    result -= (25 * numAlign - 10) * numAlign - 55

    if (version >= 7) {
      result -= 36
    }
  }

  return result
}

/** 版本可用数据码字数 */
const getNumDataCodewords = (version, eclIndex) => {
  const totalBits = getNumRawDataModules(version)
  const totalCodewords = Math.floor(totalBits / 8)
  const eccPerBlock = ECC_CODEWORDS_PER_BLOCK[eclIndex][version]
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[eclIndex][version]

  return totalCodewords - eccPerBlock * numBlocks
}

/** 对齐图案坐标 */
const getAlignmentPatternPositions = (version) => {
  if (version === 1) return []

  const numAlign = Math.floor(version / 7) + 2
  const size = version * 4 + 17
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2
  const result = [6]

  for (let pos = size - 7; result.length < numAlign; pos -= step) {
    result.splice(1, 0, pos)
  }

  return result
}

/** 根据内容长度选择最小可用版本 */
const pickVersion = (byteLength, eclIndex) => {
  for (let version = 1; version <= 40; version += 1) {
    const bitCount = 4 + (version < 10 ? 8 : 16) + byteLength * 8

    if (getNumDataCodewords(version, eclIndex) * 8 >= bitCount) {
      return version
    }
  }

  return -1
}

class BitBuffer {
  constructor() {
    this.bits = []
  }

  append(value, length) {
    for (let i = length - 1; i >= 0; i -= 1) {
      this.bits.push((value >>> i) & 1)
    }
  }

  toBytes() {
    const bytes = []

    for (let i = 0; i < this.bits.length; i += 8) {
      let byte = 0

      for (let j = 0; j < 8 && i + j < this.bits.length; j += 1) {
        byte = (byte << 1) | this.bits[i + j]
      }

      bytes.push(byte)
    }

    return bytes
  }
}

/** 组装数据码字（字节模式 + 终止符 + 补齐 Pad 码字） */
const buildCodewords = (bytes, version, eclIndex) => {
  const capacityBits = getNumDataCodewords(version, eclIndex) * 8
  const charCountBits = version < 10 ? 8 : 16
  const buffer = new BitBuffer()

  buffer.append(0b0100, 4) // 字节模式
  buffer.append(bytes.length, charCountBits)

  bytes.forEach((byte) => buffer.append(byte, 8))

  const terminateLength = Math.min(4, capacityBits - buffer.bits.length)

  buffer.append(0, terminateLength)
  buffer.append(0, (8 - (buffer.bits.length % 8)) % 8)

  const codewords = buffer.toBytes()

  // 补齐码字：0xEC / 0x11 交替
  for (let pad = 0xec; codewords.length < capacityBits / 8; pad ^= 0xec ^ 0x11) {
    codewords.push(pad)
  }

  return codewords
}

/**
 * 分块计算纠错码字并按标准顺序交织
 *
 * 交织规则（ISO/IEC 18004）：
 *   1. 先把所有块的数据码字按位置横向交织
 *   2. 再把所有块的纠错码字按位置横向交织
 *   3. 两部分首尾相接即为最终码字流
 * 短块（数据码字比长块少一个）在最后一轮数据交织时不参与。
 */
const interleaveCodewords = (codewords, version, eclIndex) => {
  const eccLen = ECC_CODEWORDS_PER_BLOCK[eclIndex][version]
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[eclIndex][version]
  const rawCodewords = Math.floor(getNumRawDataModules(version) / 8)
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks)
  const shortBlockLen = Math.floor(rawCodewords / numBlocks)
  const divisor = rsComputeDivisor(eccLen)
  // 数据码字总容量 = 总码字 - 纠错码字
  const shortDataLen = shortBlockLen - eccLen
  const maxDataLen = shortDataLen + (numShortBlocks < numBlocks ? 1 : 0)

  const dataBlocks = []
  const eccBlocks = []

  for (let i = 0, k = 0; i < numBlocks; i += 1) {
    const dataLen = shortDataLen + (i < numShortBlocks ? 0 : 1)
    const data = codewords.slice(k, k + dataLen)

    k += dataLen

    dataBlocks.push(data)
    eccBlocks.push(rsComputeRemainder(data, divisor))
  }

  const result = []

  for (let i = 0; i < maxDataLen; i += 1) {
    dataBlocks.forEach((block) => {
      if (i < block.length) {
        result.push(block[i])
      }
    })
  }

  for (let i = 0; i < eccLen; i += 1) {
    eccBlocks.forEach((block) => {
      result.push(block[i])
    })
  }

  return result
}

const drawFinderPattern = (modules, isFunction, x, y) => {
  for (let dy = -4; dy <= 4; dy += 1) {
    for (let dx = -4; dx <= 4; dx += 1) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy))
      const xx = x + dx
      const yy = y + dy

      if (xx >= 0 && xx < modules.length && yy >= 0 && yy < modules.length) {
        modules[yy][xx] = dist !== 2 && dist !== 4
        isFunction[yy][xx] = true
      }
    }
  }
}

const drawAlignmentPattern = (modules, isFunction, x, y) => {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      modules[y + dy][x + dx] = Math.max(Math.abs(dx), Math.abs(dy)) !== 1
      isFunction[y + dy][x + dx] = true
    }
  }
}

const drawFormatBits = (modules, isFunction, eclIndex, mask) => {
  const size = modules.length
  const data = (FORMAT_BITS[eclIndex] << 3) | mask
  let rem = data

  for (let i = 0; i < 10; i += 1) {
    rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
  }

  const bits = ((data << 10) | rem) ^ 0x5412

  const put = (x, y, dark) => {
    modules[y][x] = dark
    isFunction[y][x] = true
  }

  // 第一份：左上角
  for (let i = 0; i <= 5; i += 1) put(8, i, getBit(bits, i))
  put(8, 7, getBit(bits, 6))
  put(8, 8, getBit(bits, 7))
  put(7, 8, getBit(bits, 8))
  for (let i = 9; i < 15; i += 1) put(14 - i, 8, getBit(bits, i))

  // 第二份：右上与左下
  for (let i = 0; i < 8; i += 1) put(size - 1 - i, 8, getBit(bits, i))
  for (let i = 8; i < 15; i += 1) put(8, size - 15 + i, getBit(bits, i))
  put(8, size - 8, true) // 固定深色模块
}

const drawVersionBits = (modules, isFunction, version) => {
  if (version < 7) return

  const size = modules.length
  let rem = version

  for (let i = 0; i < 12; i += 1) {
    rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
  }

  const bits = (version << 12) | rem

  for (let i = 0; i < 18; i += 1) {
    const bit = getBit(bits, i)
    const a = size - 11 + (i % 3)
    const b = Math.floor(i / 3)

    modules[b][a] = bit
    isFunction[b][a] = true
    modules[a][b] = bit
    isFunction[a][b] = true
  }
}

const applyMask = (modules, isFunction, mask) => {
  const size = modules.length

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (isFunction[y][x]) continue

      let invert = false

      switch (mask) {
        case 0:
          invert = (x + y) % 2 === 0
          break
        case 1:
          invert = y % 2 === 0
          break
        case 2:
          invert = x % 3 === 0
          break
        case 3:
          invert = (x + y) % 3 === 0
          break
        case 4:
          invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0
          break
        case 5:
          invert = ((x * y) % 2) + ((x * y) % 3) === 0
          break
        case 6:
          invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0
          break
        case 7:
          invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
          break
        default:
          invert = false
      }

      if (invert) {
        modules[y][x] = !modules[y][x]
      }
    }
  }
}

/**
 * N1：连续 5 个及以上同色模块
 * 计分：N1 + (连续长度 - 5)
 */
const countRunPenalty = (getValue, size) => {
  let penalty = 0
  let runColor = getValue(0)
  let runLength = 1

  for (let i = 1; i < size; i += 1) {
    const current = getValue(i)

    if (current === runColor) {
      runLength += 1
    } else {
      if (runLength >= 5) {
        penalty += PENALTY_N1 + (runLength - 5)
      }

      runColor = current
      runLength = 1
    }
  }

  if (runLength >= 5) {
    penalty += PENALTY_N1 + (runLength - 5)
  }

  return penalty
}

/**
 * N3：形似定位图案的明暗序列 1:1:3:1:1，且一侧紧邻 4 个浅色模块
 * 换算成 11 位窗口即 10111010000 / 00001011101 两种形态
 */
const countFinderLikePenalty = (getValue, size) => {
  let penalty = 0
  let window = 0

  for (let i = 0; i < size; i += 1) {
    window = ((window << 1) & 0x7ff) | (getValue(i) ? 1 : 0)

    if (i >= 10 && (window === 0x5d0 || window === 0x05d)) {
      penalty += PENALTY_N3
    }
  }

  return penalty
}

/** 掩码惩罚分合计（数值越低越适合作为最终掩码） */
const getPenaltyScore = (modules) => {
  const size = modules.length
  let result = 0

  for (let i = 0; i < size; i += 1) {
    result += countRunPenalty((j) => modules[i][j], size)
    result += countRunPenalty((j) => modules[j][i], size)
    result += countFinderLikePenalty((j) => modules[i][j], size)
    result += countFinderLikePenalty((j) => modules[j][i], size)
  }

  // 同色 2x2 区块
  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const color = modules[y][x]

      if (color === modules[y][x + 1] && color === modules[y + 1][x] && color === modules[y + 1][x + 1]) {
        result += PENALTY_N2
      }
    }
  }

  // 深色模块占比偏离 50% 的程度，按 5% 一档计分
  let dark = 0

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (modules[y][x]) dark += 1
    }
  }

  const total = size * size
  const k = Math.abs(Math.ceil((dark * 100 / total) / 5) - 10)

  result += k * PENALTY_N4

  return result
}

/**
 * 生成二维码矩阵
 * @param {string} text 内容
 * @param {Object} [options]
 * @param {string} [options.ecc] 纠错等级 L/M/Q/H，默认 M
 * @param {number} [options.minVersion] 最小版本，默认自动
 * @param {number} [options.version] 强制指定版本（1~40），调试/对比用
 * @param {number} [options.mask] 强制指定掩码（0~7），调试/对比用
 * @returns {{size:number, modules:boolean[][], version:number, ecc:string}|null}
 */
const generate = (text, options = {}) => {
  const level = String(options.ecc || 'M').toUpperCase()
  const eclIndex = LEVEL_INDEX[level] === undefined ? 1 : LEVEL_INDEX[level]
  const bytes = toUtf8Bytes(text)

  if (!bytes.length) return null

  const autoVersion = pickVersion(bytes.length, eclIndex)

  if (autoVersion < 0) return null

  const forced = Number(options.version)
  const version = Number.isInteger(forced) && forced >= 1 && forced <= 40 ? forced : autoVersion

  const size = version * 4 + 17
  const modules = []
  const isFunction = []

  for (let i = 0; i < size; i += 1) {
    modules.push(new Array(size).fill(false))
    isFunction.push(new Array(size).fill(false))
  }

  // 定时图案
  for (let i = 0; i < size; i += 1) {
    modules[6][i] = i % 2 === 0
    isFunction[6][i] = true
    modules[i][6] = i % 2 === 0
    isFunction[i][6] = true
  }

  // 定位图案
  drawFinderPattern(modules, isFunction, 3, 3)
  drawFinderPattern(modules, isFunction, size - 4, 3)
  drawFinderPattern(modules, isFunction, 3, size - 4)

  // 对齐图案
  const alignPos = getAlignmentPatternPositions(version)

  alignPos.forEach((x, xi) => {
    alignPos.forEach((y, yi) => {
      const skipCorner = (xi === 0 && yi === 0)
        || (xi === 0 && yi === alignPos.length - 1)
        || (xi === alignPos.length - 1 && yi === 0)

      if (!skipCorner) {
        drawAlignmentPattern(modules, isFunction, x, y)
      }
    })
  })

  // 格式信息先写入占位，确定掩码后再覆盖
  drawFormatBits(modules, isFunction, eclIndex, 0)
  drawVersionBits(modules, isFunction, version)

  // 数据填充
  const dataCodewords = buildCodewords(bytes, version, eclIndex)
  const allCodewords = interleaveCodewords(dataCodewords, version, eclIndex)
  let bitIndex = 0

  // 两列一组从右往左蛇形填充；第 6 列是垂直定时图案，不承载数据，
  // 必须整体跳过（right 直接改写为 5），否则后续列对会错位：
  // 写成临时变量会导致第 4 列被扫描两次、第 0 列永远写不到数据。
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5

    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j
        const upward = ((right + 1) & 2) === 0
        const y = upward ? size - 1 - vert : vert

        if (!isFunction[y][x] && bitIndex < allCodewords.length * 8) {
          modules[y][x] = getBit(allCodewords[bitIndex >>> 3], 7 - (bitIndex & 7))
          bitIndex += 1
        }
      }
    }
  }

  // 选择惩罚分最低的掩码
  let bestMask = 0

  if (Number.isInteger(options.mask) && options.mask >= 0 && options.mask < 8) {
    // 调试/单测用：强制指定掩码，跳过自动选择
    bestMask = options.mask
  } else {
    let minPenalty = Infinity

    for (let mask = 0; mask < 8; mask += 1) {
      applyMask(modules, isFunction, mask)
      drawFormatBits(modules, isFunction, eclIndex, mask)

      const penalty = getPenaltyScore(modules)

      if (penalty < minPenalty) {
        minPenalty = penalty
        bestMask = mask
      }

      applyMask(modules, isFunction, mask) // 掩码可逆，再次应用即还原
    }
  }

  applyMask(modules, isFunction, bestMask)
  drawFormatBits(modules, isFunction, eclIndex, bestMask)

  return {
    size,
    modules,
    version,
    ecc: LEVEL_LIST[eclIndex],
    mask: bestMask,
  }
}

module.exports = {
  generate,
  toUtf8Bytes,
}
