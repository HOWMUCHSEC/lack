import * as React from 'react'
import { toast } from 'sonner'

export type ToastType = 'success' | 'info' | 'warning' | 'error' | 'loading'

export type AppToastProps = {
  open: boolean
  type: ToastType
  title: string
  description?: string
  duration?: number
  id?: string | number
  actionLabel?: string
  onAction?: () => void
  onClose?: () => void
}

export function AppToast({
  open,
  type,
  title,
  description,
  duration,
  id,
  actionLabel,
  onAction,
  onClose,
}: AppToastProps) {
  React.useEffect(() => {
    if (!open) return

    const options = {
      description,
      duration,
      id,
      action: actionLabel
        ? {
            label: actionLabel,
            onClick: () => {
              onAction?.()
            },
          }
        : undefined,
    } as const

    switch (type) {
      case 'success':
        toast.success(title, options)
        break
      case 'info':
        toast.info(title, options)
        break
      case 'warning':
        toast.warning(title, options)
        break
      case 'error':
        toast.error(title, options)
        break
      case 'loading':
        toast.loading(title, options)
        break
    }

    // Reset open flag in parent after showing
    onClose?.()
  }, [open, type, title, description, duration, id, actionLabel, onAction, onClose])

  return null
}
