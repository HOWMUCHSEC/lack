import {
  FolderIcon,
  TargetIcon,
  ChecksIcon,
  WarningIcon,
} from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import * as LocalDB from '../../../wailsjs/go/main/DB'
import * as LocalData from '@/services/localData'
import * as DashboardSvc from '../../../wailsjs/go/main/DashboardService'
import * as ScannerSvc from '../../../wailsjs/go/main/ScannerService'
import { EventsOn } from '../../../wailsjs/runtime'
import { scanner } from '../../../wailsjs/go/models'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export function StatsCards() {
  const { t } = useTranslation('dashboard')
  const [activeProjects, setActiveProjects] = useState(0)
  const [activeObjectives, setActiveObjectives] = useState(0)
  const [runningTasks, setRunningTasks] = useState(0)
  const [highRiskDetections, setHighRiskDetections] = useState(0)

  useEffect(() => {
    const load = async () => {
      try {
        const projects = await LocalData.listProjects()
        const activeCount = projects.filter((p) => p.status === 'Active').length
        setActiveProjects(activeCount)

        const targets = await LocalData.listTargets()
        const plannedCount = targets.filter((t) => t.target_status === 'planned').length
        setActiveObjectives(plannedCount)

        let running = 0
        try {
          running = await ScannerSvc.CountActiveRuns()
        } catch {
          running = await estimateRunningLocal()
        }
        setRunningTasks(running)

        let highRisk = 0
        try {
          const dashboardStats = await DashboardSvc.GetDashboardStats()
          highRisk = Number(dashboardStats?.highRiskCount || 0)
        } catch {
          try {
            const r = await computeRunStatsFromSvc()
            highRisk = r.highRisk
          } catch {
            const r = await computeRunStatsLocal()
            highRisk = r.highRisk
          }
        }
        setHighRiskDetections(highRisk)
      } catch {
        setActiveProjects(0)
        setActiveObjectives(0)
        setRunningTasks(0)
        setHighRiskDetections(0)
      }
    }
    load()

    const off1 = EventsOn('scanner:run:started', () => setRunningTasks((v) => v + 1))
    const off2 = EventsOn('scanner:run:finished', () => setRunningTasks((v) => (v > 0 ? v - 1 : 0)))
    return () => {
      if (typeof off1 === 'function') off1()
      if (typeof off2 === 'function') off2()
    }
  }, [])

  const stats = [
    {
      title: t('dashboard:stats.activeProjects'),
      value: activeProjects,
      icon: FolderIcon,
      meta: t('dashboard:stats.current'),
      color: 'text-blue-400 border-blue-500/20 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.15)]',
    },
    {
      title: t('dashboard:stats.activeObjectives'),
      value: activeObjectives,
      icon: TargetIcon,
      meta: t('dashboard:stats.current'),
      color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.15)]',
    },
    {
      title: t('dashboard:stats.runningTasks'),
      value: runningTasks,
      icon: ChecksIcon,
      meta: runningTasks > 0 ? t('dashboard:stats.runningNow') : t('dashboard:stats.idle'),
      color: 'text-amber-400 border-amber-500/20 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)]',
      animate: runningTasks > 0,
    },
    {
      title: t('dashboard:stats.highRiskDetections'),
      value: highRiskDetections,
      icon: WarningIcon,
      meta: highRiskDetections > 0 ? t('dashboard:stats.needsReview') : t('dashboard:stats.clear'),
      color: 'text-rose-400 border-rose-500/20 bg-rose-500/10 shadow-[0_0_15px_rgba(244,63,94,0.15)]',
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <div
            key={stat.title}
            className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/50 p-5 transition-all hover:border-zinc-700 hover:bg-zinc-900/50"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  {stat.title}
                </p>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-zinc-100">
                    {stat.value}
                  </span>
                  {stat.meta && (
                    <span className="text-xs font-medium text-zinc-500">
                      {stat.meta}
                    </span>
                  )}
                </div>
              </div>
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 shadow-inner transition-all group-hover:scale-110',
                  stat.color,
                  stat.animate && 'animate-pulse'
                )}
              >
                <Icon weight="duotone" className="h-6 w-6" />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

async function estimateRunningLocal(): Promise<number> {
  try {
    const kvs = await LocalDB.ListPrefix('scan:task:', 0, 500)
    const pairs = kvs.map((kv) => {
      const key = kv.key as string
      const parts = key.split(':')
      const runID = kv.value as string
      const ts = Number(parts[4] || 0)
      return { ts, runID }
    })
    pairs.sort((a, b) => b.ts - a.ts)
    let running = 0
    const sample = pairs.slice(0, 200)
    for (const p of sample) {
      try {
        await LocalDB.GetString(`scan:run:${p.runID}:meta`)
      } catch {
        running++
      }
    }
    return running
  } catch {
    return 0
  }
}

async function computeRunStatsLocal(): Promise<{ highRisk: number; today: number }> {
  try {
    const kvs = await LocalDB.ListPrefix('scan:task:', 0, 1000)
    const now = Date.now()
    const last7 = now - 7 * 24 * 60 * 60 * 1000
    const startOfToday = (() => {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      return d.getTime()
    })()
    let highRisk = 0
    let today = 0
    const pairs = kvs.map((kv) => {
      const key = kv.key as string
      const parts = key.split(':')
      const runID = kv.value as string
      const ts = Number(parts[4] || 0)
      return { ts, runID }
    })
    pairs.sort((a, b) => b.ts - a.ts)
    const limited = pairs.slice(0, 500)
    for (const p of limited) {
      try {
        const metaJSON = await LocalDB.GetString(`scan:run:${p.runID}:meta`)
        const meta = JSON.parse(metaJSON)
        const finishedAt = Number(meta?.finishedAt || 0)
        const failed = Number(meta?.failed || 0)
        if (finishedAt >= last7 && failed > 0) highRisk++
        if (finishedAt >= startOfToday) today++
      } catch {
        continue
      }
    }
    return { highRisk, today }
  } catch {
    return { highRisk: 0, today: 0 }
  }
}

async function computeRunStatsFromSvc(): Promise<{ highRisk: number; today: number }> {
  const now = Date.now()
  const last7 = now - 7 * 24 * 60 * 60 * 1000
  const startOfToday = (() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  })()
  const runs: scanner.RunResult[] = await ScannerSvc.ListRecentRuns(0, 1000)
  let highRisk = 0
  let today = 0
  for (const rr of runs) {
    const finishedAt = Number(rr.finishedAt || 0)
    const failed = Number(rr.failed || 0)
    if (finishedAt >= last7 && failed > 0) highRisk++
    if (finishedAt >= startOfToday) today++
  }
  return { highRisk, today }
}
