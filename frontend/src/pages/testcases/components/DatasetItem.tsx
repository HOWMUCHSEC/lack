import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  ChevronDown,
  ChevronRight,
  Trash2,
  Eye,
  MoreHorizontal,
  Database,
  FileText,
  Copy,
  Globe,
  Users,
} from 'lucide-react'
import type { UnifiedDataset, Sample, HfDatasetMeta, LocalHfRow } from './types'

interface DatasetItemProps {
  dataset: UnifiedDataset
  isExpanded: boolean
  onToggle: () => void
  // 本地生成样本相关
  samples: Sample[]
  onViewSample: (sample: Sample) => void
  onCopySample: (content: string) => void
  onDeleteSample: (setId: string, sampleId: string) => void
  // HF 数据集相关
  hfPreviewRows: LocalHfRow[]
  hfPreviewMeta: HfDatasetMeta | null
  onLoadHfPreview: (meta: HfDatasetMeta) => void
  // 删除
  onDelete: () => void
}

export function DatasetItem({
  dataset,
  isExpanded,
  onToggle,
  samples,
  onViewSample,
  onCopySample,
  onDeleteSample,
  hfPreviewRows,
  hfPreviewMeta,
  onLoadHfPreview,
  onDelete,
}: DatasetItemProps) {
  const { t } = useTranslation()

  const formatDate = (ts: number) => new Date(ts).toLocaleString()

  const renderVariables = (vars: Record<string, string>) => {
    const entries = Object.entries(vars)
    if (entries.length === 0) return '-'
    return entries.map(([k, v]) => `${k}=${v}`).join(', ')
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="rounded-lg border">
        <CollapsibleTrigger asChild>
          <div className="hover:bg-muted/50 flex cursor-pointer items-center justify-between p-4">
            <div className="flex items-center gap-3">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{dataset.name}</span>
                  <Badge
                    variant={dataset.source === 'generated' ? 'outline' : 'secondary'}
                    className="text-xs"
                  >
                    {dataset.source === 'generated' && (
                      <>
                        <Database className="mr-1 h-3 w-3" />
                        {t('samples:source.generated')}
                      </>
                    )}
                    {dataset.source === 'public' && (
                      <>
                        <Globe className="mr-1 h-3 w-3" />
                        {t('samples:source.public')}
                      </>
                    )}
                    {dataset.source === 'community' && (
                      <>
                        <Users className="mr-1 h-3 w-3" />
                        {t('samples:source.community')}
                      </>
                    )}
                  </Badge>
                </div>
                {dataset.description && (
                  <div className="text-muted-foreground text-sm">{dataset.description}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="secondary">
                <FileText className="mr-1 h-3 w-3" />
                {dataset.count} {t('samples:sampleCount')}
              </Badge>
              <span className="text-muted-foreground text-sm">
                {formatDate(dataset.createdAt)}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete()
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('samples:actions.deleteSet')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t p-4">
            {dataset.source === 'generated' && dataset.sampleSet && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>{t('samples:table.content')}</TableHead>
                    <TableHead>{t('samples:table.variables')}</TableHead>
                    <TableHead className="text-right">
                      {t('samples:table.actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {samples.map((sample, idx) => (
                    <TableRow key={sample.id}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="max-w-md">
                        <div className="line-clamp-2">{sample.generatedContent}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {renderVariables(sample.variables)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onViewSample(sample)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onCopySample(sample.generatedContent)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => onDeleteSample(dataset.sampleSet!.id, sample.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {samples.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-muted-foreground py-8 text-center"
                      >
                        {t('samples:table.empty')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
            {dataset.source === 'public' && dataset.hfMeta && (
              <div className="space-y-4">
                {hfPreviewRows.length > 0 && hfPreviewMeta?.hfRepoId === dataset.hfMeta.hfRepoId ? (
                  hfPreviewRows.map((row, idx) => (
                    <div key={row.id} className="rounded-lg border p-4">
                      <div className="text-muted-foreground mb-2 text-sm">#{idx + 1}</div>
                      <pre className="bg-muted overflow-x-auto rounded p-3 text-sm whitespace-pre-wrap">
                        {JSON.stringify(row.data, null, 2)}
                      </pre>
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground py-4 text-center">
                    <Button variant="outline" onClick={() => onLoadHfPreview(dataset.hfMeta!)}>
                      <Eye className="mr-2 h-4 w-4" />
                      {t('samples:publicDatasets.loadPreview')}
                    </Button>
                  </div>
                )}
              </div>
            )}
            {dataset.source === 'community' && dataset.communityPrompt && (
              <div className="space-y-4">
                <div className="rounded-lg border p-4">
                  <div className="text-muted-foreground mb-2 text-xs font-medium">
                    {t('testcases:setsStore.promptText')}
                  </div>
                  <pre className="bg-muted overflow-x-auto rounded p-3 text-sm whitespace-pre-wrap">
                    {dataset.communityPrompt.promptText}
                  </pre>
                </div>
                {dataset.communityPrompt.expectedOutput && (
                  <div className="rounded-lg border p-4">
                    <div className="text-muted-foreground mb-2 text-xs font-medium">
                      {t('testcases:setsStore.expectedOutput')}
                    </div>
                    <pre className="bg-muted overflow-x-auto rounded p-3 text-sm whitespace-pre-wrap">
                      {dataset.communityPrompt.expectedOutput}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
