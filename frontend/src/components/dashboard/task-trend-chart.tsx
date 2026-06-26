import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useEffect, useState } from 'react'
import { GetTaskTrend } from '../../../wailsjs/go/main/DashboardService'

import { TrendUpIcon } from '@phosphor-icons/react'

interface TaskTrendItem {
  date: string
  tasks: number
}

export function TaskTrendChart() {
  const { t } = useTranslation('dashboard')
  const [data, setData] = useState<TaskTrendItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    GetTaskTrend(30)
      .then((items: TaskTrendItem[]) => {
        setData(items || [])
      })
      .catch((err: unknown) => {
        console.error('Failed to fetch task trend:', err)
        setData([])
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card className="col-span-2 border-zinc-800 bg-zinc-950/50 overflow-hidden py-0 gap-0">
      <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800 bg-zinc-900/50 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/20">
            <TrendUpIcon className="h-4 w-4 text-violet-400" weight="duotone" />
          </div>
          <CardTitle className="text-zinc-100">{t('taskTrend.title')}</CardTitle>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">{t('last30DaysActivity')}</span>
          <span className="text-[10px] text-zinc-500">{t('updatesEvery5Min')}</span>
        </div>
      </CardHeader>
      <CardContent className="p-6 pl-0">
        {loading ? (
          <div className="flex items-center justify-center h-[300px] text-zinc-500">
            <span className="animate-pulse">Loading...</span>
          </div>
        ) : (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              className="text-xs font-medium text-zinc-500"
              tick={{ fill: '#71717a' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              className="text-xs font-medium text-zinc-500"
              tick={{ fill: '#71717a' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#18181b', // zinc-950
                borderColor: '#27272a', // zinc-800
                borderRadius: '0.75rem',
                color: '#f4f4f5',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              }}
              itemStyle={{ color: '#a1a1aa' }}
              labelStyle={{ color: '#e4e4e7', fontWeight: 600, marginBottom: '0.25rem' }}
              cursor={{ stroke: '#52525b', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Area
              type="monotone"
              dataKey="tasks"
              stroke="#8b5cf6"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorTasks)"
              activeDot={{
                r: 6,
                fill: '#8b5cf6',
                stroke: '#18181b',
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
