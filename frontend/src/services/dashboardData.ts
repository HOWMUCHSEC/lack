import * as LocalData from '@/services/localData'
import type { TargetMetadata } from '@/types'

export type DashboardItemStatus = 'active' | 'completed' | 'paused'

export interface DashboardObjectiveProgress {
  id: string
  name: string
  status: DashboardItemStatus
  progress: number
  totalTasks: number
  completedTasks: number
}

export interface DashboardProjectProgress {
  id: string
  name: string
  model: string
  status: DashboardItemStatus
  progress: number
  objectives: DashboardObjectiveProgress[]
}

export interface ObjectiveStatusStat {
  status: DashboardItemStatus
  count: number
  rate: number
}

export interface ObjectiveCompletionSummary {
  completed: number
  total: number
  completionRate: number
  byStatus: ObjectiveStatusStat[]
}

const SUCCESSFUL_TASK_STATUSES = new Set(['done', 'completed', 'success'])
const TERMINAL_TASK_STATUSES = new Set([
  'done',
  'completed',
  'success',
  'failed',
  'blocked',
  'cancelled',
  'canceled',
  'aborted',
])

export async function loadProjectProgress(limit = 3): Promise<DashboardProjectProgress[]> {
  const [projects, targets, tasks] = await Promise.all([
    LocalData.listProjects(),
    LocalData.listTargets(),
    LocalData.listTasks(),
  ])

  return buildProjectProgress(projects, targets, tasks, limit)
}

export async function loadObjectiveCompletion(): Promise<ObjectiveCompletionSummary> {
  const [targets, tasks] = await Promise.all([LocalData.listTargets(), LocalData.listTasks()])
  return buildObjectiveCompletion(targets, tasks)
}

export function buildProjectProgress(
  projects: LocalData.Project[],
  targets: LocalData.Target[],
  tasks: LocalData.Task[],
  limit = 3,
): DashboardProjectProgress[] {
  const visibleTargets = targets.filter((target) => !target.deleted_at)
  const tasksByTarget = groupTasksByTarget(tasks)
  const targetsByProject = new Map<string, LocalData.Target[]>()

  for (const target of visibleTargets) {
    const projectID = target.project_id
    if (!projectID) continue
    const projectTargets = targetsByProject.get(projectID) ?? []
    projectTargets.push(target)
    targetsByProject.set(projectID, projectTargets)
  }

  const sortedProjects = projects
    .filter((project) => !project.deleted_at)
    .sort((a, b) => getTime(b.created_at) - getTime(a.created_at))

  const safeLimit = limit > 0 ? limit : sortedProjects.length

  return sortedProjects.slice(0, safeLimit).map((project) => {
    const projectTargets = sortTargets(targetsByProject.get(project.id) ?? [])
    const objectives = projectTargets.map((target) =>
      buildObjectiveProgress(target, tasksByTarget.get(target.id) ?? []),
    )
    const progress =
      objectives.length > 0
        ? Math.round(objectives.reduce((sum, item) => sum + item.progress, 0) / objectives.length)
        : progressFromProjectStatus(project.status)

    return {
      id: project.id,
      name: project.name,
      model: getProjectModel(project, projectTargets),
      status: mapProjectStatus(project.status),
      progress,
      objectives,
    }
  })
}

export function buildObjectiveCompletion(
  targets: LocalData.Target[],
  tasks: LocalData.Task[],
): ObjectiveCompletionSummary {
  const tasksByTarget = groupTasksByTarget(tasks)
  const objectives = sortTargets(targets.filter((target) => !target.deleted_at)).map((target) =>
    buildObjectiveProgress(target, tasksByTarget.get(target.id) ?? []),
  )
  const total = objectives.length
  const completed = objectives.filter((objective) => objective.status === 'completed').length
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

  const byStatus: ObjectiveStatusStat[] = (['active', 'completed', 'paused'] as const).map(
    (status) => {
      const count = objectives.filter((objective) => objective.status === status).length
      return {
        status,
        count,
        rate: total > 0 ? Math.round((count / total) * 100) : 0,
      }
    },
  )

  return {
    completed,
    total,
    completionRate,
    byStatus,
  }
}

function buildObjectiveProgress(
  target: LocalData.Target,
  tasks: LocalData.Task[],
): DashboardObjectiveProgress {
  const visibleTasks = tasks.filter((task) => !task.deleted_at)
  const totalTasks = visibleTasks.length
  const completedTasks = visibleTasks.filter((task) => isSuccessfulTask(task.status)).length
  const finishedTasks = visibleTasks.filter((task) => isTerminalTask(task.status)).length
  const progress = totalTasks > 0 ? Math.round((finishedTasks / totalTasks) * 100) : 0

  return {
    id: target.id,
    name: target.target_title,
    status: getObjectiveStatus(target, totalTasks, completedTasks),
    progress,
    totalTasks,
    completedTasks,
  }
}

function getObjectiveStatus(
  target: LocalData.Target,
  totalTasks: number,
  completedTasks: number,
): DashboardItemStatus {
  if (normalize(target.target_status) === 'archived') {
    return 'paused'
  }

  if (totalTasks > 0 && completedTasks === totalTasks) {
    return 'completed'
  }

  return 'active'
}

function groupTasksByTarget(tasks: LocalData.Task[]): Map<string, LocalData.Task[]> {
  const result = new Map<string, LocalData.Task[]>()

  for (const task of tasks) {
    if (task.deleted_at || !task.goal_id) continue
    const targetTasks = result.get(task.goal_id) ?? []
    targetTasks.push(task)
    result.set(task.goal_id, targetTasks)
  }

  return result
}

function isSuccessfulTask(status: string): boolean {
  return SUCCESSFUL_TASK_STATUSES.has(normalize(status))
}

function isTerminalTask(status: string): boolean {
  return TERMINAL_TASK_STATUSES.has(normalize(status))
}

function sortTargets(targets: LocalData.Target[]): LocalData.Target[] {
  return [...targets].sort((a, b) => {
    if (a.order_index !== b.order_index) return a.order_index - b.order_index
    return getTime(b.created_at) - getTime(a.created_at)
  })
}

function getProjectModel(project: LocalData.Project, targets: LocalData.Target[]): string {
  for (const target of targets) {
    const modelName = (target.metadata as TargetMetadata | null | undefined)?.model_name
    if (typeof modelName === 'string' && modelName.trim()) {
      return modelName.trim()
    }
  }

  const metadataModel = project.metadata?.model
  if (typeof metadataModel === 'string' && metadataModel.trim()) {
    return metadataModel.trim()
  }

  return ''
}

function mapProjectStatus(status: LocalData.Project['status']): DashboardItemStatus {
  switch (normalize(status)) {
    case 'completed':
      return 'completed'
    case 'paused':
      return 'paused'
    default:
      return 'active'
  }
}

function progressFromProjectStatus(status: LocalData.Project['status']): number {
  return mapProjectStatus(status) === 'completed' ? 100 : 0
}

function normalize(status: string): string {
  return status.trim().toLowerCase()
}

function getTime(value?: string): number {
  if (!value) return 0
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}
