import { PageLayout } from '@/components/layout'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { RecentTasksTable } from '@/components/dashboard/recent-tasks-table'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { TaskTrendChart } from '@/components/dashboard/task-trend-chart'
import { RiskDistributionChart } from '@/components/dashboard/risk-distribution-chart'
import { useUser } from '@/hooks/use-user'
import { useTranslation } from 'react-i18next'


export default function DashboardPage() {

  const { user } = useUser()
  const { t } = useTranslation('dashboard')

  // Format current date
  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const timeGreeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <PageLayout
      breadcrumbs={[]}
      headerRight={null}
      contentClassName="flex flex-1 flex-col gap-4 p-4 overflow-x-hidden"
    >
      <div className="space-y-8 pb-8">

        {/* Welcome Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
              {timeGreeting}, {user?.name || 'User'}
            </h1>
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <span>{dateStr}</span>
              <span className="h-1 w-1 rounded-full bg-zinc-700"></span>
              <div className="flex items-center gap-1.5 text-emerald-500">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-medium">{t('systemNormal')}</span>
              </div>
            </div>
          </div>
          <QuickActions />
        </div>

        {/* Stats Row */}
        <StatsCards />

        {/* Charts Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          <TaskTrendChart />
          <RiskDistributionChart />
        </div>

        {/* Recent Activity */}
        <RecentTasksTable />
      </div>
    </PageLayout>
  )
}
