import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageLayout } from '@/components/layout'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { listPapers } from '@/services/papers'
import type { PaperInsight } from '@/services/papers'
import { useTranslation } from 'react-i18next'
import {
  BookOpenIcon,
  MagnifyingGlassIcon,
  ArrowRightIcon,
  SpinnerIcon,
  ArticleIcon
} from '@phosphor-icons/react'

const PAGE_SIZE = 12

export default function PaperInsightsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [list, setList] = useState<PaperInsight[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const loadMore = useCallback(
    async (pageNum: number, reset = false) => {
      if (loading) return
      setLoading(true)
      try {
        const data = await listPapers({ page: pageNum, pageSize: PAGE_SIZE })
        if (reset) {
          setList(data)
        } else {
          setList((prev) => [...prev, ...data])
        }
        setHasMore(data.length === PAGE_SIZE)
      } catch {
        if (reset) setList([])
        setHasMore(false)
      } finally {
        setLoading(false)
        setInitialLoading(false)
      }
    },
    [loading],
  )

  // Initial load
  useEffect(() => {
    loadMore(1, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run once on mount
  }, [])

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !initialLoading) {
          const nextPage = page + 1
          setPage(nextPage)
          loadMore(nextPage)
        }
      },
      { threshold: 0.1 },
    )

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current)
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [hasMore, loading, page, initialLoading, loadMore])

  const filteredList = list.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <PageLayout
      breadcrumbs={[
        { label: t('nav:researchCenter'), href: '/research/papers' },
        { label: t('nav:paperInsights') },
      ]}
    >
      <Card className="border-zinc-800 bg-zinc-950/50 backdrop-blur-xl mb-6">
        <div className="border-b border-zinc-800/50 p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-teal-500/10 text-teal-500 flex h-14 w-14 items-center justify-center rounded-2xl border border-teal-500/20 shadow-[0_0_15px_rgba(20,184,166,0.15)]">
                <BookOpenIcon className="h-7 w-7" weight="duotone" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight text-zinc-100">{t('research:pageTitle')}</h2>
                <div className="flex items-center gap-2 text-sm text-zinc-400 font-medium">
                  {t('research:pageDesc')}
                </div>
              </div>
            </div>

            <div className="relative w-full md:w-64">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                placeholder="Search papers, authors..."
                className="pl-9 bg-zinc-900/50 border-zinc-800 h-10 focus-visible:ring-teal-500/30 transition-all font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Initial loading state */}
      {initialLoading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="h-10 w-10 text-teal-500 animate-spin flex items-center justify-center rounded-full border-2 border-teal-500/30 border-t-teal-500" />
          <span className="text-zinc-500 text-sm font-medium animate-pulse">{t('research:loading')}</span>
        </div>
      )}

      {/* Paper grid */}
      {!initialLoading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredList.map((paper) => (
            <div
              key={paper.id}
              className="group relative flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 transition-all duration-300 hover:bg-zinc-900 hover:border-teal-500/30 hover:shadow-lg hover:shadow-teal-500/5 hover:-translate-y-1 cursor-pointer"
              onClick={() => navigate(`/research/papers/${paper.id}`)}
            >
              <div className="p-5 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-bold text-lg text-zinc-100 leading-snug group-hover:text-teal-400 transition-colors line-clamp-2">
                      {paper.title}
                    </h3>
                    <div className="shrink-0">
                      <Badge variant="outline" className="border-teal-500/20 bg-teal-500/5 text-teal-400 font-mono text-[10px] px-1.5 py-0.5 rounded-sm">
                        {paper.year}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-400">
                    <span className="font-medium text-zinc-300">{paper.authors}</span>
                    <span className="text-zinc-600">•</span>
                    <span className="bg-zinc-800/50 px-1.5 py-0.5 rounded text-zinc-400">{paper.venue}</span>
                  </div>
                </div>

                <p className="text-sm text-zinc-400/80 line-clamp-3 leading-relaxed min-h-[60px]">
                  {paper.summary}
                </p>

                <div className="flex flex-wrap gap-1.5 pt-2">
                  {paper.tags.slice(0, 3).map((tag: string) => (
                    <span key={tag} className="inline-flex items-center rounded-sm bg-zinc-800/80 border border-zinc-700/50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                      {tag}
                    </span>
                  ))}
                  {paper.tags.length > 3 && (
                    <span className="text-[10px] text-zinc-600 font-medium pl-1">+{paper.tags.length - 3}</span>
                  )}
                </div>
              </div>

              <div className="p-4 pt-3 border-t border-zinc-800/50 mt-2 flex items-center justify-between gap-3 bg-zinc-900/20 rounded-b-xl group-hover:bg-zinc-900/50 transition-colors">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 h-9 text-xs font-medium text-teal-500 hover:text-teal-400 hover:bg-teal-500/10 justify-start px-2 -ml-2 transition-all"
                >
                  {t('research:actions.readInsight')}
                  <ArrowRightIcon className="ml-1.5 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!initialLoading && filteredList.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 py-20 text-center flex flex-col items-center justify-center">
          <div className="h-16 w-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4">
            <ArticleIcon className="h-8 w-8 text-zinc-600 opacity-50" />
          </div>
          <h3 className="text-lg font-medium text-zinc-300">{t('research:details.noPapersFoundTitle')}</h3>
          <p className="text-sm text-zinc-500 max-w-sm mt-2">
            {searchQuery ? `No results matching "${searchQuery}"` : t('research:table.empty')}
          </p>
        </div>
      )}

      {/* Load more trigger */}
      {!initialLoading && list.length > 0 && !searchQuery && (
        <div ref={loadMoreRef} className="flex items-center justify-center py-8">
          {loading ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 text-sm">
              <SpinnerIcon className="h-4 w-4 animate-spin text-teal-500" />
              <span>{t('research:loadingMore')}</span>
            </div>
          ) : hasMore ? (
            <div className="text-zinc-600 text-xs font-medium uppercase tracking-wider">
              {t('research:list.scrollToLoad', { count: list.length })}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-zinc-600 text-xs font-medium">
              <span className="h-1 w-1 rounded-full bg-zinc-700"></span>
              <span>{t('research:noMore')}</span>
              <span className="h-1 w-1 rounded-full bg-zinc-700"></span>
            </div>
          )}
        </div>
      )}
    </PageLayout>
  )
}
