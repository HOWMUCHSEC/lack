import { useTranslation } from 'react-i18next'
import { FileText, Users, Globe, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'

export interface TestCaseItem {
  id: string
  title: string
  category: string
  status: string
}

export interface CommunityPromptItem {
  id: number
  labelLv1: string
  labelLv2: string
  promptText: string
}

export interface HfDatasetItem {
  id: string
  name: string
  rowCount: number
}

interface DatasetSelectorProps {
  testCases: TestCaseItem[]
  communityPrompts: CommunityPromptItem[]
  hfDatasets: HfDatasetItem[]
  selectedTestCaseIds: string[]
  selectedCommunityIds: string[]
  selectedHfDatasetIds: string[]
  loading: boolean
  onToggleTestCase: (id: string) => void
  onToggleCommunity: (id: string) => void
  onToggleHfDataset: (id: string) => void
  onToggleAllTestCases: () => void
  onToggleAllCommunity: () => void
  onToggleAllHfDatasets: () => void
  onRefresh: () => void
}

export function DatasetSelector({
  testCases,
  communityPrompts,
  hfDatasets,
  selectedTestCaseIds,
  selectedCommunityIds,
  selectedHfDatasetIds,
  loading,
  onToggleTestCase,
  onToggleCommunity,
  onToggleHfDataset,
  onToggleAllTestCases,
  onToggleAllCommunity,
  onToggleAllHfDatasets,
  onRefresh,
}: DatasetSelectorProps) {
  const { t } = useTranslation()

  return (
    <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/20 p-4 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
          <Label className="text-sm font-semibold text-zinc-300">
            {t('task:form.datasetLabel')}
            <span className="text-zinc-500 ml-2 text-xs font-normal">
              ({t('task:form.datasetHintNew', {
                testCases: selectedTestCaseIds.length,
                community: selectedCommunityIds.length,
                hfDatasets: selectedHfDatasetIds.length,
              })})
            </span>
          </Label>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-zinc-400 hover:text-white hover:bg-zinc-800"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {t('common:common.refresh')}
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {/* 测试用例列表 */}
        <DatasetColumn
          icon={FileText}
          title={t('task:form.testCases')}
          items={testCases}
          selectedIds={selectedTestCaseIds}
          loading={loading}
          emptyText={t('task:form.noTestCases')}
          loadingText={t('task:form.loadingDatasets')}
          onToggle={onToggleTestCase}
          onToggleAll={onToggleAllTestCases}
          renderItem={(tc) => tc.title}
          getTooltip={(tc) => tc.title}
          getId={(tc) => tc.id}
          t={t}
          accentColor="text-blue-400"
        />

        {/* 核心样本列表 */}
        <DatasetColumn
          icon={Users}
          title={t('task:form.communityPrompts')}
          items={communityPrompts}
          selectedIds={selectedCommunityIds}
          loading={loading}
          emptyText={t('task:form.noCommunityPrompts')}
          loadingText={t('task:form.loadingDatasets')}
          onToggle={(id) => onToggleCommunity(id)}
          onToggleAll={onToggleAllCommunity}
          renderItem={(cp) => cp.labelLv2 || cp.labelLv1 || cp.promptText.slice(0, 30)}
          getTooltip={(cp) => cp.promptText}
          getId={(cp) => String(cp.id)}
          t={t}
          accentColor="text-green-400"
        />

        {/* 社区样本列表 */}
        <DatasetColumn
          icon={Globe}
          title={t('task:form.hfDatasets')}
          items={hfDatasets}
          selectedIds={selectedHfDatasetIds}
          loading={loading}
          emptyText={t('task:form.noHfDatasets')}
          loadingText={t('task:form.loadingDatasets')}
          onToggle={onToggleHfDataset}
          onToggleAll={onToggleAllHfDatasets}
          renderItem={(hf) => hf.name}
          getTooltip={(hf) => hf.name}
          getId={(hf) => hf.id}
          renderBadge={(hf) => (
            <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-zinc-800 text-zinc-400">
              {hf.rowCount}
            </Badge>
          )}
          t={t}
          accentColor="text-purple-400"
        />
      </div>
    </div>
  )
}

interface DatasetColumnProps<T> {
  icon: React.ElementType
  title: string
  items: T[]
  selectedIds: string[]
  loading: boolean
  emptyText: string
  loadingText: string
  onToggle: (id: string) => void
  onToggleAll: () => void
  renderItem: (item: T) => string
  getTooltip: (item: T) => string
  getId: (item: T) => string
  renderBadge?: (item: T) => React.ReactNode
  t: (key: string) => string
  accentColor?: string
}

function DatasetColumn<T>({
  icon: Icon,
  title,
  items,
  selectedIds,
  loading,
  emptyText,
  loadingText,
  onToggle,
  onToggleAll,
  renderItem,
  getTooltip,
  getId,
  renderBadge,
  t,
  accentColor = "text-zinc-400"
}: DatasetColumnProps<T>) {
  const allSelected = items.length > 0 && selectedIds.length === items.length

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 overflow-hidden">
      <div className="bg-zinc-900/50 flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${accentColor}`}>
          <Icon className="h-4 w-4" />
          {title}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px] text-zinc-500 hover:text-white"
          onClick={onToggleAll}
          disabled={items.length === 0}
        >
          {allSelected ? t('task:form.deselectAll') : t('task:form.selectAll')}
        </Button>
      </div>
      <ScrollArea className="h-[150px]">
        {loading ? (
          <div className="text-zinc-500 flex h-full items-center justify-center text-sm">
            {loadingText}
          </div>
        ) : items.length === 0 ? (
          <div className="text-zinc-500 flex h-full items-center justify-center text-sm">
            {emptyText}
          </div>
        ) : (
          <div className="w-max min-w-full space-y-1 p-2">
            {items.map((item) => {
              const id = getId(item)
              const isSelected = selectedIds.includes(id)
              return (
                <div
                  key={id}
                  className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors ${isSelected ? 'bg-zinc-800/60' : 'hover:bg-zinc-800/30'
                    }`}
                  onClick={() => onToggle(id)}
                >
                  <Checkbox
                    checked={isSelected}
                    onClick={(e) => e.stopPropagation()}
                    onCheckedChange={() => onToggle(id)}
                    className="shrink-0 border-zinc-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={`whitespace-nowrap text-sm ${isSelected ? 'text-zinc-200' : 'text-zinc-400'}`}>
                        {renderItem(item)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs bg-zinc-900 border-zinc-800 text-zinc-300">
                      {getTooltip(item)}
                    </TooltipContent>
                  </Tooltip>
                  {renderBadge?.(item)}
                </div>
              )
            })}
          </div>
        )}
        <ScrollBar orientation="horizontal" className="bg-zinc-900" />
      </ScrollArea>
    </div>
  )
}
