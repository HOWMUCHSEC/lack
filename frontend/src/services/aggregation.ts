import { supabase } from '@/lib/supabaseClient'

export interface ListAggregationParams {
  page?: number
  pageSize?: number
  topic?: string
  language?: string
  highValue?: boolean
  sortAsc?: boolean // order by created_at ascending if true; default false (newest first)
  minUsefulnessScore?: number // filter by usefulness_score >= this value
}

export interface AiTweetEvalItem {
  id: string
  rawId?: number
  relevanceScore?: number
  qualityScore?: number
  usefulnessScore?: number
  isHighValue: boolean
  language?: string
  topicCategory?: string
  tags: string[]
  summary?: string
  insights?: string
  recommendedActions?: string
  llmModel?: string
  llmTemperature?: number
  createdAt?: string
  tweetUrl?: string
}

// Row shape as returned by Supabase
interface DbRow {
  id: number | null
  raw_id: number | null
  relevance_score: number | string | null
  quality_score: number | string | null
  usefulness_score: number | string | null
  is_high_value: boolean | number | null
  language: string | null
  topic_category: string | null
  tags: unknown
  summary: string | null
  insights: string | null
  recommended_actions: string | null
  llm_model: string | null
  llm_temperature: number | string | null
  created_at: string | null
  tweet_url: string | null
  evaluated_at: string | null
}

function toNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = parseFloat(v)
    if (!isNaN(n)) return n
  }
  return undefined
}

function toBoolean(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') return v === '1' || v.toLowerCase() === 'true'
  return false
}

function toTags(v: unknown): string[] {
  if (Array.isArray(v)) {
    const out: string[] = []
    for (const item of v) {
      if (typeof item === 'string') out.push(item)
      else if (item && typeof item === 'object') out.push(String(item))
      else if (item != null) out.push(String(item))
    }
    return out
  }
  if (typeof v === 'string' && v.trim()) {
    try {
      const parsed = JSON.parse(v)
      return toTags(parsed)
    } catch {
      return v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    }
  }
  return []
}

function mapRow(row: DbRow): AiTweetEvalItem {
  return {
    id: String(row.id ?? ''),
    rawId: row.raw_id ?? undefined,
    relevanceScore: toNumber(row.relevance_score),
    qualityScore: toNumber(row.quality_score),
    usefulnessScore: toNumber(row.usefulness_score),
    isHighValue: toBoolean(row.is_high_value),
    language: row.language ?? undefined,
    topicCategory: row.topic_category ?? undefined,
    tags: toTags(row.tags),
    summary: row.summary ?? undefined,
    insights: row.insights ?? undefined,
    recommendedActions: row.recommended_actions ?? undefined,
    llmModel: row.llm_model ?? undefined,
    llmTemperature: toNumber(row.llm_temperature),
    createdAt: row.created_at ?? undefined,
    tweetUrl: row.tweet_url ?? undefined,
  }
}

export interface ListAggregationResult {
  items: AiTweetEvalItem[]
  page: number
  pageSize: number
  total: number
}

export async function listAiTweetEvals(
  params: ListAggregationParams = {},
): Promise<ListAggregationResult> {
  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.max(1, params.pageSize ?? 24)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let q = supabase
    .from('ai_tweets_eval')
    .select(
      [
        'id',
        'raw_id',
        'relevance_score',
        'quality_score',
        'usefulness_score',
        'is_high_value',
        'language',
        'topic_category',
        'tags',
        'summary',
        'insights',
        'recommended_actions',
        'llm_model',
        'llm_temperature',
        'created_at',
        'tweet_url',
        'evaluated_at',
      ].join(','),
      { count: 'exact' },
    )
    .order('created_at', { ascending: !!params.sortAsc })
    .range(from, to)

  if (params.topic) q = q.eq('topic_category', params.topic)
  if (params.language) q = q.eq('language', params.language)
  if (typeof params.highValue === 'boolean') q = q.eq('is_high_value', params.highValue)
  if (typeof params.minUsefulnessScore === 'number' && params.minUsefulnessScore > 0) {
    q = q.gte('usefulness_score', params.minUsefulnessScore)
  }

  const { data, error, count } = await q.returns<DbRow[]>()
  if (error) throw error
  const items = (data || []).map(mapRow)
  return { items, page, pageSize, total: count ?? items.length }
}
