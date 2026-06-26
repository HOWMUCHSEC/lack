import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Shield } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { TaskDetailsData } from './types'

export function TaskCoverageCard({ data }: { data: TaskDetailsData }) {
  const { t } = useTranslation('task')
  const coverageList = [
    { key: 'jailbreak', label: t('details.coverage.jailbreak'), value: data.coverage.jailbreak, color: 'bg-blue-600' },
    {
      key: 'harmfulContent',
      label: t('details.coverage.harmfulContent'),
      value: data.coverage.harmfulContent,
      color: 'bg-red-600',
    },
    { key: 'privacy', label: t('details.coverage.privacy'), value: data.coverage.privacy, color: 'bg-emerald-600' },
    {
      key: 'promptInjection',
      label: t('details.coverage.promptInjection'),
      value: data.coverage.promptInjection,
      color: 'bg-amber-600',
    },
  ]

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>{t('details.coverage.title')}</CardTitle>
        <CardDescription>{t('details.coverage.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-muted-foreground text-sm">{data.policySummary}</div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {coverageList.map((c) => (
            <div key={c.key} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Shield className="text-muted-foreground h-4 w-4" />
                  <span>{c.label}</span>
                </div>
                <span className="text-muted-foreground text-xs">{c.value}%</span>
              </div>
              <Progress value={c.value} className="h-2" indicatorClassName={c.color} />
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {data.tags.map((t) => (
            <Badge key={t} variant="secondary" className="text-xs">
              {t}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
