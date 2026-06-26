/**
 * 变量占位符处理工具函数
 */

/**
 * 从文本中提取 {{变量名}} 占位符
 * @param content 包含占位符的文本
 * @returns 去重后的变量名数组
 */
export function extractPlaceholders(content: string): string[] {
  if (!content) return []
  const regex = /\{\{([a-zA-Z0-9_-]+)\}\}/g
  const matches = content.matchAll(regex)
  const seen = new Set<string>()
  const result: string[] = []
  for (const m of matches) {
    if (!seen.has(m[1])) {
      seen.add(m[1])
      result.push(m[1])
    }
  }
  return result
}

/**
 * 解析变量值（可能是 JSON 数组或单值）
 * @param value 变量值字符串
 * @returns 解析后的值数组
 */
export function parseVariableValues(value: string): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed.filter((v) => typeof v === 'string' && v.trim())
    }
  } catch {
    // 不是 JSON，当作单值
  }
  return value.trim() ? [value.trim()] : []
}

/**
 * 替换文本中的占位符
 * @param template 模板字符串
 * @param variables 变量映射
 * @returns 替换后的字符串
 */
export function replacePlaceholders(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{\{([a-zA-Z0-9_-]+)\}\}/g, (match, name) => {
    return variables[name] ?? match
  })
}
