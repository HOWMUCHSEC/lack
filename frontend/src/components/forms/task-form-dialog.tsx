import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import * as LocalDB from '../../../wailsjs/go/main/DB'
import * as LocalData from '@/services/localData'
import * as SampleService from '../../../wailsjs/go/main/SampleService'
import * as TestCaseService from '../../../wailsjs/go/main/TestCaseService'
import * as EvalService from '../../../wailsjs/go/main/EvalService'
import { useTranslation } from 'react-i18next'
import {
  DatasetSelector,
  RunnerConfigSection,
  type TestCaseItem,
  type CommunityPromptItem,
  type HfDatasetItem,
} from './task'
import { TaskBasicFields, type Project, type Target } from './task/TaskBasicFields'
import { FieldMappingConfig, type DatasetFieldInfo } from '@/pages/tasks/details/evaluation/FieldMappingConfig'

interface TaskFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function TaskFormDialog({ open, onOpenChange, onSuccess }: TaskFormDialogProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [targets, setTargets] = useState<Target[]>([])
  const [formData, setFormData] = useState({
    project_id: '',
    goal_id: '',
    title: '',
    description: '',
    order_index: 0,
    tags: '',
  })

  // 数据集选择状态
  const [testCases, setTestCases] = useState<TestCaseItem[]>([])
  const [communityPrompts, setCommunityPrompts] = useState<CommunityPromptItem[]>([])
  const [hfDatasets, setHfDatasets] = useState<HfDatasetItem[]>([])
  const [selectedTestCaseIds, setSelectedTestCaseIds] = useState<string[]>([])
  const [selectedCommunityIds, setSelectedCommunityIds] = useState<string[]>([])
  const [selectedHfDatasetIds, setSelectedHfDatasetIds] = useState<string[]>([])
  const [loadingDatasets, setLoadingDatasets] = useState(false)

  // 字段映射状态
  const [datasetFields, setDatasetFields] = useState<DatasetFieldInfo[]>([])
  const [loadingFields, setLoadingFields] = useState(false)
  const [promptField, setPromptField] = useState('')
  const [runnerCfg, setRunnerCfg] = useState({
    maxAttempts: 2,
    perAttemptTimeoutMs: 8000,
    baseBackoffMs: 500,
    maxBackoffMs: 4000,
    jitterPct: 30,
    abortAfterFailures: 5,
    expectedSuccess: '200-299',
    retryOn: '408,429,500-599',
    failOn: '400-499',
  })

  // 加载项目列表和样本集
  useEffect(() => {
    if (open) {
      loadProjects()
      loadAllDatasets()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // 当选择项目时，加载该项目的目标列表
  useEffect(() => {
    if (formData.project_id) {
      loadTargets(formData.project_id)
    } else {
      setTargets([])
    }
  }, [formData.project_id])

  // 关闭时重置表单
  useEffect(() => {
    if (!open) {
      setFormData({
        project_id: '',
        goal_id: '',
        title: '',
        description: '',
        order_index: 0,
        tags: '',
      })
      setRunnerCfg({
        maxAttempts: 2,
        perAttemptTimeoutMs: 8000,
        baseBackoffMs: 500,
        maxBackoffMs: 4000,
        jitterPct: 30,
        abortAfterFailures: 5,
        expectedSuccess: '200-299',
        retryOn: '408,429,500-599',
        failOn: '400-499',
      })
      setSelectedTestCaseIds([])
      setSelectedCommunityIds([])
      setSelectedHfDatasetIds([])
      setDatasetFields([])
      setPromptField('')
    }
  }, [open])

  // 当数据集选择改变时，加载字段列表
  useEffect(() => {
    const hasSelection = selectedTestCaseIds.length > 0 || selectedCommunityIds.length > 0 || selectedHfDatasetIds.length > 0
    if (hasSelection) {
      loadDatasetFields()
    } else {
      setDatasetFields([])
      setPromptField('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTestCaseIds, selectedCommunityIds, selectedHfDatasetIds])

  // 加载数据集字段
  const loadDatasetFields = async () => {
    setLoadingFields(true)
    try {
      // 构建 DatasetConfig 用于获取字段
      const config = {
        localSampleSetIds: selectedTestCaseIds,
        cloudSampleSetIds: selectedCommunityIds,
        hfDatasets: selectedHfDatasetIds.map((id) => {
          const [repoId, configName, split] = id.split(':')
          return { repoId, config: configName || 'default', split: split || 'test' }
        }),
      }
      const fields = await EvalService.GetDatasetFields(config as never)
      // 转换类型以匹配组件期望的类型
      const typedFields: DatasetFieldInfo[] = (fields || []).map((f) => ({
        name: f.name,
        sampleValue: f.sampleValue,
        inferredType: f.inferredType as 'prompt' | 'context' | 'output' | 'other',
      }))
      setDatasetFields(typedFields)
    } catch (error) {
      console.error('Failed to load dataset fields:', error)
      setDatasetFields([])
    } finally {
      setLoadingFields(false)
    }
  }

  const loadProjects = async () => {
    try {
      const data = await LocalData.listProjects()
      setProjects(data.map((p) => ({ id: p.id, name: p.name })))
    } catch (error) {
      console.error('加载项目列表失败:', error)
    }
  }

  const loadTargets = async (projectId: string) => {
    try {
      const all = await LocalData.listTargets()
      const filtered = all
        .filter((t) => t.project_id === projectId && t.metadata?.purpose !== 'judge')
        .sort((a, b) => a.order_index - b.order_index)
      setTargets(filtered.map((t) => ({ id: t.id, target_title: t.target_title })))
    } catch (error) {
      console.error('加载目标列表失败:', error)
      setTargets([])
    }
  }

  // 加载所有数据集
  const loadAllDatasets = useCallback(async () => {
    setLoadingDatasets(true)
    try {
      // 1. 加载测试用例
      const tcResult = await TestCaseService.ListTestCases(0, 500)
      const tcItems = (tcResult.items || []) as TestCaseItem[]
      // 只显示启用的测试用例
      setTestCases(tcItems.filter((tc) => tc.status === 'active'))

      // 2. 加载核心样本
      const cpResult = await SampleService.ListDownloadedCommunityPrompts()
      setCommunityPrompts(cpResult || [])

      // 3. 加载社区样本
      const hfResult = await SampleService.ListDownloadedHfDatasets()
      const hfItems: HfDatasetItem[] = (hfResult || []).map((meta) => ({
        id: `${meta.hfRepoId}:${meta.config}:${meta.split}`,
        name: meta.config ? `${meta.hfRepoId} / ${meta.config} (${meta.split})` : `${meta.hfRepoId} (${meta.split})`,
        rowCount: meta.rowCount,
      }))
      setHfDatasets(hfItems)
    } catch (e) {
      console.error('加载数据集失败:', e)
    } finally {
      setLoadingDatasets(false)
    }
  }, [])

  // 切换选中状态 - useCallback 优化避免不必要重渲染
  const toggleTestCase = useCallback((id: string) => {
    setSelectedTestCaseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }, [])

  const toggleCommunity = useCallback((id: string) => {
    setSelectedCommunityIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }, [])

  const toggleHfDataset = useCallback((id: string) => {
    setSelectedHfDatasetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }, [])

  // 全选/取消全选 - useCallback 优化
  const toggleAllTestCases = useCallback(() => {
    setSelectedTestCaseIds((prev) =>
      prev.length === testCases.length ? [] : testCases.map((tc) => tc.id)
    )
  }, [testCases])

  const toggleAllCommunity = useCallback(() => {
    setSelectedCommunityIds((prev) =>
      prev.length === communityPrompts.length ? [] : communityPrompts.map((cp) => String(cp.id))
    )
  }, [communityPrompts])

  const toggleAllHfDatasets = useCallback(() => {
    setSelectedHfDatasetIds((prev) =>
      prev.length === hfDatasets.length ? [] : hfDatasets.map((hf) => hf.id)
    )
  }, [hfDatasets])

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error(t('task:form.toasts.nameRequired'))
      return
    }

    if (!formData.project_id) {
      toast.error(t('task:form.toasts.projectRequired'))
      return
    }

    setLoading(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast.error(t('task:form.toasts.loginRequired'))
        return
      }

      // 处理标签
      const tagsArray = formData.tags
        ? formData.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
        : []

      const taskData = {
        project_id: formData.project_id,
        goal_id: formData.goal_id || null,
        title: formData.title,
        description: formData.description || null,
        status: 'todo',
        priority: 'medium',
        order_index: formData.order_index,
        tags: tagsArray,
        creator_id: user.id,
      }

      const saveCfg = async (tid: string) => {
        const payload = {
          retry: {
            maxAttempts: Number(runnerCfg.maxAttempts) || 0,
            perAttemptTimeoutMs: Number(runnerCfg.perAttemptTimeoutMs) || 8000,
            baseBackoffMs: Number(runnerCfg.baseBackoffMs) || 500,
            maxBackoffMs: Number(runnerCfg.maxBackoffMs) || 4000,
            jitterPct: Number(runnerCfg.jitterPct) || 0,
          },
          status: {
            expectedSuccess: runnerCfg.expectedSuccess
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean),
            retryOn: runnerCfg.retryOn
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean),
            failOn: runnerCfg.failOn
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean),
          },
          abortAfterFailures: Number(runnerCfg.abortAfterFailures) || 0,
        }
        await LocalDB.PutString(`scan:cfg:${tid}`, JSON.stringify(payload))

        // 保存数据集配置（包含字段映射）
        const fieldMappings: Record<string, string> = {}
        if (promptField) {
          fieldMappings[promptField] = 'prompt'
        }
        const datasetPayload = {
          testCaseIds: selectedTestCaseIds,
          communityIds: selectedCommunityIds,
          hfDatasetIds: selectedHfDatasetIds,
          fieldMappings,
        }
        await SampleService.SaveTaskDatasetConfig(tid, datasetPayload)
      }

      // 创建任务
      const newTask = await LocalData.createTask(taskData)
      const newId = newTask.id
      if (newId) {
        await saveCfg(newId)
      }
      toast.success(t('task:form.toasts.createSuccess'))

      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('保存任务失败:', error)
      const errorMessage = error instanceof Error ? error.message : t('task:form.toasts.saveFailed')
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleBasicFieldChange = (field: string, value: string | number) => {
    setFormData({ ...formData, [field]: value })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[700px] bg-zinc-950/95 backdrop-blur-xl border-zinc-800 shadow-2xl p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-zinc-800/50 sticky top-0 bg-zinc-950/95 backdrop-blur-xl z-10">
          <DialogTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span className="w-1 h-5 bg-emerald-500 rounded-full"></span>
            {t('task:form.title')}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {t('task:form.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-6 space-y-8">
          {/* 基本信息 */}
          <section>
            <h4 className="text-sm font-semibold text-zinc-300 mb-4 pb-2 border-b border-zinc-900 flex items-center gap-2">
              <span className="text-emerald-500">01.</span> {t('task:form.basicInfo')}
            </h4>
            <TaskBasicFields
              formData={formData}
              projects={projects}
              targets={targets}
              onFieldChange={handleBasicFieldChange}
            />
          </section>

          {/* 数据集选择 */}
          <section>
            <h4 className="text-sm font-semibold text-zinc-300 mb-4 pb-2 border-b border-zinc-900 flex items-center gap-2">
              <span className="text-orange-500">02.</span> {t('task:form.datasets')}
            </h4>
            <DatasetSelector
              testCases={testCases}
              communityPrompts={communityPrompts}
              hfDatasets={hfDatasets}
              selectedTestCaseIds={selectedTestCaseIds}
              selectedCommunityIds={selectedCommunityIds}
              selectedHfDatasetIds={selectedHfDatasetIds}
              loading={loadingDatasets}
              onToggleTestCase={toggleTestCase}
              onToggleCommunity={toggleCommunity}
              onToggleHfDataset={toggleHfDataset}
              onToggleAllTestCases={toggleAllTestCases}
              onToggleAllCommunity={toggleAllCommunity}
              onToggleAllHfDatasets={toggleAllHfDatasets}
              onRefresh={loadAllDatasets}
            />

            {/* 字段映射配置 - 选择数据集后显示 */}
            {(datasetFields.length > 0 || loadingFields) && (
              <div className="mt-6 pt-4 border-t border-zinc-800/50">
                <FieldMappingConfig
                  fields={datasetFields}
                  loading={loadingFields}
                  promptField={promptField}
                  onPromptFieldChange={setPromptField}
                />
              </div>
            )}
          </section>

          {/* 运行配置 */}
          <section>
            <h4 className="text-sm font-semibold text-zinc-300 mb-4 pb-2 border-b border-zinc-900 flex items-center gap-2">
              <span className="text-purple-500">03.</span> {t('task:form.runnerConfig.title')}
            </h4>
            <RunnerConfigSection config={runnerCfg} onChange={setRunnerCfg} />
          </section>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-zinc-800/50 bg-zinc-950/50 sticky bottom-0 backdrop-blur-sm z-10">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:text-white"
          >
            {t('task:form.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20"
          >
            {loading ? t('task:form.saving') : t('task:form.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
