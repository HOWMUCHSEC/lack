import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Copy } from 'lucide-react'
import type { Sample } from './types'

interface SampleDetailDialogProps {
  sample: Sample | null
  onClose: () => void
  onCopy: (content: string) => void
}

export function SampleDetailDialog({ sample, onClose, onCopy }: SampleDetailDialogProps) {
  const { t } = useTranslation()

  const renderVariables = (vars: Record<string, string>) => {
    const entries = Object.entries(vars)
    if (entries.length === 0) return '-'
    return entries.map(([k, v]) => `${k}=${v}`).join(', ')
  }

  return (
    <Dialog open={!!sample} onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('samples:dialog.viewTitle')}</DialogTitle>
          <DialogDescription>{t('samples:dialog.viewDesc')}</DialogDescription>
        </DialogHeader>
        {sample && (
          <div className="space-y-4">
            <div>
              <div className="text-muted-foreground mb-1 text-sm font-medium">
                {t('samples:dialog.generatedContent')}
              </div>
              <div className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap">
                {sample.generatedContent}
              </div>
            </div>
            <Separator />
            <div>
              <div className="text-muted-foreground mb-1 text-sm font-medium">
                {t('samples:dialog.originalTemplate')}
              </div>
              <div className="bg-muted/50 rounded-md p-3 text-sm whitespace-pre-wrap">
                {sample.originalContent}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">
                  {t('samples:dialog.variables')}
                  {t('common:common.colon')}
                </span>
                <span className="font-medium">
                  {renderVariables(sample.variables) || '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t('samples:dialog.category')}
                  {t('common:common.colon')}
                </span>
                <span className="font-medium">{sample.category}</span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t('samples:dialog.severity')}
                  {t('common:common.colon')}
                </span>
                <Badge variant="outline">{sample.severity}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t('samples:dialog.testCase')}
                  {t('common:common.colon')}
                </span>
                <span className="font-medium">{sample.testCaseTitle}</span>
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common:common.close')}
          </Button>
          {sample && (
            <Button onClick={() => onCopy(sample.generatedContent)}>
              <Copy className="mr-2 h-4 w-4" />
              {t('samples:actions.copy')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
