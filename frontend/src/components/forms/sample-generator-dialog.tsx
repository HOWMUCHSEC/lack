import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { AlertCircle, Sparkles, Variable, FileText, Plus, Minus, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { extractPlaceholders, parseVariableValues } from '@/lib/placeholder'
import * as SampleService from '../../../wailsjs/go/main/SampleService'
import { samples } from '../../../wailsjs/go/models'

interface UserVariable {
  id: string
  name: string
  value: string
  enabled: boolean
  description?: string | null
}

interface TestCaseData {
  id: string
  title: string
  content: string
  category: string
  severity: string
  tags?: string[]
}

interface SampleGeneratorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  testCase: TestCaseData | null
  onSuccess?: () => void
}

export function SampleGeneratorDialog({
  open,
  onOpenChange,
  testCase,
  onSuccess,
}: SampleGeneratorDialogProps) {
  const { t } = useTranslation()
  const [generating, setGenerating] = useState(false)
  const [userVariables, setUserVariables] = useState<UserVariable[]>([])
  const [selectedVars, setSelectedVars] = useState<Record<string, boolean>>({})
  const [customValues, setCustomValues] = useState<Record<string, string[]>>({})
  const [setName, setSetName] = useState('')
  const [setDescription, setSetDescription] = useState('')

  // 从测试用例内容中提取占位符
  const placeholders = useMemo(() => {
    return testCase?.content ? extractPlaceholders(testCase.content) : []
  }, [testCase?.content])

  // 加载用户变量
  useEffect(() => {
    if (open) {
      loadUserVariables()
      // 重置选择状态
      setSelectedVars({})
      setCustomValues({})
      setSetName('')
      setSetDescription('')
    }
  }, [open])

  // 当占位符变化时，自动匹配用户变量
  useEffect(() => {
    if (placeholders.length > 0 && userVariables.length > 0) {
      const newSelected: Record<string, boolean> = {}
      const newCustom: Record<string, string[]> = {}

      for (const ph of placeholders) {
        const matchedVar = userVariables.find(
          (v) => v.name.toLowerCase() === ph.toLowerCase() && v.enabled,
        )
        if (matchedVar) {
          newSelected[ph] = true
          newCustom[ph] = parseVariableValues(matchedVar.value)
        } else {
          newSelected[ph] = false
          newCustom[ph] = ['']
        }
      }

      setSelectedVars(newSelected)
      setCustomValues(newCustom)
    }
  }, [placeholders, userVariables])

  const loadUserVariables = async () => {
    try {
      const { data, error } = await supabase
        .from('user_variables')
        .select('id,name,value,enabled,description')
        .is('deleted_at', null)
        .order('name')

      if (error) throw error
      setUserVariables((data || []) as UserVariable[])
    } catch (e) {
      console.error('加载变量失败:', e)
    }
  }

  // 计算将生成的样本数量
  const sampleCount = useMemo(() => {
    let count = 1
    for (const ph of placeholders) {
      if (selectedVars[ph]) {
        const values = customValues[ph]?.filter((v) => v.trim()) || []
        if (values.length > 0) {
          count *= values.length
        }
      }
    }
    return count
  }, [placeholders, selectedVars, customValues])

  const handleValueChange = (placeholder: string, index: number, value: string) => {
    setCustomValues((prev) => {
      const values = [...(prev[placeholder] || [''])]
      values[index] = value
      return { ...prev, [placeholder]: values }
    })
  }

  const handleAddValue = (placeholder: string) => {
    setCustomValues((prev) => {
      const values = [...(prev[placeholder] || ['']), '']
      return { ...prev, [placeholder]: values }
    })
  }

  const handleRemoveValue = (placeholder: string, index: number) => {
    setCustomValues((prev) => {
      const values = (prev[placeholder] || ['']).filter((_, i) => i !== index)
      return { ...prev, [placeholder]: values.length ? values : [''] }
    })
  }

  const handleGenerate = async () => {
    if (!testCase) return

    // 构建变量数据
    const variables = placeholders
      .filter((ph) => selectedVars[ph])
      .map((ph) => ({
        name: ph,
        values: (customValues[ph] || []).filter((v) => v.trim()),
        enabled: true,
      }))

    if (variables.length === 0 || variables.every((v) => v.values.length === 0)) {
      toast.error(t('samples:generator.toasts.noVariables'))
      return
    }

    setGenerating(true)
    try {
      const req = {
        testCaseId: testCase.id,
        testCaseTitle: testCase.title,
        content: testCase.content,
        category: testCase.category,
        severity: testCase.severity,
        tags: testCase.tags || [],
        variables,
        setName: setName || '',
        setDescription: setDescription || '',
      }
      const result = await SampleService.GenerateSamples(req as samples.GenerateRequest)

      if (result.success) {
        toast.success(t('samples:generator.toasts.success', { count: result.sampleCount }))
        onOpenChange(false)
        onSuccess?.()
      } else {
        toast.error(result.error || t('samples:generator.toasts.failed'))
      }
    } catch (e) {
      console.error('生成样本失败:', e)
      toast.error(t('samples:generator.toasts.failed'))
    } finally {
      setGenerating(false)
    }
  }

  if (!testCase) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            {t('samples:generator.title')}
          </DialogTitle>
          <DialogDescription>{t('samples:generator.description')}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto pr-4">
          <div className="space-y-6">
            {/* 测试用例信息 */}
            <div className="rounded-lg border p-4">
              <div className="mb-2 flex items-center gap-2">
                <FileText className="text-muted-foreground h-4 w-4" />
                <span className="font-medium">{testCase.title}</span>
              </div>
              <div className="bg-muted rounded p-3 text-sm whitespace-pre-wrap">
                {testCase.content}
              </div>
            </div>

            {/* 检测到的变量 */}
            {placeholders.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{t('samples:generator.noPlaceholders')}</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Variable className="text-muted-foreground h-4 w-4" />
                  <span className="font-medium">
                    {t('samples:generator.detectedVariables')} ({placeholders.length})
                  </span>
                </div>

                {placeholders.map((ph) => (
                  <div key={ph} className="rounded-lg border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`var-${ph}`}
                          checked={selectedVars[ph] || false}
                          onCheckedChange={(checked) =>
                            setSelectedVars((prev) => ({ ...prev, [ph]: !!checked }))
                          }
                        />
                        <Label htmlFor={`var-${ph}`} className="font-mono text-sm">
                          {`{{${ph}}}`}
                        </Label>
                        {userVariables.some(
                          (v) => v.name.toLowerCase() === ph.toLowerCase() && v.enabled,
                        ) && (
                          <Badge variant="secondary" className="text-xs">
                            {t('samples:generator.matched')}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {selectedVars[ph] && (
                      <div className="ml-6 space-y-2">
                        <Label className="text-muted-foreground text-xs">
                          {t('samples:generator.valuesLabel')}
                        </Label>
                        {(customValues[ph] || ['']).map((val, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Input
                              value={val}
                              onChange={(e) => handleValueChange(ph, idx, e.target.value)}
                              placeholder={t('samples:generator.valuePlaceholder')}
                              className="h-8 text-sm"
                            />
                            {idx === (customValues[ph] || ['']).length - 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleAddValue(ph)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            )}
                            {(customValues[ph] || []).length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleRemoveValue(ph, idx)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Separator />

            {/* 样本集信息 */}
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="setName">{t('samples:generator.setNameLabel')}</Label>
                <Input
                  id="setName"
                  value={setName}
                  onChange={(e) => setSetName(e.target.value)}
                  placeholder={t('samples:generator.setNamePlaceholder', {
                    title: testCase.title,
                  })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="setDesc">{t('samples:generator.setDescLabel')}</Label>
                <Input
                  id="setDesc"
                  value={setDescription}
                  onChange={(e) => setSetDescription(e.target.value)}
                  placeholder={t('samples:generator.setDescPlaceholder')}
                />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div className="text-muted-foreground text-sm">
            {t('samples:generator.willGenerate', { count: sampleCount })}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('common:common.cancel')}
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generating || placeholders.length === 0 || sampleCount === 0}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('samples:generator.generating')}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t('samples:generator.generate')}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
