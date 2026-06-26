import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, ArrowRight, Sparkles } from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export interface DatasetFieldInfo {
  name: string
  sampleValue: string
  inferredType: 'prompt' | 'context' | 'output' | 'other'
}

interface FieldMappingConfigProps {
  fields: DatasetFieldInfo[]
  loading: boolean
  promptField: string
  onPromptFieldChange: (field: string) => void
  contextField?: string
  onContextFieldChange?: (field: string) => void
}

const TYPE_COLORS: Record<string, string> = {
  prompt: 'bg-purple-900/30 text-purple-400 border-purple-800',
  context: 'bg-blue-900/30 text-blue-400 border-blue-800',
  output: 'bg-emerald-900/30 text-emerald-400 border-emerald-800',
  other: 'bg-zinc-800/50 text-zinc-400 border-zinc-700',
}

export function FieldMappingConfig({
  fields,
  loading,
  promptField,
  onPromptFieldChange,
  contextField,
  onContextFieldChange,
}: FieldMappingConfigProps) {
  const { t } = useTranslation()
  const [autoInferred, setAutoInferred] = useState(false)

  // Auto-select inferred prompt field on first load
  useEffect(() => {
    if (!autoInferred && fields.length > 0 && !promptField) {
      const inferredPrompt = fields.find((f) => f.inferredType === 'prompt')
      if (inferredPrompt) {
        onPromptFieldChange(inferredPrompt.name)
        setAutoInferred(true)
      }
    }
  }, [fields, promptField, autoInferred, onPromptFieldChange])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-zinc-400 py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">{t('task:details.evaluation.loadingFields')}</span>
      </div>
    )
  }

  if (fields.length === 0) {
    return null
  }

  return (
    <div className="grid gap-3">
      {/* Prompt Field Mapping - 一行两列布局 */}
      <div className="flex items-center gap-2 mb-1">
        <Label className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
          {t('task:details.evaluation.promptFieldLabel')}
        </Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-zinc-700 text-zinc-500">
                {t('task:details.evaluation.required')}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="bg-zinc-900 border-zinc-800 text-zinc-300 max-w-xs">
              <p>{t('task:details.evaluation.promptFieldDesc')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* 一行两列：左边下拉选择，右边映射预览 */}
      <div className="grid grid-cols-2 gap-3">
        {/* 左列：字段选择 */}
        <Select value={promptField} onValueChange={onPromptFieldChange}>
          <SelectTrigger className="bg-zinc-900/50 border-zinc-800 text-zinc-100 focus:ring-purple-500/30">
            <SelectValue placeholder={t('task:details.evaluation.selectPromptField')} />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800 max-h-[300px]">
            {fields.map((field) => (
              <SelectItem
                key={field.name}
                value={field.name}
                className="text-zinc-100 focus:bg-zinc-800 focus:text-white"
              >
                <div className="flex items-center gap-2 w-full">
                  <span className="font-mono text-sm">{field.name}</span>
                  <Badge variant="outline" className={`text-[10px] px-1 py-0 ${TYPE_COLORS[field.inferredType]}`}>
                    {field.inferredType}
                  </Badge>
                  {field.inferredType === 'prompt' && (
                    <Sparkles className="h-3 w-3 text-purple-400" />
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 右列：映射预览 */}
        <div className="flex items-center gap-2 text-xs bg-zinc-900/50 rounded-md border border-zinc-800 px-3 h-10">
          {promptField ? (
            <>
              <span className="font-mono text-purple-400 truncate">{promptField}</span>
              <ArrowRight className="h-3 w-3 text-zinc-600 flex-shrink-0" />
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="font-mono text-emerald-400">prompt</span>
            </>
          ) : (
            <span className="text-zinc-600">{t('task:details.evaluation.mappingPreview')}</span>
          )}
        </div>
      </div>

      {/* 样本值预览 */}
      {promptField && (
        <div className="text-xs text-zinc-500 bg-zinc-900/30 rounded px-2 py-1.5 font-mono truncate">
          {fields.find((f) => f.name === promptField)?.sampleValue || ''}
        </div>
      )}

      {/* Context Field Mapping (Optional) */}
      {onContextFieldChange && (
        <div className="grid gap-2 mt-2">
          <div className="flex items-center gap-2">
            <Label className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
              {t('task:details.evaluation.contextFieldLabel')}
            </Label>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-zinc-700 text-zinc-500">
              {t('task:details.evaluation.optional')}
            </Badge>
          </div>
          <Select value={contextField || ''} onValueChange={onContextFieldChange}>
            <SelectTrigger className="bg-zinc-900/50 border-zinc-800 text-zinc-100 focus:ring-purple-500/30">
              <SelectValue placeholder={t('task:details.evaluation.selectContextField')} />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800 max-h-[300px]">
              <SelectItem value="__none__" className="text-zinc-500">
                {t('task:details.evaluation.noContextField')}
              </SelectItem>
              {fields.map((field) => (
                <SelectItem
                  key={field.name}
                  value={field.name}
                  className="text-zinc-100 focus:bg-zinc-800 focus:text-white"
                >
                  <div className="flex items-center gap-2 w-full">
                    <span className="font-mono text-sm">{field.name}</span>
                    <Badge variant="outline" className={`text-[10px] px-1 py-0 ${TYPE_COLORS[field.inferredType]}`}>
                      {field.inferredType}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
