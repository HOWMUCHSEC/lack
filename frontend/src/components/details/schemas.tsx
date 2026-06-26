import React from 'react'
import { Badge } from '@/components/ui/badge'
import { testCaseCategories } from '@/data/test-case-categories'
import { formatDateTime } from '@/lib/date'

export interface Field<T = Record<string, unknown>> {
  key: keyof T | string
  label: string
  render?: (row: T) => React.ReactNode
}

export interface DetailSection<T = Record<string, unknown>> {
  id: string
  label: string
  fields: Field<T>[]
}

export type ProjectRow = {
  id: string
  name: string
  status?: string
  tags?: string[]
  metadata?: { model?: string } | null
  created_at?: string
}

export type ObjectiveRow = {
  id: string
  target_title: string
  target_status?: string
  order_index?: number
  tags?: string[]
  created_at?: string
  projects?: { name?: string } | null
}

export type TestCaseRow = {
  id: string
  category?: string
  title: string
  content?: string
  expected_response?: string
  status?: string
  tags?: string[]
  created_at?: string
  updated_at?: string
}

type TFunction = (key: string) => string

export const projectSections = (t: TFunction): DetailSection<ProjectRow>[] => [
  {
    id: 'basic',
    label: t('common:details.sections.basic'),
    fields: [
      { key: 'name', label: t('common:details.fields.projectName') },
      {
        key: 'status',
        label: t('common:details.fields.status'),
        render: (r) => <Badge variant="outline">{r.status ?? '-'}</Badge>,
      },
      {
        key: 'tags',
        label: t('common:details.fields.tags'),
        render: (r) => (r.tags && r.tags.length ? r.tags.join(', ') : '-'),
      },
    ],
  },
  {
    id: 'meta',
    label: t('common:details.sections.meta'),
    fields: [
      { key: 'id', label: t('common:details.fields.id') },
      { key: 'created_at', label: t('common:details.fields.createdAt'), render: (r) => formatDateTime(r.created_at) },
      { key: 'metadata.model', label: t('common:details.fields.model'), render: (r) => r.metadata?.model ?? '-' },
    ],
  },
  {
    id: 'stats',
    label: t('common:details.sections.stats'),
    fields: [
      {
        key: 'tags.length',
        label: t('common:details.fields.tagsCount'),
        render: (r) => (r.tags ? r.tags.length : 0),
      },
    ],
  },
]

export const objectiveSections = (t: TFunction): DetailSection<ObjectiveRow>[] => [
  {
    id: 'basic',
    label: t('common:details.sections.basic'),
    fields: [
      { key: 'target_title', label: t('common:details.fields.objectiveName') },
      { key: 'projects.name', label: t('common:details.fields.parentProject'), render: (r) => r.projects?.name ?? '-' },
      {
        key: 'target_status',
        label: t('common:details.fields.status'),
        render: (r) => <Badge variant="outline">{r.target_status ?? '-'}</Badge>,
      },
    ],
  },
  {
    id: 'meta',
    label: t('common:details.sections.meta'),
    fields: [
      { key: 'id', label: t('common:details.fields.id') },
      { key: 'created_at', label: t('common:details.fields.createdAt'), render: (r) => formatDateTime(r.created_at) },
      { key: 'order_index', label: t('common:details.fields.orderIndex'), render: (r) => r.order_index ?? '-' },
    ],
  },
  {
    id: 'stats',
    label: t('common:details.sections.stats'),
    fields: [
      { key: 'tags.length', label: t('common:details.fields.tagsCount'), render: (r) => (r.tags ? r.tags.length : 0) },
    ],
  },
]

export const testCaseSections = (t: TFunction): DetailSection<TestCaseRow>[] => [
  {
    id: 'basic',
    label: t('common:details.sections.basic'),
    fields: [
      { key: 'title', label: t('common:details.fields.testCaseTitle') },
      {
        key: 'category',
        label: t('common:details.fields.riskCategory'),
        render: (r) =>
          testCaseCategories.find((c) => c.id === r.category)?.name ?? r.category ?? '-',
      },
      {
        key: 'status',
        label: t('common:details.fields.status'),
        render: (r) => <Badge variant="outline">{r.status ?? '-'}</Badge>,
      },
    ],
  },
  {
    id: 'meta',
    label: t('common:details.sections.meta'),
    fields: [
      { key: 'id', label: t('common:details.fields.id') },
      { key: 'created_at', label: t('common:details.fields.createdAt'), render: (r) => formatDateTime(r.created_at) },
      { key: 'updated_at', label: t('common:details.fields.updatedAt'), render: (r) => formatDateTime(r.updated_at) },
    ],
  },
  {
    id: 'stats',
    label: t('common:details.sections.stats'),
    fields: [
      { key: 'tags.length', label: t('common:details.fields.tagsCount'), render: (r) => (r.tags ? r.tags.length : 0) },
      {
        key: 'content.length',
        label: t('common:details.fields.contentLength'),
        render: (r) => (typeof r.content === 'string' ? r.content.length : 0),
      },
    ],
  },
]
