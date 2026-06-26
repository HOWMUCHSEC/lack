/**
 * 统一类型定义
 */

// ============ Target Metadata ============
export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
export type Purpose = 'target' | 'judge'

export interface TargetMetadata {
  base_url?: string | null
  request_headers?: string | null
  request_body_template?: string | null
  method?: RequestMethod
  timeout_ms?: number | null
  purpose?: Purpose
  request_field?: string | null
  response_field?: string | null
  model_name?: string | null
}

// ============ User Plan ============
export type UserPlan = 'trial' | 'pro' | 'team'

// ============ Common Form State ============
export interface FormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

// ============ Selectable List Item ============
export interface SelectableItem {
  id: string
  label: string
  description?: string
}
