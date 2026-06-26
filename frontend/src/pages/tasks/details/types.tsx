import { AlertTriangle, Bug, EyeOff, ShieldOff } from 'lucide-react'

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'archived'

export interface TaskRun {
  id: string
  startedAt: string
  durationSec: number
  status: TaskStatus
  findings: number
  critical: number
  high: number
  medium: number
  low: number
}

export interface ApiResponseLog {
  id: string
  timestamp: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  endpoint: string
  statusCode: number
  durationMs: number
  requestPreview?: string
  responsePreview?: string
}

export interface TaskDetailsData {
  id: string
  title: string
  status: TaskStatus
  project: { id: string; name: string }
  target: { id: string; title: string }
  createdAt: string
  tags: string[]
  policySummary: string
  coverage: {
    jailbreak: number
    harmfulContent: number
    privacy: number
    promptInjection: number
  }
  latestRun: TaskRun
  runs: TaskRun[]
  riskyPrompts: Array<{
    id: string
    category: string
    prompt: string
    severity: 'critical' | 'high' | 'medium' | 'low'
  }>
  responses?: ApiResponseLog[]
}

export function statusBadgeColor(status: TaskStatus) {
  if (status === 'in_progress') return 'bg-blue-100 text-blue-700 border-blue-200'
  if (status === 'blocked') return 'bg-red-100 text-red-700 border-red-200'
  if (status === 'done') return 'bg-green-100 text-green-700 border-green-200'
  if (status === 'archived') return 'bg-slate-100 text-slate-700 border-slate-200'
  return 'bg-amber-100 text-amber-700 border-amber-200'
}

export function statusLabelText(status: TaskStatus) {
  if (status === 'todo') return '待办'
  if (status === 'in_progress') return '进行中'
  if (status === 'blocked') return '失败'
  if (status === 'done') return '已完成'
  return '已归档'
}

export function getRiskCategoryIcon(category: string) {
  const className = 'h-3.5 w-3.5'
  // 选择稳定存在的 lucide 图标，避免版本不兼容
  if (category.includes('越狱')) return <ShieldOff className={className} />
  if (category.includes('隐私')) return <EyeOff className={className} />
  if (category.toLowerCase().includes('prompt')) return <Bug className={className} />
  // 默认视为有害内容
  return <AlertTriangle className={className} />
}
