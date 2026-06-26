import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import {
  GlobeIcon,
  CloudArrowDownIcon,
  CheckCircleIcon,
  ArrowsClockwiseIcon,
  EyeIcon,
  SpinnerIcon,
  ArrowSquareOutIcon,
  Database
} from '@phosphor-icons/react'
import {
  listHfDatasetSummaries,
  fetchAllHfRowsByDataset,
  listHfRowsByDataset,
  type HfDatasetSummary,
  type HfRow,
} from '@/services/hfDatasets'
import * as SampleService from '../../../wailsjs/go/main/SampleService'
import { BrowserOpenURL } from '../../../wailsjs/runtime/runtime'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'


interface DownloadState {
  downloading: boolean
  progress: number
  total: number
}

export default function PublicDatasetsContent({ onRefresh }: { onRefresh?: () => void }) {
  const { t } = useTranslation()
  const [datasets, setDatasets] = useState<HfDatasetSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [downloadedMap, setDownloadedMap] = useState<Record<string, boolean>>({})
  const [downloadState, setDownloadState] = useState<Record<string, DownloadState>>({})
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewDataset, setPreviewDataset] = useState<HfDatasetSummary | null>(null)
  const [previewRows, setPreviewRows] = useState<HfRow[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [openUrlConfirm, setOpenUrlConfirm] = useState(false)
  const [pendingUrl, setPendingUrl] = useState('')

  // 生成数据集唯一键
  const makeKey = (d: HfDatasetSummary) => `${d.hfRepoId}|${d.config}|${d.split}`

  // 检查数据集下载状态
  const checkDownloadedStatus = useCallback(async (items: HfDatasetSummary[]) => {
    const statusMap: Record<string, boolean> = {}
    for (const item of items) {
      try {
        const downloaded = await SampleService.IsHfDatasetDownloaded(
          item.hfRepoId,
          item.config,
          item.split,
        )
        statusMap[makeKey(item)] = downloaded
      } catch {
        statusMap[makeKey(item)] = false
      }
    }
    setDownloadedMap(statusMap)
  }, [])

  // 加载数据集列表
  const loadDatasets = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listHfDatasetSummaries()
      setDatasets(result)
      // 检查每个数据集的下载状态
      await checkDownloadedStatus(result)
      onRefresh?.()
    } catch (e) {
      console.error('加载数据集失败:', e)
      toast.error(t('samples:publicDatasets.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t, checkDownloadedStatus, onRefresh])

  useEffect(() => {
    loadDatasets()
  }, [loadDatasets])

  // 下载数据集
  const handleDownload = async (dataset: HfDatasetSummary) => {
    const key = makeKey(dataset)
    setDownloadState((prev) => ({
      ...prev,
      [key]: { downloading: true, progress: 0, total: dataset.count },
    }))

    try {
      // 从云端获取所有数据
      const rows = await fetchAllHfRowsByDataset(
        dataset.hfRepoId,
        dataset.config,
        dataset.split,
        (loaded, total) => {
          setDownloadState((prev) => ({
            ...prev,
            [key]: { downloading: true, progress: loaded, total },
          }))
        },
      )

      // 转换数据格式并保存到本地
      const meta = {
        hfRepoId: dataset.hfRepoId,
        config: dataset.config,
        split: dataset.split,
        rowCount: rows.length,
        downloadedAt: 0,
        updatedAt: 0,
      }

      const localRows = rows.map((r) => ({
        id: r.id,
        hfRepoId: r.hfRepoId,
        config: r.config,
        split: r.split,
        sourceIndex: r.sourceIndex ?? 0,
        data: r.data as Record<string, unknown>,
        checksum: r.checksum ?? '',
        importedAt: r.importedAt,
        updatedAt: r.updatedAt,
        status: r.status,
        extraMetadata: r.extraMetadata ?? {},
      }))

      await SampleService.SaveHfDataset(meta, localRows)

      setDownloadedMap((prev) => ({ ...prev, [key]: true }))
      toast.success(t('samples:publicDatasets.downloadSuccess'))
    } catch (e) {
      console.error('下载失败:', e)
      toast.error(t('samples:publicDatasets.downloadFailed'))
    } finally {
      setDownloadState((prev) => ({
        ...prev,
        [key]: { downloading: false, progress: 0, total: 0 },
      }))
    }
  }

  // 预览数据集
  const handlePreview = async (dataset: HfDatasetSummary) => {
    setPreviewDataset(dataset)
    setPreviewOpen(true)
    setPreviewLoading(true)
    setPreviewRows([])

    try {
      // 只获取前 10 条预览
      const result = await listHfRowsByDataset(
        dataset.hfRepoId,
        dataset.config,
        dataset.split,
        1,
        10,
      )
      setPreviewRows(result.items)
    } catch (e) {
      console.error('预览失败:', e)
      toast.error(t('samples:publicDatasets.previewFailed'))
    } finally {
      setPreviewLoading(false)
    }
  }

  // 格式化数据集名称（按 HuggingFace URL 路径格式拼接）
  // split 用于区分同一数据集的不同划分（train/test/validation）
  const formatDatasetName = (d: HfDatasetSummary, showSplit = true) => {
    let name = d.hfRepoId
    if (d.config) name += `/${d.config}`
    if (showSplit && d.split) name += ` (${d.split})`
    return name
  }

  // 生成 HuggingFace URL
  const buildHfUrl = (d: HfDatasetSummary) => {
    let url = `https://huggingface.co/datasets/${d.hfRepoId}`
    if (d.config) url += `/tree/main/${d.config}`
    return url
  }

  // 点击 URL 时打开确认框
  const handleUrlClick = (url: string) => {
    setPendingUrl(url)
    setOpenUrlConfirm(true)
  }

  // 确认后打开浏览器
  const handleConfirmOpenUrl = () => {
    BrowserOpenURL(pendingUrl)
    setOpenUrlConfirm(false)
    setPendingUrl('')
  }

  return (
    <>
      <Card className="border-zinc-800 bg-zinc-900/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-xl">
                <GlobeIcon className="h-6 w-6 text-sky-500" weight="duotone" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-xl text-zinc-100">{t('samples:publicDatasets.pageTitle')}</CardTitle>
                <CardDescription className="text-sm text-zinc-500">{t('samples:publicDatasets.pageDesc')}</CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={loadDatasets}
              disabled={loading}
              className="border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              <ArrowsClockwiseIcon className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {t('common:common.refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && datasets.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-48 rounded-xl bg-zinc-900/20 border border-zinc-800/50 animate-pulse" />
              ))}
            </div>
          ) : datasets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 py-16 text-center">
              <GlobeIcon className="mx-auto mb-4 h-12 w-12 text-zinc-600 opacity-50" />
              <p className="text-zinc-500">{t('samples:publicDatasets.empty')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {datasets.map((dataset) => {
                const key = makeKey(dataset)
                const isDownloaded = downloadedMap[key]
                const state = downloadState[key]
                const isDownloading = state?.downloading

                return (
                  <Card key={key} className="group border-zinc-800 bg-zinc-900/40 backdrop-blur-sm hover:bg-zinc-900/60 hover:border-violet-500/30 transition-all duration-300">
                    <CardContent className="p-4 pb-2 flex flex-col h-full gap-4">
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex gap-3 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-500">
                            <Database className="h-5 w-5" weight="duotone" />
                          </div>
                          <div className="space-y-0.5 min-w-0">
                            <h3 className="font-semibold text-zinc-200 truncate pr-2" title={dataset.hfRepoId}>
                              {dataset.hfRepoId}
                            </h3>
                            <div
                              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 cursor-pointer w-fit"
                              onClick={() => handleUrlClick(buildHfUrl(dataset))}
                            >
                              <ArrowSquareOutIcon className="h-3 w-3" />
                              <span className="truncate">{t('samples:publicDatasets.viewOnHfShort')}</span>
                            </div>
                          </div>
                        </div>
                        {isDownloaded ? (
                          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shrink-0">
                            <CheckCircleIcon className="mr-1 h-3 w-3" weight="fill" />
                            {t('samples:publicDatasets.downloaded')}
                          </Badge>
                        ) : isDownloading ? (
                          <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20 shrink-0 animate-pulse">
                            <SpinnerIcon className="mr-1 h-3 w-3 animate-spin" />
                            {t('samples:publicDatasets.downloadingStatus')}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-zinc-800 text-zinc-500 border-zinc-700 shrink-0">
                            {t('samples:publicDatasets.available')}
                          </Badge>
                        )}
                      </div>

                      {/* Metadata Grid */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-500 mt-2 bg-zinc-950/30 p-2.5 rounded-lg border border-zinc-800/50">
                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-600">{t('samples:publicDatasets.rowCount')}:</span>
                          <span className="text-zinc-300 font-mono">{dataset.count.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-600">{t('samples:publicDatasets.split')}:</span>
                          <span className="text-zinc-300 font-mono truncate max-w-[80px]" title={dataset.split}>{dataset.split || '-'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-600">{t('samples:publicDatasets.config')}:</span>
                          <span className="text-zinc-300 font-mono truncate max-w-[100px]" title={dataset.config}>{dataset.config || 'default'}</span>
                        </div>
                      </div>

                      {/* Progress Bar (if downloading) */}
                      {isDownloading && (
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs text-blue-400">
                            <span>Downloading...</span>
                            <span>{Math.round((state.progress / state.total) * 100)}%</span>
                          </div>
                          <Progress value={(state.progress / state.total) * 100} className="h-1.5 bg-zinc-800" indicatorClassName="bg-blue-500" />
                        </div>
                      )}

                      {/* Actions */}
                      <div className="mt-auto pt-2 flex items-center justify-end gap-2 border-t border-zinc-800/50">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs gap-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                          onClick={() => handlePreview(dataset)}
                        >
                          <EyeIcon className="h-4 w-4" />
                          {t('samples:publicDatasets.loadPreview')}
                        </Button>
                        {!isDownloaded && !isDownloading && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1.5 border-violet-500/20 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300 hover:border-violet-500/30 bg-transparent"
                            onClick={() => handleDownload(dataset)}
                          >
                            <CloudArrowDownIcon className="h-4 w-4" />
                            {t('samples:publicDatasets.download')}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 云端预览对话框 */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto bg-zinc-950 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">{t('samples:publicDatasets.previewTitle')}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              {previewDataset && formatDatasetName(previewDataset)}
            </DialogDescription>
          </DialogHeader>
          {previewLoading ? (
            <div className="flex items-center justify-center py-8 text-violet-500">
              <SpinnerIcon className="h-8 w-8 animate-spin" />
            </div>
          ) : previewRows.length === 0 ? (
            <div className="text-zinc-500 py-8 text-center">
              {t('samples:publicDatasets.noData')}
            </div>
          ) : (
            <div className="space-y-4">
              {previewRows.map((row, idx) => (
                <div key={row.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                  <div className="text-zinc-500 mb-2 text-sm font-mono">#{idx + 1}</div>
                  <pre className="bg-zinc-950 overflow-x-auto rounded p-3 text-sm text-zinc-300 whitespace-pre-wrap font-mono border border-zinc-800">
                    {JSON.stringify(row.data, null, 2)}
                  </pre>
                </div>
              ))}
              {previewDataset && previewDataset.count > 10 && (
                <div className="text-zinc-500 text-center text-sm">
                  {t('samples:publicDatasets.previewHint', {
                    shown: 10,
                    total: previewDataset.count,
                  })}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 打开外部链接确认对话框 */}
      <AlertDialog open={openUrlConfirm} onOpenChange={setOpenUrlConfirm}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">{t('samples:publicDatasets.openUrlTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {t('samples:publicDatasets.openUrlDesc')}
              <span className="mt-2 block break-all rounded bg-zinc-900 p-2 text-xs font-mono text-zinc-300 border border-zinc-800">
                {pendingUrl}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-800 bg-transparent text-zinc-300 hover:bg-zinc-900 hover:text-white">{t('common:common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmOpenUrl} className="bg-violet-600 hover:bg-violet-700 text-white border-0">
              {t('samples:publicDatasets.openInBrowser')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
