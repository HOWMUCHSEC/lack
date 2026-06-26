export const SUPPORTED_LANGUAGES = ['en', 'zh-CN'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const DEFAULT_NAMESPACE = 'common'
export const NAMESPACES = [
  'common',
  'nav',
  'help',
  'settings',
  'task',
  'validation',
  'auth',
  'testcases',
  'projects',
  'dashboard',
  'research',
  'objectives',
  'mcp',
  'samples',
  'security',
  'reports',
  'data',
] as const

export const STORAGE_KEY = 'lack.lang'

export function normalizeLanguage(input?: string | null): SupportedLanguage {
  const val = (input || '').toLowerCase()
  if (val.startsWith('zh')) return 'zh-CN'
  if (val.startsWith('en')) return 'en'
  return 'en'
}
