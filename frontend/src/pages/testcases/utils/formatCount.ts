/**
 * 将数字格式化为简洁的展示字符串。
 *
 * - count < 1000：直接返回数字字符串（如 42 → "42"）
 * - count >= 1000：返回 `{n}k` 格式，保留一位小数，去除末尾零（如 1200 → "1.2k"，2000 → "2k"）
 */
export function formatCount(count: number): string {
  if (count < 1000) {
    return count.toString()
  }
  const k = count / 1000
  const formatted = k.toFixed(1)
  // 去除末尾零：1.0 → 1, 1.2 → 1.2
  const trimmed = formatted.replace(/\.0$/, '')
  return `${trimmed}k`
}
