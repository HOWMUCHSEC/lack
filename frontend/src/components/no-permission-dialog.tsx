import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export type NoPermissionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  message: string
  onUpgrade?: () => void
}

export function NoPermissionDialog({
  open,
  onOpenChange,
  message,
  onUpgrade,
}: NoPermissionDialogProps) {
  const { t } = useTranslation('common')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('noPermission.title')}</DialogTitle>
        </DialogHeader>
        <div className="text-muted-foreground text-sm">{message}</div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('noPermission.gotIt')}
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false)
              onUpgrade?.()
            }}
          >
            {t('noPermission.upgrade')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
