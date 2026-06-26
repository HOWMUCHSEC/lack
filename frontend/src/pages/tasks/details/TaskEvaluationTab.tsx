import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { main, scanner } from '../../../../wailsjs/go/models'
import * as LocalData from '@/services/localData'
import { fetchEvaluatorTemplates, type EvaluatorTemplate } from '@/services/evaluator'
import * as SampleService from '../../../../wailsjs/go/main/SampleService'
import { EvaluateScanSteps } from '../../../../wailsjs/go/main/EvalService'
import { EventsOn } from '../../../../wailsjs/runtime'
import { EvaluationStats } from './evaluation/EvaluationStats'
import { EvaluationConfigDialog } from './evaluation/EvaluationConfigDialog'
import { EvaluationDatasetSelector } from './evaluation/EvaluationDatasetSelector'
import { EvaluationTable } from './evaluation/EvaluationTable'
import { type EvalItemResult, type JudgeModel } from './evaluation/types'

interface TaskEvaluationTabProps {
  taskId: string
  steps: scanner.StepResult[]
  requestField?: string
  responseField?: string
}

function stepKey(step: scanner.StepResult) {
  return `${step.runID}-${step.sampleID}-${step.attempt}`
}

function getValueByPath(obj: unknown, path: string): unknown {
  if (!path || !obj) return obj
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function extractFieldOrRaw(raw: string | undefined, fieldPath?: string): string {
  const source = raw?.trim() || ''
  if (!source || !fieldPath) return source
  try {
    const value = getValueByPath(JSON.parse(source), fieldPath)
    if (value === undefined || value === null) return source
    return typeof value === 'string' ? value : JSON.stringify(value)
  } catch {
    return source
  }
}

function promptFromStep(step: scanner.StepResult, requestField?: string) {
  return extractFieldOrRaw(step.finalRequest?.bodyJSON || step.reqPreview, requestField)
}

function responseFromStep(step: scanner.StepResult, responseField?: string) {
  return extractFieldOrRaw(step.responseBody || step.respPreview, responseField)
}

function normalizeEvalItem(item: Partial<EvalItemResult>, index: number): EvalItemResult {
  const allowedStatuses = new Set<string>(['pending', 'running', 'completed', 'failed'])
  const status = allowedStatuses.has(item.status || '')
    ? (item.status as EvalItemResult['status'])
    : 'failed'
  return {
    index: item.index ?? index,
    sampleId: item.sampleId || `item-${index + 1}`,
    prompt: item.prompt || '',
    response: item.response || '',
    score: item.score || 0,
    label: item.label || '',
    reasoning: item.reasoning || item.error || '',
    status,
    error: item.error,
  }
}

export function TaskEvaluationTab({
  taskId,
  steps,
  requestField,
  responseField,
}: TaskEvaluationTabProps) {
  const { t } = useTranslation()
  const taskIdRef = useRef(taskId)
  const evalRunRef = useRef(0)

  // 数据选择状态
  const [selectedStepIds, setSelectedStepIds] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)

  // 配置弹窗状态
  const [configModalOpen, setConfigModalOpen] = useState(false)

  // 模型和模板选择
  const [judgeModels, setJudgeModels] = useState<JudgeModel[]>([])
  const [selectedModelId, setSelectedModelId] = useState('')
  const [evalTemplates, setEvalTemplates] = useState<EvaluatorTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [taskHfRepoIds, setTaskHfRepoIds] = useState<string[]>([])

  // 评测状态
  const [evalStatus, setEvalStatus] = useState<'idle' | 'running' | 'paused' | 'completed'>('idle')
  const [evalProgress, setEvalProgress] = useState({ current: 0, total: 0 })
  const [evalResults, setEvalResults] = useState<EvalItemResult[]>([])

  // 筛选 200 响应的 steps
  const successSteps = useMemo(() => {
    return steps.filter((step) => step.statusCode >= 200 && step.statusCode < 300)
  }, [steps])

  // 加载评判模型列表和已有评测结果
  useEffect(() => {
    taskIdRef.current = taskId
    setSelectedStepIds(new Set())
    setSelectAll(false)
    setSelectedModelId('')
    setSelectedTemplateId('')
    setEvalStatus('idle')
    setEvalProgress({ current: 0, total: 0 })
    setEvalResults([])
    setTaskHfRepoIds([])
    loadJudgeModels()
    loadEvalTemplates()
    loadTaskDatasetConfig(taskId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId])

  useEffect(() => {
    const off = EventsOn('eval:manual:progress', (event: unknown) => {
      const payload = event as {
        taskId?: string
        completed?: number
        total?: number
        result?: Partial<EvalItemResult>
      }
      if (!payload || payload.taskId !== taskIdRef.current) return
      setEvalProgress({
        current: Number(payload.completed || 0),
        total: Number(payload.total || 0),
      })
      if (!payload.result) return
      setEvalResults((prev) =>
        prev.map((item, index) =>
          item.index === payload.result?.index
            ? normalizeEvalItem(payload.result, index)
            : item,
        ),
      )
    })
    return () => {
      if (typeof off === 'function') off()
    }
  }, [])

  // 加载任务的数据集配置，提取 HF 数据集的 repo ID
  const loadTaskDatasetConfig = async (requestedTaskId = taskId) => {
    try {
      const cfg = await SampleService.GetTaskDatasetConfig(requestedTaskId)
      if (taskIdRef.current !== requestedTaskId) return
      if (cfg?.hfDatasetIds && cfg.hfDatasetIds.length > 0) {
        // hfDatasetIds 格式: "repoId:config:split"，提取 repoId
        const repoIds = cfg.hfDatasetIds.map((id) => id.split(':')[0])
        setTaskHfRepoIds([...new Set(repoIds)]) // 去重
      } else {
        setTaskHfRepoIds([])
      }
    } catch (error) {
      console.error('Failed to load task dataset config:', error)
      if (taskIdRef.current === requestedTaskId) {
        setTaskHfRepoIds([])
      }
    }
  }

  // 选择全部时自动选中所有 200 响应
  useEffect(() => {
    if (selectAll) {
      const allIds = new Set(
        successSteps.map(stepKey),
      )
      setSelectedStepIds(allIds)
    }
  }, [selectAll, successSteps])

  const loadJudgeModels = async () => {
    try {
      const all = await LocalData.listTargets()
      const judges = all
        .filter((t) => t.metadata?.purpose === 'judge')
        .map((t) => ({
          id: t.id,
          name: t.target_title,
          baseUrl: t.metadata?.base_url,
        }))
      setJudgeModels(judges)
    } catch (error) {
      console.error('Failed to load judge models:', error)
    }
  }

  const loadEvalTemplates = async () => {
    setLoadingTemplates(true)
    try {
      const templates = await fetchEvaluatorTemplates()
      setEvalTemplates(templates)
    } catch (error) {
      console.error('Failed to load evaluator templates:', error)
    } finally {
      setLoadingTemplates(false)
    }
  }

  // 根据任务关联的数据集筛选评测模板
  // 返回匹配的模板和不匹配的模板，匹配的模板优先显示
  const filteredTemplates = useMemo(() => {
    if (taskHfRepoIds.length === 0) {
      // 没有 HF 数据集，返回所有模板
      return { matched: evalTemplates, unmatched: [] }
    }
    const matched: EvaluatorTemplate[] = []
    const unmatched: EvaluatorTemplate[] = []
    for (const tpl of evalTemplates) {
      const supports = tpl.supported_datasets || []
      const isMatch = taskHfRepoIds.some((repoId) => supports.includes(repoId))
      if (isMatch) {
        matched.push(tpl)
      } else {
        unmatched.push(tpl)
      }
    }
    return { matched, unmatched }
  }, [evalTemplates, taskHfRepoIds])

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedStepIds(new Set())
      setSelectAll(false)
    } else {
      const allIds = new Set(
        successSteps.map(stepKey),
      )
      setSelectedStepIds(allIds)
      setSelectAll(true)
    }
  }

  const handleStartEvaluation = async () => {
    if (selectedStepIds.size === 0) {
      toast.error(t('task:details.evaluation.noDataSelected'))
      return
    }
    if (!selectedModelId) {
      toast.error(t('task:details.evaluation.noModelSelected'))
      return
    }
    if (!selectedTemplateId) {
      toast.error(t('task:details.evaluation.noTemplateSelected'))
      return
    }

    const selectedTemplate = evalTemplates.find((tpl) => tpl.id === selectedTemplateId)
    if (!judgeModels.some((m) => m.id === selectedModelId) || !selectedTemplate) {
      toast.error(t('task:details.evaluation.configError'))
      return
    }

    const selectedSteps = successSteps.filter((step) => selectedStepIds.has(stepKey(step)))
    if (selectedSteps.length === 0) {
      toast.error(t('task:details.evaluation.noDataSelected'))
      return
    }

    const runID = evalRunRef.current + 1
    evalRunRef.current = runID
    setEvalStatus('running')
    setEvalProgress({ current: 0, total: selectedSteps.length })
    setEvalResults(
      selectedSteps.map((step, index) => ({
        index,
        sampleId: step.sampleID || `item-${index + 1}`,
        prompt: promptFromStep(step, requestField),
        response: responseFromStep(step, responseField),
        score: 0,
        label: '',
        reasoning: '',
        status: 'pending',
      })),
    )

    try {
      const results = await EvaluateScanSteps(main.ManualScanStepEvaluationRequest.createFrom({
        taskId,
        judgeModelId: selectedModelId,
        evaluatorType: selectedTemplate.evaluator_type,
        templateId: selectedTemplate.id,
        requestField: requestField || '',
        responseField: responseField || '',
        steps: selectedSteps,
      }))
      if (evalRunRef.current !== runID || taskIdRef.current !== taskId) return
      const normalized = (results as Partial<EvalItemResult>[]).map(normalizeEvalItem)
      setEvalResults(normalized)
      setEvalProgress({ current: normalized.length, total: normalized.length })
      setEvalStatus('completed')
      toast.success(t('task:details.evaluation.completed'))
    } catch (error) {
      if (evalRunRef.current !== runID) return
      const message = error instanceof Error ? error.message : String(error)
      setEvalStatus('idle')
      toast.error(message)
    }
  }

  const handleStopEvaluation = () => {
    evalRunRef.current += 1
    setEvalStatus('idle')
    toast.info(t('task:details.evaluation.stopped'))
  }

  const getResultStats = () => {
    const completed = evalResults.filter((r) => r.status === 'completed')
    const passed = completed.filter((r) => r.label === 'pass').length
    const failed = completed.filter((r) => r.label === 'fail').length
    const avgScore =
      completed.length > 0
        ? Math.round(completed.reduce((sum, r) => sum + r.score, 0) / completed.length)
        : 0
    return { total: evalResults.length, completed: completed.length, passed, failed, avgScore }
  }

  const stats = getResultStats()

  return (
    <div className="space-y-6">
      <EvaluationDatasetSelector
        successSteps={successSteps}
        selectedStepIds={selectedStepIds}
        onSelectAll={handleSelectAll}
        selectAll={selectAll}
        onConfigOpen={() => setConfigModalOpen(true)}
        requestField={requestField}
        responseField={responseField}
        onRemoveStep={(stepKey) => {
          setSelectedStepIds((prev) => {
            const next = new Set(prev)
            next.delete(stepKey)
            if (next.size === 0) setSelectAll(false)
            return next
          })
        }}
      />

      <EvaluationConfigDialog
        open={configModalOpen}
        onOpenChange={setConfigModalOpen}
        selectedCount={selectedStepIds.size}
        judgeModels={judgeModels}
        selectedModelId={selectedModelId}
        onModelIdChange={setSelectedModelId}
        selectedTemplateId={selectedTemplateId}
        onTemplateIdChange={setSelectedTemplateId}
        loadingTemplates={loadingTemplates}
        filteredTemplates={filteredTemplates}
        onStart={handleStartEvaluation}
      />

      {evalResults.length > 0 && (
        <EvaluationStats stats={stats} />
      )}

      <EvaluationTable
        evalStatus={evalStatus}
        evalProgress={evalProgress}
        onStop={handleStopEvaluation}
        results={evalResults}
      />
    </div>
  )
}
