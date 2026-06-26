import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { PageLayout } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import { Store } from 'lucide-react'
import { usePlanAccess } from '@/hooks/use-plan-access'
import { UpgradeDialog } from '@/components/upgrade-dialog'
import { compareVersion } from '@/lib/version'
import { NoPermissionDialog } from '@/components/no-permission-dialog'
import * as LocalDB from '../../../wailsjs/go/main/DB'
import * as SetsIndex from '@/services/setsIndex'
import SearchAndQuickFilter from './components/SearchAndQuickFilter'
import CategoryTabsList from './components/CategoryTabsList'
import SetsTable from './components/SetsTable'
import PaginationRow from './components/PaginationRow'
import SetDetailsDialog from './components/SetDetailsDialog'

type SetRow = {
  id: string
  label_lv1: string | null
  label_lv2: string | null
  prompt_text: string
  expected_output: string | null
  version: string | null
  lang: string
  min_plan: 'trial' | 'pro' | 'team'
  created_at: string
}

const PAGE_SIZE = 24

export default function SetsStorePage() {
  const { t } = useTranslation()
  const { plan: userPlan, canAccess } = usePlanAccess()
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [keyword, setKeyword] = useState('')
  const [items, setItems] = useState<SetRow[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [viewOpen, setViewOpen] = useState(false)
  const [currentRow, setCurrentRow] = useState<SetRow | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [noPermOpen, setNoPermOpen] = useState(false)
  const [noPermText, setNoPermText] = useState(t('testcases:setsStore.noPermission'))
  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])
  const [statusById, setStatusById] = useState<Record<string, 'none' | 'downloaded' | 'update'>>({})
  const [downloadedMode, setDownloadedMode] = useState(false)
  // Cache for downloaded items to avoid re-scanning LocalDB on every page change
  const [downloadedCache, setDownloadedCache] = useState<SetRow[]>([])

  // 加载分类（按 label_lv1 去重）。优先从视图加载，以便展示全部标题
  const loadCategories = async () => {
    try {
      let resp = await supabase
        .from('sets_public_view')
        .select('label_lv1')
        .eq('is_deleted', false)
        .order('label_lv1', { ascending: true })

      if (resp.error) {
        // 视图不存在则回退到表
        resp = await supabase
          .from('sets')
          .select('label_lv1')
          .eq('is_deleted', false)
          .order('label_lv1', { ascending: true })
      }

      if (resp.error) throw resp.error
      const uniq = Array.from(
        new Set(
          (resp.data || [])
            .map((r: { label_lv1: string | null }) => r.label_lv1)
            .filter((v: string | null): v is string => !!v),
        ),
      )
      setCategories(uniq)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(t('testcases:setsStore.loadCategoriesFailed'), e)
      toast.error(t('testcases:setsStore.loadCategoriesFailedWithMsg', { message: msg }))
      setCategories([])
    }
  }

  const loadItems = async (reset = false, pageIndex?: number) => {
    try {
      setLoading(true)
      const nextPage = pageIndex ?? (reset ? 1 : page)
      const from = (nextPage - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const build = (source: string) => {
        let q = supabase
          .from(source)
          .select(
            'id,label_lv1,label_lv2,prompt_text,expected_output,version,lang,min_plan,created_at',
            { count: 'exact' },
          )
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .range(from, to)
        if (selectedCategory !== 'all') {
          q = q.eq('label_lv1', selectedCategory)
        }
        if (keyword.trim()) {
          q = q.or(
            `prompt_text.ilike.%${keyword.trim()}%,expected_output.ilike.%${keyword.trim()}%`,
          )
        }
        return q
      }

      let resp = await build('sets_public_view')
      if (resp.error) {
        resp = await build('sets')
      }
      if (resp.error) throw resp.error

      const rows = (resp.data as SetRow[]) || []
      setItems(rows)
      setTotal(resp.count || 0)
      setPage(nextPage)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(t('testcases:setsStore.loadFailed'), e)
      toast.error(t('testcases:setsStore.loadFailedWithMsg', { message: msg }))
      if (reset) setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: load categories only on mount
  }, [])

  useEffect(() => {
    if (downloadedMode) {
      loadDownloaded(true, 1)
    } else {
      loadItems(true, 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: reload only when category/mode changes
  }, [selectedCategory, downloadedMode])

  // 当 items 变化或用户切换时刷新下载状态
  useEffect(() => {
    if (items.length > 0) {
      refreshStatuses(items)
    }
  }, [items, userPlan])

  const headerDesc = useMemo(() => {
    return selectedCategory === 'all'
      ? t('testcases:setsStore.pageDesc')
      : t('testcases:setsStore.categoryFilter', { category: selectedCategory })
  }, [selectedCategory, t])

  const handleSearch = () => {
    if (downloadedMode) {
      loadDownloaded(true, 1)
    } else {
      loadItems(true, 1)
    }
  }

  const loadDownloaded = async (reset = false, pageIndex?: number) => {
    try {
      setLoading(true)
      const nextPage = pageIndex ?? (reset ? 1 : page)

      // Use cached data for pagination if not resetting
      if (!reset && downloadedCache.length > 0) {
        const from = (nextPage - 1) * PAGE_SIZE
        const to = from + PAGE_SIZE
        setItems(downloadedCache.slice(from, to))
        setTotal(downloadedCache.length)
        setPage(nextPage)
        setLoading(false)
        return
      }

      if (!(await SetsIndex.hasIndex())) {
        await SetsIndex.rebuildIndex()
      }

      // Use index for fast filtering (lightweight entries)
      const indexEntries = await SetsIndex.listIndexEntries({
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        keyword: keyword.trim() || undefined,
      })

      // Convert index entries to SetRow format (load full data only for display)
      const filtered: SetRow[] = indexEntries.map((entry) => ({
        id: entry.id,
        label_lv1: entry.label_lv1,
        label_lv2: entry.label_lv2,
        prompt_text: entry.prompt_preview, // Preview for list, full data loaded on view
        expected_output: entry.output_preview,
        version: entry.version,
        lang: entry.lang,
        min_plan: entry.min_plan,
        created_at: entry.created_at,
      }))

      // Cache filtered results for pagination
      setDownloadedCache(filtered)
      const from = (nextPage - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE
      setItems(filtered.slice(from, to))
      setTotal(filtered.length)
      setPage(nextPage)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(t('testcases:setsStore.loadLocalFailed'), e)
      toast.error(t('testcases:setsStore.loadLocalFailedWithMsg', { message: msg }))
      if (reset) setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  const canAccessRow = (row: SetRow): boolean => canAccess(row.min_plan)

  const refreshStatuses = async (rows: SetRow[]) => {
    const settled = await Promise.allSettled(
      rows.map(async (row) => {
        try {
          const raw = await LocalDB.GetString(`sets:${row.id}`)
          const local = JSON.parse(raw || '{}') as Partial<SetRow> & { version?: string }
          const cmp = compareVersion(local.version ?? 'v1', row.version ?? 'v1')
          const st: 'downloaded' | 'update' = cmp < 0 ? 'update' : 'downloaded'
          return { id: row.id, status: st }
        } catch {
          return { id: row.id, status: 'none' as const }
        }
      }),
    )
    const newMap: Record<string, 'none' | 'downloaded' | 'update'> = {}
    for (const r of settled) {
      if (r.status === 'fulfilled') {
        newMap[r.value.id] = r.value.status
      }
    }
    setStatusById((prev) => ({ ...prev, ...newMap }))
  }

  const openDetails = (row: SetRow) => {
    if (!canAccessRow(row)) {
      setNoPermText(
        t('testcases:setsStore.noPermViewContent', { plan: userPlan, minPlan: row.min_plan }),
      )
      setNoPermOpen(true)
      return
    }
    setCurrentRow(row)
    setViewOpen(true)
  }

  const handleDownload = (row: SetRow) => {
    if (!canAccessRow(row)) {
      setNoPermText(
        t('testcases:setsStore.noPermDownloadContent', { plan: userPlan, minPlan: row.min_plan }),
      )
      setNoPermOpen(true)
      return
    }
    const payload = {
      id: row.id,
      title: row.label_lv2 || row.label_lv1,
      label_lv1: row.label_lv1,
      label_lv2: row.label_lv2,
      prompt_text: row.prompt_text,
      expected_output: row.expected_output,
      version: row.version || 'v1',
      lang: row.lang,
      min_plan: row.min_plan,
      created_at: row.created_at,
    }
    const key = `sets:${row.id}`
    LocalDB.PutString(key, JSON.stringify(payload))
      .then(async () => {
        // Also update the index for fast filtering
        await SetsIndex.upsertIndexEntry({
          id: row.id,
          label_lv1: row.label_lv1,
          label_lv2: row.label_lv2,
          prompt_preview: row.prompt_text.slice(0, 100),
          output_preview: (row.expected_output || '').slice(0, 100),
          version: row.version || 'v1',
          lang: row.lang,
          min_plan: row.min_plan,
          created_at: row.created_at,
        })
        toast.success(t('testcases:setsStore.downloadSuccess'))
        setStatusById((prev) => ({ ...prev, [row.id]: 'downloaded' }))
      })
      .catch((e) =>
        toast.error(t('testcases:setsStore.downloadFailedWithMsg', { message: e?.message || e })),
      )
  }

  return (
    <PageLayout
      breadcrumbs={[
        { label: t('testcases:setsStore.breadcrumb.parent'), href: '/testcases' },
        { label: t('testcases:setsStore.breadcrumb.current') },
      ]}
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-xl">
                <Store className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl">{t('testcases:setsStore.pageTitle')}</CardTitle>
                <CardDescription className="mt-1">{headerDesc}</CardDescription>
              </div>
            </div>
            <SearchAndQuickFilter
              keyword={keyword}
              onKeywordChange={setKeyword}
              onSearch={handleSearch}
              downloadedMode={downloadedMode}
              loading={loading}
              onToggleDownloadedMode={() => {
                setDownloadedMode((prev) => !prev)
                setDownloadedCache([])
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <CategoryTabsList categories={categories} />
            <TabsContent value={selectedCategory} className="mt-4">
              {items.length === 0 ? (
                <div className="text-muted-foreground py-10 text-center text-sm">
                  {loading ? t('testcases:setsStore.loading') : t('testcases:setsStore.empty')}
                </div>
              ) : (
                <SetsTable
                  items={items}
                  statusById={statusById}
                  canAccess={canAccessRow}
                  onOpenDetails={openDetails}
                  onDownload={handleDownload}
                />
              )}
              <PaginationRow
                total={total}
                page={page}
                pageCount={pageCount}
                loading={loading}
                onPrev={() =>
                  downloadedMode ? loadDownloaded(false, page - 1) : loadItems(false, page - 1)
                }
                onNext={() =>
                  downloadedMode ? loadDownloaded(false, page + 1) : loadItems(false, page + 1)
                }
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button variant="outline" asChild>
          <Link to="/testcases/local-sets">{t('testcases:setsStore.viewLocalSets')}</Link>
        </Button>
      </div>
      {/* 查看详情对话框 */}
      <SetDetailsDialog open={viewOpen} onOpenChange={setViewOpen} row={currentRow} />

      {/* 无权限提示 */}
      <NoPermissionDialog
        open={noPermOpen}
        onOpenChange={setNoPermOpen}
        message={noPermText}
        onUpgrade={() => setUpgradeOpen(true)}
      />

      {/* 升级提示 */}
      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </PageLayout>
  )
}
