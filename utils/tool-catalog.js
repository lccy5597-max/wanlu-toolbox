/**
 * 工具目录（唯一数据源）
 *
 * 首页、工具页、搜索、分类均从此处读取，禁止在页面里重复维护工具清单。
 *
 * 字段说明：
 * id          唯一标识
 * name        工具名称
 * description 工具简介
 * icon        TDesign 图标名
 * iconColor   图标颜色
 * tone        卡片色调（决定图标底色，见 styles/theme.wxss）
 * category    所属分类（见 CATEGORIES）
 * path        页面路径
 * keywords    搜索关键词
 * sort        排序权重，越小越靠前
 * isHot       是否热门
 * isNew       是否新上线
 * isVip       是否需要会员
 * isAi        是否 AI 能力
 * enabled     是否启用（false 时不进入工具页列表）
 */

const TOOL_PAGE_ROOT = '/packageTools/pages'

const CATEGORIES = [
  { id: 'all', name: '全部' },
  { id: 'image', name: '图片' },
  { id: 'text', name: '文本' },
  { id: 'calc', name: '计算' },
  { id: 'dev', name: '开发' },
  { id: 'ai', name: 'AI' },
  { id: 'pdf', name: 'PDF' },
  { id: 'other', name: '其他' },
]

const toolPath = (page) => `${TOOL_PAGE_ROOT}/${page}/${page}`

const tools = [
  // ---------------- 图片 / 视频 ----------------
  {
    id: 'image-compress',
    name: '图片压缩',
    description: '按比例压缩体积，保留清晰度',
    icon: 'file-zip',
    iconColor: '#3f7a4b',
    tone: 'green',
    category: 'image',
    path: toolPath('image-compress'),
    keywords: ['图片', '压缩', '体积', '瘦身', '证件照', '素材'],
    sort: 10,
    isHot: true,
  },
  {
    id: 'image-resize',
    name: '图片改尺寸',
    description: '一寸二寸证件照，自由裁切',
    icon: 'frame',
    iconColor: '#2d6895',
    tone: 'sky',
    category: 'image',
    path: toolPath('image-resize'),
    keywords: ['图片尺寸', '证件照', '裁切', '改尺寸', '报名照', '一寸照', '二寸照'],
    sort: 11,
    isHot: true,
  },
  {
    id: 'qrcode',
    name: '二维码生成',
    description: '文字链接转二维码，可加 logo',
    icon: 'qrcode',
    iconColor: '#2f7567',
    tone: 'mint',
    category: 'image',
    path: toolPath('qrcode'),
    keywords: ['二维码', '生成', '扫码', '链接', '美化码'],
    sort: 12,
    isHot: true,
  },
  {
    id: 'image-watermark',
    name: '图片加水印',
    description: '证件材料图批量加用途水印',
    icon: 'secured',
    iconColor: '#2f7567',
    tone: 'mint',
    category: 'image',
    path: toolPath('image-watermark'),
    keywords: ['图片水印', '加水印', '证件水印', '他用无效', '身份证水印'],
    sort: 13,
    isHot: true,
  },
  {
    id: 'long-image',
    name: '长图拼接',
    description: '多张截图合成一张长图',
    icon: 'image',
    iconColor: '#4f5fa8',
    tone: 'indigo',
    category: 'image',
    path: toolPath('long-image'),
    keywords: ['长图', '拼接', '截图', '聊天记录', '订单截图', '长截图'],
    sort: 14,
    isHot: true,
  },
  {
    id: 'nine-grid',
    name: '九宫格切图',
    description: '一键切朋友圈九宫格',
    icon: 'image',
    iconColor: '#c4622d',
    tone: 'coral',
    category: 'image',
    path: toolPath('nine-grid'),
    keywords: ['九宫格', '切图', '朋友圈', '方图', '3x3', '图片分割'],
    sort: 15,
  },
  {
    id: 'pindou',
    name: '拼豆图纸',
    description: '图片转 MARD 色号拼豆图',
    icon: 'image',
    iconColor: '#a85b52',
    tone: 'coral',
    category: 'image',
    path: toolPath('pindou'),
    keywords: ['拼豆', '图纸', '像素画', '色号', 'MARD', '手工'],
    sort: 16,
  },
  {
    id: 'video-compress',
    name: '视频压缩',
    description: '本地压缩视频，减小体积',
    icon: 'video',
    iconColor: '#5d67d8',
    tone: 'indigo',
    category: 'image',
    path: toolPath('video-compress'),
    keywords: ['视频', '压缩', '视频压缩', '体积', '相册'],
    sort: 17,
  },

  // ---------------- 计算 ----------------
  {
    id: 'converter',
    name: '单位换算',
    description: '长度面积重量快捷换算',
    icon: 'measurement',
    iconColor: '#a85b52',
    tone: 'coral',
    category: 'calc',
    path: toolPath('converter'),
    keywords: ['单位', '换算', '长度', '面积', '重量', '体积', '温度'],
    sort: 20,
    isHot: true,
  },
  {
    id: 'date-diff',
    name: '日期计算',
    description: '算间隔天数，推算前后日期',
    icon: 'calendar',
    iconColor: '#2d6895',
    tone: 'sky',
    category: 'calc',
    path: toolPath('date-diff'),
    keywords: ['日期', '间隔', '天数', '相差几天', '倒计时', '纪念日', '工作日'],
    sort: 21,
    isHot: true,
  },
  {
    id: 'mortgage',
    name: '房贷计算器',
    description: '组合贷月供与还款明细',
    icon: 'houses',
    iconColor: '#9a6a19',
    tone: 'amber',
    category: 'calc',
    path: toolPath('mortgage'),
    keywords: ['房贷', '贷款', '利率', '月供', '组合贷', '提前还款'],
    sort: 22,
    isHot: true,
  },
  {
    id: 'salary',
    name: '工资计算器',
    description: '税后到手一键估算',
    icon: 'wallet',
    iconColor: '#6655a6',
    tone: 'violet',
    category: 'calc',
    path: toolPath('salary'),
    keywords: ['工资', '薪资', '税后', '个税', '五险一金', '到手工资'],
    sort: 23,
    isHot: true,
  },
  {
    id: 'price-compare',
    name: '比价计算器',
    description: '按规格算单价，一眼看划算',
    icon: 'discount',
    iconColor: '#b66f18',
    tone: 'amber',
    category: 'calc',
    path: toolPath('price-compare'),
    keywords: ['比价', '价格', '单价', '哪个便宜', '购物', '克价', '毫升价'],
    sort: 24,
  },
  {
    id: 'compound',
    name: '复利定投',
    description: '估算长期复利增长曲线',
    icon: 'saving-pot',
    iconColor: '#3f7a4b',
    tone: 'green',
    category: 'calc',
    path: toolPath('compound'),
    keywords: ['复利', '定投', '理财', '投资', '基金', '年化'],
    sort: 25,
  },
  {
    id: 'retirement-pension',
    name: '养老金估算',
    description: '估算退休后每月养老金',
    icon: 'wallet',
    iconColor: '#3f7a4b',
    tone: 'green',
    category: 'calc',
    path: toolPath('retirement-pension'),
    keywords: ['退休', '养老金', '退休金', '养老保险', '计发月数'],
    sort: 26,
  },
  {
    id: 'retirement-age',
    name: '退休年龄',
    description: '按出生日期推算退休年月',
    icon: 'calendar',
    iconColor: '#2d6895',
    tone: 'sky',
    category: 'calc',
    path: toolPath('retirement-age'),
    keywords: ['退休年龄', '延迟退休', '法定退休', '退休时间'],
    sort: 27,
  },
  {
    id: 'shelf-life',
    name: '保质期计算',
    description: '算到期日和剩余天数',
    icon: 'calendar',
    iconColor: '#b67f2e',
    tone: 'amber',
    category: 'calc',
    path: toolPath('shelf-life'),
    keywords: ['保质期', '到期', '过期', '生产日期', '有效期'],
    sort: 28,
  },
  {
    id: 'relationship',
    name: '亲戚称呼',
    description: '姑舅姨表不再叫错',
    icon: 'usergroup',
    iconColor: '#8b5a4a',
    tone: 'coral',
    category: 'calc',
    path: toolPath('relationship'),
    keywords: ['亲戚', '称呼', '关系', '姑妈', '舅舅', '姨妈', '表哥'],
    sort: 29,
  },
  {
    id: 'bmi',
    name: 'BMI 计算',
    description: '科学评估身体健康指标',
    icon: 'heart',
    iconColor: '#2d6895',
    tone: 'sky',
    category: 'calc',
    path: toolPath('bmi'),
    keywords: ['bmi', '体重', '身高', '健康', '指数'],
    sort: 30,
  },
  {
    id: 'bmr',
    name: '基础代谢率',
    description: '了解每日基础热量消耗',
    icon: 'activity',
    iconColor: '#c4622d',
    tone: 'coral',
    category: 'calc',
    path: toolPath('bmr'),
    keywords: ['bmr', '基础代谢', '代谢率', '热量', '卡路里'],
    sort: 31,
  },
  {
    id: 'restaurant',
    name: '开店测算',
    description: '建店成本、保本与经营分析',
    icon: 'shop',
    iconColor: '#24584d',
    tone: 'deep',
    category: 'calc',
    path: toolPath('restaurant'),
    keywords: ['餐饮', '开店', '投资', '盈亏平衡', '经营分析', '保本'],
    sort: 32,
  },

  // ---------------- 其他 ----------------
  {
    id: 'ruler',
    name: '屏幕尺子',
    description: '用卡片校准后测量长度',
    icon: 'measurement',
    iconColor: '#2d7467',
    tone: 'mint',
    category: 'other',
    path: toolPath('ruler'),
    keywords: ['尺子', '测量', '长度', '厘米', '毫米', '校准'],
    sort: 40,
  },
  {
    id: 'choice-helper',
    name: '选择困难助手',
    description: '今天吃什么帮你决定',
    icon: 'app',
    iconColor: '#c4662d',
    tone: 'coral',
    category: 'other',
    path: toolPath('choice-helper'),
    keywords: ['选择困难', '随机决定', '今天吃什么', '抽签'],
    sort: 42,
  },
  {
    id: 'guide',
    name: '使用指南',
    description: '快速了解工具箱怎么用',
    icon: 'book-open',
    iconColor: '#24584d',
    tone: 'deep',
    category: 'other',
    path: toolPath('guide'),
    keywords: ['指南', '教程', '使用', '帮助', '新手'],
    sort: 44,
  },
]

// 首页第一屏固定的 7 个高频工具 + 「更多工具」入口（第 8 个由页面补位）
const QUICK_TOOL_IDS = [
  'image-compress',
  'image-resize',
  'qrcode',
  'converter',
  'date-diff',
  'image-watermark',
  'long-image',
]

const normalize = (value) => String(value == null ? '' : value).trim().toLowerCase()

const bySort = (a, b) => (a.sort || 999) - (b.sort || 999)

const decorate = (item) => ({
  isHot: false,
  isNew: false,
  isVip: false,
  isAi: false,
  enabled: true,
  ...item,
})

const TOOL_LIST = tools.map(decorate)

const TOOL_MAP = TOOL_LIST.reduce((acc, item) => {
  acc[item.id] = item
  return acc
}, {})

const getCategories = () => {
  const activeCategoryIds = new Set(
    TOOL_LIST.filter((item) => item.enabled !== false).map((item) => item.category),
  )

  return CATEGORIES
    .filter((item) => item.id === 'all' || activeCategoryIds.has(item.id))
    .map((item) => ({ ...item }))
}

const getSearchText = (item) => [
  item.name,
  item.description,
  item.category,
  ...(item.keywords || []),
].join(' ').toLowerCase()

const searchTools = (keyword) => {
  const query = normalize(keyword)

  return TOOL_LIST.filter((item) => item.enabled !== false)
    .filter((item) => !query || getSearchText(item).includes(query))
    .sort(bySort)
}

const getToolsByCategory = (categoryId, keyword) => {
  const query = normalize(keyword)

  return TOOL_LIST.filter((item) => item.enabled !== false)
    .filter((item) => !categoryId || categoryId === 'all' || item.category === categoryId)
    .filter((item) => !query || getSearchText(item).includes(query))
    .sort(bySort)
}

const getHotTools = (limit) => {
  const list = TOOL_LIST.filter((item) => item.enabled !== false && item.isHot).sort(bySort)

  return limit > 0 ? list.slice(0, limit) : list
}

const getNewTools = (limit) => {
  const list = TOOL_LIST.filter((item) => item.enabled !== false && item.isNew).sort(bySort)

  return limit > 0 ? list.slice(0, limit) : list
}

const getQuickTools = () => QUICK_TOOL_IDS
  .map((id) => TOOL_MAP[id])
  .filter((item) => item && item.enabled !== false)

const getToolById = (id) => TOOL_MAP[id] || null

const getCategoryName = (categoryId) => {
  const matched = CATEGORIES.find((item) => item.id === categoryId)

  return matched ? matched.name : '其他'
}

module.exports = {
  CATEGORIES,
  QUICK_TOOL_IDS,
  getCategories,
  getHotTools,
  getNewTools,
  getQuickTools,
  getToolById,
  getToolsByCategory,
  getCategoryName,
  searchTools,
  tools: TOOL_LIST,
}
