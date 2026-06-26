// 轻量级全局 Loading 事件工具，供非 React 环境（如 supabaseClient）触发

export type LoadingEventDetail = {
  id: string
  label?: string
  status?: 'success' | 'error'
  message?: string
}

const START_EVENT = 'global-loading:start'
const END_EVENT = 'global-loading:end'

let idSeq = 0

function generateId() {
  idSeq += 1
  return `loading-${Date.now()}-${idSeq}`
}

export function startGlobalLoading(label?: string): string {
  const id = generateId()
  if (typeof window !== 'undefined') {
    const event = new CustomEvent<LoadingEventDetail>(START_EVENT, {
      detail: { id, label },
    })
    window.dispatchEvent(event)
  }
  return id
}

export function endGlobalLoading(
  id: string,
  opts?: { status?: 'success' | 'error'; message?: string },
) {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent<LoadingEventDetail>(END_EVENT, {
      detail: { id, status: opts?.status, message: opts?.message },
    })
    window.dispatchEvent(event)
  }
}

export type LoadingEventsApi = {
  START_EVENT: typeof START_EVENT
  END_EVENT: typeof END_EVENT
}

export const LoadingEvents: LoadingEventsApi = {
  START_EVENT,
  END_EVENT,
}
