import { supabase } from '@/lib/supabaseClient'

/**
 * HF 数据集摘要（按 hf_repo_id + config + split 分组）
 */
export interface HfDatasetSummary {
  hfRepoId: string
  config: string
  split: string
  count: number
}

/**
 * HF 数据行
 */
export interface HfRow {
  id: number
  hfRepoId: string
  config: string
  split: string
  sourceIndex: number | null
  data: Record<string, unknown>
  checksum: string | null
  importedAt: string
  updatedAt: string
  status: string
  extraMetadata: Record<string, unknown> | null
}

// Supabase 返回的原始行结构
interface DbRow {
  id: number
  hf_repo_id: string
  config: string | null
  split: string | null
  source_index: number | null
  data: Record<string, unknown>
  checksum: string | null
  imported_at: string
  updated_at: string
  status: string
  extra_metadata: Record<string, unknown> | null
}

interface DbSummaryAggregateRow {
  hf_repo_id: string
  config: string | null
  split: string | null
  count: number | string | null
}

function mapRow(row: DbRow): HfRow {
  return {
    id: row.id,
    hfRepoId: row.hf_repo_id,
    config: row.config ?? '',
    split: row.split ?? '',
    sourceIndex: row.source_index,
    data: row.data,
    checksum: row.checksum,
    importedAt: row.imported_at,
    updatedAt: row.updated_at,
    status: row.status,
    extraMetadata: row.extra_metadata,
  }
}

/**
 * 获取所有数据集的摘要列表（按 hf_repo_id + config + split 分组统计数量）
 * 使用 Supabase RPC 或手动分组
 */
export async function listHfDatasetSummaries(): Promise<HfDatasetSummary[]> {
  const aggregateResult = await supabase
    .from('hf_rows')
    .select('hf_repo_id, config, split, count()')
    .eq('status', 'active')
    .returns<DbSummaryAggregateRow[]>()

  if (!aggregateResult.error && aggregateResult.data) {
    return aggregateResult.data.map((row) => ({
      hfRepoId: row.hf_repo_id,
      config: row.config ?? '',
      split: row.split ?? '',
      count: Number(row.count ?? 0),
    }))
  }

  // 当前后端若未启用 PostgREST 聚合，则保留前端分组兜底，避免列表不可用。
  const { data, error } = await supabase
    .from('hf_rows')
    .select('hf_repo_id, config, split')
    .eq('status', 'active')

  if (error) throw error
  if (!data || data.length === 0) return []

  // 在前端分组统计
  const groupMap = new Map<string, { hfRepoId: string; config: string; split: string; count: number }>()

  for (const row of data) {
    const config = row.config ?? ''
    const split = row.split ?? ''
    const key = `${row.hf_repo_id}|${config}|${split}`
    const existing = groupMap.get(key)
    if (existing) {
      existing.count++
    } else {
      groupMap.set(key, {
        hfRepoId: row.hf_repo_id,
        config,
        split,
        count: 1,
      })
    }
  }

  return Array.from(groupMap.values())
}

export interface ListHfRowsResult {
  items: HfRow[]
  total: number
  page: number
  pageSize: number
}

/**
 * 分页获取某个数据集的行数据
 */
export async function listHfRowsByDataset(
  hfRepoId: string,
  config: string,
  split: string,
  page: number = 1,
  pageSize: number = 100,
): Promise<ListHfRowsResult> {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('hf_rows')
    .select('*', { count: 'exact' })
    .eq('hf_repo_id', hfRepoId)
    .eq('status', 'active')
    .order('source_index', { ascending: true })
    .range(from, to)

  // config 和 split 可能为空字符串
  if (config) {
    query = query.eq('config', config)
  } else {
    query = query.or('config.eq.,config.is.null')
  }

  if (split) {
    query = query.eq('split', split)
  } else {
    query = query.or('split.eq.,split.is.null')
  }

  const { data, error, count } = await query.returns<DbRow[]>()

  if (error) throw error

  return {
    items: (data || []).map(mapRow),
    total: count ?? 0,
    page,
    pageSize,
  }
}

/**
 * 获取某个数据集的全部行数据（用于下载）
 * 注意：数据量大时可能需要分批获取
 */
export async function fetchAllHfRowsByDataset(
  hfRepoId: string,
  config: string,
  split: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<HfRow[]> {
  const allRows: HfRow[] = []
  const pageSize = 500
  let page = 1
  let total = 0

  // 首次获取总数
  const firstResult = await listHfRowsByDataset(hfRepoId, config, split, 1, pageSize)
  total = firstResult.total
  allRows.push(...firstResult.items)
  onProgress?.(allRows.length, total)

  // 继续获取剩余页
  while (allRows.length < total) {
    page++
    const result = await listHfRowsByDataset(hfRepoId, config, split, page, pageSize)
    allRows.push(...result.items)
    onProgress?.(allRows.length, total)
  }

  return allRows
}
