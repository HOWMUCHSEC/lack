/**
 * 版本号工具函数
 */

/**
 * 将版本字符串标准化为数字数组
 * @example normalizeVersion('v1.2.3') => [1, 2, 3]
 */
export function normalizeVersion(v: string | null | undefined): number[] {
  const s = (v || 'v1').trim()
  const stripped = s.replace(/^[vV]/, '')
  return stripped.split('.').map((n) => {
    const num = Number.parseInt(n, 10)
    return Number.isNaN(num) ? 0 : num
  })
}

/**
 * 比较两个版本号
 * @returns 负数表示 a < b，0 表示相等，正数表示 a > b
 */
export function compareVersion(a?: string | null, b?: string | null): number {
  const av = normalizeVersion(a)
  const bv = normalizeVersion(b)
  const len = Math.max(av.length, bv.length)
  for (let i = 0; i < len; i++) {
    const ai = av[i] ?? 0
    const bi = bv[i] ?? 0
    if (ai < bi) return -1
    if (ai > bi) return 1
  }
  return 0
}
