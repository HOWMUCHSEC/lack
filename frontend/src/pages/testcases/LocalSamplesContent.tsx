import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DatabaseIcon,
  ArrowsClockwiseIcon,
  TrashIcon,
  EyeIcon,
  CopyIcon,
  GlobeIcon,
  CloudIcon,
  DotsThreeIcon,
  FileTextIcon,
  ListNumbersIcon,
  CalendarBlankIcon,
  MagnifyingGlassIcon,
  XIcon
} from '@phosphor-icons/react'
import * as SampleService from '../../../wailsjs/go/main/SampleService'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  type SampleSet,
  type Sample,
  type HfDatasetMeta,
  type LocalHfRow,
  type UnifiedDataset,
  type CommunityPrompt,
  SampleDetailDialog,
  HfPreviewDialog,
} from './components'

export default function LocalSamplesContent({ onRefresh }: { onRefresh?: () => void }) {
  const { t } = useTranslation()
  const [sampleSets, setSampleSets] = useState<SampleSet[]>([])
  const [samplesMap, setSamplesMap] = useState<Record<string, Sample[]>>({})
  const [loading, setLoading] = useState(false)
  const [viewSample, setViewSample] = useState<Sample | null>(null)
  const [deleteSetId, setDeleteSetId] = useState<string | null>(null)
  const [deleteSampleId, setDeleteSampleId] = useState<{ setId: string; sampleId: string } | null>(null)

  // 搜索相关 state
  const [searchInput, setSearchInput] = useState('')
  const [committedSearchQuery, setCommittedSearchQuery] = useState('')
  const searchTimeoutRef = useRef<number | null>(null)

  // HF 数据集相关 state
  const [hfDatasets, setHfDatasets] = useState<HfDatasetMeta[]>([])
  const [hfPreviewOpen, setHfPreviewOpen] = useState(false)
  const [hfPreviewMeta, setHfPreviewMeta] = useState<HfDatasetMeta | null>(null)
  const [hfPreviewRows, setHfPreviewRows] = useState<LocalHfRow[]>([])
  const [hfPreviewLoading, setHfPreviewLoading] = useState(false)

  // 核心样本相关 state
  const [communityPrompts, setCommunityPrompts] = useState<CommunityPrompt[]>([])

  // 查看数据集详情Dialog state
  const [viewSetOpen, setViewSetOpen] = useState(false)
  const [currentSet, setCurrentSet] = useState<UnifiedDataset | null>(null)

  const loadSampleSets = useCallback(async (query?: string) => {
    setLoading(true)
    try {
      const searchTerm = query ?? committedSearchQuery
      let result
      if (searchTerm.trim()) {
        result = await SampleService.SearchSampleSets(searchTerm.trim(), 0, 100)
      } else {
        result = await SampleService.ListSampleSets(0, 100)
      }
      setSampleSets((result.items as SampleSet[]) || [])
      onRefresh?.()
    } catch (e) {
      toast.error(t('samples:toasts.loadFailed'))
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [t, committedSearchQuery, onRefresh])

  const commitSearchQuery = useCallback((query: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
      searchTimeoutRef.current = null
    }

    searchTimeoutRef.current = window.setTimeout(() => {
      setCommittedSearchQuery(query)
      searchTimeoutRef.current = null
    }, 300)
  }, [])

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  const loadHfDatasets = useCallback(async () => {
    try {
      const result = await SampleService.ListDownloadedHfDatasets()
      setHfDatasets(result || [])
    } catch (e) {
      console.error('加载 HF 数据集失败:', e)
    }
  }, [])

  const loadCommunityPrompts = useCallback(async () => {
    try {
      const result = await SampleService.ListDownloadedCommunityPrompts()
      setCommunityPrompts(result || [])
    } catch (e) {
      console.error('加载核心样本失败:', e)
    }
  }, [])

  useEffect(() => {
    loadSampleSets(committedSearchQuery)
  }, [loadSampleSets, committedSearchQuery])

  useEffect(() => {
    loadHfDatasets()
    loadCommunityPrompts()
  }, [loadHfDatasets, loadCommunityPrompts])

  // 格式化 HF 数据集名称
  const formatHfDatasetName = (d: HfDatasetMeta) => {
    let name = d.hfRepoId
    if (d.config) name += ` / ${d.config}`
    if (d.split) name += ` (${d.split})`
    return name
  }

  // 合并所有数据集为统一列表（带搜索过滤）
  const unifiedDatasets = useMemo((): UnifiedDataset[] => {
    const datasets: UnifiedDataset[] = []
    const query = committedSearchQuery.trim().toLowerCase()

    // 帮助函数：检查字符串是否包含查询词
    const matchesQuery = (text: string | undefined) => {
      if (!query) return true
      return text?.toLowerCase().includes(query) ?? false
    }

    // 本地样本集（后端已过滤）
    for (const set of sampleSets) {
      datasets.push({
        id: `generated:${set.id}`,
        name: set.name,
        description: set.description,
        source: 'generated',
        count: set.sampleCount,
        createdAt: set.createdAt,
        sampleSet: set,
      })
    }

    // HF 数据集（前端过滤）
    for (const meta of hfDatasets) {
      const name = formatHfDatasetName(meta)
      if (matchesQuery(name)) {
        datasets.push({
          id: `public:${meta.hfRepoId}:${meta.config}:${meta.split}`,
          name,
          source: 'public',
          count: meta.rowCount,
          createdAt: meta.downloadedAt,
          hfMeta: meta,
        })
      }
    }

    // 核心样本（前端过滤）
    for (const prompt of communityPrompts) {
      const promptPreview = prompt.promptText.slice(0, 50) + (prompt.promptText.length > 50 ? '...' : '')
      const description = `${prompt.labelLv1 || ''} / ${prompt.labelLv2 || ''}`
      if (matchesQuery(promptPreview) || matchesQuery(prompt.labelLv1) || matchesQuery(prompt.labelLv2)) {
        datasets.push({
          id: `community:${prompt.id}`,
          name: promptPreview,
          description,
          source: 'community',
          count: 1,
          createdAt: prompt.downloadedAt || Date.now(),
          communityPrompt: prompt,
        })
      }
    }

    return datasets.sort((a, b) => b.createdAt - a.createdAt)
  }, [sampleSets, hfDatasets, communityPrompts, committedSearchQuery])

  const loadSamplesForSet = async (setId: string) => {
    if (samplesMap[setId]) return
    try {
      const result = await SampleService.ListSamplesBySet(setId, 0, 500)
      setSamplesMap((prev) => ({
        ...prev,
        [setId]: (result.items as Sample[]) || [],
      }))
    } catch (e) {
      toast.error(t('samples:toasts.loadSamplesFailed'))
      console.error(e)
    }
  }

  const handleOpenSet = async (dataset: UnifiedDataset) => {
    if (dataset.source === 'generated' && dataset.sampleSet) {
      await loadSamplesForSet(dataset.sampleSet.id)
      setCurrentSet(dataset)
      setViewSetOpen(true)
    } else if (dataset.source === 'public' && dataset.hfMeta) {
      handleHfPreview(dataset.hfMeta)
    } else if (dataset.source === 'community' && dataset.communityPrompt) {
      // TODO: Maybe open a detailed view for community prompt
      // For now, we can show it in the generic dialog or handle it separately
      setCurrentSet(dataset)
      setViewSetOpen(true)
    }
  }

  const handleDeleteSet = async () => {
    if (!deleteSetId) return
    try {
      await SampleService.DeleteSampleSet(deleteSetId)
      toast.success(t('samples:toasts.deleteSuccess'))
      setSampleSets((prev) => prev.filter((s) => s.id !== deleteSetId))
      setSamplesMap((prev) => {
        const copy = { ...prev }
        delete copy[deleteSetId]
        return copy
      })
      onRefresh?.()
    } catch (e) {
      toast.error(t('samples:toasts.deleteFailed'))
      console.error(e)
    } finally {
      setDeleteSetId(null)
    }
  }

  const handleCopyContent = (content: string) => {
    navigator.clipboard.writeText(content)
    toast.success(t('samples:toasts.copied'))
  }

  const handleDeleteSample = async () => {
    if (!deleteSampleId) return
    const { setId, sampleId } = deleteSampleId
    try {
      await SampleService.DeleteSample(sampleId)
      toast.success(t('samples:toasts.sampleDeleted'))
      setSamplesMap((prev) => ({
        ...prev,
        [setId]: (prev[setId] || []).filter((s) => s.id !== sampleId),
      }))
      setSampleSets((prev) =>
        prev.map((set) => (set.id === setId ? { ...set, sampleCount: set.sampleCount - 1 } : set)),
      )
      onRefresh?.()
    } catch (e) {
      toast.error(t('samples:toasts.sampleDeleteFailed'))
      console.error(e)
    } finally {
      setDeleteSampleId(null)
    }
  }

  const handleHfPreview = async (meta: HfDatasetMeta) => {
    setHfPreviewMeta(meta)
    setHfPreviewOpen(true)
    setHfPreviewLoading(true)
    setHfPreviewRows([])

    try {
      const result = await SampleService.GetHfDatasetRows(meta.hfRepoId, meta.config, meta.split, 0, 10)
      setHfPreviewRows((result.items || []) as LocalHfRow[])
    } catch (e) {
      console.error('加载本地数据失败:', e)
      toast.error(t('samples:publicDatasets.previewFailed'))
    } finally {
      setHfPreviewLoading(false)
    }
  }

  const handleDeleteHfDataset = async (meta: HfDatasetMeta) => {
    try {
      await SampleService.DeleteHfDataset(meta.hfRepoId, meta.config, meta.split)
      toast.success(t('samples:publicDatasets.deleteSuccess'))
      loadHfDatasets()
      onRefresh?.()
    } catch (e) {
      console.error('删除失败:', e)
      toast.error(t('samples:publicDatasets.deleteFailed'))
    }
  }

  const handleDeleteCommunityPrompt = async (id: number) => {
    try {
      await SampleService.DeleteCommunityPrompt(id)
      toast.success(t('samples:communityPrompts.deleteSuccess'))
      loadCommunityPrompts()
      onRefresh?.()
    } catch (e) {
      console.error('删除失败:', e)
      toast.error(t('samples:communityPrompts.deleteFailed'))
    }
  }

  const handleDatasetDelete = (dataset: UnifiedDataset, e: React.MouseEvent) => {
    e.stopPropagation()
    if (dataset.source === 'generated' && dataset.sampleSet) {
      setDeleteSetId(dataset.sampleSet.id)
    } else if (dataset.source === 'public' && dataset.hfMeta) {
      handleDeleteHfDataset(dataset.hfMeta)
    } else if (dataset.source === 'community' && dataset.communityPrompt) {
      handleDeleteCommunityPrompt(dataset.communityPrompt.id)
    }
  }

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'generated': return <DatabaseIcon className="h-4 w-4 text-violet-500" />
      case 'public': return <GlobeIcon className="h-4 w-4 text-sky-500" />
      case 'community': return <CloudIcon className="h-4 w-4 text-teal-500" />
      default: return <DatabaseIcon className="h-4 w-4" />
    }
  }

  const renderVariables = (vars: Record<string, string>) => {
    const entries = Object.entries(vars)
    if (entries.length === 0) return '-'
    return entries.map(([k, v]) => `${k}=${v}`).join(', ')
  }

  return (
    <>
      <Card className="border-zinc-800 bg-zinc-900/20">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-xl">
                <DatabaseIcon className="h-6 w-6 text-violet-400" weight="duotone" />
              </div>
              <div>
                <CardTitle className="text-xl text-zinc-100">{t('samples:pageTitle')}</CardTitle>
                <CardDescription className="mt-1 text-zinc-500">{t('samples:pageDesc')}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  type="text"
                  placeholder={t('samples:searchPlaceholder')}
                  value={searchInput}
                  onChange={(e) => {
                    const value = e.target.value
                    setSearchInput(value)
                    commitSearchQuery(value)
                  }}
                  className="w-56 pl-9 pr-8 border-zinc-700 bg-zinc-800/50 text-zinc-300 placeholder:text-zinc-600 focus:border-violet-500/50"
                />
                {searchInput && (
                  <button
                    onClick={() => {
                      if (searchTimeoutRef.current) {
                        clearTimeout(searchTimeoutRef.current)
                        searchTimeoutRef.current = null
                      }
                      setSearchInput('')
                      setCommittedSearchQuery('')
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button variant="outline" onClick={() => loadSampleSets()} disabled={loading} className="border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800 hover:text-white">
                <ArrowsClockwiseIcon className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {t('common:common.refresh')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && unifiedDatasets.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-40 rounded-xl bg-zinc-900/20 border border-zinc-800/50 animate-pulse" />
              ))}
            </div>
          ) : unifiedDatasets.length === 0 ? (
            <div className="text-muted-foreground py-16 text-center border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-900/10">
              <DatabaseIcon className="mx-auto mb-4 h-12 w-12 opacity-30 text-violet-500" />
              <p className="text-zinc-500 font-medium">{t('samples:empty')}</p>
              <p className="mt-2 text-sm text-zinc-600 max-w-sm mx-auto">{t('samples:emptyHint')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {unifiedDatasets.map((dataset) => (
                <Card
                  key={dataset.id}
                  className="group border-zinc-800 bg-zinc-900/40 backdrop-blur-sm hover:bg-zinc-900/60 hover:border-violet-500/30 transition-all duration-300 flex flex-col cursor-pointer overflow-hidden"
                  onClick={() => handleOpenSet(dataset)}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800/50 group-hover:border-zinc-700 transition-colors shrink-0">
                          {getSourceIcon(dataset.source)}
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="font-semibold text-zinc-200 text-sm cursor-help">
                              {dataset.name.length > 20 ? dataset.name.slice(0, 20) + '...' : dataset.name}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent
                            side="bottom"
                            className="max-w-md break-words bg-zinc-900 border border-zinc-700 text-zinc-100"
                            sideOffset={5}
                          >
                            <p className="whitespace-normal">{dataset.name}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-zinc-300 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <DotsThreeIcon className="h-5 w-5" weight="bold" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-zinc-950 border-zinc-800">
                          <DropdownMenuItem className="text-red-400 focus:text-red-300 focus:bg-red-500/10" onClick={(e) => handleDatasetDelete(dataset, e)}>
                            <TrashIcon className="mr-2 h-4 w-4" />
                            {t('common:common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {dataset.description && (
                      <div className="text-xs text-zinc-500 truncate mt-2" title={dataset.description}>
                        {dataset.description}
                      </div>
                    )}
                  </CardHeader>
                  <CardFooter className="p-4 pt-0 mt-auto flex items-center justify-between border-t border-zinc-800/50 bg-zinc-950/20 pt-3">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <ListNumbersIcon className="h-3.5 w-3.5" />
                      <span>{dataset.count} {t('samples:sampleCount')}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                      <CalendarBlankIcon className="h-3.5 w-3.5" />
                      <span>{new Date(dataset.createdAt).toLocaleDateString()}</span>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Dataset Details Dialog (Unified) */}
      <Dialog open={viewSetOpen} onOpenChange={setViewSetOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col bg-zinc-950 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-zinc-100">
              {currentSet && getSourceIcon(currentSet.source)}
              <span className="truncate flex-1 text-base">{currentSet?.name}</span>
            </DialogTitle>
            <DialogDescription className="truncate">
              {currentSet?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto border rounded-md border-zinc-800 bg-zinc-900/30 -mx-2">
            {currentSet?.source === 'generated' && currentSet.sampleSet && (
              <Table>
                <TableHeader className="bg-zinc-900/50 sticky top-0 z-10 backdrop-blur-sm">
                  <TableRow className="hover:bg-transparent border-zinc-800">
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>{t('samples:table.content')}</TableHead>
                    <TableHead>{t('samples:table.variables')}</TableHead>
                    <TableHead className="text-right w-[120px]">{t('samples:table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(samplesMap[currentSet.sampleSet.id] || []).map((sample, idx) => (
                    <TableRow key={sample.id} className="border-zinc-800 hover:bg-zinc-900/50">
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="max-w-md">
                        <div className="line-clamp-2 text-zinc-300 font-mono text-sm">{sample.generatedContent}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs font-mono">
                        {renderVariables(sample.variables)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewSample(sample)}>
                            <EyeIcon className="h-3.5 w-3.5 text-zinc-500" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyContent(sample.generatedContent)}>
                            <CopyIcon className="h-3.5 w-3.5 text-zinc-500" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500/70 hover:text-red-400" onClick={() => setDeleteSampleId({ setId: currentSet.sampleSet!.id, sampleId: sample.id })}>
                            <TrashIcon className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(samplesMap[currentSet.sampleSet.id] || []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        {t('samples:table.empty')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}

            {currentSet?.source === 'community' && currentSet.communityPrompt && (
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                    <FileTextIcon className="h-4 w-4" />
                    {t('testcases:setsStore.promptText')}
                  </h4>
                  <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 font-mono text-sm text-zinc-300 whitespace-pre-wrap">
                    {currentSet.communityPrompt.promptText}
                  </div>
                </div>
                {currentSet.communityPrompt.expectedOutput && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                      <EyeIcon className="h-4 w-4" />
                      {t('testcases:setsStore.expectedOutput')}
                    </h4>
                    <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 font-mono text-sm text-zinc-300 whitespace-pre-wrap">
                      {currentSet.communityPrompt.expectedOutput}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <SampleDetailDialog
        sample={viewSample}
        onClose={() => setViewSample(null)}
        onCopy={handleCopyContent}
      />

      <HfPreviewDialog
        open={hfPreviewOpen}
        onOpenChange={setHfPreviewOpen}
        meta={hfPreviewMeta}
        rows={hfPreviewRows}
        loading={hfPreviewLoading}
      />

      <ConfirmDialog
        open={!!deleteSetId}
        onOpenChange={() => setDeleteSetId(null)}
        title={t('samples:dialog.deleteTitle')}
        description={t('samples:dialog.deleteDesc')}
        onConfirm={handleDeleteSet}
        variant="destructive"
      />

      <ConfirmDialog
        open={!!deleteSampleId}
        onOpenChange={() => setDeleteSampleId(null)}
        title={t('samples:dialog.deleteSampleTitle')}
        description={t('samples:dialog.deleteSampleDesc')}
        onConfirm={handleDeleteSample}
        variant="destructive"
      />
    </>
  )
}
