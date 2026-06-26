import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { TaskDetailsData } from './types'

export function TaskLatestRunCard({ data }: { data: TaskDetailsData }) {
  const { t } = useTranslation('task')
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('details.latestRun.title')}</CardTitle>
        <CardDescription>{'runId: '}{data.latestRun.id}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {data.latestRun.status === 'in_progress' ? (
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              ) : data.latestRun.status === 'done' ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              )}
              <span>{t('details.latestRun.status')}</span>
            </div>
            <span className="text-muted-foreground text-xs">
              {data.latestRun.status === 'in_progress'
                ? t('details.latestRun.statusInProgress')
                : data.latestRun.status === 'done'
                  ? t('details.latestRun.statusDone')
                  : t('details.latestRun.statusFailed')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>{t('details.latestRun.startTime')}</span>
            <span className="text-muted-foreground text-xs">{data.latestRun.startedAt}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>{t('details.latestRun.duration')}</span>
            <span className="text-muted-foreground text-xs">{data.latestRun.durationSec}{'s'}</span>
          </div>
          <Separator className="my-2" />
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="rounded-md bg-slate-50 p-2">
              <div className="text-muted-foreground text-xs">{t('details.latestRun.findings')}</div>
              <div className="text-lg font-semibold">{data.latestRun.findings}</div>
            </div>
            <div className="rounded-md bg-red-50 p-2">
              <div className="text-xs text-red-600">{t('details.latestRun.critical')}</div>
              <div className="text-lg font-semibold text-red-700">{data.latestRun.critical}</div>
            </div>
            <div className="rounded-md bg-amber-50 p-2">
              <div className="text-xs text-amber-600">{t('details.latestRun.high')}</div>
              <div className="text-lg font-semibold text-amber-700">{data.latestRun.high}</div>
            </div>
            <div className="rounded-md bg-emerald-50 p-2">
              <div className="text-xs text-emerald-600">{t('details.latestRun.mediumLow')}</div>
              <div className="text-lg font-semibold text-emerald-700">
                {data.latestRun.medium + data.latestRun.low}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
