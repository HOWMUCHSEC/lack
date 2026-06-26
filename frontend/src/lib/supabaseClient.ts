import { createClient } from '@supabase/supabase-js'
import { startGlobalLoading, endGlobalLoading } from './globalLoadingEvents'

// 聚合所有 Supabase 请求为一次全局 Loading，避免频繁开关造成多次弹出
let activeRequests = 0
let globalLoadingId: string | null = null
let endTimer: ReturnType<typeof setTimeout> | null = null
let batchHasError = false
const GRACE_MS = 300

const SB_DEBUG = import.meta.env.DEV
const DEFAULT_SUPABASE_URL = 'http://127.0.0.1:54321'
const DEFAULT_SUPABASE_ANON_KEY = 'local-dev-anon-key'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? DEFAULT_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? DEFAULT_SUPABASE_ANON_KEY
const LOCAL_ONLY_ROUTES = ['/security/ai-infrastructure']

// Prefer VITE_SUPABASE_* so builds target the intended backend; defaults stay local-only.

function maskSecret(value: string | undefined): string {
  if (!value) return '[empty]'
  if (value.length <= 6) return '[redacted]'
  return `${value.slice(0, 3)}...${value.slice(-2)}`
}

if (SB_DEBUG) {
  console.warn('[supabase] 初始化配置', {
    url: SUPABASE_URL,
    anonKey: maskSecret(SUPABASE_ANON_KEY),
    source: {
      url: import.meta.env.VITE_SUPABASE_URL ? 'env' : 'fallback',
      anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'env' : 'fallback',
    },
  })
}

// 包装 fetch，打印请求/响应的基本信息（不读取响应体，避免影响流）
function isRequest(v: unknown): v is Request {
  return typeof Request !== 'undefined' && v instanceof Request
}

function isURL(v: unknown): v is URL {
  return typeof URL !== 'undefined' && v instanceof URL
}

function extractUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (isURL(input)) return input.toString()
  if (isRequest(input)) return input.url
  return String(input)
}

function extractMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method
  if (isRequest(input)) return input.method
  return 'GET'
}

function currentHashRoute(): string {
  if (typeof window === 'undefined') return ''
  const hash = window.location.hash.replace(/^#/, '')
  return hash.split('?')[0] || '/'
}

function isLocalOnlyRoute(): boolean {
  const route = currentHashRoute()
  return LOCAL_ONLY_ROUTES.some((prefix) => route === prefix || route.startsWith(`${prefix}/`))
}

function shouldTrackCloudLoading(url: string): boolean {
  if (/\/auth\/v1\//.test(url)) return false
  if (/\/rest\/v1\/rpc\//.test(url)) return false
  if (isLocalOnlyRoute()) return false
  return true
}

const loggingFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = extractUrl(input)
  const method = extractMethod(input, init)

  // Auth/RPC calls are background checks in this app. They should not create
  // a user-facing "cloud data" toast, especially on local-only scan pages.
  const trackCloudLoading = shouldTrackCloudLoading(url)
  if (trackCloudLoading) {
    if (endTimer) {
      clearTimeout(endTimer)
      endTimer = null
    }
    if (activeRequests === 0) {
      if (!globalLoadingId) {
        globalLoadingId = startGlobalLoading('正在加载云端数据…')
        batchHasError = false
      }
    }
    activeRequests += 1
  }
  try {
    if (SB_DEBUG) {
      console.debug('[supabase][request]', method, url)
      if (init?.headers) {
        const headers = new Headers(init.headers)
        const apikey = headers.get('apikey')
        const authorization = headers.get('authorization')
        if (apikey) headers.set('apikey', maskSecret(apikey))
        if (authorization) headers.set('authorization', '[redacted]')
        console.debug('[supabase][request headers]', Object.fromEntries(headers.entries()))
      }
    }
    const res = await globalThis.fetch(input as RequestInfo, init)
    if (SB_DEBUG) {
      console.debug('[supabase][response]', method, res.url, res.status, res.ok ? 'OK' : 'ERR')
    }
    if (trackCloudLoading && !res.ok) {
      batchHasError = true
    }
    return res
  } catch (err) {
    console.error('[supabase][fetch error]', err)
    if (trackCloudLoading) {
      batchHasError = true
    }
    throw err
  } finally {
    if (trackCloudLoading) {
      activeRequests = Math.max(0, activeRequests - 1)
      if (activeRequests === 0 && globalLoadingId) {
        const id = globalLoadingId
        endTimer = setTimeout(() => {
          endGlobalLoading(id, {
            status: batchHasError ? 'error' : undefined,
            message: batchHasError ? '云端数据加载失败' : undefined,
          })
          globalLoadingId = null
        }, GRACE_MS)
      }
    }
  }
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'lack-auth-token',
  },
  global: {
    fetch: SB_DEBUG ? loggingFetch : fetch,
  },
})

// 可选：调试鉴权状态变化
if (SB_DEBUG && typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event, session) => {
    console.debug('[supabase][auth]', event, {
      user: session?.user?.id ?? null,
      expires_at: session?.expires_at ?? null,
    })
  })
  console.debug('[supabase] 已初始化', {
    url: SUPABASE_URL,
    anonKey: maskSecret(SUPABASE_ANON_KEY),
    debug: SB_DEBUG,
  })
}
