import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Database,
    Settings2,
    ChevronDown,
    ChevronRight,
    Eye,
    XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { scanner } from '../../../../../wailsjs/go/models'

interface EvaluationDatasetSelectorProps {
    successSteps: scanner.StepResult[]
    selectedStepIds: Set<string>
    onSelectAll: () => void
    selectAll: boolean
    onConfigOpen: () => void
    requestField?: string
    responseField?: string
    onRemoveStep: (stepKey: string) => void
}

// Helper to extract field
function getValueByPath(obj: unknown, path: string): unknown {
    if (!path || !obj) return obj
    const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.')
    let current: unknown = obj
    for (const part of parts) {
        if (current === null || current === undefined) return undefined
        if (typeof current === 'object') {
            current = (current as Record<string, unknown>)[part]
        } else {
            return undefined
        }
    }
    return current
}

function extractField(jsonStr: string, fieldPath: string): string {
    if (!jsonStr || !fieldPath) return jsonStr || ''
    try {
        const parsed = JSON.parse(jsonStr)
        const value = getValueByPath(parsed, fieldPath)
        if (value === undefined || value === null) return ''
        if (typeof value === 'string') return value
        return JSON.stringify(value)
    } catch {
        return jsonStr || ''
    }
}

export function EvaluationDatasetSelector({
    successSteps,
    selectedStepIds,
    onSelectAll,
    selectAll,
    onConfigOpen,
    requestField,
    responseField,
    onRemoveStep,
}: EvaluationDatasetSelectorProps) {
    const { t } = useTranslation()
    const [isDataExpanded, setIsDataExpanded] = useState(false)

    return (
        <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/20 p-4">
            <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="bg-blue-500/10 p-1.5 rounded-lg border border-blue-500/20">
                        <Database className="h-4 w-4 text-blue-400" />
                    </div>
                    <Label className="font-semibold text-zinc-300">{t('task:details.evaluation.datasetLabel')}</Label>
                    <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 hover:bg-zinc-700 pointer-events-none">
                        {t('task:details.evaluation.successCount', { count: successSteps.length })}
                    </Badge>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onSelectAll}
                        className="border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 bg-zinc-900"
                    >
                        {selectAll
                            ? t('task:details.evaluation.deselectAll')
                            : t('task:details.evaluation.selectAll')}
                    </Button>

                    <Button
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-900/20"
                        disabled={selectedStepIds.size === 0}
                        onClick={onConfigOpen}
                    >
                        <Settings2 className="mr-2 h-4 w-4" />
                        {t('task:details.evaluation.configEval')}
                    </Button>
                </div>
            </div>
            <p className="text-zinc-500 text-sm">
                {t('task:details.evaluation.datasetHint')}
            </p>

            {/* 已选数据折叠预览 */}
            {selectedStepIds.size > 0 && (
                <Collapsible open={isDataExpanded} onOpenChange={setIsDataExpanded} className="mt-3">
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="flex items-center gap-1 px-2 text-zinc-400 hover:text-white hover:bg-zinc-800">
                            {isDataExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                            ) : (
                                <ChevronRight className="h-4 w-4" />
                            )}
                            {t('task:details.evaluation.selectedCount', { count: selectedStepIds.size })}
                        </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <ScrollArea className="mt-2 h-[300px] rounded-lg border border-zinc-800 bg-zinc-950/30">
                            <div className="p-2 space-y-3">
                                {successSteps
                                    .filter((s) => selectedStepIds.has(`${s.runID}-${s.sampleID}-${s.attempt}`))
                                    .map((step, idx) => {
                                        const stepKey = `${step.runID}-${step.sampleID}-${step.attempt}`
                                        const prompt = requestField
                                            ? extractField(step.reqPreview || '', requestField)
                                            : step.reqPreview || ''
                                        const response = responseField
                                            ? extractField(step.responseBody || step.respPreview || '', responseField)
                                            : step.respPreview || ''
                                        return (
                                            <div key={stepKey} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-xs">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-zinc-400">#{idx + 1}</span>
                                                        <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">
                                                            {step.sampleID || `item-${idx + 1}`}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        {/* 查看完整内容 */}
                                                        <Dialog>
                                                            <DialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-400 hover:text-white hover:bg-zinc-800">
                                                                    <Eye className="h-3 w-3" />
                                                                </Button>
                                                            </DialogTrigger>
                                                            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-zinc-950/95 border-zinc-800 backdrop-blur-xl">
                                                                <DialogHeader>
                                                                    <DialogTitle className="text-white">
                                                                        {t('task:details.evaluation.preview.title', { index: idx + 1 })}
                                                                    </DialogTitle>
                                                                </DialogHeader>
                                                                <div className="space-y-4 pt-4">
                                                                    <div>
                                                                        <Label className="text-zinc-400 text-xs uppercase tracking-wider font-semibold">
                                                                            {t('task:details.evaluation.preview.request')}
                                                                        </Label>
                                                                        <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-xs whitespace-pre-wrap text-zinc-300 font-mono">
                                                                            {prompt || '-'}
                                                                        </pre>
                                                                    </div>
                                                                    <div>
                                                                        <Label className="text-zinc-400 text-xs uppercase tracking-wider font-semibold">
                                                                            {t('task:details.evaluation.preview.response')}
                                                                        </Label>
                                                                        <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-xs whitespace-pre-wrap text-zinc-300 font-mono">
                                                                            {response || '-'}
                                                                        </pre>
                                                                    </div>
                                                                </div>
                                                            </DialogContent>
                                                        </Dialog>
                                                        {/* 取消选择 */}
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-red-500/70 hover:text-red-400 hover:bg-red-500/10"
                                                            onClick={() => {
                                                                onRemoveStep(stepKey)
                                                                /* Logic handled by parent */
                                                            }}
                                                        >
                                                            <XCircle className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                {/* 请求预览 */}
                                                <div className="mb-2">
                                                    <span className="text-zinc-500">{t('task:details.evaluation.preview.request')}:</span>
                                                    <p className="mt-1 line-clamp-2 text-zinc-300 bg-zinc-950/50 rounded p-1.5 border border-zinc-800/50">{prompt || '-'}</p>
                                                </div>
                                                {/* 响应预览 */}
                                                <div>
                                                    <span className="text-zinc-500">{t('task:details.evaluation.preview.response')}:</span>
                                                    <p className="mt-1 line-clamp-2 text-zinc-300 bg-zinc-950/50 rounded p-1.5 border border-zinc-800/50">{response || '-'}</p>
                                                </div>
                                            </div>
                                        )
                                    })}
                            </div>
                        </ScrollArea>
                    </CollapsibleContent>
                </Collapsible>
            )}
        </div>
    )
}
