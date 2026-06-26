import { FC } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useTranslation } from 'react-i18next'

export type SetRow = {
  id: string
  label_lv1: string | null
  label_lv2: string | null
  prompt_text: string
  expected_output: string | null
  version: string | null
  lang: string
  min_plan: 'trial' | 'pro' | 'team'
  created_at: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: SetRow | null
}

const SetDetailsDialog: FC<Props> = ({ open, onOpenChange, row }) => {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('testcases:details.title')}</DialogTitle>
        </DialogHeader>
        {row && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('testcases:details.primaryCategory')}</Label>
              <Input value={row.label_lv1 || ''} readOnly disabled />
            </div>
            <div className="space-y-2">
              <Label>{t('testcases:details.secondaryCategory')}</Label>
              <Input value={row.label_lv2 || ''} readOnly disabled />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>{t('testcases:details.prompt')}</Label>
              <Textarea value={row.prompt_text} readOnly disabled className="min-h-[120px]" />
            </div>
            {row.expected_output && (
              <div className="space-y-2 md:col-span-2">
                <Label>{t('testcases:details.expectedOutput')}</Label>
                <Textarea value={row.expected_output} readOnly disabled className="min-h-[120px]" />
              </div>
            )}
            <div className="space-y-2">
              <Label>{t('testcases:details.lang')}</Label>
              <Input value={row.lang} readOnly disabled />
            </div>
            <div className="space-y-2">
              <Label>{t('testcases:details.version')}</Label>
              <Input value={row.version || t('testcases:table.versionDefault')} readOnly disabled />
            </div>
            <div className="space-y-2">
              <Label>{t('testcases:details.minPlan')}</Label>
              <Input value={row.min_plan} readOnly disabled />
            </div>
            <div className="space-y-2">
              <Label>{t('testcases:details.createdAt')}</Label>
              <Input value={new Date(row.created_at).toLocaleString()} readOnly disabled />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default SetDetailsDialog
