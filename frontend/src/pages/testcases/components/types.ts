// 本地样本集类型定义

export interface SampleSet {
  id: string
  name: string
  description?: string
  testCaseIds: string[]
  sampleCount: number
  createdAt: number
  updatedAt: number
}

export interface Sample {
  id: string
  testCaseId: string
  testCaseTitle: string
  originalContent: string
  generatedContent: string
  variables: Record<string, string>
  category: string
  severity: string
  tags?: string[]
  createdAt: number
}

export interface HfDatasetMeta {
  hfRepoId: string
  config: string
  split: string
  rowCount: number
  downloadedAt: number
  updatedAt: number
}

export interface LocalHfRow {
  id: number
  data: Record<string, unknown>
}

// 核心样本类型（只保留必要字段）
export interface CommunityPrompt {
  id: number
  labelLv1: string
  labelLv2: string
  promptText: string
  expectedOutput?: string
  promptHash: string
  downloadedAt: number
}

// 统一的数据集类型
export type DatasetSource = 'generated' | 'public' | 'community'

export interface UnifiedDataset {
  id: string
  name: string
  description?: string
  source: DatasetSource
  count: number
  createdAt: number
  // 本地生成的样本集特有字段
  sampleSet?: SampleSet
  // HF 数据集特有字段
  hfMeta?: HfDatasetMeta
  // 核心样本特有字段
  communityPrompt?: CommunityPrompt
}
