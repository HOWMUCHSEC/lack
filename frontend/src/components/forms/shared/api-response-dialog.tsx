import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useTranslation } from 'react-i18next'

export interface ApiResponseDialogState {
  open: boolean
  status?: number
  time?: number
  body?: string
}

interface ApiResponseDialogProps {
  state: ApiResponseDialogState
  onOpenChange: (open: boolean) => void
  maxWidth?: string
}

export function ApiResponseDialog({
  state,
  onOpenChange,
  maxWidth = 'sm:max-w-[800px]',
}: ApiResponseDialogProps) {
  const { t } = useTranslation()

  return (
    <AlertDialog open={state.open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={maxWidth}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('objectives:form.response.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('objectives:form.response.desc', {
              status: state.status ?? t('objectives:form.response.unknown'),
              time: state.time ?? '-',
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="bg-muted overflow-x-auto rounded-md p-3">
          <pre className="font-mono text-xs whitespace-pre-wrap md:text-sm">{state.body}</pre>
        </div>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => onOpenChange(false)}>
            {t('objectives:form.response.close')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
