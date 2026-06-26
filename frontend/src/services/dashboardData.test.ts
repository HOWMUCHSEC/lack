import { describe, expect, it } from 'vitest'
import {
  buildObjectiveCompletion,
  buildProjectProgress,
  type ObjectiveCompletionSummary,
} from './dashboardData'
import type { Project, Target, Task } from './localData'

describe('dashboardData', () => {
  it('does not synthesize mock dashboard data when local DB records are empty', () => {
    const projects = buildProjectProgress([], [], [])
    const completion = buildObjectiveCompletion([], [])
    const expectedCompletion: ObjectiveCompletionSummary = {
      completed: 0,
      total: 0,
      completionRate: 0,
      byStatus: [
        { status: 'active', count: 0, rate: 0 },
        { status: 'completed', count: 0, rate: 0 },
        { status: 'paused', count: 0, rate: 0 },
      ],
    }

    expect(projects).toEqual([])
    expect(completion).toEqual(expectedCompletion)
  })

  it('aggregates project progress and objective completion from real project, target, and task records', () => {
    const projects: Project[] = [
      createProject({ id: 'project-old', status: 'Completed', created_at: '2026-01-01T00:00:00Z' }),
      createProject({ id: 'project-live', status: 'Active', created_at: '2026-01-02T00:00:00Z' }),
    ]
    const targets: Target[] = [
      createTarget({
        id: 'objective-complete',
        project_id: 'project-live',
        order_index: 0,
        metadata: { model_name: 'gpt-real' },
      }),
      createTarget({
        id: 'objective-running',
        project_id: 'project-live',
        order_index: 1,
      }),
      createTarget({
        id: 'objective-archived',
        project_id: 'project-old',
        target_status: 'archived',
      }),
    ]
    const tasks: Task[] = [
      createTask({ id: 'task-complete', goal_id: 'objective-complete', status: 'done' }),
      createTask({ id: 'task-finished', goal_id: 'objective-running', status: 'done' }),
      createTask({ id: 'task-running', goal_id: 'objective-running', status: 'running' }),
      createTask({ id: 'task-archived', goal_id: 'objective-archived', status: 'done' }),
    ]

    const progress = buildProjectProgress(projects, targets, tasks, 1)
    const completion = buildObjectiveCompletion(targets, tasks)

    expect(progress).toHaveLength(1)
    expect(progress[0]).toMatchObject({
      id: 'project-live',
      model: 'gpt-real',
      status: 'active',
      progress: 75,
    })
    expect(progress[0].objectives).toMatchObject([
      {
        id: 'objective-complete',
        status: 'completed',
        progress: 100,
        totalTasks: 1,
        completedTasks: 1,
      },
      {
        id: 'objective-running',
        status: 'active',
        progress: 50,
        totalTasks: 2,
        completedTasks: 1,
      },
    ])
    expect(completion).toMatchObject({
      completed: 1,
      total: 3,
      completionRate: 33,
      byStatus: [
        { status: 'active', count: 1, rate: 33 },
        { status: 'completed', count: 1, rate: 33 },
        { status: 'paused', count: 1, rate: 33 },
      ],
    })
  })
})

function createProject(overrides: Partial<Project>): Project {
  return {
    id: 'project',
    name: 'Real Project',
    status: 'Active',
    created_at: '2026-01-01T00:00:00Z',
    metadata: {},
    ...overrides,
  }
}

function createTarget(overrides: Partial<Target>): Target {
  return {
    id: 'objective',
    project_id: 'project',
    target_title: 'Real Objective',
    target_status: 'planned',
    order_index: 0,
    created_at: '2026-01-01T00:00:00Z',
    metadata: {},
    ...overrides,
  }
}

function createTask(overrides: Partial<Task>): Task {
  return {
    id: 'task',
    title: 'Real Task',
    status: 'todo',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}
