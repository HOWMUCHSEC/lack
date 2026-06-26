/**
 * Evaluator templates service
 * Fetches evaluation prompt templates from Supabase
 */
import { supabase } from '@/lib/supabaseClient'

export interface EvaluatorTemplate {
  id: string
  created_at: string
  updated_at: string
  evaluator_type: string
  name: string
  name_zh: string | null
  description: string | null
  description_zh: string | null
  version: string
  supported_datasets: string[]
  field_mappings: Record<string, Record<string, string>>
  target_prompt_template: string | null
  eval_prompt_template: string
  result_schema: Record<string, string>
  status: 'active' | 'deprecated'
  min_plan: 'trial' | 'pro' | 'team'
}

/**
 * Fetch all active evaluator templates from Supabase
 * Requires authenticated user due to RLS policy
 */
export async function fetchEvaluatorTemplates(): Promise<EvaluatorTemplate[]> {
  // 检查用户是否已登录
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.warn('User not authenticated, skipping evaluator templates fetch')
    return []
  }

  const { data, error } = await supabase
    .from('evaluator_templates')
    .select('*')
    .eq('status', 'active')
    .order('evaluator_type', { ascending: true })
    .order('version', { ascending: false })

  if (error) {
    console.error('Failed to fetch evaluator templates:', error)
    throw error
  }

  // Deduplicate by evaluator_type (keep first = latest version)
  const seen = new Set<string>()
  const unique: EvaluatorTemplate[] = []
  for (const t of data || []) {
    if (!seen.has(t.evaluator_type)) {
      seen.add(t.evaluator_type)
      unique.push(t)
    }
  }

  return unique
}

/**
 * Fetch a specific evaluator template by type
 */
export async function fetchEvaluatorTemplate(
  evaluatorType: string,
): Promise<EvaluatorTemplate | null> {
  const { data, error } = await supabase
    .from('evaluator_templates')
    .select('*')
    .eq('evaluator_type', evaluatorType)
    .eq('status', 'active')
    .order('version', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null
    }
    console.error('Failed to fetch evaluator template:', error)
    throw error
  }

  return data
}
