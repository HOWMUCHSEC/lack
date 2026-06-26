import { useState, useCallback, useEffect, useRef } from 'react'
import * as LocalData from '@/services/localData'
import * as ScannerService from '../../../../wailsjs/go/main/ScannerService'
import { scanner, main } from '../../../../wailsjs/go/models'

export interface TaskDetailsState {
  task: LocalData.Task | null
  stats: main.TaskStats | null
  runs: scanner.RunResult[]
  steps: scanner.StepResult[]
  loading: boolean
  project: { id: string; name: string } | null
  target: { id: string; title: string; requestField?: string; responseField?: string } | null
}

export function useTaskDetailsState(taskId: string | undefined) {
  const [task, setTask] = useState<LocalData.Task | null>(null)
  const [stats, setStats] = useState<main.TaskStats | null>(null)
  const [runs, setRuns] = useState<scanner.RunResult[]>([])
  const [steps, setSteps] = useState<scanner.StepResult[]>([])
  const [stepsLoaded, setStepsLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<{ id: string; name: string } | null>(null)
  const [target, setTarget] = useState<{ id: string; title: string; requestField?: string; responseField?: string } | null>(null)
  
  // Track if initial load is done to avoid showing loading spinner on refreshes
  const initialLoadDone = useRef(false)
  const taskIdRef = useRef(taskId)
  const loadSeqRef = useRef(0)
  const stepsLoadSeqRef = useRef(0)

  useEffect(() => {
    taskIdRef.current = taskId
    initialLoadDone.current = false
    loadSeqRef.current += 1
    stepsLoadSeqRef.current += 1
    setTask(null)
    setStats(null)
    setRuns([])
    setSteps([])
    setStepsLoaded(false)
    setProject(null)
    setTarget(null)
    setLoading(Boolean(taskId))
  }, [taskId])

  const loadData = useCallback(async () => {
    if (!taskId) {
      setLoading(false)
      return
    }
    const requestedTaskId = taskId
    const loadSeq = ++loadSeqRef.current
    const isStale = () => loadSeqRef.current !== loadSeq || taskIdRef.current !== requestedTaskId

    // Only show loading spinner on initial load, not on refreshes
    if (!initialLoadDone.current) {
      setLoading(true)
    }
    try {
      // 加载任务基本信息
      const taskData = await LocalData.getTask(requestedTaskId)
      if (isStale()) return
      setTask(taskData)

      if (!taskData) {
        setStats(null)
        setRuns([])
        setSteps([])
        setStepsLoaded(false)
        setProject(null)
        setTarget(null)
        return
      }

      // 加载关联的项目和目标
      let nextProject: { id: string; name: string } | null = null
      let nextTarget: { id: string; title: string; requestField?: string; responseField?: string } | null = null
      if (taskData?.project_id) {
        const p = await LocalData.getProject(taskData.project_id)
        if (isStale()) return
        if (p) nextProject = { id: p.id, name: p.name }
      }
      if (taskData?.goal_id) {
        const tgt = await LocalData.getTarget(taskData.goal_id)
        if (isStale()) return
        if (tgt) nextTarget = {
          id: tgt.id, 
          title: tgt.target_title,
          requestField: tgt.metadata?.request_field || undefined,
          responseField: tgt.metadata?.response_field || undefined,
        }
      }
      setProject(nextProject)
      setTarget(nextTarget)

      // 加载任务统计
      const statsData = await ScannerService.GetTaskStats(requestedTaskId)
      if (isStale()) return
      setStats(statsData)

      // 加载运行历史
      const runsData = await ScannerService.ListTaskRuns(requestedTaskId, 0, 50)
      if (isStale()) return
      setRuns(runsData || [])
      
      // 重置 steps 状态，等待按需加载
      if (!runsData || runsData.length === 0) {
        setSteps([])
        setStepsLoaded(false)
      }
    } catch (e) {
      console.error('加载任务详情失败:', e)
    } finally {
      if (!isStale()) {
        setLoading(false)
        initialLoadDone.current = true
      }
    }
  }, [taskId])

  // Lazy load steps from ALL runs when requested (for Requests/Evaluation tabs)
  const loadSteps = useCallback(async () => {
    if (!taskId || runs.length === 0 || stepsLoaded) return
    const requestedTaskId = taskId
    const stepsLoadSeq = ++stepsLoadSeqRef.current
    const isStale = () => stepsLoadSeqRef.current !== stepsLoadSeq || taskIdRef.current !== requestedTaskId

    try {
      // 加载所有运行记录的步骤数据，合并到一起
      const allSteps: scanner.StepResult[] = []
      for (const run of runs.filter((run) => run.taskID === requestedTaskId)) {
        const stepsData = await ScannerService.ListRunSteps(run.runID, 0, 1000)
        if (isStale()) return
        if (stepsData && stepsData.length > 0) {
          allSteps.push(...stepsData.filter((step) => step.taskID === requestedTaskId))
        }
      }
      if (isStale()) return
      setSteps(allSteps)
      setStepsLoaded(true)
    } catch (e) {
      console.error('加载步骤数据失败:', e)
    }
  }, [runs, stepsLoaded, taskId])

  // Add a single step incrementally (called from event listener)
  const addStep = useCallback((step: scanner.StepResult) => {
    if (!taskId || step.taskID !== taskId) return
    setSteps((prev) => {
      // Avoid duplicates by checking if step already exists
      const key = `${step.runID}-${step.sampleID}-${step.attempt}`
      const exists = prev.some((s) => `${s.runID}-${s.sampleID}-${s.attempt}` === key)
      if (exists) return prev
      return [...prev, step]
    })
  }, [taskId])

  return {
    task,
    stats,
    runs,
    steps,
    loading,
    project,
    target,
    loadData,
    loadSteps,
    stepsLoaded,
    addStep,
  }
}
