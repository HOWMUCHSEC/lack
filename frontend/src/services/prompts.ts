import { supabase } from '@/lib/supabaseClient'

// 厂商到表名的映射
const VENDOR_TABLE_MAP: Record<string, string> = {
  Anthropic: 'prompts_anthropic_combined',
  AWS: 'prompts_aws_combined',
  Google: 'prompts_google_combined',
  Meta: 'prompts_meta_combined',
  OpenAI: 'prompts_openai_combined',
  // Microsoft 和 MLCommons 暂无独立表，使用默认表
  Microsoft: 'prompts_combined',
  MLCommons: 'prompts_combined',
}

// 默认表名
const DEFAULT_TABLE = 'prompts_combined'

// 根据厂商获取对应的表名
function getTableByVendor(vendor?: string): string {
  if (!vendor) return DEFAULT_TABLE
  return VENDOR_TABLE_MAP[vendor] || DEFAULT_TABLE
}

export interface PromptItem {
  id: number
  stage: string
  sourceId: number
  labelLv1: string | null
  labelLv2: string | null
  promptText: string
  expectedOutput: string | null
  promptHash: string
  riskLevel: number | null
  source: string | null
  version: string | null
  tag: string | null
  lang: string | null
  creator: string | null
  createdAt: string | null
  updatedAt: string | null
  mutation: string | null
  loader: string | null
  finalPrompt: string | null
  fatherHash: string | null
}

export interface ListPromptsParams {
  page: number
  pageSize: number
  labelLv1?: string
  labelLv2?: string
  lang?: string
  keyword?: string
  riskLevel?: number
  stage?: string
  mutation?: string
  loader?: string
  vendor?: string  // 厂商名称，用于选择对应的表
}

export interface ListPromptsResult {
  items: PromptItem[]
  total: number
}

/**
 * 检查当前用户是否有权限访问 prompts_combined
 */
export async function checkPromptsAccess(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_prompts_access')
    if (error) {
      console.warn('checkPromptsAccess error:', error)
      return false
    }
    return !!data
  } catch (e) {
    console.error('checkPromptsAccess exception:', e)
    return false
  }
}

/**
 * 获取 prompts_combined 表的分类列表
 */
export async function listPromptsCategories(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('prompts_combined')
      .select('label_lv1')
      .order('label_lv1', { ascending: true })

    if (error) throw error

    const uniq = Array.from(
      new Set(
        (data || [])
          .map((r: { label_lv1: string | null }) => r.label_lv1)
          .filter((v: string | null): v is string => !!v),
      ),
    )
    return uniq
  } catch (e) {
    console.error('listPromptsCategories error:', e)
    return []
  }
}

/**
 * 分页获取 prompts 表数据（根据厂商选择对应的表）
 */
export async function listPromptsCombined(
  params: ListPromptsParams,
): Promise<ListPromptsResult> {
  const { page, pageSize, labelLv1, labelLv2, lang, keyword, riskLevel, stage, vendor } = params
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // 根据厂商获取对应的表名
  const tableName = getTableByVendor(vendor)

  try {
    let query = supabase
      .from(tableName)
      .select(
        'id,stage,source_id,label_lv1,label_lv2,prompt_text,expected_output,prompt_hash,risk_level,source,version,tag,lang,creator,created_at,updated_at,mutation,loader,final_prompt,father_hash',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(from, to)

    if (stage) {
      query = query.eq('stage', stage)
    }
    if (labelLv1) {
      query = query.eq('label_lv1', labelLv1)
    }
    if (labelLv2) {
      query = query.eq('label_lv2', labelLv2)
    }
    if (lang) {
      query = query.eq('lang', lang)
    }
    if (riskLevel !== undefined) {
      query = query.eq('risk_level', riskLevel)
    }
    if (keyword?.trim()) {
      query = query.or(
        `prompt_text.ilike.%${keyword.trim()}%,expected_output.ilike.%${keyword.trim()}%`,
      )
    }

    const { data, count, error } = await query

    if (error) throw error

    const items: PromptItem[] = (data || []).map((row) => ({
      id: row.id,
      stage: row.stage,
      sourceId: row.source_id,
      labelLv1: row.label_lv1,
      labelLv2: row.label_lv2,
      promptText: row.prompt_text,
      expectedOutput: row.expected_output,
      promptHash: row.prompt_hash,
      riskLevel: row.risk_level,
      source: row.source,
      version: row.version,
      tag: row.tag,
      lang: row.lang,
      creator: row.creator,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      mutation: row.mutation,
      loader: row.loader,
      finalPrompt: row.final_prompt,
      fatherHash: row.father_hash,
    }))

    return {
      items,
      total: count || 0,
    }
  } catch (e) {
    console.error('listPromptsCombined error:', e)
    throw e
  }
}
