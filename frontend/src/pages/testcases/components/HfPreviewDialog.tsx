import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import type { HfDatasetMeta, LocalHfRow } from './types'

interface HfPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  meta: HfDatasetMeta | null
  rows: LocalHfRow[]
  loading: boolean
}

export function HfPreviewDialog({
  open,
  onOpenChange,
  meta,
  rows,
  loading,
}: HfPreviewDialogProps) {
  const { t } = useTranslation()

  const formatDatasetName = (d: HfDatasetMeta) => {
    let name = d.hfRepoId
    if (d.config) name += ` / ${d.config}`
    if (d.split) name += ` (${d.split})`
    return name
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('samples:publicDatasets.localPreviewTitle')}</DialogTitle>
          <DialogDescription>
            {meta && formatDatasetName(meta)}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center">
            {t('samples:publicDatasets.noData')}
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((row, idx) => (
              <div key={row.id} className="rounded-lg border p-4">
                <div className="text-muted-foreground mb-2 text-sm">#{idx + 1}</div>
                <pre className="bg-muted overflow-x-auto rounded p-3 text-sm whitespace-pre-wrap">
                  {JSON.stringify(row.data, null, 2)}
                </pre>
              </div>
            ))}
            {meta && meta.rowCount > 10 && (
              <div className="text-muted-foreground text-center text-sm">
                {t('samples:publicDatasets.previewHint', {
                  shown: 10,
                  total: meta.rowCount,
                })}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
