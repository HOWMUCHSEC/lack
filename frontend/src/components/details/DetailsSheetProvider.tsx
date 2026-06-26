import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { DetailsSheetUI } from './DetailsSheet'

export type DetailEntityType = 'project' | 'objective' | 'testcase'

export interface DetailsActions {
  onEdit?: () => void
  onNavigate?: () => void
}

export interface DetailsPayload<T = unknown> {
  type: DetailEntityType
  data: T
  title?: string
  actions?: DetailsActions
}

interface DetailsSheetContextValue {
  isOpen: boolean
  payload: DetailsPayload | null
  openDetails: (payload: DetailsPayload) => void
  closeDetails: () => void
}

const DetailsSheetContext = createContext<DetailsSheetContextValue | undefined>(undefined)

export function DetailsSheetProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [payload, setPayload] = useState<DetailsPayload | null>(null)

  const openDetails = useCallback((nextPayload: DetailsPayload) => {
    setPayload(nextPayload)
    setIsOpen(true)
  }, [])

  const closeDetails = useCallback(() => {
    setIsOpen(false)
  }, [])

  const value = useMemo(
    () => ({ isOpen, payload, openDetails, closeDetails }),
    [isOpen, payload, openDetails, closeDetails],
  )

  return (
    <DetailsSheetContext.Provider value={value}>
      {children}
      <DetailsSheetUI open={isOpen} onOpenChange={setIsOpen} payload={payload} />
    </DetailsSheetContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- co-located hook
export function useDetailsSheet() {
  const ctx = useContext(DetailsSheetContext)
  if (!ctx) throw new Error('useDetailsSheet must be used within DetailsSheetProvider')
  return ctx
}
