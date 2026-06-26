/**
 * Local data service for projects, models (targets), and templates
 * Uses Wails DB bindings to store data in local Badger DB
 */
import * as Sentry from '@sentry/react'
import * as DB from '../../wailsjs/go/main/DB'
import type { TargetMetadata } from '@/types'

// Re-export shared types for backward compatibility
export type { TargetMetadata } from '@/types'

// Key prefixes
const PREFIX = {
  PROJECT: 'project:',
  PROJECT_TEMPLATE: 'project_template:',
  TARGET: 'target:',
  TARGET_TEMPLATE: 'target_template:',
  TASK: 'task:',
}

// ============ Types ============

export interface Project {
  id: string
  name: string
  description?: string | null
  status: 'Active' | 'Completed' | 'Paused'
  tags?: string[]
  metadata?: Record<string, unknown>
  created_at: string
  updated_at?: string
  deleted_at?: string | null
}

export interface ProjectTemplate {
  id: string
  name: string
  description?: string | null
  tags?: string[]
  usage_count?: number
  is_public: boolean
  created_at: string
  updated_at?: string
  deleted_at?: string | null
}

export interface Target {
  id: string
  project_id?: string
  target_title: string
  target_details?: string | null
  target_status: string
  order_index: number
  tags?: string[]
  metadata?: TargetMetadata | null
  created_at: string
  updated_at?: string
  deleted_at?: string | null
}

export interface Task {
  id: string
  project_id?: string | null
  goal_id?: string | null
  title: string
  description?: string | null
  status: string
  priority?: string
  order_index?: number
  tags?: string[]
  creator_id?: string
  created_at: string
  updated_at?: string
  deleted_at?: string | null
}

export interface TargetTemplate {
  id: string
  name: string
  description?: string | null
  category?: string | null
  base_url?: string | null
  api_token?: string | null
  request_headers?: string | null
  request_body_template?: string | null
  tags?: string[]
  metadata?: Record<string, unknown>
  usage_count?: number
  is_public: boolean
  created_at: string
  updated_at?: string
  deleted_at?: string | null
}

// ============ Helpers ============

function generateId(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

async function getItem<T>(key: string): Promise<T | null> {
  try {
    const data = await DB.GetString(key)
    if (!data) return null
    return JSON.parse(data) as T
  } catch (error) {
    console.error('[LocalData] getItem failed', { key, error })
    Sentry.captureException(error, { tags: { source: 'localData', operation: 'getItem' } })
    return null
  }
}

async function setItem<T>(key: string, value: T): Promise<void> {
  try {
    await DB.PutString(key, JSON.stringify(value))
  } catch (error) {
    console.error('[LocalData] setItem failed', { key, error })
    Sentry.captureException(error, { tags: { source: 'localData', operation: 'setItem' } })
    throw error // 重新抛出，让调用方知道保存失败
  }
}

/** 默认列表查询限制 */
const DEFAULT_LIST_LIMIT = 1000

/** 列出指定前缀的所有项目 */
async function listAllItems<T>(prefix: string, limit = DEFAULT_LIST_LIMIT): Promise<T[]> {
  const all: T[] = []
  const pageLimit = Math.max(1, limit)
  let offset = 0

  while (true) {
    try {
      const items = await DB.ListPrefix(prefix, offset, pageLimit)
      all.push(
        ...items
          .map((kv) => {
            try {
              return JSON.parse(kv.value) as T
            } catch {
              return null
            }
          })
          .filter((item): item is T => item !== null),
      )
      offset += items.length
      if (items.length < pageLimit) break
    } catch (error) {
      console.error('[LocalData] listAllItems failed', { prefix, offset, limit: pageLimit, error })
      Sentry.captureException(error, { tags: { source: 'localData', operation: 'listAllItems' } })
      break
    }
  }

  return all
}

// ============ Project CRUD ============

export async function listProjects(): Promise<Project[]> {
  const all = await listAllItems<Project>(PREFIX.PROJECT)
  return all
    .filter((p) => !p.deleted_at)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export async function getProject(id: string): Promise<Project | null> {
  return getItem<Project>(PREFIX.PROJECT + id)
}

export async function createProject(
  data: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>,
): Promise<Project> {
  const project: Project = {
    ...data,
    id: generateId(),
    created_at: now(),
  }
  await setItem(PREFIX.PROJECT + project.id, project)
  return project
}

export async function updateProject(id: string, data: Partial<Project>): Promise<Project | null> {
  const existing = await getProject(id)
  if (!existing) return null
  const updated: Project = {
    ...existing,
    ...data,
    id,
    updated_at: now(),
  }
  await setItem(PREFIX.PROJECT + id, updated)
  return updated
}

export async function deleteProject(id: string): Promise<boolean> {
  const existing = await getProject(id)
  if (!existing) return false
  // Soft delete
  existing.deleted_at = now()
  await setItem(PREFIX.PROJECT + id, existing)
  return true
}

export async function getProjectsByIds(ids: string[]): Promise<Project[]> {
  const results = await Promise.all(ids.map((id) => getProject(id)))
  return results.filter((p): p is Project => p !== null && !p.deleted_at)
}

// ============ Project Template CRUD ============

export async function listProjectTemplates(): Promise<ProjectTemplate[]> {
  const all = await listAllItems<ProjectTemplate>(PREFIX.PROJECT_TEMPLATE)
  return all
    .filter((t) => !t.deleted_at)
    .sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0))
}

export async function getProjectTemplate(id: string): Promise<ProjectTemplate | null> {
  return getItem<ProjectTemplate>(PREFIX.PROJECT_TEMPLATE + id)
}

export async function createProjectTemplate(
  data: Omit<ProjectTemplate, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>,
): Promise<ProjectTemplate> {
  const template: ProjectTemplate = {
    ...data,
    id: generateId(),
    created_at: now(),
    usage_count: 0,
  }
  await setItem(PREFIX.PROJECT_TEMPLATE + template.id, template)
  return template
}

export async function updateProjectTemplate(
  id: string,
  data: Partial<ProjectTemplate>,
): Promise<ProjectTemplate | null> {
  const existing = await getProjectTemplate(id)
  if (!existing) return null
  const updated: ProjectTemplate = {
    ...existing,
    ...data,
    id,
    updated_at: now(),
  }
  await setItem(PREFIX.PROJECT_TEMPLATE + id, updated)
  return updated
}

export async function deleteProjectTemplate(id: string): Promise<boolean> {
  const existing = await getProjectTemplate(id)
  if (!existing) return false
  existing.deleted_at = now()
  await setItem(PREFIX.PROJECT_TEMPLATE + id, existing)
  return true
}

// ============ Target (Model) CRUD ============

export async function listTargets(): Promise<Target[]> {
  const all = await listAllItems<Target>(PREFIX.TARGET)
  return all.filter((t) => !t.deleted_at).sort((a, b) => a.order_index - b.order_index)
}

export async function getTarget(id: string): Promise<Target | null> {
  return getItem<Target>(PREFIX.TARGET + id)
}

export async function createTarget(
  data: Omit<Target, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>,
): Promise<Target> {
  const target: Target = {
    ...data,
    id: generateId(),
    created_at: now(),
  }
  await setItem(PREFIX.TARGET + target.id, target)
  return target
}

export async function updateTarget(id: string, data: Partial<Target>): Promise<Target | null> {
  const existing = await getTarget(id)
  if (!existing) return null
  const updated: Target = {
    ...existing,
    ...data,
    id,
    updated_at: now(),
  }
  await setItem(PREFIX.TARGET + id, updated)
  return updated
}

export async function deleteTarget(id: string): Promise<boolean> {
  const existing = await getTarget(id)
  if (!existing) return false
  existing.deleted_at = now()
  await setItem(PREFIX.TARGET + id, existing)
  return true
}

export async function getTargetsByIds(ids: string[]): Promise<Target[]> {
  const results = await Promise.all(ids.map((id) => getTarget(id)))
  return results.filter((t): t is Target => t !== null && !t.deleted_at)
}

// ============ Target Template (Model Template) CRUD ============

export async function listTargetTemplates(): Promise<TargetTemplate[]> {
  const all = await listAllItems<TargetTemplate>(PREFIX.TARGET_TEMPLATE)
  return all
    .filter((t) => !t.deleted_at)
    .sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0))
}

export async function getTargetTemplate(id: string): Promise<TargetTemplate | null> {
  return getItem<TargetTemplate>(PREFIX.TARGET_TEMPLATE + id)
}

export async function createTargetTemplate(
  data: Omit<TargetTemplate, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>,
): Promise<TargetTemplate> {
  const template: TargetTemplate = {
    ...data,
    id: generateId(),
    created_at: now(),
    usage_count: 0,
  }
  await setItem(PREFIX.TARGET_TEMPLATE + template.id, template)
  return template
}

export async function updateTargetTemplate(
  id: string,
  data: Partial<TargetTemplate>,
): Promise<TargetTemplate | null> {
  const existing = await getTargetTemplate(id)
  if (!existing) return null
  const updated: TargetTemplate = {
    ...existing,
    ...data,
    id,
    updated_at: now(),
  }
  await setItem(PREFIX.TARGET_TEMPLATE + id, updated)
  return updated
}

export async function deleteTargetTemplate(id: string): Promise<boolean> {
  const existing = await getTargetTemplate(id)
  if (!existing) return false
  existing.deleted_at = now()
  await setItem(PREFIX.TARGET_TEMPLATE + id, existing)
  return true
}

// ============ Task CRUD ============

export async function listTasks(): Promise<Task[]> {
  const all = await listAllItems<Task>(PREFIX.TASK)
  return all
    .filter((t) => !t.deleted_at && t.title) // 过滤已删除和无效数据
    .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
}

export async function getTask(id: string): Promise<Task | null> {
  return getItem<Task>(PREFIX.TASK + id)
}

export async function createTask(
  data: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>,
): Promise<Task> {
  const task: Task = {
    ...data,
    id: generateId(),
    created_at: now(),
  }
  await setItem(PREFIX.TASK + task.id, task)
  return task
}

export async function updateTask(id: string, data: Partial<Task>): Promise<Task | null> {
  const existing = await getTask(id)
  if (!existing) return null
  const updated: Task = {
    ...existing,
    ...data,
    id,
    updated_at: now(),
  }
  await setItem(PREFIX.TASK + id, updated)
  return updated
}

export async function deleteTask(id: string): Promise<boolean> {
  const existing = await getTask(id)
  if (!existing) return false
  existing.deleted_at = now()
  await setItem(PREFIX.TASK + id, existing)
  return true
}

export async function getTasksByIds(ids: string[]): Promise<Task[]> {
  const results = await Promise.all(ids.map((id) => getTask(id)))
  return results.filter((task): task is Task => task !== null && !task.deleted_at)
}
