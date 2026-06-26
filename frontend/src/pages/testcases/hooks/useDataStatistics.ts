import { useState, useEffect, useCallback } from 'react'
import * as DB from '../../../../wailsjs/go/main/DB'
import { supabase } from '@/lib/supabaseClient'

export interface DataStatistics {
  localCount: number | null
  communityCount: number | null
  publicCount: number | null
  refreshLocal: () => void
  refreshCommunity: () => void
  refreshPublic: () => void
}

/**
 * 查询本地数据总数。
 * 调用 DB.CountPrefix 三次，分别查询 sampleset:、hfdataset:、prompts: 前缀，求和返回。
 * 若三个前缀全部失败则抛出错误；部分失败的前缀计数视为 0。
 */
export async function fetchLocalCount(): Promise<number> {
  const prefixes = ['sampleset:', 'hfdataset:', 'prompts:']
  const results = await Promise.allSettled(prefixes.map((p) => DB.CountPrefix(p)))

  let sum = 0
  let allFailed = true
  for (const r of results) {
    if (r.status === 'fulfilled') {
      sum += r.value
      allFailed = false
    }
  }

  if (allFailed) {
    throw new Error('All CountPrefix queries failed')
  }
  return sum
}

/**
 * 需要统计的厂商表列表（排除 prompts_combined）。
 */
export const COMMUNITY_VENDOR_TABLES = [
  'prompts_openai_combined',
  'prompts_google_combined',
  'prompts_meta_combined',
  'prompts_anthropic_combined',
  'prompts_aws_combined',
] as const

/**
 * 查询社区数据总数。
 * 并行查询五个厂商表的 count 并求和。
 * 部分失败时将失败表计数视为 0；全部失败时抛出错误。
 */
export async function fetchCommunityCount(): Promise<number> {
  const results = await Promise.allSettled(
    COMMUNITY_VENDOR_TABLES.map((table) =>
      supabase.from(table).select('*', { count: 'exact', head: true })
    )
  )

  let sum = 0
  let allFailed = true
  for (const r of results) {
    if (r.status === 'fulfilled' && !r.value.error) {
      sum += r.value.count ?? 0
      allFailed = false
    }
  }

  if (allFailed) throw new Error('All vendor table count queries failed')
  return sum
}

/**
 * 查询公共数据集总行数。
 * 通过 Supabase select count from hf_rows where status='active'。
 */
export async function fetchPublicCount(): Promise<number> {
  const { count, error } = await supabase
    .from('hf_rows')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  if (error) throw error
  return count ?? 0
}

/**
 * 自定义 Hook：获取三个 Tab 的数据总数。
 * 页面加载时并行查询，每个计数独立管理状态，互不阻塞。
 */
export function useDataStatistics(): DataStatistics {
  const [localCount, setLocalCount] = useState<number | null>(null)
  const [communityCount, setCommunityCount] = useState<number | null>(null)
  const [publicCount, setPublicCount] = useState<number | null>(null)

  const refreshLocal = useCallback(() => {
    fetchLocalCount()
      .then(setLocalCount)
      .catch(() => setLocalCount(null))
  }, [])

  const refreshCommunity = useCallback(() => {
    fetchCommunityCount()
      .then(setCommunityCount)
      .catch(() => setCommunityCount(null))
  }, [])

  const refreshPublic = useCallback(() => {
    fetchPublicCount()
      .then(setPublicCount)
      .catch(() => setPublicCount(null))
  }, [])

  useEffect(() => {
    refreshLocal()
    refreshCommunity()
    refreshPublic()
  }, [refreshLocal, refreshCommunity, refreshPublic])

  return {
    localCount,
    communityCount,
    publicCount,
    refreshLocal,
    refreshCommunity,
    refreshPublic,
  }
}
