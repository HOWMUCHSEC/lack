import { useCallback, useEffect, lazy, Suspense } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageLayout } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ListChecks,
  ArrowLeftRight,
  Star,
} from 'lucide-react'
import { EventsOn } from '../../../wailsjs/runtime/runtime'
import { TaskStatsCards } from './details/TaskStatsCards'
import { TaskRunsHistoryTable } from './details/TaskRunsHistoryTable'
import { TaskRequestsList } from './details/TaskRequestsList'
// Lazy load heavy evaluation tab to reduce initial chunk size
const TaskEvaluationTab = lazy(() => import('./details/TaskEvaluationTab').then(m => ({ default: m.TaskEvaluationTab })))
import { useTaskDetailsState } from './hooks/useTaskDetailsState'
import { useThrottledCallback } from '@/hooks/use-throttled-callback'

type ScannerTaskEvent = {
  taskID?: string
  taskId?: string
}

export default function TaskDetailsPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const { task, stats, runs, steps, loading, project, target, loadData, loadSteps, stepsLoaded, addStep } = useTaskDetailsState(id)

  useEffect(() => {
    loadData()
  }, [loadData])

  // Throttled data refresh to reduce UI jank during scans
  const throttledLoadData = useThrottledCallback(loadData, 500)

  const isCurrentTaskEvent = useCallback((event: unknown) => {
    if (!id || !event || typeof event !== 'object') return false
    const taskEvent = event as ScannerTaskEvent
    return taskEvent.taskID === id || taskEvent.taskId === id
  }, [id])

  // 监听扫描事件自动刷新
  useEffect(() => {
    const handleRunEvent = (event: unknown) => {
      if (!isCurrentTaskEvent(event)) return
      loadData()
    }

    // Handle progress events: add step incrementally instead of full reload
    const handleProgress = (step: unknown) => {
      if (!isCurrentTaskEvent(step)) return
      // Add step to the list incrementally for real-time display
      if (step && typeof step === 'object') {
        addStep(step as Parameters<typeof addStep>[0])
      }
      // Throttled stats refresh
      throttledLoadData()
    }
    const off1 = EventsOn('scanner:run:finished', handleRunEvent)
    const off2 = EventsOn('scanner:run:started', handleRunEvent)
    const off3 = EventsOn('scanner:run:progress', handleProgress)
    return () => {
      off1()
      off2()
      off3()
    }
  }, [isCurrentTaskEvent, loadData, addStep, throttledLoadData])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge className="bg-blue-100 text-blue-700"><Loader2 className="mr-1 h-3 w-3 animate-spin" />{t('task:details.status.running')}</Badge>
      case 'done':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="mr-1 h-3 w-3" />{t('task:details.status.done')}</Badge>
      case 'failed':
        return <Badge className="bg-red-100 text-red-700"><XCircle className="mr-1 h-3 w-3" />{t('task:details.status.failed')}</Badge>
      default:
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />{t('task:details.status.pending')}</Badge>
    }
  }

  const activeTab = searchParams.get('tab') || 'runs'

  const handleTabChange = (val: string) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('tab', val)
    setSearchParams(newParams, { replace: true })

    // Lazy load steps only when needed
    if ((val === 'requests' || val === 'evaluation') && !stepsLoaded) {
      loadSteps()
    }
  }

  // Initial load check
  useEffect(() => {
    if ((activeTab === 'requests' || activeTab === 'evaluation') && !stepsLoaded) {
      loadSteps()
    }
  }, [activeTab, stepsLoaded, loadSteps])

  if (loading) {
    return (
      <PageLayout breadcrumbs={[{ label: t('nav:taskCenter') }, { label: t('nav:taskDetails') }]}>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </PageLayout>
    )
  }

  if (!task) {
    return (
      <PageLayout breadcrumbs={[{ label: t('nav:taskCenter') }, { label: t('nav:taskDetails') }]}>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{t('task:details.notFound')}</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/tasks')}>
              {t('task:details.backToList')}
            </Button>
          </CardContent>
        </Card>
      </PageLayout>
    )
  }

  return (
    <PageLayout breadcrumbs={[{ label: t('nav:taskCenter') }, { label: task.title }]}>
      {/* 标题栏 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/tasks')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <CardTitle className="flex items-center gap-3">
                  {task.title}
                  {getStatusBadge(task.status)}
                </CardTitle>
                <CardDescription className="mt-1">
                  {project && <span className="mr-3">{t('task:details.project')}: {project.name}</span>}
                  {target && <span>{t('task:details.target')}: {target.title}</span>}
                </CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('task:details.refresh')}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* 统计卡片 */}
      <TaskStatsCards stats={stats} />

      {/* 运行历史 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('task:details.history.title')}</CardTitle>
          <CardDescription>{t('task:details.history.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="runs">
                <span className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-blue-600" />
                  {t('task:details.tabs.runs')}
                </span>
              </TabsTrigger>
              <TabsTrigger value="requests">
                <span className="flex items-center gap-2">
                  <ArrowLeftRight className="h-4 w-4 text-green-600" />
                  {t('task:details.tabs.requests')}
                </span>
              </TabsTrigger>
              <TabsTrigger value="evaluation">
                <span className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-purple-600" />
                  {t('task:details.tabs.evaluation')}
                </span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="runs" className="mt-4">
              <TaskRunsHistoryTable runs={runs} onRetrySuccess={loadData} />
            </TabsContent>
            <TabsContent value="requests" className="mt-4">
              <TaskRequestsList
                steps={steps}
                requestField={target?.requestField}
                responseField={target?.responseField}
              />
            </TabsContent>
            <TabsContent value="evaluation" className="mt-4">
              <Suspense fallback={<div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                <TaskEvaluationTab
                  taskId={task.id}
                  steps={steps}
                  requestField={target?.requestField}
                  responseField={target?.responseField}
                />
              </Suspense>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </PageLayout>
  )
}
