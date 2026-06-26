import { useTranslation } from 'react-i18next'
import { PageLayout } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function RealTimeMonitorPage() {
  const { t } = useTranslation('nav')

  return (
    <PageLayout breadcrumbs={[{ label: t('realTimeMonitor') }]}>
      <Card>
        <CardHeader>
          <CardTitle>{t('realTimeMonitor')}</CardTitle>
          <CardDescription>{t('realTimeMonitorDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{t('realTimeMonitorWip')}</p>
        </CardContent>
      </Card>
    </PageLayout>
  )
}
