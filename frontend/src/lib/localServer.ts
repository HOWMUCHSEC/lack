// Lightweight wrapper to call Wails-bound LocalServerService without relying on generated TS modules.
// This avoids build-time import errors before `wails generate` runs.
/* eslint-disable @typescript-eslint/no-explicit-any */

function svc(): any {
  const g: any = (globalThis as any).window || (globalThis as any)
  const mod = g?.go?.mcpserver?.Service
  if (!mod) {
    throw new Error(
      'mcpserver.Service is not available. Please run the app to generate wailsjs bindings.',
    )
  }
  return mod
}

export async function StartLocalServer(): Promise<any> {
  return svc().StartLocalServer()
}
export async function StopLocalServer(): Promise<void> {
  return svc().StopLocalServer()
}
export async function GetLocalServerStatus(): Promise<any> {
  return svc().GetLocalServerStatus()
}
export async function ListMCPReports(offset = 0, limit = 50): Promise<any[]> {
  return svc().ListMCPReports(offset, limit)
}
export async function GetMCPReport(id: string): Promise<any> {
  return svc().GetMCPReport(id)
}

export function withAuthToken(endpoint?: string, authToken?: string): string {
  if (!endpoint) return ''
  if (!authToken) return endpoint

  try {
    const url = new URL(endpoint)
    url.searchParams.set('token', authToken)
    return url.toString()
  } catch {
    const separator = endpoint.includes('?') ? '&' : '?'
    return `${endpoint}${separator}token=${encodeURIComponent(authToken)}`
  }
}

// ========== 新增：扫描会话 API ==========
export async function ListScanSessions(offset = 0, limit = 50): Promise<any[]> {
  return svc().ListScanSessions(offset, limit)
}
export async function GetScanSession(id: string): Promise<any> {
  return svc().GetScanSession(id)
}
export async function DeleteScanSession(id: string): Promise<void> {
  return svc().DeleteScanSession(id)
}
export async function ArchiveScanSession(session: any): Promise<void> {
  return svc().ArchiveScanSession(session)
}
