import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import {
  loadObjectiveCompletion,
  type DashboardItemStatus,
  type ObjectiveCompletionSummary,
} from '@/services/dashboardData'

export function ObjectiveCompletion() {
  const { t } = useTranslation('dashboard')
  const [summary, setSummary] = useState<ObjectiveCompletionSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    loadObjectiveCompletion()
      .then((data) => {
        if (mounted) setSummary(data)
      })
      .catch(() => {
        if (mounted) setSummary(null)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  const completionRate = summary?.completionRate ?? 0
  const completedObjectives = summary?.completed ?? 0
  const totalObjectives = summary?.total ?? 0

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>{t('objectiveCompletion.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="relative h-32 w-32">
            <svg className="h-32 w-32 -rotate-90 transform">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                className="text-muted"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={`${2 * Math.PI * 56}`}
                strokeDashoffset={`${2 * Math.PI * 56 * (1 - completionRate / 100)}`}
                className="text-primary transition-all duration-500"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-bold">{completionRate}%</span>
            </div>
          </div>
          <p className="text-muted-foreground text-sm">
            {loading
              ? t('objectiveCompletion.loading')
              : t('objectiveCompletion.completed', {
                  completed: completedObjectives,
                  total: totalObjectives,
                })}
          </p>
        </div>

        {!loading && totalObjectives === 0 ? (
          <div className="text-muted-foreground py-3 text-center text-sm">
            {t('objectiveCompletion.empty')}
          </div>
        ) : (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">{t('objectiveCompletion.byStatus')}</h4>
            {(summary?.byStatus ?? []).map((stat) => (
              <div key={stat.status} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t(`objectiveCompletion.status.${stat.status}`)}
                  </span>
                  <span className="font-medium">{stat.rate}%</span>
                </div>
                <div className="bg-muted h-1.5 w-full rounded-full">
                  <div
                    className={`h-1.5 rounded-full transition-all ${getStatusBarClass(stat.status)}`}
                    style={{ width: `${stat.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function getStatusBarClass(status: DashboardItemStatus): string {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500'
    case 'paused':
      return 'bg-amber-500'
    default:
      return 'bg-primary'
  }
}
