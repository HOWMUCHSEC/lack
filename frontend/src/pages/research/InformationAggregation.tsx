import { PageLayout } from '@/components/layout'
import { Card } from '@/components/ui/card'
import { useTranslation } from 'react-i18next'
import { useEffect, useState, useRef, useCallback, memo, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { listAiTweetEvals, type AiTweetEvalItem } from '@/services/aggregation'
import { usePlanAccess } from '@/hooks/use-plan-access'
import type { UserPlan } from '@/hooks/use-user'
import {
  BroadcastIcon,
  FunnelSimpleIcon,
  SortAscendingIcon,
  SortDescendingIcon,
  StarIcon,
  LightningIcon,
  TrendUpIcon,
  LightbulbIcon,
  CaretDownIcon,
  CaretUpIcon,
  ArrowSquareOutIcon,
  SpinnerIcon,
  NewspaperIcon
} from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { BrowserOpenURL } from '../../../wailsjs/runtime'

export default function InformationAggregationPage() {
  const { t } = useTranslation()
  const { canAccess } = usePlanAccess()

  const [items, setItems] = useState<AiTweetEvalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(24)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  const MAX_RENDERED_ITEMS = 200
  const [language, setLanguage] = useState<string>('')
  const [topic, setTopic] = useState<string>('')
  const [highValueOnly, setHighValueOnly] = useState(false)
  const [sortAsc, setSortAsc] = useState(false)
  const [minUsefulnessScore, setMinUsefulnessScore] = useState(0)

  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setPage(1)
    setHasMore(true)
    listAiTweetEvals({
      page: 1,
      pageSize,
      language: language || undefined,
      topic: topic || undefined,
      highValue: highValueOnly ? true : undefined,
      sortAsc,
      minUsefulnessScore: minUsefulnessScore > 0 ? minUsefulnessScore : undefined,
    })
      .then((res) => {
        if (!cancelled) {
          setItems(res.items)
          setTotal(res.total)
          setHasMore(res.items.length >= pageSize && res.items.length < res.total)
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [pageSize, language, topic, highValueOnly, sortAsc, minUsefulnessScore])

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const nextPage = page + 1
    listAiTweetEvals({
      page: nextPage,
      pageSize,
      language: language || undefined,
      topic: topic || undefined,
      highValue: highValueOnly ? true : undefined,
      sortAsc,
      minUsefulnessScore: minUsefulnessScore > 0 ? minUsefulnessScore : undefined,
    })
      .then((res) => {
        setItems((prev) => {
          const combined = [...prev, ...res.items]
          if (combined.length > MAX_RENDERED_ITEMS) {
            return combined.slice(-MAX_RENDERED_ITEMS)
          }
          return combined
        })
        setPage(nextPage)
        setTotal(res.total)
        setHasMore(res.items.length >= pageSize && items.length + res.items.length < res.total)
      })
      .catch((e) => {
        setError(String(e))
      })
      .finally(() => {
        setLoadingMore(false)
      })
  }, [loadingMore, hasMore, page, pageSize, language, topic, highValueOnly, sortAsc, minUsefulnessScore, items.length])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && hasMore) {
          loadMore()
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loading, hasMore, loadMore])

  const fmtDateTime = useCallback((input?: string) => {
    if (!input) return ''
    try {
      const d = new Date(input)
      if (Number.isNaN(d.getTime())) return input
      return d.toLocaleString()
    } catch {
      return input
    }
  }, [])

  return (
    <PageLayout
      breadcrumbs={[
        { label: t('nav:researchCenter'), href: '/research/aggregation' },
        { label: t('nav:infoAggregation') },
      ]}
      contentClassName="flex flex-1 flex-col gap-4 p-4 overflow-x-hidden"
    >
      {/* Header and Filter Bar */}
      <Card className="border-zinc-800 bg-zinc-950/50 backdrop-blur-xl mb-6">
        <div className="border-b border-zinc-800/50 p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-sky-500/10 text-sky-500 flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-500/20 shadow-[0_0_15px_rgba(14,165,233,0.15)]">
                <BroadcastIcon className="h-7 w-7" weight="duotone" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight text-zinc-100">{t('research:aggregationPageTitle')}</h2>
                <div className="flex items-center gap-2 text-sm text-zinc-400 font-medium">
                  {t('research:aggregationPageDesc')}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-zinc-900/50 p-1.5 rounded-xl border border-zinc-800/50">
              <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 font-mono h-8 px-3">
                {t('research:aggregation.totalCount', { count: total })}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-6">
            {/* Filters Group */}
            <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 h-10 transition-colors hover:bg-zinc-900/60">
              <FunnelSimpleIcon className="h-4 w-4 text-zinc-500" />
              <div className="h-4 w-px bg-zinc-800 mx-1" />

              <Select
                value={language || 'any'}
                onValueChange={(v) => {
                  setLanguage(v === 'any' ? '' : v)
                }}
              >
                <SelectTrigger className="h-6 w-[110px] border-0 bg-transparent shadow-none text-xs font-medium focus:ring-0 p-0 text-zinc-300">
                  <SelectValue placeholder={t('research:aggregation.controls.languagePlaceholder')} />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="any">{t('research:aggregation.controls.languageAny')}</SelectItem>
                  <SelectItem value="en">{t('common:language.en')}</SelectItem>
                  <SelectItem value="zh-CN">{t('common:language.zh-CN')}</SelectItem>
                </SelectContent>
              </Select>

              <div className="h-4 w-px bg-zinc-800 mx-1" />

              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="h-6 w-[120px] border-0 bg-transparent shadow-none text-xs focus-visible:ring-0 p-0 placeholder:text-zinc-600"
                placeholder={t('research:aggregation.controls.topicPlaceholder')}
              />
            </div>

            {/* High Value Toggle */}
            <label className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg border px-3 h-10 transition-all select-none",
              highValueOnly
                ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:bg-zinc-900/60"
            )}>
              <Checkbox
                className={cn("border-zinc-600 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500")}
                checked={highValueOnly}
                onCheckedChange={(v) => setHighValueOnly(Boolean(v))}
              />
              <StarIcon className={cn("h-4 w-4", highValueOnly ? "fill-amber-500" : "")} weight={highValueOnly ? "fill" : "regular"} />
              <span className="text-xs font-medium uppercase tracking-wide">{t('research:aggregation.controls.highValueOnly')}</span>
            </label>

            {/* Usefulness Slider */}
            <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 h-10">
              <LightningIcon className="h-4 w-4 text-orange-500 shrink-0" weight="duotone" />
              <span className="text-xs font-medium text-zinc-400 whitespace-nowrap">
                {t('research:aggregation.controls.minScore')}
              </span>
              <Slider
                value={[minUsefulnessScore]}
                onValueChange={(v) => setMinUsefulnessScore(v[0])}
                min={0}
                max={1}
                step={0.1}
                className="w-20 [&>[data-slot=slider-track]]:bg-zinc-700"
              />
              <span className="text-xs font-mono text-zinc-300 w-6 text-right">{minUsefulnessScore.toFixed(1)}</span>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 h-10 ml-auto">
              <button
                onClick={() => setSortAsc(!sortAsc)}
                className="text-zinc-400 hover:text-white transition-colors"
                title={sortAsc ? t('research:aggregation.controls.sortOldestTooltip') : t('research:aggregation.controls.sortNewestTooltip')}
              >
                {sortAsc ? <SortAscendingIcon className="h-4 w-4" /> : <SortDescendingIcon className="h-4 w-4" />}
              </button>
              <div className="h-4 w-px bg-zinc-800 mx-1" />
              <span className="text-xs font-medium text-zinc-400">
                {sortAsc ? t('research:aggregation.controls.sortOldest') : t('research:aggregation.controls.sortNewest')}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Content Area - Masonry-like Feed */}
      {error && (
        <div className="text-red-400 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm mb-6 text-center">
          {t('common:app.error')}: {String(error)}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 text-sky-500 animate-spin flex items-center justify-center rounded-full border-2 border-sky-500/30 border-t-sky-500" />
            <span className="text-zinc-500 text-sm font-medium animate-pulse">{t('research:loading')}</span>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
          <NewspaperIcon className="h-16 w-16 opacity-20 mb-4" />
          <p className="font-medium">{t('research:aggregationEmpty')}</p>
        </div>
      ) : (
        <TooltipProvider>
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
            {items.map((it) => (
              <TweetEvalCard
                key={it.id}
                item={it}
                canAccess={canAccess}
                fmtDateTime={fmtDateTime}
                t={t}
              />
            ))}
          </div>
        </TooltipProvider>
      )}

      {/* Sentinel & Loaders */}
      <div ref={sentinelRef} className="h-1" />

      {loadingMore && (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 text-sm">
            <SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
            <span>{t('research:loadingMore')}</span>
          </div>
        </div>
      )}

      {!hasMore && items.length > 0 && (
        <div className="flex items-center justify-center py-8 gap-2 text-zinc-600 text-xs font-medium">
          <span className="h-1 w-1 rounded-full bg-zinc-700"></span>
          <span>{t('research:noMore')}</span>
          <span className="h-1 w-1 rounded-full bg-zinc-700"></span>
        </div>
      )}
    </PageLayout>
  )
}

// Visual Score Bar Component
const ScoreBar = memo(function ScoreBar({
  value,
  label,
  color,
}: {
  value?: number
  label: string
  color: 'blue' | 'green' | 'orange'
}) {
  const percent = useMemo(() => value !== undefined ? Math.round(value * 100) : 0, [value])
  const colorMap = {
    blue: 'bg-sky-500',
    green: 'bg-emerald-500',
    orange: 'bg-amber-500',
  }

  if (value === undefined) return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex-1 min-w-0 group/bar">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] uppercase tracking-wider font-semibold text-zinc-500 group-hover/bar:text-zinc-300 transition-colors truncate">{label}</span>
            <span className="text-[9px] font-mono text-zinc-400 group-hover/bar:text-white transition-colors">{percent}%</span>
          </div>
          <div className="h-1 w-full rounded-full bg-zinc-800/50 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(0,0,0,0.3)]', colorMap[color])}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs font-mono bg-zinc-900 border-zinc-800">
        {label}: {value.toFixed(3)}
      </TooltipContent>
    </Tooltip>
  )
})

// Intelligence Card Component
const TweetEvalCard = memo(function TweetEvalCard({
  item: it,
  canAccess,
  fmtDateTime,
  t,
}: {
  item: AiTweetEvalItem
  canAccess: (required: UserPlan) => boolean
  fmtDateTime: (input?: string) => string
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  const [expanded, setExpanded] = useState(false)
  const [actionsExpanded, setActionsExpanded] = useState(false)
  const tagList = Array.isArray(it.tags) ? it.tags : []
  const hasInsights = canAccess('pro') && it.insights
  const hasActionsData = !!it.recommendedActions
  const canViewActions = canAccess('team')

  return (
    <div className="break-inside-avoid mb-4 page-break-avoid">
      <Card
        className={cn(
          'group relative overflow-hidden transition-all duration-300 border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/80 hover:border-zinc-700/50 hover:shadow-xl hover:-translate-y-1',
          it.isHighValue && 'border-amber-500/30 bg-amber-950/5 hover:border-amber-500/50 hover:bg-zinc-900 shadow-[0_0_20px_rgba(245,158,11,0.05)]'
        )}
      >
        {/* Header */}
        <div className="relative p-4 pb-0">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              {it.topicCategory && (
                <Badge variant="outline" className={cn(
                  "text-[10px] uppercase tracking-wider font-bold h-5 px-1.5 border-0",
                  it.isHighValue ? "bg-amber-500/20 text-amber-500" : "bg-zinc-800 text-zinc-400"
                )}>
                  {it.topicCategory.replace(/_/g, ' ')}
                </Badge>
              )}
              {it.isHighValue && (
                <SparklesWrapper />
              )}
            </div>
            <span className="text-[10px] font-mono text-zinc-600 group-hover:text-zinc-500 transition-colors">
              {fmtDateTime(it.createdAt)}
            </span>
          </div>

          <p className="text-sm leading-relaxed text-zinc-200 mb-4 font-medium">
            {it.summary || '-'}
          </p>

          {/* Tags */}
          {tagList.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
              {tagList.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-sm bg-zinc-800/50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Scores */}
          {canAccess('pro') && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-black/20 border border-white/5 mb-3 group-hover:border-white/10 transition-colors">
              <ScoreBar
                value={it.usefulnessScore}
                label={t('research:aggregation.fields.useful')}
                color="orange"
              />
              <ScoreBar
                value={it.relevanceScore}
                label={t('research:aggregation.fields.relevant')}
                color="blue"
              />
              <ScoreBar
                value={it.qualityScore}
                label={t('research:aggregation.fields.quality')}
                color="green"
              />
            </div>
          )}

          {/* Insights Toggle */}
          {hasInsights && (
            <div className="border-t border-zinc-800/50">
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex w-full items-center justify-between py-2.5 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <LightbulbIcon className={cn("h-3.5 w-3.5", expanded ? "text-yellow-400 fill-yellow-400" : "")} />
                  <span>{t('research:aggregation.viewInsights')}</span>
                </div>
                {expanded ? <CaretUpIcon className="h-3 w-3" /> : <CaretDownIcon className="h-3 w-3" />}
              </button>

              {expanded && (
                <div className="pb-3 animate-in slide-in-from-top-1 fade-in duration-200">
                  <div className="rounded-lg bg-sky-500/5 border border-sky-500/10 p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <TrendUpIcon className="h-3.5 w-3.5 text-sky-400" weight="bold" />
                      <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wide">
                        {t('research:aggregation.fields.aiAnalysis')}
                      </span>
                    </div>
                    <p className="text-xs text-sky-100/80 leading-relaxed">
                      {it.insights}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions Toggle */}
          {hasActionsData && (
            <div className={cn("border-t border-zinc-800/50", !hasInsights && "border-t-0")}>
              <button
                onClick={() => setActionsExpanded(!actionsExpanded)}
                className="flex w-full items-center justify-between py-2.5 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <LightningIcon className={cn("h-3.5 w-3.5", actionsExpanded ? "text-emerald-400 fill-emerald-400" : "")} />
                  <span>{t('research:aggregation.viewActions')}</span>
                </div>
                {actionsExpanded ? <CaretUpIcon className="h-3 w-3" /> : <CaretDownIcon className="h-3 w-3" />}
              </button>

              {actionsExpanded && (
                <div className="pb-3 animate-in slide-in-from-top-1 fade-in duration-200">
                  {canViewActions ? (
                    <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <LightningIcon className="h-3.5 w-3.5 text-emerald-400" weight="fill" />
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">
                          {t('research:aggregation.fields.actionItems')}
                        </span>
                      </div>
                      <p className="text-xs text-emerald-100/80 leading-relaxed">
                        {it.recommendedActions}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-center">
                      <span className="text-[10px] text-zinc-500">
                        {t('research:aggregation.visibility.requiresPlan', { plan: 'Team' })}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Link */}
        {it.tweetUrl && (
          <div className="flex items-center justify-end p-2 bg-black/20 border-t border-zinc-800/50">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => BrowserOpenURL(it.tweetUrl!)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-medium text-zinc-500 hover:text-sky-400 hover:bg-sky-500/10 transition-all group/link"
                >
                  <span>{t('research:aggregation.actions.viewSource')}</span>
                  <ArrowSquareOutIcon className="h-3 w-3 group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5 transition-transform" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {t('research:aggregation.fields.openTweet')}
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </Card>
    </div>
  )
})

const SparklesWrapper = () => (
  <div className="relative flex items-center justify-center">
    <StarIcon className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
    <div className="absolute inset-0 bg-amber-400 blur-[8px] opacity-40"></div>
  </div>
)
