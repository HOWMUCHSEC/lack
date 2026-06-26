import { Button } from '@/components/ui/button'
import { ArrowLeft, FileText, Loader2, Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { statusBadgeColor, statusLabelText, TaskDetailsData } from './types'

export function TaskTitleBar({ data, onBack }: { data: TaskDetailsData; onBack: () => void }) {
  const { t } = useTranslation('task')
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('details.titleBar.back')}
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">{data.title}</h2>
            <span
              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${statusBadgeColor(data.status)}`}
            >
              {statusLabelText(data.status)}
            </span>
          </div>
          <div className="text-muted-foreground mt-1 text-xs">
            {t('details.titleBar.meta', {
              id: data.id,
              project: data.project.name,
              target: data.target.title,
              createdAt: data.createdAt,
            })}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="default">
          <Play className="mr-2 h-4 w-4" />
          {t('details.titleBar.startRedTeam')}
        </Button>
        <Button variant="outline">
          <Loader2 className="mr-2 h-4 w-4" />
          {t('details.titleBar.rerun')}
        </Button>
        <Button variant="outline">
          <FileText className="mr-2 h-4 w-4" />
          {t('details.titleBar.exportReport')}
        </Button>
      </div>
    </div>
  )
}
