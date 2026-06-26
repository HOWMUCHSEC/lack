import { supabase } from '@/lib/supabaseClient'

// UI model used by pages
export interface PaperInsight {
  id: string
  arxivId: string
  title: string
  authors: string
  venue: string
  year: string
  tags: string[]
  link: string
  summary: string
  problem: string
  method: string
  highlights: string
  pros: string
  cons: string
  useCases: string
  canConstruct: boolean
}

export type PaperStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'interrupted'

export interface ListPapersParams {
  status?: PaperStatus
  page?: number
  pageSize?: number
}

// Shape of a row from public.papers
interface DbPaperRow {
  id: number | null
  title: string | null
  arxiv_id: string | null
  authors: string | null
  summary: string | null
  detailed_analysis: string | null
  evaluation: {
    strengths?: string[]
    weaknesses?: string[]
    score?: number
    score_explanation?: string
  } | null
  score: number | null
  tags: string[] | null
  published_date: string | null
  pdf_url: string | null
  is_jailbreak_attack: number | null
  is_text_constructable: number | null
  attack_method: string | null
  status: string | null
  construction_info: {
    example_template?: string
    [k: string]: unknown
  } | null
}

function toAuthorsString(v: unknown): string {
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string').join(', ')
  if (typeof v === 'string') return v
  if (v && typeof v === 'object') {
    try {
      const arr = Array.from(Object.values(v as Record<string, unknown>))
      return arr.filter((x) => typeof x === 'string').join(', ')
    } catch {
      return ''
    }
  }
  return ''
}

const PAPER_SELECT_FIELDS = [
  'id',
  'title',
  'arxiv_id',
  'authors',
  'summary',
  'detailed_analysis',
  'evaluation',
  'score',
  'tags',
  'published_date',
  'pdf_url',
  'is_jailbreak_attack',
  'is_text_constructable',
  'attack_method',
  'status',
  'construction_info',
].join(',')

function toPaperInsight(row: DbPaperRow): PaperInsight {
  const authors = toAuthorsString(row.authors)
  const year = row.published_date ? String(new Date(row.published_date).getFullYear()) : ''
  const venue = row.arxiv_id ? 'arXiv' : '-'
  const link = row.arxiv_id ? `https://arxiv.org/abs/${row.arxiv_id}` : row.pdf_url || ''
  const tags: string[] = Array.isArray(row.tags) ? row.tags : []
  const canConstruct = (row.is_text_constructable ?? 0) !== 0

  const evalObj = row.evaluation ?? {}
  const pros = Array.isArray(evalObj.strengths) ? evalObj.strengths.join('；') : ''
  const cons = Array.isArray(evalObj.weaknesses) ? evalObj.weaknesses.join('；') : ''
  const highlights = typeof evalObj.score_explanation === 'string' ? evalObj.score_explanation : ''

  return {
    id: String(row.id ?? ''),
    arxivId: row.arxiv_id || '',
    title: row.title || '',
    authors,
    venue,
    year,
    tags,
    link,
    summary: row.summary || '',
    problem: row.detailed_analysis || '',
    method: row.attack_method || '',
    highlights,
    pros,
    cons,
    useCases: row.construction_info?.example_template || '',
    canConstruct,
  }
}

export async function listPapers(params: ListPapersParams = {}): Promise<PaperInsight[]> {
  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.max(1, params.pageSize ?? 24)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let q = supabase
    .from('ai_research_papers')
    .select(PAPER_SELECT_FIELDS)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (params.status) {
    q = q.eq('status', params.status)
  }
  // tag filtering removed: tags is json (not jsonb) in cloud schema and UI no longer filters by tag

  const { data, error } = await q.returns<DbPaperRow[]>()
  if (error) throw error
  return (data || []).map(toPaperInsight)
}

export async function getPaperById(id: string): Promise<PaperInsight | null> {
  const idNum = Number(id)
  const { data, error } = await supabase
    .from('ai_research_papers')
    .select(PAPER_SELECT_FIELDS)
    .eq('id', isNaN(idNum) ? -1 : idNum)
    .maybeSingle()
    .returns<DbPaperRow>()

  if (error) throw error
  if (!data) return null
  return toPaperInsight(data)
}
