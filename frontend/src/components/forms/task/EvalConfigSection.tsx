import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, AlertTriangle, Gavel } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { EvaluatorTemplate } from '@/services/evaluator'

interface JudgeModel {
  id: string
  name: string
}

interface SelectedDataSources {
  communityIds: string[]  // prompts_combined
  hfDatasetIds: string[]  // format: "repoId:config:split"
}

interface EvalConfigSectionProps {
  enabled: boolean
  modelId: string
  promptSource: 'preset' | 'custom'
  selectedTemplateId: string
  customPrompt: string
  judgeModels: JudgeModel[]
  evalTemplates: EvaluatorTemplate[]
  loadingTemplates: boolean
  previewTemplate: EvaluatorTemplate | null
  selectedDataSources: SelectedDataSources
  onEnabledChange: (enabled: boolean) => void
  onModelIdChange: (modelId: string) => void
  onPromptSourceChange: (source: 'preset' | 'custom') => void
  onTemplateChange: (templateId: string, template: EvaluatorTemplate | null) => void
  onCustomPromptChange: (prompt: string) => void
}

function extractHfRepoId(hfDatasetId: string): string {
  const parts = hfDatasetId.split(':')
  return parts[0] || hfDatasetId
}

function isTemplateCompatible(
  template: EvaluatorTemplate,
  sources: SelectedDataSources,
): { compatible: boolean; missingDatasets: string[] } {
  const missingDatasets: string[] = []
  const supported = template.supported_datasets || []

  // Check prompts_combined compatibility
  if (sources.communityIds.length > 0) {
    if (!supported.includes('prompts_combined')) {
      missingDatasets.push('prompts_combined')
    }
  }

  // Check HF datasets compatibility
  for (const hfId of sources.hfDatasetIds) {
    const repoId = extractHfRepoId(hfId)
    if (!supported.includes(repoId)) {
      missingDatasets.push(repoId)
    }
  }

  return {
    compatible: missingDatasets.length === 0,
    missingDatasets,
  }
}

export function EvalConfigSection({
  enabled,
  modelId,
  promptSource,
  selectedTemplateId,
  customPrompt,
  judgeModels,
  evalTemplates,
  loadingTemplates,
  previewTemplate,
  selectedDataSources,
  onEnabledChange,
  onModelIdChange,
  onPromptSourceChange,
  onTemplateChange,
  onCustomPromptChange,
}: EvalConfigSectionProps) {
  const { t } = useTranslation()

  // Filter templates based on selected data sources
  const { compatibleTemplates, hasDataSources } = useMemo(() => {
    const hasSources =
      selectedDataSources.communityIds.length > 0 ||
      selectedDataSources.hfDatasetIds.length > 0

    if (!hasSources) {
      // No data sources selected, show all templates
      return { compatibleTemplates: evalTemplates, hasDataSources: false }
    }

    const compatible = evalTemplates.filter((tpl) => {
      const result = isTemplateCompatible(tpl, selectedDataSources)
      return result.compatible
    })

    return { compatibleTemplates: compatible, hasDataSources: true }
  }, [evalTemplates, selectedDataSources])

  // Check current template compatibility
  const currentTemplateWarning = useMemo(() => {
    if (!previewTemplate || !hasDataSources) return null
    const result = isTemplateCompatible(previewTemplate, selectedDataSources)
    if (!result.compatible) {
      return result.missingDatasets
    }
    return null
  }, [previewTemplate, selectedDataSources, hasDataSources])

  return (
    <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/20 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-1 h-4 bg-cyan-500 rounded-full"></span>
          <h4 className="text-sm font-semibold text-zinc-300">{t('task:form.evalConfig')}</h4>
        </div>
        <div className="flex items-center space-x-2">
          <Label htmlFor="eval-mode" className="text-sm text-zinc-400">
            {enabled ? t('task:form.evalEnabled') : t('task:form.evalDisabled')}
          </Label>
          <Switch
            id="eval-mode"
            checked={enabled}
            onCheckedChange={onEnabledChange}
            className="data-[state=checked]:bg-cyan-600"
          />
        </div>
      </div>

      {enabled && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="grid gap-2">
            <Label className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
              {t('task:form.judgeModelLabel')} <span className="text-red-500">*</span>
            </Label>
            <Select value={modelId} onValueChange={onModelIdChange}>
              <SelectTrigger className="bg-zinc-900/50 border-zinc-800 text-zinc-100 focus:ring-cyan-500/30">
                <SelectValue placeholder={t('task:form.judgeModelPlaceholder')} />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                {judgeModels.map((model) => (
                  <SelectItem key={model.id} value={model.id} className="text-zinc-100 focus:bg-zinc-800 focus:text-white">
                    <div className="flex items-center gap-2">
                      <Gavel className="h-3.5 w-3.5 text-cyan-500" />
                      {model.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
              {t('task:form.evalPromptLabel')}
            </Label>
            <RadioGroup
              value={promptSource}
              onValueChange={(v) => onPromptSourceChange(v as 'preset' | 'custom')}
              className="flex items-center gap-4 py-1"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="preset" id="prompt-preset" className="border-zinc-600 text-cyan-600" />
                <Label htmlFor="prompt-preset" className="cursor-pointer font-normal text-zinc-300 text-sm">
                  {t('task:form.evalPromptPreset')}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="custom" id="prompt-custom" className="border-zinc-600 text-cyan-600" />
                <Label htmlFor="prompt-custom" className="cursor-pointer font-normal text-zinc-300 text-sm">
                  {t('task:form.evalPromptCustom')}
                </Label>
              </div>
            </RadioGroup>

            {promptSource === 'preset' ? (
              <div className="grid gap-2 mt-1">
                {/* 兼容性警告 */}
                {currentTemplateWarning && currentTemplateWarning.length > 0 && (
                  <div className="flex items-start gap-2 rounded-md border border-yellow-800/50 bg-yellow-950/20 p-2 text-sm text-yellow-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
                    <span>
                      {t('task:form.templateIncompatibleWarning', {
                        datasets: currentTemplateWarning.join(', '),
                      })}
                    </span>
                  </div>
                )}
                {/* 无兼容模板提示 */}
                {hasDataSources && compatibleTemplates.length === 0 && (
                  <div className="flex items-start gap-2 rounded-md border border-orange-800/50 bg-orange-950/20 p-2 text-sm text-orange-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                    <span>{t('task:form.noCompatibleTemplates')}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedTemplateId}
                    onValueChange={(v) => {
                      const tpl = compatibleTemplates.find((t) => t.id === v)
                      onTemplateChange(v, tpl || null)
                    }}
                    disabled={loadingTemplates || (hasDataSources && compatibleTemplates.length === 0)}
                  >
                    <SelectTrigger className="flex-1 bg-zinc-900/50 border-zinc-800 text-zinc-100 focus:ring-cyan-500/30">
                      <SelectValue
                        placeholder={
                          loadingTemplates
                            ? t('task:form.loadingTemplates')
                            : hasDataSources && compatibleTemplates.length === 0
                              ? t('task:form.noCompatibleTemplates')
                              : t('task:form.selectTemplatePlaceholder')
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      {compatibleTemplates.map((tpl) => (
                        <SelectItem key={tpl.id} value={tpl.id} className="text-zinc-100 focus:bg-zinc-800 focus:text-white">
                          {tpl.name_zh || tpl.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {previewTemplate && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" variant="outline" size="icon" className="border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-white hover:bg-zinc-800">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-md bg-zinc-950 border-zinc-800 text-zinc-300 p-3 shadow-xl">
                        <div className="space-y-2">
                          <p className="font-bold text-white text-sm">
                            {previewTemplate.name_zh || previewTemplate.name}
                          </p>
                          <p className="text-zinc-400 text-xs border-b border-zinc-800 pb-2 mb-2">
                            {previewTemplate.description_zh || previewTemplate.description}
                          </p>
                          <div className="relative">
                            <pre className="bg-zinc-900/80 max-h-48 overflow-auto rounded p-2 text-[10px] font-mono whitespace-pre-wrap text-zinc-300 border border-zinc-800/50">
                              {previewTemplate.eval_prompt_template}
                            </pre>
                            <div className="absolute top-0 right-0 p-1">
                              <span className="text-[9px] text-zinc-500 uppercase">{t('task:form.evalPromptLabel')}</span>
                            </div>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            ) : (
              <Textarea
                className="mt-1 bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-cyan-500/30 min-h-[100px]"
                placeholder={t('task:form.customPromptPlaceholder')}
                value={customPrompt}
                onChange={(e) => onCustomPromptChange(e.target.value)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
