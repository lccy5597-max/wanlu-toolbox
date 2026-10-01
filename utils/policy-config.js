/**
 * 政策类数据统一配置
 *
 * 背景：
 * 利率、税率、起征点、计发月数、延迟退休规则等都属于**会随政策变化**的数据，
 * 原先散落在各个页面里，政策一变就要逐页改代码并重新发版。
 *
 * 约定：
 * 1. 所有可变政策数据集中在本文件；
 * 2. 页面只允许读取，不允许自行硬编码同类数值；
 * 3. 当前阶段不接远程配置，仅预留 remote 结构与 loadRemotePolicy() 接口，
 *    未来接入后可用服务端下发覆盖默认值。
 *
 * 维护提示：每次修改请同步更新 POLICY_META.version 与 updatedAt。
 */

const POLICY_META = {
  version: '2026.09',
  updatedAt: '2026-09-28',
  note: '数值为默认值，政策调整时需人工复核后更新',
}

/** 个人所得税（综合所得，月度累计换算） */
const incomeTax = {
  // 起征点（元/月）
  threshold: 5000,
  // 七级超额累进税率：limit 为应纳税所得额上限，rate 为税率，deduction 为速算扣除数
  brackets: [
    { limit: 3000, rate: 0.03, deduction: 0 },
    { limit: 12000, rate: 0.1, deduction: 210 },
    { limit: 25000, rate: 0.2, deduction: 1410 },
    { limit: 35000, rate: 0.25, deduction: 2660 },
    { limit: 55000, rate: 0.3, deduction: 4410 },
    { limit: 80000, rate: 0.35, deduction: 7160 },
    { limit: Infinity, rate: 0.45, deduction: 15160 },
  ],
  // 五险一金默认个人缴纳比例（%）
  socialInsuranceItems: [
    { name: '养老保险', rate: '8' },
    { name: '医疗保险', rate: '2' },
    { name: '失业保险', rate: '0.5' },
    { name: '工伤保险', rate: '0', payer: '单位缴纳' },
    { name: '生育保险', rate: '0', payer: '单位缴纳' },
  ],
  defaultSocialTotalRate: '10.5',
  // 住房公积金默认比例与快捷选项（%）
  defaultHousingFundRate: '7',
  quickHousingFundRates: ['5', '7', '12'],
}

/** 房贷 */
const mortgage = {
  defaultCommercialRate: '3.2',
  defaultFundRate: '2.6',
  quickYears: ['10', '20', '30'],
  downPaymentOptions: ['20', '30', '40', '50'],
  defaultDownPaymentRate: '30',
  minYears: 1,
  maxYears: 40,
}

/** 养老金 */
const pension = {
  // 个人账户养老金计发月数
  retireAgeOptions: [
    { age: '50', months: 195 },
    { age: '55', months: 170 },
    { age: '60', months: 139 },
    { age: '65', months: 101 },
  ],
  // 个人账户缴费比例
  personalAccountRate: 0.08,
  // 缴费指数档位
  contributionLevels: [
    { id: 'low', label: '偏低', index: 0.6, desc: '约最低档' },
    { id: 'average', label: '平均', index: 1.0, desc: '接近社平' },
    { id: 'high', label: '较高', index: 1.5, desc: '高于平均' },
  ],
  // 估算社平工资口径：快捷选项与默认值
  baseQuickOptions: ['6000', '8000', '10000', '12000'],
  defaultBase: '8000',
  // 基础养老金公式系数：(社平工资 + 指数化月均缴费工资) / 2 * 缴费年限 * 系数
  basePensionRate: 0.01,
  minContributionIndex: 0.6,
  maxContributionIndex: 3,
}

/** 退休年龄（渐进式延迟退休） */
const retirementAge = {
  workerTypes: [
    {
      id: 'male',
      label: '男职工',
      baseAgeMonths: 60 * 12,
      maxDelayMonths: 36,
      stepMonths: 4,
      finalAgeText: '63 岁',
    },
    {
      id: 'female55',
      label: '女性原 55 岁（管理/专技）',
      baseAgeMonths: 55 * 12,
      maxDelayMonths: 36,
      stepMonths: 4,
      finalAgeText: '58 岁',
    },
    {
      id: 'female50',
      label: '女性原 50 岁（普通工人）',
      baseAgeMonths: 50 * 12,
      maxDelayMonths: 60,
      stepMonths: 2,
      finalAgeText: '55 岁',
    },
  ],
  policyStartYear: 2025,
  policyStartMonthIndex: 0,
  // 弹性退休延迟上限（月）
  flexibleDelayMonths: 36,
}

/** 餐饮开店经验值（非官方政策，仅作为经营分析参考） */
const business = {
  offlineRatioDefault: 60,
  takeawayRatioDefault: 40,
  safetyBufferRatio: 1.1,
  netProfitHealthyRate: 0.15,
  netProfitWarningRate: 0.05,
  costRateRedLines: {
    material: 0.38,
    labor: 0.25,
    rent: 0.15,
  },
  grossMarginWarningRate: 0.2,
}

/**
 * 远程配置预留（阶段限制：不接远程服务器）
 * 后续若有服务端，可将 enabled 置为 true 并在 renew 时拉取覆盖。
 */
const remote = {
  enabled: false,
  url: '',
  lastSyncedAt: '',
}

const getPolicyMeta = () => ({ ...POLICY_META })

/** 预留：未来从服务端拉取最新政策数据 */
const loadRemotePolicy = () => Promise.resolve({
  incomeTax,
  mortgage,
  pension,
  retirementAge,
  business,
})

module.exports = {
  POLICY_META,
  getPolicyMeta,
  incomeTax,
  mortgage,
  pension,
  retirementAge,
  business,
  remote,
  loadRemotePolicy,
}
