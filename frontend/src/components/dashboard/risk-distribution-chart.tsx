import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useEffect, useState } from 'react'
import { GetRiskDistribution } from '../../../wailsjs/go/main/DashboardService'
import { useTranslation } from 'react-i18next'

import { ShieldWarningIcon } from '@phosphor-icons/react'

interface RiskDistItem {
  high: number
  medium: number
  low: number
}

export function RiskDistributionChart() {
  const { t } = useTranslation('dashboard')
  const [riskData, setRiskData] = useState<RiskDistItem | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    GetRiskDistribution()
      .then((data: RiskDistItem) => {
        setRiskData(data)
      })
      .catch((err: unknown) => {
        console.error('Failed to fetch risk distribution:', err)
        setRiskData({ high: 0, medium: 0, low: 0 })
      })
      .finally(() => setLoading(false))
  }, [])

  const aggregatedData = [
    { name: t('riskDistribution.high'), value: riskData?.high || 0, color: '#fb7185' }, // rose-400
    { name: t('riskDistribution.medium'), value: riskData?.medium || 0, color: '#fbbf24' }, // amber-400
    { name: t('riskDistribution.low'), value: riskData?.low || 0, color: '#34d399' }, // emerald-400
  ]

  const total = aggregatedData.reduce((acc, curr) => acc + curr.value, 0)

  return (
    <Card className="col-span-1 border-zinc-800 bg-zinc-950/50 overflow-hidden flex flex-col py-0 gap-0">
      <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800 bg-zinc-900/50 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 border border-rose-500/20">
            <ShieldWarningIcon className="h-4 w-4 text-rose-400" weight="duotone" />
          </div>
          <CardTitle className="text-zinc-100">{t('riskDistribution.title')}</CardTitle>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">{t('vulnerabilityOverview')}</span>
          <span className="text-[10px] text-zinc-500">{t('currentSecurityPosture')}</span>
        </div>
      </CardHeader>
      <CardContent className="p-6 flex-1 flex items-center justify-center relative">
        {loading ? (
          <div className="flex items-center justify-center h-[250px] text-zinc-500">
            <span className="animate-pulse">Loading...</span>
          </div>
        ) : (
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={aggregatedData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={85}
              paddingAngle={5}
              dataKey="value"
              stroke="none"
            >
              {aggregatedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#18181b',
                borderColor: '#27272a',
                borderRadius: '0.5rem',
                color: '#f4f4f5',
              }}
              itemStyle={{ color: '#a1a1aa' }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '12px', color: '#a1a1aa' }}
            />
          </PieChart>
        </ResponsiveContainer>
        )}
        {/* Center Text */}
        {!loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
          <span className="text-3xl font-bold text-zinc-100">{total}</span>
          <span className="text-xs text-zinc-500 uppercase tracking-wider">{t('total')}</span>
        </div>
        )}
      </CardContent>
    </Card>
  )
}
