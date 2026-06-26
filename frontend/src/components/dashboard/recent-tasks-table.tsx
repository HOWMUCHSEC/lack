import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  CheckCircleIcon,
  WarningIcon,
  XCircleIcon,
  ArrowClockwiseIcon,
  EyeIcon,
  ArrowRightIcon,
} from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as LocalDB from '../../../wailsjs/go/main/DB'
import { EventsOn } from '../../../wailsjs/runtime'
import * as ScannerSvc from '../../../wailsjs/go/main/ScannerService'
import * as LocalData from '@/services/localData'
import { scanner } from '../../../wailsjs/go/models'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

type Row = {
  executedAt: string
  project: string
  objective: string
  task: string
  testCases: string
  status: 'success' | 'warning' | 'failed'
  passRate: number
}

export function RecentTasksTable() {
  const { t } = useTranslation('dashboard')
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        let metas: Array<{
          runID: string
          taskID: string
          finishedAt: number
          ok: number
          total: number
          failed: number
        }> = []
        try {
          const runs: scanner.RunResult[] = await ScannerSvc.ListRecentRuns(0, 30)
          metas = runs.map((r) => ({
            runID: r.runID,
            taskID: r.taskID,
            finishedAt: Number(r.finishedAt || 0),
            ok: Number(r.ok || 0),
            total: Number(r.total || 0),
            failed: Number(r.failed || 0),
          }))
        } catch {
          const kvs = await LocalDB.ListPrefix('scan:task:', 0, 2000)
          const pairs = kvs.map((kv) => {
            const key = kv.key as string
            const parts = key.split(':')
            const taskID = parts[2]
            const ts = Number(parts[4] || 0)
            const runID = kv.value as string
            return { ts, runID, taskID }
          })
          pairs.sort((a, b) => b.ts - a.ts)
          const recent = pairs.slice(0, 30)
          for (const p of recent) {
            try {
              const metaJSON = await LocalDB.GetString(`scan:run:${p.runID}:meta`)
              const meta = JSON.parse(metaJSON)
              metas.push({
                runID: p.runID,
                taskID: p.taskID,
                finishedAt: Number(meta?.finishedAt || 0),
                ok: Number(meta?.ok || 0),
                total: Number(meta?.total || 0),
                failed: Number(meta?.failed || 0),
              })
            } catch {
              continue
            }
          }
        }

        const taskIDs = [...new Set(metas.map((m) => m.taskID))]
        const tasksMap = new Map<
          string,
          { title: string; project_id?: string | null; goal_id?: string | null }
        >()
        const projectsMap = new Map<string, string>()
        const targetsMap = new Map<string, string>()
        if (taskIDs.length > 0) {
          const tasksData = await LocalData.getTasksByIds(taskIDs)
          tasksData.forEach((t) => {
            tasksMap.set(t.id, {
              title: t.title,
              project_id: t.project_id ?? null,
              goal_id: t.goal_id ?? null,
            })
          })
          const projectIDs = [...new Set(tasksData.map((t) => t.project_id).filter(Boolean))]
          const targetIDs = [...new Set(tasksData.map((t) => t.goal_id).filter(Boolean))]
          if (projectIDs.length > 0) {
            // Use batch fetch instead of listing all projects
            const projects = await LocalData.getProjectsByIds(projectIDs as string[])
            projects.forEach((p) => projectsMap.set(p.id, p.name))
          }
          if (targetIDs.length > 0) {
            // Use batch fetch instead of listing all targets
            const targets = await LocalData.getTargetsByIds(targetIDs as string[])
            targets.forEach((t) => targetsMap.set(t.id, t.target_title))
          }
        }

        const toRelTime = (ms: number) => {
          if (!ms || ms <= 0) return t('recentTasks.relative.na')
          const diff = Date.now() - ms
          const m = Math.floor(diff / 60000)
          if (m < 1) return t('recentTasks.relative.justNow')
          if (m < 60) return t('recentTasks.relative.minutesAgo', { count: m })
          const h = Math.floor(m / 60)
          if (h < 24) return t('recentTasks.relative.hoursAgo', { count: h })
          const d = Math.floor(h / 24)
          if (d < 7) return t('recentTasks.relative.daysAgo', { count: d })
          const dt = new Date(ms)
          const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
          return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
        }

        const computed: Row[] = metas
          .sort((a, b) => b.finishedAt - a.finishedAt)
          .slice(0, 10)
          .map((m) => {
            const t = tasksMap.get(m.taskID)
            const projectName = (t?.project_id && projectsMap.get(t.project_id)) || '-'
            const targetName = (t?.goal_id && targetsMap.get(t.goal_id)) || '-'
            const passRate = m.total > 0 ? Math.round((m.ok / m.total) * 100) : 0
            let status: Row['status'] = 'failed'
            if (m.failed === 0) status = 'success'
            else if (m.ok > 0) status = 'warning'
            return {
              executedAt: toRelTime(m.finishedAt),
              project: projectName,
              objective: targetName,
              task: t?.title || m.taskID,
              testCases: `${m.ok}/${m.total}`,
              status,
              passRate,
            }
          })
        setRows(computed)
      } catch {
        setRows([])
      } finally {
        setLoading(false)
      }
    }
    load()
    const off = EventsOn('scanner:run:finished', () => load())
    return () => {
      if (typeof off === 'function') off()
    }
  }, [t])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          {t('recentTasks.title')}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
          onClick={() => navigate('/tasks')}
        >
          {t('recentTasks.viewAll')} <ArrowRightIcon className="ml-1 h-3 w-3" />
        </Button>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 overflow-hidden">
        <Table>
          <TableHeader className="bg-zinc-900/50">
            <TableRow className="border-none hover:bg-transparent">
              <TableHead className="w-[150px] text-xs font-medium text-zinc-400">{t('recentTasks.headers.executionTime')}</TableHead>
              <TableHead className="text-xs font-medium text-zinc-400">{t('recentTasks.headers.project')}</TableHead>
              <TableHead className="text-xs font-medium text-zinc-400">{t('recentTasks.headers.objective')}</TableHead>
              <TableHead className="text-xs font-medium text-zinc-400">{t('recentTasks.headers.task')}</TableHead>
              <TableHead className="w-[100px] text-xs font-medium text-zinc-400">{t('recentTasks.headers.testCases')}</TableHead>
              <TableHead className="w-[120px] text-xs font-medium text-zinc-400">{t('recentTasks.headers.result')}</TableHead>
              <TableHead className="text-right w-[100px] text-xs font-medium text-zinc-400">{t('recentTasks.headers.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-none">
                <TableCell colSpan={7} className="h-24 text-center text-zinc-500 text-sm">
                  {t('recentTasks.loading')}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow className="border-none">
                <TableCell colSpan={7} className="h-24 text-center text-zinc-500 text-sm">
                  {t('recentTasks.empty')}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((task, index) => {
                const StatusIcon =
                  task.status === 'success'
                    ? CheckCircleIcon
                    : task.status === 'warning'
                      ? WarningIcon
                      : XCircleIcon
                const statusColor =
                  task.status === 'success'
                    ? 'text-emerald-400'
                    : task.status === 'warning'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                const statusBg =
                  task.status === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/20'
                    : task.status === 'warning'
                      ? 'bg-amber-500/10 border-amber-500/20'
                      : 'bg-rose-500/10 border-rose-500/20'

                return (
                  <TableRow
                    key={index}
                    className="group border-b border-zinc-800/50 hover:bg-zinc-900/40 transition-colors last:border-0"
                  >
                    <TableCell className="font-mono text-xs text-zinc-500">
                      {task.executedAt}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-zinc-200">{task.project}</TableCell>
                    <TableCell className="text-sm text-zinc-400">{task.objective}</TableCell>
                    <TableCell className="text-sm text-zinc-400">{task.task}</TableCell>
                    <TableCell className="font-mono text-xs text-zinc-500">
                      {task.testCases}
                    </TableCell>
                    <TableCell>
                      <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5", statusBg)}>
                        <StatusIcon weight="fill" className={cn('h-3.5 w-3.5', statusColor)} />
                        <span
                          className={cn(
                            'text-xs font-medium',
                            statusColor
                          )}
                        >
                          {task.passRate}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800">
                          <EyeIcon className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800">
                          <ArrowClockwiseIcon className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
