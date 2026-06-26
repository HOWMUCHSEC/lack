export interface EvalItemResult {
    index: number
    sampleId: string
    prompt: string
    response: string
    score: number
    label: string
    reasoning: string
    status: 'pending' | 'running' | 'completed' | 'failed'
    error?: string
}

export interface JudgeModel {
    id: string
    name: string
    baseUrl?: string | null
    apiKey?: string | null
}
