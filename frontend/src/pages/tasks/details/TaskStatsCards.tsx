import { useTranslation } from 'react-i18next'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { main } from '../../../../wailsjs/go/models'

interface TaskStatsCardsProps {
  stats: main.TaskStats | null
}

export function TaskStatsCards({ stats }: TaskStatsCardsProps) {
  const { t } = useTranslation()

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>{t('task:details.stats.totalRuns')}</CardDescription>
          <CardTitle className="text-2xl">{stats?.totalRuns || 0}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>{t('task:details.stats.totalSamples')}</CardDescription>
          <CardTitle className="text-2xl">{stats?.totalSamples || 0}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>{t('task:details.stats.success')}</CardDescription>
          <CardTitle className="text-2xl text-green-600">{stats?.totalOk || 0}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>{t('task:details.stats.failed')}</CardDescription>
          <CardTitle className="text-2xl text-red-600">{stats?.totalFailed || 0}</CardTitle>
        </CardHeader>
      </Card>
    </div>
  )
}
