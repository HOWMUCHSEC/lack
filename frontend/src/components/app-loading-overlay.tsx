import React from 'react'
import { LoadingEvents, LoadingEventDetail } from '@/lib/globalLoadingEvents'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

type LoadingItem = {
  id: string
  label?: string
}

type GlobalLoadingContextValue = {
  start: (label?: string) => string
  end: (id: string, opts?: { success?: boolean; message?: string }) => void
  track: <T>(
    promise: Promise<T>,
    label?: string,
    messages?: { success?: string; error?: string },
  ) => Promise<T>
  isLoading: boolean
}

const GlobalLoadingContext = React.createContext<GlobalLoadingContextValue | null>(null)

// eslint-disable-next-line react-refresh/only-export-components -- co-located hook
export function useGlobalLoading(): GlobalLoadingContextValue {
  const ctx = React.useContext(GlobalLoadingContext)
  if (!ctx) throw new Error('useGlobalLoading must be used within GlobalLoadingProvider')
  return ctx
}

export function GlobalLoadingProvider({ children }: { children: React.ReactNode }) {
  const [activeIds, setActiveIds] = React.useState<Set<string>>(new Set())
  const isLoading = activeIds.size > 0
  const { t } = useTranslation()

  React.useEffect(() => {
    function onStart(e: Event) {
      const ce = e as CustomEvent<LoadingItem>
      const { id, label } = ce.detail || { id: 'unknown' }
      setActiveIds((prev) => {
        const next = new Set(prev)
        next.add(id)
        return next
      })
      // 使用 sonner 展示加载中（同 id 避免重复 toast）
      toast.loading(label || t('common:toasts.loadingCloudData'), { id })
    }
    function onEnd(e: Event) {
      const ce = e as CustomEvent<LoadingEventDetail>
      const { id, status, message } = ce.detail || { id: 'unknown' }
      setActiveIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      if (status === 'success') {
        toast.success(message || t('common:toasts.success'), { id })
      } else if (status === 'error') {
        toast.error(message || t('common:toasts.error'), { id })
      } else {
        toast.dismiss(id)
      }
    }

    window.addEventListener(LoadingEvents.START_EVENT, onStart as EventListener)
    window.addEventListener(LoadingEvents.END_EVENT, onEnd as EventListener)
    return () => {
      window.removeEventListener(LoadingEvents.START_EVENT, onStart as EventListener)
      window.removeEventListener(LoadingEvents.END_EVENT, onEnd as EventListener)
    }
  }, [t])

  const start = React.useCallback(
    (label?: string) => {
      const id = `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`
      setActiveIds((prev) => new Set(prev).add(id))
      toast.loading(label || t('common:toasts.processing'), { id })
      return id
    },
    [t],
  )

  const end = React.useCallback(
    (id: string, opts?: { success?: boolean; message?: string }) => {
      setActiveIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      if (opts?.success === true) {
        toast.success(opts?.message || t('common:toasts.success'), { id })
      } else if (opts?.success === false) {
        toast.error(opts?.message || t('common:toasts.error'), { id })
      } else {
        toast.dismiss(id)
      }
    },
    [t],
  )

  const track = React.useCallback(
    async <T,>(
      promise: Promise<T>,
      label?: string,
      messages?: { success?: string; error?: string },
    ) => {
      const id = start(label)
      try {
        const result = await promise
        toast.success(messages?.success || t('common:toasts.success'), { id })
        return result
      } catch (e) {
        toast.error(messages?.error || t('common:toasts.error'), { id })
        throw e
      } finally {
        setActiveIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    },
    [start, t],
  )

  const value: GlobalLoadingContextValue = React.useMemo(
    () => ({ start, end, track, isLoading }),
    [start, end, track, isLoading],
  )

  return <GlobalLoadingContext.Provider value={value}>{children}</GlobalLoadingContext.Provider>
}
