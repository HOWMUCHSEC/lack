import { useTranslation } from 'react-i18next'
import { Play } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { type EvaluatorTemplate } from '@/services/evaluator'
import { FieldMappingConfig, type DatasetFieldInfo } from './FieldMappingConfig'

interface JudgeModel {
    id: string
    name: string
}

interface EvaluationConfigDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    selectedCount: number
    judgeModels: JudgeModel[]
    selectedModelId: string
    onModelIdChange: (id: string) => void
    selectedTemplateId: string
    onTemplateIdChange: (id: string) => void
    loadingTemplates: boolean
    filteredTemplates: { matched: EvaluatorTemplate[]; unmatched: EvaluatorTemplate[] }
    startDisabledReason?: string
    onStart: () => void
    datasetFields?: DatasetFieldInfo[]
    loadingFields?: boolean
    promptField?: string
    onPromptFieldChange?: (field: string) => void
}

export function EvaluationConfigDialog({
    open,
    onOpenChange,
    selectedCount,
    judgeModels,
    selectedModelId,
    onModelIdChange,
    selectedTemplateId,
    onTemplateIdChange,
    loadingTemplates,
    filteredTemplates,
    startDisabledReason,
    onStart,
    datasetFields = [],
    loadingFields = false,
    promptField = '',
    onPromptFieldChange,
}: EvaluationConfigDialogProps) {
    const { t } = useTranslation()

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] bg-zinc-950/95 backdrop-blur-xl border-zinc-800 shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-white flex items-center gap-2">
                        <span className="w-1 h-5 bg-purple-500 rounded-full"></span>
                        {t('task:details.evaluation.configTitle')}
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        {t('task:details.evaluation.configDesc', { count: selectedCount })}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4 max-h-[60vh] overflow-y-auto">
                    {/* 评判模型选择 */}
                    <div className="grid gap-2">
                        <Label className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                            {t('task:details.evaluation.judgeModelLabel')}
                        </Label>
                        <Select value={selectedModelId} onValueChange={onModelIdChange}>
                            <SelectTrigger className="bg-zinc-900/50 border-zinc-800 text-zinc-100 focus:ring-purple-500/30">
                                <SelectValue placeholder={t('task:details.evaluation.selectModel')} />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800">
                                {judgeModels.length === 0 ? (
                                    <SelectItem value="__empty__" disabled className="text-zinc-500">
                                        {t('task:details.evaluation.noJudgeModels')}
                                    </SelectItem>
                                ) : (
                                    judgeModels.map((m) => (
                                        <SelectItem key={m.id} value={m.id} className="text-zinc-100 focus:bg-zinc-800 focus:text-white">
                                            {m.name}
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                    {/* 评测模板选择 */}
                    <div className="grid gap-2">
                        <Label className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                            {t('task:details.evaluation.templateLabel')}
                        </Label>
                        <Select
                            value={selectedTemplateId}
                            onValueChange={onTemplateIdChange}
                            disabled={loadingTemplates}
                        >
                            <SelectTrigger className="bg-zinc-900/50 border-zinc-800 text-zinc-100 focus:ring-purple-500/30">
                                <SelectValue
                                    placeholder={
                                        loadingTemplates
                                            ? t('task:details.evaluation.loadingTemplates')
                                            : t('task:details.evaluation.selectTemplate')
                                    }
                                />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800">
                                {/* 匹配的模板（推荐） */}
                                {filteredTemplates.matched.map((tpl) => (
                                    <SelectItem key={tpl.id} value={tpl.id} className="text-zinc-100 focus:bg-zinc-800 focus:text-white">
                                        <span className="flex items-center gap-2 w-full justify-between">
                                            {tpl.name_zh || tpl.name}
                                            <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-emerald-900/30 text-emerald-400 border-emerald-800">
                                                {t('task:details.evaluation.recommended')}
                                            </Badge>
                                        </span>
                                    </SelectItem>
                                ))}
                                {/* 不匹配的模板 */}
                                {filteredTemplates.unmatched.map((tpl) => (
                                    <SelectItem key={tpl.id} value={tpl.id} className="text-zinc-400 focus:bg-zinc-800 focus:text-white">
                                        {tpl.name_zh || tpl.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* 字段映射配置 */}
                    {(datasetFields.length > 0 || loadingFields) && onPromptFieldChange && (
                        <>
                            <Separator className="bg-zinc-800" />
                            <FieldMappingConfig
                                fields={datasetFields}
                                loading={loadingFields}
                                promptField={promptField}
                                onPromptFieldChange={onPromptFieldChange}
                            />
                        </>
                    )}
                </div>
                {startDisabledReason && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                        {startDisabledReason}
                    </div>
                )}
                <DialogFooter className="border-t border-zinc-800/50 pt-4">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900"
                    >
                        {t('common:common.cancel')}
                    </Button>
                    <Button
                        onClick={() => {
                            onOpenChange(false)
                            onStart()
                        }}
                        disabled={!selectedModelId || !selectedTemplateId || Boolean(startDisabledReason)}
                        className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-900/20"
                    >
                        <Play className="mr-2 h-4 w-4" />
                        {t('task:details.evaluation.start')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
