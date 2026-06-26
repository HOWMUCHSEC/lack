import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { COMMUNITY_VENDOR_TABLES } from './useDataStatistics'

// --- Interfaces ---

export interface CategoryCount {
  label: string
  count: number
}

export interface VendorStats {
  vendor: string
  table: string
  categoryCounts: CategoryCount[]
  loading: boolean
  error: string | null
}

export interface CommunityStatistics {
  vendors: VendorStats[]
  loading: boolean
  refresh: () => void
}

// --- Pure aggregation functions (exported for testing) ---

/**
 * 按 label_lv1 分组计数，过滤 null 和零计数条目。
 * 结果按 count 降序排列。
 */
export function aggregateCategoryCounts(labels: (string | null)[]): CategoryCount[] {
  const countMap = new Map<string, number>()

  for (const label of labels) {
    if (!label) continue // filter out null, undefined, and empty string
    countMap.set(label, (countMap.get(label) || 0) + 1)
  }

  return Array.from(countMap.entries())
    .filter(([, count]) => count > 0)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
}

// --- Async data fetching ---

/** 厂商表名到显示名称的映射 */
const VENDOR_DISPLAY_NAMES: Record<string, string> = {
  prompts_openai_combined: 'OpenAI',
  prompts_google_combined: 'Google',
  prompts_meta_combined: 'Meta',
  prompts_anthropic_combined: 'Anthropic',
  prompts_aws_combined: 'AWS',
}

/**
 * 查询单个厂商表的 stage 和 label_lv1 分布。
 * stage 使用 head:true + count:'exact' 查询（不受行数限制）。
 * label_lv1 分页获取所有值后在前端聚合。
 */
export async function fetchVendorStatistics(
  table: string,
): Promise<{ categoryCounts: CategoryCount[] }> {
  // 定义分类获取 Promise
  const fetchCategories = async () => {
    const allLabels: string[] = []
    let labelError = false
    const PAGE_SIZE = 1000
    // 只拉取最多 3000 条做分类统计采样，防止大量并发阻塞网络
    const MAX_ROWS = 3000
    let from = 0
    
    while (from < MAX_ROWS) {
      const { data, error } = await supabase
        .from(table)
        .select('label_lv1')
        .not('label_lv1', 'is', null)
        .range(from, from + PAGE_SIZE - 1)

      if (error) {
        labelError = true
        break
      }
      if (!data || data.length === 0) break

      for (const row of data) {
        if (row.label_lv1) allLabels.push(row.label_lv1 as string)
      }

      if (data.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }

    return labelError ? [] : aggregateCategoryCounts(allLabels)
  }

  // 并行执行 categories 拉取
  const [categoryCounts] = await Promise.all([
    fetchCategories().catch(() => [])
  ])

  // 为了让还没创建的表正确地直接显示空，而不抛出红字Error，我们总是直接 return
  return { categoryCounts }
}

// --- React Hook ---

/**
 * 管理五个厂商的统计数据，支持懒加载和刷新。
 * 仅在调用 refresh() 时触发查询（配合面板展开使用）。
 */
export function useCommunityStatistics(): CommunityStatistics {
  const [vendors, setVendors] = useState<VendorStats[]>(
    COMMUNITY_VENDOR_TABLES.map((table) => ({
      vendor: VENDOR_DISPLAY_NAMES[table] || table,
      table,
      categoryCounts: [],
      loading: false,
      error: null,
    })),
  )
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(() => {
    setLoading(true)

    // 将每个厂商设为 loading 状态
    setVendors((prev) =>
      prev.map((v) => ({ ...v, loading: true, error: null })),
    )

    // 并行查询每个厂商
    const promises = COMMUNITY_VENDOR_TABLES.map(async (table, index) => {
      try {
        const stats = await fetchVendorStatistics(table)
        setVendors((prev) => {
          const next = [...prev]
          next[index] = {
            ...next[index],
            categoryCounts: stats.categoryCounts,
            loading: false,
            error: null,
          }
          return next
        })
      } catch (err) {
        setVendors((prev) => {
          const next = [...prev]
          next[index] = {
            ...next[index],
            loading: false,
            error: err instanceof Error ? err.message : String(err),
          }
          return next
        })
      }
    })

    Promise.allSettled(promises).then(() => setLoading(false))
  }, [])

  return { vendors, loading, refresh }
}
