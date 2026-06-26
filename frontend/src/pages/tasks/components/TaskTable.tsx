import { memo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Circle, Loader2, CheckCircle2, Eye, Trash2 } from 'lucide-react'

export interface TaskItem {
  id: string
  title: string
  project_id?: string | null
  goal_id?: string | null
  status: string
  order_index?: number
  tags?: string[]
  projectName?: string
  targetName?: string
}

interface TaskTableProps {
  tasks: TaskItem[]
  loading: boolean
  onStartClick: (taskId: string) => void
  onDeleteClick: (taskId: string) => void
}

export const TaskTable = memo(function TaskTable({ tasks, loading, onStartClick, onDeleteClick }: TaskTableProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const isTaskDone = useCallback((status: string) =>
    status === 'done' || status === 'completed' || status === 'archived' || status === 'blocked' || status === 'failed', [])

  const handleNavigate = useCallback((taskId: string) => {
    navigate(`/tasks/${taskId}`)
  }, [navigate])

  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('task:center.table.headers.title')}</TableHead>
            <TableHead>{t('task:center.table.headers.target')}</TableHead>
            <TableHead>{t('task:center.table.headers.project')}</TableHead>
            <TableHead>{t('task:center.table.headers.status')}</TableHead>
            <TableHead>{t('task:center.table.headers.order')}</TableHead>
            <TableHead>{t('task:center.table.headers.tags')}</TableHead>
            <TableHead className="text-right">{t('task:center.table.headers.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground text-center">
                {t('task:center.table.loading')}
              </TableCell>
            </TableRow>
          ) : tasks.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground text-center">
                {t('task:center.table.empty')}
              </TableCell>
            </TableRow>
          ) : (
            tasks.map((task) => (
              <TaskTableRow
                key={task.id}
                task={task}
                isTaskDone={isTaskDone}
                onStartClick={onStartClick}
                onDeleteClick={onDeleteClick}
                onNavigate={handleNavigate}
                t={t}
              />
            ))
          )}
        </TableBody>
      </Table>
    </TooltipProvider>
  )
})

const TaskTableRow = memo(function TaskTableRow({
  task,
  isTaskDone,
  onStartClick,
  onDeleteClick,
  onNavigate,
  t,
}: {
  task: TaskItem
  isTaskDone: (status: string) => boolean
  onStartClick: (taskId: string) => void
  onDeleteClick: (taskId: string) => void
  onNavigate: (taskId: string) => void
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  return (
    <TableRow className="group">
      <TableCell className="font-medium">{task.title}</TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {task.targetName || t('task:center.common.na')}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {task.projectName || t('task:center.common.na')}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          {task.status === 'in_progress' || task.status === 'running' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
          ) : task.status === 'done' || task.status === 'blocked' || task.status === 'failed' ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <Circle className="text-muted-foreground h-3.5 w-3.5" />
          )}
          <span className="text-sm">
            {task.status === 'in_progress' || task.status === 'running'
              ? t('task:center.status.in_progress')
              : task.status === 'done' || task.status === 'blocked' || task.status === 'failed'
                ? t('task:center.status.done')
                : t('task:center.status.todo')}
          </span>
        </div>
      </TableCell>
      <TableCell>{task.order_index}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {task.tags?.slice(0, 2).map((tag: string, index: number) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {task.tags && task.tags.length > 2 && (
            <Badge variant="secondary" className="text-xs">
              {t('task:center.tags.more', { count: task.tags.length - 2 })}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          {isTaskDone(task.status) ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1 px-2 text-xs"
                    disabled
                  >
                    {t('task:center.actions.startScan')}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('task:center.actions.startScanDisabledHint')}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1 px-2 text-xs"
              onClick={() => onStartClick(task.id)}
            >
              {t('task:center.actions.startScan')}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1 px-2 text-xs"
            onClick={() => onNavigate(task.id)}
          >
            <Eye className="h-3 w-3" />
            {t('task:center.actions.viewDetails')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => onDeleteClick(task.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
})
