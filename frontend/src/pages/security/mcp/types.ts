// MCP Scan 相关类型定义

export interface ServerStatus {
  running: boolean
  endpoint?: string
  authToken?: string
  port?: number
  startedAt?: number
}

export interface ResultData {
  ruleId: string
  ruleName: string
  filePath: string
  line: number
  column: number
  matchedText: string
  context: string
  language: string
  severity: string
  description: string
  timestamp: string
}

export interface ScanSession {
  id: string
  scannerId: string
  status: string
  targets: string[]
  totalFiles: number
  scannedFiles: number
  totalMatches: number
  critical?: number
  high: number
  medium: number
  low: number
  startedAt: number
  completedAt: number
  results: ResultData[]
}

export interface ActiveScan {
  id: string
  scannerId: string
  status: 'running' | 'completed' | 'disconnected' | 'aborted'
  targets: string[]
  totalFiles: number
  scannedFiles: number
  totalMatches: number
  critical: number
  high: number
  medium: number
  low: number
  startedAt: number
  completedAt?: number
  results: ResultData[]
}

export interface SeverityCounts {
  critical: number
  high: number
  medium: number
  low: number
}

function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function countResults(results: ResultData[] | undefined): SeverityCounts {
  const counts: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const result of results || []) {
    const severity = String(result.severity || '')
      .trim()
      .toLowerCase()
    if (severity === 'critical') {
      counts.critical += 1
    } else if (severity === 'high') {
      counts.high += 1
    } else if (severity === 'medium') {
      counts.medium += 1
    } else {
      counts.low += 1
    }
  }
  return counts
}

export function getSeverityCounts(
  source:
    | Partial<Pick<ScanSession, 'critical' | 'high' | 'medium' | 'low' | 'results'>>
    | null
    | undefined,
): SeverityCounts {
  if (!source) return { critical: 0, high: 0, medium: 0, low: 0 }

  if (typeof source.critical === 'number') {
    return {
      critical: toCount(source.critical),
      high: toCount(source.high),
      medium: toCount(source.medium),
      low: toCount(source.low),
    }
  }

  if (source.results?.length) {
    return countResults(source.results)
  }

  return {
    critical: 0,
    high: toCount(source.high),
    medium: toCount(source.medium),
    low: toCount(source.low),
  }
}

export function normalizeScanSession(session: ScanSession): ScanSession {
  const counts = getSeverityCounts(session)
  return {
    ...session,
    critical: counts.critical,
    high: counts.high,
    medium: counts.medium,
    low: counts.low,
  }
}

// 工具函数
export function formatTimestamp(timestamp: number | undefined): string {
  if (!timestamp) return 'Invalid date'
  try {
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return 'Invalid date'
    return date.toLocaleString()
  } catch {
    return 'Invalid date'
  }
}

export function isValidServerStatus(obj: unknown): obj is ServerStatus {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'running' in obj &&
    typeof (obj as ServerStatus).running === 'boolean'
  )
}
