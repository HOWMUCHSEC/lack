import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartBarIcon, WarningIcon } from '@phosphor-icons/react'
import { useCommunityStatistics } from '../hooks/useCommunityStatistics'
import type { VendorStats } from '../hooks/useCommunityStatistics'

export interface CommunityStatsPanelProps {
  /** Incremented by parent to signal the panel should re-fetch statistics */
  refreshTrigger?: number
}

function VendorStatsCard({ vendor }: { vendor: VendorStats }) {
  const { t } = useTranslation()

  if (vendor.loading) {
    return (
      <Card className="border-zinc-800 bg-zinc-900/30">
        <CardContent className="px-4 py-3 space-y-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    )
  }

  if (vendor.error) {
    return (
      <Card className="border-red-900/30 bg-zinc-900/30">
        <CardContent className="px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-200 mb-2">
            {vendor.vendor}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-red-400">
            <WarningIcon className="h-3.5 w-3.5" />
            <span>{t('samples:statistics.loadFailed')}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-zinc-800 bg-zinc-900/30">
      <CardContent className="px-4 py-3 space-y-3">
        <div className="text-sm font-medium text-zinc-200">{vendor.vendor}</div>

        {/* Category distribution */}
        {vendor.categoryCounts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {vendor.categoryCounts.map((cc) => (
              <Badge
                key={cc.label}
                variant="secondary"
                className="bg-zinc-800/60 text-zinc-400 text-[10px] px-1.5 py-0.5"
              >
                {cc.label}: {cc.count.toLocaleString()}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function CommunityStatsPanel({ refreshTrigger }: CommunityStatsPanelProps) {
  const { t } = useTranslation()
  const stats = useCommunityStatistics()

  // Fetch data on mount
  const [hasFetched, setHasFetched] = useState(false)
  useEffect(() => {
    if (!hasFetched) {
      stats.refresh()
      setHasFetched(true)
    }
  }, [hasFetched, stats])

  // Re-fetch when parent signals a data refresh (e.g. filter reset)
  useEffect(() => {
    if (refreshTrigger && hasFetched) {
      stats.refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger])

  return (
    <div className="mb-6 space-y-3">
      <div className="flex items-center gap-2 px-1">
        <ChartBarIcon className="h-4 w-4 text-teal-400" weight="duotone" />
        <span className="text-sm font-medium text-zinc-300">
          {t('samples:statistics.panelTitle', '数据统计概览')}
        </span>
        {stats.loading && (
          <span className="text-xs text-zinc-500 ml-2">
            {t('samples:statistics.loading', '加载中...')}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {stats.vendors.map((vendor) => (
          <VendorStatsCard key={vendor.table} vendor={vendor} />
        ))}
      </div>
    </div>
  )
}
