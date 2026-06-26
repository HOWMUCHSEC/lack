/**
 * 日期时间工具函数
 */

/**
 * 格式化日期时间为本地字符串
 */
export function formatDateTime(value?: string | number | Date): string {
  if (!value) return '-'
  const d = typeof value === 'string' || typeof value === 'number' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString()
}

/**
 * 格式化日期为 YYYY-MM-DD HH:mm 格式
 */
export function formatDateTimeFull(ms: number): string {
  if (!ms || ms <= 0) return '-'
  const dt = new Date(ms)
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

/**
 * 相对时间格式化（支持 i18n）
 */
export function toRelativeTime(
  ms: number,
  t: (key: string, options?: { count?: number }) => string,
  prefix = 'recentTasks.relative',
): string {
  if (!ms || ms <= 0) return t(`${prefix}.na`)
  const diff = Date.now() - ms
  const m = Math.floor(diff / 60000)
  if (m < 1) return t(`${prefix}.justNow`)
  if (m < 60) return t(`${prefix}.minutesAgo`, { count: m })
  const h = Math.floor(m / 60)
  if (h < 24) return t(`${prefix}.hoursAgo`, { count: h })
  const d = Math.floor(h / 24)
  if (d < 7) return t(`${prefix}.daysAgo`, { count: d })
  return formatDateTimeFull(ms)
}

/**
 * 获取今日开始时间戳
 */
export function getStartOfToday(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * 获取N天前的时间戳
 */
export function getDaysAgo(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000
}
