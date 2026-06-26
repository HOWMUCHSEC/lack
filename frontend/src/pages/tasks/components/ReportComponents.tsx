import { useTranslation } from 'react-i18next'
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
} from 'recharts'
import {
    ShieldCheck as ShieldCheckIcon,
    Warning as WarningIcon,
    Bug as BugIcon,
    CheckCircle as CheckCircleIcon,
    XCircle as XCircleIcon,
    TrendUp as TrendUpIcon,
    Article as ArticleIcon,
    Info as InfoIcon,
} from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'

// --- Data Types (matching Go struct) ---

export interface EvaluationReportData {
    score: number
    totalTests: number
    passRate: string
    avgTime: string
    security: {
        mcp: SecurityItem
        infra: SecurityItem
        cloud: SecurityItem
    }
    tasks: {
        name: string
        total: number
        completed: number
        failed: number
        successRate: number
    }[]
    performance: {
        name: string
        Accuracy: number
        Precision: number
        Recall: number
    }[]
    sampleCover: {
        total: number
        covered: number
        rate: number
    }
    testCases: {
        id: string
        description: string
        status: string
        time: string
    }[]
    validation: {
        input: string
        output: string
        schema: string
    }
    quickStats: {
        passCount: number
        failCount: number
        skipCount: number
        passRate: number
        peakMemory: string
        avgGPU: string
        throughput: string
        errorRate: string
    }
    research: {
        paperCount: number
        findings: string[]
    }
    generatedAt: string
    projectInfo: string
}

export interface SecurityItem {
    status: string // "secure", "warning", "danger"
    findings: number
    vulnerabilities: number
    critical: number
    riskLevel: string
    threats: number
}


// --- Icons Mapping ---
const SecurityIcon = ({ status }: { status: string }) => {
    if (status === 'secure') return <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
    if (status === 'warning') return <WarningIcon className="h-5 w-5 text-amber-500" />
    return <XCircleIcon className="h-5 w-5 text-rose-500" />
}

// --- Components ---

export function SummaryCard({
    title,
    value,
    subValue,
    icon,
    trend,
}: {
    title: string
    value: string | number
    subValue?: string
    icon?: React.ReactNode
    trend?: 'up' | 'down' | 'neutral'
}) {
    return (
        <Card>
            <CardContent className="p-6 flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
                    <div className="text-2xl font-bold">{value}</div>
                    {subValue && <p className="text-xs text-muted-foreground mt-1">{subValue}</p>}
                </div>
                <div className="flex flex-col items-end gap-2">
                    {icon && <div className="p-2 bg-primary/10 rounded-full text-primary">{icon}</div>}
                    {trend && (
                        <div className={`flex items-center text-xs ${trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-rose-500' : 'text-muted-foreground'}`}>
                            <TrendUpIcon className={`h-3 w-3 mr-1 ${trend === 'down' ? 'rotate-180' : ''}`} />
                            <span>{trend === 'up' ? '+5%' : trend === 'down' ? '-2%' : '0%'}</span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

export function SecuritySection({ data }: { data: EvaluationReportData['security'] }) {
    const { t } = useTranslation('reports')

    const getStatusLabel = (status: string) => {
        return t(`modelEval.security.status.${status}`)
    }

    const getVariant = (status: string) => {
        if (status === 'secure') return 'default'
        if (status === 'warning') return 'outline' // customized below
        return 'destructive'
    }

    const getBadgeClass = (status: string) => {
        if (status === 'secure') return 'bg-emerald-500 hover:bg-emerald-600'
        if (status === 'warning') return 'text-amber-500 border-amber-500'
        return ''
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <ShieldCheckIcon className="h-5 w-5" />
                    {t('modelEval.security.title')}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* MCP */}
                    <div className="p-4 rounded-lg border bg-card/50">
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold">{t('modelEval.security.mcp')}</span>
                            <SecurityIcon status={data.mcp.status} />
                        </div>
                        <div className="text-sm space-y-1 text-muted-foreground">
                            <div className="flex justify-between">
                                <span>{t('status.label')}:</span>
                                <Badge variant={getVariant(data.mcp.status)} className={getBadgeClass(data.mcp.status)}>
                                    {getStatusLabel(data.mcp.status)}
                                </Badge>
                            </div>
                            <div className="flex justify-between">
                                <span>{t('modelEval.security.findings', { count: data.mcp.findings })}</span>
                            </div>
                        </div>
                    </div>

                    {/* Infra */}
                    <div className="p-4 rounded-lg border bg-card/50">
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold">{t('modelEval.security.infra')}</span>
                            <SecurityIcon status={data.infra.status} />
                        </div>
                        <div className="text-sm space-y-1 text-muted-foreground">
                            <div className="flex justify-between">
                                <span>{t('status.label')}:</span>
                                <Badge variant={getVariant(data.infra.status)} className={getBadgeClass(data.infra.status)}>
                                    {getStatusLabel(data.infra.status)}
                                </Badge>
                            </div>
                            <div className="flex justify-between">
                                <span>{t('modelEval.security.vulnerabilities', { count: data.infra.vulnerabilities })}</span>
                            </div>
                        </div>
                    </div>

                    {/* Cloud */}
                    <div className="p-4 rounded-lg border bg-card/50">
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold">{t('modelEval.security.cloud')}</span>
                            <SecurityIcon status={data.cloud.status} />
                        </div>
                        <div className="text-sm space-y-1 text-muted-foreground">
                            <div className="flex justify-between">
                                <span>{t('status.label')}:</span>
                                <Badge variant={getVariant(data.cloud.status)} className={getBadgeClass(data.cloud.status)}>
                                    {getStatusLabel(data.cloud.status)}
                                </Badge>
                            </div>
                            <div className="flex justify-between">
                                <span>{t('modelEval.security.riskLevel', { level: data.cloud.riskLevel })}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

export function EvaluationSection({ tasks }: Pick<EvaluationReportData, 'tasks'>) {
    const { t } = useTranslation('reports')

    return (
        <Card className="col-span-1">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5" />
                    {t('modelEval.evaluation.title')}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <h4 className="text-sm font-semibold mb-3">{t('modelEval.evaluation.taskMetrics')}</h4>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('modelEval.evaluation.table.taskName')}</TableHead>
                                <TableHead className="text-right">{t('modelEval.evaluation.table.total')}</TableHead>
                                <TableHead className="text-right">{t('modelEval.evaluation.table.completed')}</TableHead>
                                <TableHead className="text-right">{t('modelEval.evaluation.table.successRate')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(tasks ?? []).map((task, i) => (
                                <TableRow key={i}>
                                    <TableCell className="font-medium">{task.name}</TableCell>
                                    <TableCell className="text-right">{task.total}</TableCell>
                                    <TableCell className="text-right">{task.completed}</TableCell>
                                    <TableCell className="text-right text-emerald-500 font-bold">{task.successRate.toFixed(1)}%</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    )
}

export function SampleCoverageSection({ sampleCover }: Pick<EvaluationReportData, 'sampleCover'>) {
    const { t } = useTranslation('reports')

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{t('modelEval.evaluation.sampleCoverage')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('modelEval.evaluation.covered', { rate: sampleCover.rate, covered: sampleCover.covered, total: sampleCover.total })}</span>
                </div>
                <Progress value={sampleCover.rate} className="h-2" />
            </CardContent>
        </Card>
    )
}

export function TestCaseSection({ testCases, validation }: Pick<EvaluationReportData, 'testCases' | 'validation'>) {
    const { t } = useTranslation('reports')

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <BugIcon className="h-5 w-5" />
                    {t('modelEval.testCases.title')}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('modelEval.testCases.table.testId')}</TableHead>
                            <TableHead>{t('modelEval.testCases.table.description')}</TableHead>
                            <TableHead>{t('modelEval.testCases.table.status')}</TableHead>
                            <TableHead className="text-right">{t('modelEval.testCases.table.time')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(testCases ?? []).map((tc, i) => (
                            <TableRow key={i}>
                                <TableCell className="font-mono text-xs">{tc.id}</TableCell>
                                <TableCell>{tc.description}</TableCell>
                                <TableCell>
                                    <Badge variant={tc.status === 'PASS' ? 'default' : 'destructive'}
                                        className={tc.status === 'PASS' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
                                        {tc.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right font-mono">{tc.time}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                <div className="rounded-lg border bg-muted/30 p-4">
                    <h4 className="text-sm font-semibold mb-3">{t('modelEval.testCases.variableValidation')}</h4>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                            <span>{t('modelEval.testCases.validation.input')}</span>
                            <span className={validation.input === 'PASS' ? "text-emerald-500 font-medium" : "text-rose-500 font-medium"}>
                                {validation.input}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span>{t('modelEval.testCases.validation.output')}</span>
                            <span className={validation.output === 'PASS' ? "text-emerald-500 font-medium" : "text-rose-500 font-medium"}>
                                {validation.output}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span>{t('modelEval.testCases.validation.schema')}</span>
                            <span className={validation.schema === 'PASS' ? "text-emerald-500 font-medium" : "text-rose-500 font-medium"}>
                                {validation.schema}
                            </span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

export function QuickStats({ stats }: { stats: EvaluationReportData['quickStats'] }) {
    const { t } = useTranslation('reports')

    const data = [
        { name: 'Pass', value: stats.passCount, color: '#10b981' },
        { name: 'Fail', value: stats.failCount, color: '#f43f5e' },
        { name: 'Skip', value: stats.skipCount, color: '#eab308' },
    ]

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{t('modelEval.quickStats.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="h-[200px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-bold">{stats.passRate.toFixed(1)}%</span>
                        <span className="text-xs text-muted-foreground">{t('modelEval.quickStats.passRateLabel')}</span>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{t('modelEval.quickStats.peakMemory')}</span>
                        <span className="font-mono">{stats.peakMemory}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{t('modelEval.quickStats.avgGpuUtil')}</span>
                        <span className="font-mono">{stats.avgGPU}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{t('modelEval.quickStats.throughput')}</span>
                        <span className="font-mono">{stats.throughput}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{t('modelEval.quickStats.errorRate')}</span>
                        <span className="font-mono">{stats.errorRate}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

export function ResearchSection({ research }: { research: EvaluationReportData['research'] }) {
    const { t } = useTranslation('reports')

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <ArticleIcon className="h-5 w-5" />
                    {t('modelEval.research.title')}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg text-primary">
                    <InfoIcon className="h-5 w-5" />
                    <span className="font-medium text-sm">{t('modelEval.research.referencedPapers', { count: research.paperCount })}</span>
                </div>

                <div className="space-y-3">
                    <h4 className="text-sm font-semibold">{t('modelEval.research.keyFindings')}</h4>
                    <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                        {research.findings.map((finding, i) => (
                            <li key={i}>{finding}</li>
                        ))}
                    </ul>
                </div>
            </CardContent>
        </Card>
    )
}
