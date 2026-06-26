import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChevronDown, ChevronRight, Info } from 'lucide-react'
import { scanner } from '../../../../wailsjs/go/models'

interface TaskRequestsListProps {
  steps: scanner.StepResult[]
  requestField?: string  // 请求字段路径
  responseField?: string // 响应字段路径
}

// 根据字段路径从 JSON 对象中提取值
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

// 格式化值为字符串
function formatValue(value: unknown): string {
  if (value === undefined || value === null) return '-'
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

// 尝试解析 JSON 并提取字段
function extractField(jsonStr: string, fieldPath: string): string {
  if (!jsonStr || !fieldPath) return jsonStr || '-'
  try {
    const parsed = JSON.parse(jsonStr)
    const value = getValueByPath(parsed, fieldPath)
    return formatValue(value)
  } catch {
    return jsonStr || '-'
  }
}

// 格式化 JSON 字符串
function formatJson(jsonStr: string): string {
  if (!jsonStr) return '-'
  try {
    const parsed = JSON.parse(jsonStr)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return jsonStr
  }
}

export function TaskRequestsList({ steps, requestField, responseField }: TaskRequestsListProps) {
  const { t } = useTranslation()
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())

  // Cache parsed field values to avoid re-parsing on each render
  // Only parse when step is expanded
  const parsedFieldsCache = useMemo(() => new Map<string, { request: string; response: string }>(), [])

  if (steps.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        {t('task:details.empty.requests')}
      </div>
    )
  }

  // Get parsed fields for a step, using cache to avoid re-parsing
  const getParsedFields = (step: scanner.StepResult, stepKey: string) => {
    if (parsedFieldsCache.has(stepKey)) {
      return parsedFieldsCache.get(stepKey)!
    }
    const result = {
      request: requestField 
        ? extractField(step.reqPreview || '', requestField)
        : (step.reqPreview || '-'),
      response: responseField 
        ? extractField(step.responseBody || step.respPreview || '', responseField)
        : (step.respPreview || '-'),
    }
    parsedFieldsCache.set(stepKey, result)
    return result
  }

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-2 pr-4">
        {steps.map((step, idx) => {
          const stepKey = `${step.runID}-${step.sampleID}-${step.attempt}`
          const isExpanded = expandedSteps.has(stepKey)
          
          // Only parse fields when expanded (defer JSON.parse)
          const { request: requestValue, response: responseValue } = isExpanded 
            ? getParsedFields(step, stepKey)
            : { request: '', response: '' }
          
          return (
            <Collapsible
              key={stepKey}
              open={isExpanded}
              onOpenChange={(open) => {
                setExpandedSteps((prev) => {
                  const next = new Set(prev)
                  if (open) {
                    next.add(stepKey)
                  } else {
                    next.delete(stepKey)
                  }
                  return next
                })
              }}
            >
              <CollapsibleTrigger asChild>
                <div className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-muted/50">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-mono text-xs text-muted-foreground">#{idx + 1}</span>
                  <Badge
                    className={
                      step.success
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }
                  >
                    {step.statusCode || 'N/A'}
                  </Badge>
                  <span className="flex-1 truncate text-sm">{step.sampleID}</span>
                  <span className="text-xs text-muted-foreground">{t('task:details.request.durationMs', { ms: step.durationMs })}</span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-7 mt-2 max-h-[300px] space-y-3 overflow-auto rounded-md border bg-muted/30 p-3">
                  {/* 请求字段 */}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        {requestField ? `${t('task:details.request.request')} (${requestField})` : t('task:details.request.request')}
                      </span>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <Info className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>{t('task:details.request.fullRequest')}</DialogTitle>
                          </DialogHeader>
                          <ScrollArea className="h-[400px]">
                            <pre className="text-xs whitespace-pre-wrap break-all p-4">
                              {formatJson(step.reqPreview || '')}
                            </pre>
                          </ScrollArea>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <pre className="max-h-24 overflow-auto rounded bg-background p-2 text-xs whitespace-pre-wrap break-all">
                      {isExpanded ? requestValue : ''}
                    </pre>
                  </div>
                  
                  {/* 响应字段 */}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        {responseField ? `${t('task:details.request.response')} (${responseField})` : t('task:details.request.response')}
                      </span>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <Info className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>{t('task:details.request.fullResponse')}</DialogTitle>
                          </DialogHeader>
                          <ScrollArea className="h-[400px]">
                            <pre className="text-xs whitespace-pre-wrap break-all p-4">
                              {formatJson(step.responseBody || step.respPreview || '')}
                            </pre>
                          </ScrollArea>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <pre className="max-h-24 overflow-auto rounded bg-background p-2 text-xs whitespace-pre-wrap break-all">
                      {isExpanded ? responseValue : ''}
                    </pre>
                  </div>
                  
                  {/* 错误信息 */}
                  {step.error && (
                    <div>
                      <div className="mb-1 text-xs font-medium text-red-600">{t('task:details.request.error')}</div>
                      <pre className="max-h-16 overflow-auto rounded bg-red-50 p-2 text-xs text-red-700 whitespace-pre-wrap">
                        {step.error}
                      </pre>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        })}
      </div>
    </ScrollArea>
  )
}
