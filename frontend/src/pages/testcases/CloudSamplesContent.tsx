import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { NoPermissionDialog } from '@/components/no-permission-dialog'
import * as LocalDB from '../../../wailsjs/go/main/DB'
import PaginationRow from './components/PaginationRow'
import { getVendors, getLv1ByVendor, type Vendor } from './constants/categories'
import {
  checkPromptsAccess,
  listPromptsCombined,
  type PromptItem,
} from '@/services/prompts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DownloadIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  CloudIcon,
  TagIcon,
  HashIcon,
  WarningIcon,
  Target,
  Lightning,
  Stack,
  ListDashes
} from '@phosphor-icons/react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import CommunityStatsPanel from './components/CommunityStatsPanel'

const PAGE_SIZE = 24

export default function CloudSamplesContent({ onRefresh }: { onRefresh?: () => void }) {
  const { t } = useTranslation()
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [selectedStage, setSelectedStage] = useState<string>('')
  const [selectedVendor, setSelectedVendor] = useState<Vendor | ''>('')
  const [selectedLv1, setSelectedLv1] = useState<string>('')
  const [selectedLv2, setSelectedLv2] = useState<string>('')

  // 阶段选项
  const stageOptions = ['stage1', 'stage2', 'stage3']

  // 阶段名称映射
  const stageNameMap: Record<string, string> = {
    'stage1': '基线',
    'stage2': '变异',
    'stage3': '组合'
  }

  // 阶段图标映射
  const stageIconMap: Record<string, React.ElementType> = {
    'stage1': Target,
    'stage2': Lightning,
    'stage3': Stack
  }

  // 阶段图标颜色映射
  const stageColorMap: Record<string, string> = {
    'stage1': 'text-cyan-400',
    'stage2': 'text-amber-400',
    'stage3': 'text-purple-400'
  }

  // 获取阶段显示名称（处理 stage1_aws 等格式）
  const getStageDisplayName = (stage: string): string => {
    const stageKey = stage.split('_')[0] // 提取 stage1/stage2/stage3 部分
    return stageNameMap[stageKey] || stage
  }

  // 厂商列表
  const vendors = useMemo(() => getVendors(), [])
  // 获取分类列表（基于厂商） - Now returns string[]
  const lv1Options = useMemo(() => (selectedVendor ? getLv1ByVendor(selectedVendor) : []), [selectedVendor])
  // const lv2Categories = useMemo(() => (selectedLv1 ? getLv2Categories(selectedLv1) : []), [selectedLv1]) // Level 2 is empty for now

  const [keyword, setKeyword] = useState('')
  const [items, setItems] = useState<PromptItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [viewOpen, setViewOpen] = useState(false)
  const [currentRow, setCurrentRow] = useState<PromptItem | null>(null)
  const [noPermOpen, setNoPermOpen] = useState(false)
  const [statusById, setStatusById] = useState<Record<number, 'none' | 'downloaded'>>({})
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0)
  const requestSeqRef = useRef(0)
  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])

  // 检查访问权限
  useEffect(() => {
    checkPromptsAccess().then((ok) => {
      setHasAccess(ok)
      if (!ok) {
        setNoPermOpen(true)
      }
    })
  }, [])

  // 加载数据
  const loadItems = async (reset = false, pageIndex?: number) => {
    if (!hasAccess) return
    const requestSeq = ++requestSeqRef.current
    try {
      setLoading(true)
      const nextPage = pageIndex ?? (reset ? 1 : page)

      // 构建 stage 查询值：当同时选择了 stage 和 vendor 时，组合成 stage1_aws 格式
      let stageQuery: string | undefined
      if (selectedStage && selectedVendor) {
        stageQuery = `${selectedStage}_${selectedVendor.toLowerCase()}`
      } else if (selectedStage) {
        stageQuery = selectedStage
      }

      const result = await listPromptsCombined({
        page: nextPage,
        pageSize: PAGE_SIZE,
        stage: stageQuery,
        vendor: selectedVendor || undefined,
        labelLv1: selectedLv1 || undefined,
        labelLv2: selectedLv2 || undefined,
        keyword: keyword.trim() || undefined,
      })
      if (requestSeq !== requestSeqRef.current) return

      setItems(result.items)
      setTotal(result.total)
      setPage(nextPage)
      // 刷新下载状态
      void refreshStatuses(result.items, requestSeq)
      if (reset) onRefresh?.()
      if (reset) setStatsRefreshTrigger((n) => n + 1)
    } catch (e) {
      if (requestSeq !== requestSeqRef.current) return

      console.error('加载数据失败:', e)
      toast.error(t('testcases:setsStore.loadFailed'))
      if (reset) setItems([])
      setTotal(0)
    } finally {
      if (requestSeq === requestSeqRef.current) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    if (hasAccess) {
      loadItems(true, 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStage, selectedVendor, selectedLv1, selectedLv2, hasAccess])

  // 当厂商变化时，重置分类
  const handleVendorChange = (value: string) => {
    const vendor = value === 'all' ? '' : value as Vendor
    setSelectedVendor(vendor)
    setSelectedLv1('')
    setSelectedLv2('')
  }

  const handleSearch = () => {
    loadItems(true, 1)
  }

  const refreshStatuses = async (rows: PromptItem[], requestSeq = requestSeqRef.current) => {
    const settled = await Promise.allSettled(
      rows.map(async (row) => {
        try {
          const raw = await LocalDB.GetString(`prompts:${row.id}`)
          return { id: row.id, status: raw ? 'downloaded' : 'none' }
        } catch {
          return { id: row.id, status: 'none' as const }
        }
      }),
    )
    const newMap: Record<number, 'none' | 'downloaded'> = {}
    for (const r of settled) {
      if (r.status === 'fulfilled') {
        newMap[r.value.id] = r.value.status as 'none' | 'downloaded'
      }
    }
    if (requestSeq !== requestSeqRef.current) return

    setStatusById((prev) => ({ ...prev, ...newMap }))
  }

  const openDetails = (row: PromptItem) => {
    setCurrentRow(row)
    setViewOpen(true)
  }

  const handleDownload = async (row: PromptItem, e: React.MouseEvent) => {
    e.stopPropagation()
    const key = `prompts:${row.id}`
    try {
      // 只存储必要字段
      const dataToStore = {
        id: row.id,
        labelLv1: row.labelLv1,
        labelLv2: row.labelLv2,
        promptText: row.promptText,
        expectedOutput: row.expectedOutput,
        promptHash: row.promptHash,
        downloadedAt: Date.now(),
      }
      await LocalDB.PutString(key, JSON.stringify(dataToStore))
      toast.success(t('testcases:setsStore.downloadSuccess'))
      setStatusById((prev) => ({ ...prev, [row.id]: 'downloaded' }))
    } catch {
      toast.error(t('testcases:setsStore.downloadFailed'))
    }
  }

  const getRiskBadge = (level: number | null) => {
    if (level === null) return null
    const variants: Record<number, string> = {
      1: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
      2: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      3: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      4: 'bg-red-500/10 text-red-400 border-red-500/20',
    }
    const labels: Record<number, string> = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical' }
    return (
      <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5", variants[level] || variants[1])}>
        {labels[level] || level}
      </Badge>
    )
  }

  // 无权限提示
  if (hasAccess === false) {
    return (
      <>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-8 text-center">
          <div className="bg-zinc-900/50 text-zinc-500 flex h-16 w-16 items-center justify-center rounded-2xl mx-auto mb-4 border border-zinc-800">
            <CloudIcon className="h-8 w-8" weight="duotone" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-200">{t('testcases:setsStore.pageTitle')}</h3>
          <p className="text-zinc-500 mt-2 max-w-md mx-auto">{t('testcases:setsStore.pageDesc')}</p>
          <div className="text-zinc-600 mt-8">
            {t('testcases:setsStore.noAccessHint')}
          </div>
        </div>
        <NoPermissionDialog
          open={noPermOpen}
          onOpenChange={setNoPermOpen}
          message={t('testcases:setsStore.noAccessMessage')}
        />
      </>
    )
  }

  // 等待权限检查完成
  if (hasAccess === null) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <div key={i} className="h-48 rounded-xl bg-zinc-900/20 border border-zinc-800/50 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <>
      <Card className="border-zinc-800 bg-zinc-900/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-xl">
                <CloudIcon className="h-6 w-6 text-teal-400" weight="duotone" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-xl text-zinc-100">{t('testcases:setsStore.pageTitle')}</CardTitle>
                <CardDescription className="text-sm text-zinc-500">{t('testcases:setsStore.pageDesc')}</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Community Statistics Panel */}
          <CommunityStatsPanel refreshTrigger={statsRefreshTrigger} />

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-3 bg-zinc-900/30 p-1.5 rounded-lg border border-zinc-800/50 w-fit mb-6">
            <Select value={selectedStage || 'all'} onValueChange={(v) => setSelectedStage(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[120px] h-9 bg-zinc-900 border-zinc-800 focus:ring-teal-500/20">
                <SelectValue placeholder={t('testcases:setsStore.selectStage')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <ListDashes className="h-4 w-4 text-zinc-400" />
                    <span>{t('testcases:setsStore.allStages')}</span>
                  </div>
                </SelectItem>
                {stageOptions.map((s) => {
                  const Icon = stageIconMap[s]
                  const colorClass = stageColorMap[s]
                  return (
                    <SelectItem key={s} value={s}>
                      <div className="flex items-center gap-2">
                        {Icon && <Icon className={`h-4 w-4 ${colorClass}`} />}
                        <span>{stageNameMap[s] || s}</span>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            <div className="h-4 w-px bg-zinc-800" />
            <Select value={selectedVendor || 'all'} onValueChange={handleVendorChange}>
              <SelectTrigger className="w-[140px] h-9 bg-zinc-900 border-zinc-800 focus:ring-teal-500/20">
                <SelectValue placeholder={t('testcases:setsStore.selectVendor')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('testcases:setsStore.allVendors')}</SelectItem>
                {vendors.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="h-4 w-px bg-zinc-800" />
            <Select
              value={selectedLv1 || 'all'}
              onValueChange={(v) => setSelectedLv1(v === 'all' ? '' : v)}
              disabled={lv1Options.length === 0}
            >
              <SelectTrigger className="w-[200px] h-9 bg-zinc-900 border-zinc-800 focus:ring-teal-500/20">
                <SelectValue placeholder={t('testcases:setsStore.selectLv1')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('testcases:setsStore.allCategories')}</SelectItem>
                {lv1Options.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Level 2 Subcategory - Hidden or Disabled as it is currently unused/empty */}
            {/* 
            <Select
              value={selectedLv2 || 'all'}
              onValueChange={(v) => setSelectedLv2(v === 'all' ? '' : v)}
              disabled={true}
            >... 
            */}

            <div className="h-4 w-px bg-zinc-800" />
            <div className="flex items-center gap-2 relative">
              <Input
                placeholder={t('testcases:setsStore.searchPlaceholder')}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-[240px] h-9 bg-zinc-900 border-zinc-800 pl-8 focus-visible:ring-teal-500/20"
              />
              <MagnifyingGlassIcon className="absolute left-2.5 h-4 w-4 text-zinc-500" />
              <Button variant="ghost" size="icon" className="h-8 w-8 absolute right-1 hover:bg-zinc-800 text-zinc-400" onClick={handleSearch} disabled={loading}>
                <MagnifyingGlassIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className="h-48 rounded-xl bg-zinc-900/20 border border-zinc-800/50 animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 py-16 text-center">
              <CloudIcon className="mx-auto mb-4 h-12 w-12 text-zinc-600 opacity-50" />
              <p className="text-zinc-500">{t('testcases:setsStore.empty')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map((row) => (
                <Card
                  key={row.id}
                  className="group border-zinc-800 bg-zinc-900/40 backdrop-blur-sm hover:bg-zinc-900/60 hover:border-teal-500/30 transition-all duration-300 flex flex-col cursor-pointer"
                  onClick={() => openDetails(row)}
                >
                  <CardContent className="px-4 py-3 flex flex-col h-full gap-3">
                    {/* Header: Stage Badge + Status */}
                    <div className="flex items-start justify-between">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="bg-zinc-800/50 border-zinc-700 text-zinc-400 text-[10px] h-5 px-1.5">
                          {getStageDisplayName(row.stage)}
                        </Badge>
                        {getRiskBadge(row.riskLevel)}
                      </div>
                      {statusById[row.id] === 'downloaded' ? (
                        <div className="bg-emerald-500/10 text-emerald-500 p-1 rounded-md">
                          <CheckCircleIcon className="h-3.5 w-3.5" weight="fill" />
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-zinc-500 hover:text-teal-400 hover:bg-teal-500/10 -mt-1 -mr-1"
                          onClick={(e) => handleDownload(row, e)}
                        >
                          <DownloadIcon className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    {/* Prompt Preview Text */}
                    <div className="flex-1 bg-zinc-950/50 rounded-lg p-2.5 border border-zinc-800/50 group-hover:border-zinc-700/50 transition-colors">
                      <p className="text-xs text-zinc-300 font-mono line-clamp-4 leading-relaxed opacity-90">
                        {row.finalPrompt || row.promptText}
                      </p>
                    </div>

                    {/* Category Metadata */}
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-1">
                      <TagIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate max-w-[120px]" title={row.labelLv1 || ''}>{row.labelLv1 || '-'}</span>
                      {row.labelLv2 && (
                        <>
                          <span className="text-zinc-700">/</span>
                          <span className="truncate text-zinc-400 group-hover:text-zinc-300 transition-colors" title={row.labelLv2}>{row.labelLv2}</span>
                        </>
                      )}
                    </div>

                    {/* Footer: Tech details */}
                    <div className="pt-3 mt-auto border-t border-zinc-800/50 flex items-center justify-between text-[10px] text-zinc-500">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <span className="text-zinc-600">{t('testcases:setsStore.table.mutation')}</span>
                          <span className="font-mono text-zinc-400">{row.mutation || '-'}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-zinc-600">{t('testcases:setsStore.table.loader')}</span>
                          <span className="font-mono text-zinc-400">{row.loader || '-'}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-zinc-600">ID</span>
                        <div className="flex items-center gap-1">
                          <HashIcon className="h-3 w-3" />
                          <span className="font-mono">{row.id}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="mt-4">
            <PaginationRow
              total={total}
              page={page}
              pageCount={pageCount}
              loading={loading}
              onPrev={() => loadItems(false, page - 1)}
              onNext={() => loadItems(false, page + 1)}
            />
          </div>
        </CardContent>
      </Card>

      {/* 查看详情对话框 */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto bg-zinc-950 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 flex items-center gap-2">
              <CloudIcon className="h-5 w-5 text-teal-500" />
              {t('testcases:setsStore.detailsTitle')}
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              {currentRow?.labelLv1} {currentRow?.labelLv2 && `/ ${currentRow.labelLv2}`}
            </DialogDescription>
          </DialogHeader>
          {currentRow && (
            <div className="space-y-6 text-sm">
              {/* Meta Grid */}
              <div className="grid grid-cols-4 gap-4 p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50">
                <div>
                  <span className="text-muted-foreground text-xs block mb-1.5">{t('testcases:setsStore.detail.stage')}</span>
                  <div className="font-medium text-zinc-200">{getStageDisplayName(currentRow.stage)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs block mb-1.5">{t('testcases:setsStore.detail.mutation')}</span>
                  <div className="font-medium text-zinc-200">{currentRow.mutation || '-'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs block mb-1.5">{t('testcases:setsStore.detail.loader')}</span>
                  <div className="font-medium text-zinc-200">{currentRow.loader || '-'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs block mb-1.5">{t('testcases:setsStore.detail.riskLevel')}</span>
                  <div>{getRiskBadge(currentRow.riskLevel)}</div>
                </div>
              </div>

              {/* Prompt Text */}
              <div className="space-y-2">
                <div className="text-zinc-400 font-medium flex items-center gap-2">
                  <WarningIcon className="h-4 w-4" />
                  {t('testcases:setsStore.promptText')}
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 text-zinc-300 font-mono text-sm leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {currentRow.promptText}
                </div>
              </div>

              {/* Expected Output */}
              {currentRow.expectedOutput && (
                <div className="space-y-2">
                  <div className="text-zinc-400 font-medium flex items-center gap-2">
                    <CheckCircleIcon className="h-4 w-4" />
                    {t('testcases:setsStore.expectedOutput')}
                  </div>
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 text-zinc-300 font-mono text-sm leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {currentRow.expectedOutput}
                  </div>
                </div>
              )}

              {/* Hash & Tags */}
              <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                <div className="flex gap-4 text-xs text-zinc-500 font-mono">
                  <div className="flex gap-2">
                    <span>{t('testcases:setsStore.detail.promptHash')}:</span>
                    <span className="text-zinc-400">{currentRow.promptHash.substring(0, 12)}...</span>
                  </div>
                  {currentRow.fatherHash && (
                    <div className="flex gap-2">
                      <span>{t('testcases:setsStore.detail.fatherHash')}:</span>
                      <span className="text-zinc-400">{currentRow.fatherHash.substring(0, 12)}...</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {currentRow.source && <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">{currentRow.source}</Badge>}
                  {currentRow.version && <Badge variant="outline" className="border-zinc-700 text-zinc-500">{currentRow.version}</Badge>}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
