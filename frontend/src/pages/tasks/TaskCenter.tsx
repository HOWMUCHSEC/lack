import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { EventsOn } from '../../../wailsjs/runtime/runtime'
import { useNavigate } from 'react-router-dom'
import { PageLayout } from '@/components/layout'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  CheckSquareIcon,
  ListDashesIcon,
  PlusIcon,
  PlayIcon,
  TrashIcon,
  CalendarBlankIcon,
  TargetIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  CircleIcon,
  SpinnerIcon,
  WarningCircleIcon,
  EyeIcon,
  SparkleIcon,
  HashIcon
} from '@phosphor-icons/react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { TaskFormDialog } from '@/components/forms/task-form-dialog'
import { toast } from 'sonner'
import * as LocalData from '@/services/localData'
import * as ScannerService from '../../../wailsjs/go/main/ScannerService'
import * as SampleService from '../../../wailsjs/go/main/SampleService'
import { scanner } from '../../../wailsjs/go/models'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface TaskItem extends LocalData.Task {
  projectName?: string
  targetName?: string
}

export default function TaskCenterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingTaskId, setDeletingTaskId] = useState<string | undefined>()
  const [startConfirmOpen, setStartConfirmOpen] = useState(false)
  const [startingTaskId, setStartingTaskId] = useState<string | undefined>()
  const [starting, setStarting] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true)

      // 从本地数据库加载任务
      const tasksData = await LocalData.listTasks()

      // 查询关联的项目和目标信息
      if (tasksData && tasksData.length > 0) {
        // 从本地数据库加载 projects 和 targets
        const [allProjects, allTargets] = await Promise.all([
          LocalData.listProjects(),
          LocalData.listTargets(),
        ])
        const projectsMap = new Map(allProjects.map((p) => [p.id, p.name]))
        const targetsMap = new Map(allTargets.map((t) => [t.id, t.target_title]))

        // 合并数据
        const tasksWithRelations: TaskItem[] = tasksData.map((task) => ({
          ...task,
          projectName: task.project_id ? projectsMap.get(task.project_id) : undefined,
          targetName: task.goal_id ? targetsMap.get(task.goal_id) : undefined,
        }))

        // Sort by created_at desc
        tasksWithRelations.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

        setTasks(tasksWithRelations)
      } else {
        setTasks([])
      }
    } catch {
      console.error(t('task:center.toasts.loadFailed'))
      toast.error(t('task:center.toasts.loadFailed'))
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [t])

  // 使用 ref 存储最新的 loadTasks 引用，避免事件监听器中的 stale closure
  const loadTasksRef = useRef(loadTasks)
  loadTasksRef.current = loadTasks

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  // 监听扫描事件自动刷新任务列表
  const handleScannerEvent = useCallback(() => {
    loadTasksRef.current()
  }, [])

  useEffect(() => {
    const off1 = EventsOn('scanner:run:started', handleScannerEvent)
    const off2 = EventsOn('scanner:run:finished', handleScannerEvent)
    return () => {
      off1()
      off2()
    }
  }, [handleScannerEvent])

  const handleDeleteConfirm = async () => {
    if (!deletingTaskId) return

    try {
      // 1. 软删除任务
      const deleted = await LocalData.deleteTask(deletingTaskId)
      if (!deleted) throw new Error('Task not found')

      // 2. 清理本地配置（scan:cfg 和 task:datasets）
      try {
        await SampleService.DeleteTaskConfig(deletingTaskId)
      } catch (e) {
        console.warn('Failed to clean up local task config:', e)
      }

      toast.success(t('task:center.toasts.deleted'))
      loadTasks()
    } catch {
      console.error(t('task:center.toasts.deleteFailed'))
      toast.error(t('task:center.toasts.deleteFailed'))
    } finally {
      setDeleteDialogOpen(false)
      setDeletingTaskId(undefined)
    }
  }

  const handleStartConfirm = async () => {
    if (!startingTaskId) return
    setStarting(true)
    try {
      // 1. 加载任务配置中选中的样本
      const loadedSamples = await SampleService.LoadSamplesForTask(startingTaskId)
      if (!loadedSamples || loadedSamples.length === 0) {
        toast.error(t('task:center.toasts.noSamples'))
        setStarting(false)
        return
      }

      // 2. 获取目标配置（从任务关联的 target 中读取）
      const task = tasks.find((t) => t.id === startingTaskId)
      let req: scanner.RequestSpec = {
        baseURL: '',
        method: 'POST',
        headersJSON: '{}',
        bodyJSON: '{}',
        requestField: '',
        responseField: '',
      }
      if (task?.goal_id) {
        const target = await LocalData.getTarget(task.goal_id)
        if (target?.metadata) {
          req = {
            baseURL: target.metadata.base_url || '',
            method: target.metadata.method || 'POST',
            headersJSON: target.metadata.request_headers || '{}',
            bodyJSON: target.metadata.request_body_template || '{}',
            requestField: target.metadata.request_field || '',
            responseField: target.metadata.response_field || '',
          }
        }
      }

      const variables: Record<string, string> = {}
      const runID = await ScannerService.StartScanForTask(startingTaskId, req, loadedSamples, variables)
      toast.success(t('task:center.toasts.scanStarted', { id: runID }))
      setStartConfirmOpen(false)
      // 跳转到任务详情页
      navigate(`/tasks/${startingTaskId}`)
      setStartingTaskId(undefined)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(t('task:center.toasts.scanFailed', { msg }))
    } finally {
      setStarting(false)
    }
  }

  const handleDeleteClick = (taskId: string) => {
    setDeletingTaskId(taskId)
    setDeleteDialogOpen(true)
  }

  const handleStartClick = (taskId: string) => {
    setStartingTaskId(taskId)
    setStartConfirmOpen(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'todo': return "bg-slate-500/10 text-slate-400 border-slate-500/20"
      case 'in_progress':
      case 'running': return "bg-sky-500/10 text-sky-400 border-sky-500/20"
      case 'done': return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      case 'failed':
      case 'blocked': return "bg-rose-500/10 text-rose-400 border-rose-500/20"
      default: return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'todo': return <CircleIcon className="h-3.5 w-3.5" weight="duotone" />
      case 'in_progress':
      case 'running': return <SpinnerIcon className="h-3.5 w-3.5 animate-spin" weight="duotone" />
      case 'done': return <CheckCircleIcon className="h-3.5 w-3.5" weight="fill" />
      case 'failed':
      case 'blocked': return <WarningCircleIcon className="h-3.5 w-3.5" weight="fill" />
      default: return <CircleIcon className="h-3.5 w-3.5" />
    }
  }

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      // Status Filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'in_progress' && (t.status === 'in_progress' || t.status === 'running')) {
          // keep
        } else if (statusFilter === 'done' && (t.status === 'done' || t.status === 'failed' || t.status === 'blocked')) {
          // keep
        } else if (t.status !== statusFilter && statusFilter !== 'in_progress' && statusFilter !== 'done') {
          return false
        }
      }

      // Search Filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          t.title.toLowerCase().includes(q) ||
          t.projectName?.toLowerCase().includes(q) ||
          t.targetName?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [tasks, statusFilter, searchQuery])

  // Counts for tabs
  const counts = useMemo(() => {
    return {
      all: tasks.length,
      todo: tasks.filter(t => t.status === 'todo').length,
      in_progress: tasks.filter(t => t.status === 'in_progress' || t.status === 'running').length,
      done: tasks.filter(t => t.status === 'done' || t.status === 'failed' || t.status === 'blocked').length
    }
  }, [tasks])

  return (
    <PageLayout breadcrumbs={[{ label: t('nav:modelEvaluation') }, { label: t('nav:taskList') }]}>
      {/* Header */}
      <div className="mb-8 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-500 shadow-[0_0_15px_-3px_rgba(139,92,246,0.3)]">
            <CheckSquareIcon className="h-6 w-6" weight="duotone" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-white">{t('task:center.pageTitle')}</h1>
            <p className="text-sm font-medium text-zinc-400">{t('task:center.pageDesc')}</p>
          </div>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-900/20"
        >
          <PlusIcon className="mr-2 h-4 w-4" />
          {t('task:center.actions.newTask')}
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <Tabs defaultValue="all" value={statusFilter} onValueChange={setStatusFilter} className="w-full md:w-auto">
          <TabsList className="bg-zinc-900/50 border border-zinc-800/50 p-1">
            <TabsTrigger value="all" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-400 text-xs px-3 py-1.5 h-auto">
              <ListDashesIcon className="mr-2 h-4 w-4" />
              {t('task:center.tabs.all')} <Badge variant="secondary" className="ml-2 bg-zinc-800 text-zinc-400 h-4 px-1 text-[9px]">{counts.all}</Badge>
            </TabsTrigger>
            <TabsTrigger value="todo" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-400 text-xs px-3 py-1.5 h-auto">
              <CircleIcon className="mr-2 h-4 w-4" />
              {t('task:center.tabs.todo')} <Badge variant="secondary" className="ml-2 bg-zinc-800 text-zinc-400 h-4 px-1 text-[9px]">{counts.todo}</Badge>
            </TabsTrigger>
            <TabsTrigger value="in_progress" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-400 text-xs px-3 py-1.5 h-auto">
              <SpinnerIcon className="mr-2 h-4 w-4 animate-spin text-sky-500" weight="bold" />
              {t('task:center.tabs.in_progress')} <Badge variant="secondary" className="ml-2 bg-zinc-800 text-zinc-400 h-4 px-1 text-[9px]">{counts.in_progress}</Badge>
            </TabsTrigger>
            <TabsTrigger value="done" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-400 text-xs px-3 py-1.5 h-auto">
              <CheckCircleIcon className="mr-2 h-4 w-4 text-emerald-500" weight="fill" />
              {t('task:center.tabs.done')} <Badge variant="secondary" className="ml-2 bg-zinc-800 text-zinc-400 h-4 px-1 text-[9px]">{counts.done}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full md:w-64">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-zinc-900/40 border-zinc-800 focus-visible:ring-violet-500/30"
          />
        </div>
      </div>

      {/* Task Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 rounded-xl bg-zinc-900/20 border border-zinc-800/50 animate-pulse" />
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 py-16 text-center">
          <CheckSquareIcon className="mx-auto mb-4 h-12 w-12 text-zinc-600 opacity-50" />
          <h3 className="text-lg font-medium text-zinc-300">{t('task:center.table.empty')}</h3>
          <p className="text-sm text-zinc-500 mt-2 max-w-xs mx-auto text-center">{t('task:center.emptyState.description')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="group relative flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 transition-all hover:bg-zinc-900 hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-500/5 hover:-translate-y-1"
            >
              <div className="p-4 pb-2 space-y-3">
                {/* Top Row: Title & Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <h3
                      className="font-semibold text-zinc-200 truncate group-hover:text-violet-400 transition-colors cursor-pointer"
                      onClick={() => navigate(`/tasks/${task.id}`)}
                    >
                      {task.title}
                    </h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px] gap-1", getStatusColor(task.status))}>
                        {getStatusIcon(task.status)}
                        {t(`task:center.status.${task.status}`)}
                      </Badge>
                      {task.tags && task.tags.length > 0 && (
                        <div className="flex gap-1">
                          {task.tags.slice(0, 2).map(tag => (
                            <Badge key={tag} variant="secondary" className="h-5 px-1.5 text-[10px] bg-zinc-800 text-zinc-400 border-zinc-800">
                              {tag}
                            </Badge>
                          ))}
                          {task.tags.length > 2 && (
                            <Badge variant="secondary" className="h-5 px-1 text-[10px] bg-zinc-800 text-zinc-500 border-zinc-800">
                              +{task.tags.length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-x-2 gap-y-2 text-xs text-zinc-500">
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 cursor-help">
                          <HashIcon className="h-4 w-4 text-zinc-600 shrink-0" />
                          <span className="font-mono truncate">{task.id.slice(0, 8)}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('task:center.common.taskId')}</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 cursor-help overflow-hidden">
                          <FolderIcon className="h-4 w-4 text-zinc-600 shrink-0" />
                          <span className="truncate">{task.projectName || '-'}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('task:center.tooltips.project') || 'Project'}</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 cursor-help overflow-hidden">
                          <TargetIcon className="h-4 w-4 text-zinc-600 shrink-0" />
                          <span className="truncate">{task.targetName || '-'}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('task:center.tooltips.target') || 'Target'}</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 cursor-help">
                          <CalendarBlankIcon className="h-4 w-4 text-zinc-600 shrink-0" />
                          <span>{task.created_at ? new Date(task.created_at).toLocaleDateString() : '-'}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('task:center.tooltips.createdAt') || 'Created At'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              {/* Action Footer */}
              <div className="p-2 border-t border-zinc-800/50 mt-auto flex items-center gap-1 bg-zinc-900/20 rounded-b-xl">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 h-8 text-xs font-medium text-zinc-400 border border-transparent hover:border-zinc-700 hover:bg-zinc-800 hover:text-white transition-all"
                  onClick={() => navigate(`/tasks/${task.id}`)}
                >
                  <EyeIcon className="mr-2 h-3.5 w-3.5" />
                  {t('task:center.actions.viewDetails')}
                </Button>

                <div className="h-4 w-px bg-zinc-800" />

                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 h-8 text-xs font-medium text-zinc-400 border border-transparent hover:border-zinc-700 hover:bg-zinc-800 hover:text-white transition-all"
                  onClick={() => navigate(`/tasks/${task.id}?tab=evaluation`)}
                >
                  <SparkleIcon className="mr-2 h-3.5 w-3.5 text-purple-400" />
                  {t('task:center.actions.evaluate')}
                </Button>

                <div className="h-4 w-px bg-zinc-800" />

                {(task.status === 'todo' || task.status === 'failed') ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 h-8 text-xs font-medium text-zinc-400 border border-transparent hover:border-zinc-700 hover:bg-zinc-800 hover:text-white transition-all"
                    onClick={() => handleStartClick(task.id)}
                  >
                    <PlayIcon className="mr-2 h-3.5 w-3.5" />
                    {t('task:center.actions.startScan')}
                  </Button>
                ) : (task.status === 'in_progress' || task.status === 'running') ? (
                  <div className="flex-1 h-8 flex items-center justify-center text-xs font-medium text-sky-500 animate-pulse">
                    <SpinnerIcon className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Running...
                  </div>
                ) : (
                  <div className="flex-1 h-8 flex items-center justify-center text-xs font-medium text-zinc-500 cursor-not-allowed">
                    {t('task:center.status.done')}
                  </div>
                )}

                <div className="h-4 w-px bg-zinc-800" />

                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                  onClick={() => handleDeleteClick(task.id)}
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <TaskFormDialog open={dialogOpen} onOpenChange={setDialogOpen} onSuccess={loadTasks} />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t('task:center.deleteConfirm.title')}
        description={t('task:center.deleteConfirm.description')}
        onConfirm={handleDeleteConfirm}
        variant="destructive"
      />
      <ConfirmDialog
        open={startConfirmOpen}
        onOpenChange={setStartConfirmOpen}
        title={t('task:center.startConfirm.title')}
        description={t('task:center.startConfirm.description')}
        onConfirm={handleStartConfirm}
        cancelLabel={t('task:center.common.cancel')}
        confirmLabel={
          starting ? t('task:center.actions.starting') : t('task:center.actions.startScan')
        }
        loading={starting}
      />
    </PageLayout>
  )
}
