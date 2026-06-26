import { useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { PageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    DownloadSimpleIcon,
    TrendUpIcon,
    CheckCircleIcon,
    ClockIcon,
    ListNumbersIcon,
    FileTextIcon,
} from '@phosphor-icons/react'
import {
    SummaryCard,
    EvaluationSection,
    TestCaseSection,
    QuickStats,
    SampleCoverageSection,
    type EvaluationReportData,
} from './components/ReportComponents'
import { GetReportByID, ExportReportAsPDF, ExportReportAsMarkdown } from '../../../wailsjs/go/main/ReportService'
import { toast } from 'sonner'
import { Loader2Icon } from 'lucide-react'
import { useParams } from 'react-router-dom'

export default function EvaluationReport() {
    const { t } = useTranslation(['reports', 'nav', 'common'])
    const { id: reportId } = useParams<{ id: string }>()
    const contentRef = useRef<HTMLDivElement>(null)

    const [data, setData] = useState<EvaluationReportData | null>(null)
    const [projectInfo, setProjectInfo] = useState('')
    const [generatedAt, setGeneratedAt] = useState('')
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            if (!reportId) return
            try {
                setIsLoading(true)
                const res = await GetReportByID(reportId)
                if (res?.data) {
                    setData(res.data)
                    setProjectInfo(res.projectName || res.data?.projectInfo || '')
                    setGeneratedAt(res.data?.generatedAt || '')
                }
            } catch (e) {
                console.error(e)
                toast.error(t('reports:toasts.loadFailed'))
            } finally {
                setIsLoading(false)
            }
        }
        fetchData()
    }, [reportId, t])

    const handleExport = async (format: 'pdf' | 'markdown') => {
        if (!reportId) return

        try {
            toast.loading(t('reports:loading'), { id: "export" })

            if (format === 'markdown') {
                await ExportReportAsMarkdown(reportId)
                toast.success(t('reports:actions.exportMarkdown') + " " + t('common:toasts.success'), { id: "export" })
            } else if (format === 'pdf') {
                await ExportReportAsPDF(reportId)
                toast.success(t('reports:actions.exportPdf') + " " + t('common:toasts.success'), { id: "export" })
            }
        } catch (e) {
            console.error('Export error:', e)
            toast.error(t('common:toasts.error'), { id: "export" })
        }
    }

    // Fallback if data is insufficient for some reason, though normally loading state covers it
    const scoreVal = data?.score ? data.score.toFixed(1) : "0.0"

    return (
        <PageLayout
            breadcrumbs={[
                { label: t('nav:modelEvaluation') },
                { label: t('nav:evaluationReports') },
            ]}
        >
            <div className="space-y-6 pb-10" ref={contentRef}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-500 shadow-[0_0_15px_-3px_rgba(139,92,246,0.3)]">
                            <FileTextIcon className="h-6 w-6" weight="duotone" />
                        </div>
                        <div className="space-y-1">
                            <h1 className="text-2xl font-bold tracking-tight">{t('reports:modelEval.title')}</h1>
                            <p className="text-sm text-muted-foreground">{isLoading ? "Loading..." : t('reports:modelEval.projectInfo', { project: projectInfo, date: generatedAt })}</p>
                        </div>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button size="sm">
                                <DownloadSimpleIcon className="mr-2 h-4 w-4" />
                                {t('reports:detail.export')}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleExport('pdf')}>
                                {t('reports:actions.exportPdf')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport('markdown')}>
                                {t('reports:actions.exportMarkdown')}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {isLoading || !data ? (
                    <div className="h-[400px] flex items-center justify-center">
                        <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <>
                        {/* 1. Summary Cards Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <SummaryCard
                                title={t('reports:modelEval.summary.overallScore')}
                                value={scoreVal}
                                subValue={parseFloat(scoreVal) > 90 ? t('reports:modelEval.summary.excellent') : parseFloat(scoreVal) > 75 ? t('reports:modelEval.summary.good') : t('reports:modelEval.summary.average')}
                                icon={<TrendUpIcon className="h-6 w-6" />}
                                trend="up"
                            />
                            <SummaryCard
                                title={t('reports:modelEval.summary.totalTests')}
                                value={data.totalTests.toLocaleString()}
                                icon={<ListNumbersIcon className="h-6 w-6" />}
                            />
                            <SummaryCard
                                title={t('reports:modelEval.summary.passRate')}
                                value={data.passRate}
                                icon={<CheckCircleIcon className="h-6 w-6" />}
                                trend="up"
                            />
                            <SummaryCard
                                title={t('reports:modelEval.summary.avgResponseTime')}
                                value={data.avgTime}
                                icon={<ClockIcon className="h-6 w-6" />}
                                trend="down"
                            />
                        </div>

                        {/* 2. Main Content Area */}
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                            {/* Left Column (Main Results) - Spans 2 columns on large screens */}
                            <div className="xl:col-span-2 space-y-6">
                                <EvaluationSection
                                    tasks={data.tasks}
                                />
                                <TestCaseSection
                                    testCases={data.testCases}
                                    validation={data.validation}
                                />
                            </div>

                            {/* Right Column (Sidebar Stats) - Spans 1 column */}
                            <div className="space-y-6">
                                <QuickStats stats={data.quickStats} />
                                <SampleCoverageSection sampleCover={data.sampleCover} />
                            </div>
                        </div>

                        {/* Footer info */}
                        <div className="text-center text-xs text-muted-foreground pt-10 border-t">
                            <p>{t('reports:modelEval.footer', { date: new Date().getFullYear() })}</p>
                        </div>
                    </>
                )}
            </div>
        </PageLayout>
    )
}
