import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { PageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Tabs,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import {
    FileText as FileTextIcon,
    Trash as TrashIcon,
    Plus as PlusIcon,
    MagnifyingGlass as MagnifyingGlassIcon,
    ListDashes as ListDashesIcon,
    CheckCircle as CheckCircleIcon,
    WarningCircle as WarningCircleIcon,
    Spinner as SpinnerIcon,
    Circle as CircleIcon,
    Eye as EyeIcon,
    Folder as FolderIcon,
    CalendarBlank as CalendarBlankIcon,
    ChartBar as ChartBarIcon,
    Hash as HashIcon,
    DownloadSimple as DownloadSimpleIcon
} from '@phosphor-icons/react'
import { Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ListReports, GenerateReport, DeleteReport, ExportReport } from '../../../wailsjs/go/main/ReportService'
import * as localData from '@/services/localData'
import { cn } from '@/lib/utils'

interface ReportListItem {
    id: string
    projectId: string
    projectName: string
    status: string
    createdAt: number
    score: number
    totalTests: number
}

interface Project {
    id: string
    name: string
}

interface Target {
    id: string
    project_id?: string
    target_title: string
    metadata?: {
        base_url?: string | null
        model_name?: string | null
        purpose?: string
    } | null
}

export default function ReportList() {
    const { t } = useTranslation(['reports', 'nav', 'common'])
    const navigate = useNavigate()

    const [reports, setReports] = useState<ReportListItem[]>([])
    const [projects, setProjects] = useState<Project[]>([])
    const [targets, setTargets] = useState<Target[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isGenerating, setIsGenerating] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [reportToDelete, setReportToDelete] = useState<string | null>(null)
    const [selectedProjectId, setSelectedProjectId] = useState<string>('')
    const [selectedTargetId, setSelectedTargetId] = useState<string>('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')

    const loadReports = async () => {
        try {
            setIsLoading(true)
            const res = await ListReports()
            // Sort by createdAt desc
            const sorted = (res ?? []).sort((a: ReportListItem, b: ReportListItem) => b.createdAt - a.createdAt)
            setReports(sorted)
        } catch (e) {
            console.error(e)
            toast.error(t('reports:toasts.loadFailed'))
        } finally {
            setIsLoading(false)
        }
    }

    const loadProjects = async () => {
        try {
            const res = await localData.listProjects()
            setProjects(res ?? [])
        } catch (e) {
            console.error('listProjects error:', e)
        }
    }

    // Load targets when project selection changes
    useEffect(() => {
        const loadTargetsForProject = async () => {
            if (!selectedProjectId) {
                setTargets([])
                setSelectedTargetId('')
                return
            }
            try {
                const allTargets = await localData.listTargets()
                // Filter targets by project_id AND purpose === 'target' (目标模型 type only)
                const projectTargets = allTargets.filter(t =>
                    t.project_id === selectedProjectId &&
                    t.metadata?.purpose === 'target'
                )
                setTargets(projectTargets)
                setSelectedTargetId('')
            } catch (e) {
                console.error('loadTargets error:', e)
                setTargets([])
            }
        }
        loadTargetsForProject()
    }, [selectedProjectId])

    useEffect(() => {
        loadReports()
        loadProjects()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleGenerate = async () => {
        if (!selectedProjectId) {
            toast.error('请选择一个项目')
            return
        }
        if (!selectedTargetId) {
            toast.error('请选择目标模型')
            return
        }

        // Find project name and target model name
        const selectedProject = projects.find(p => p.id === selectedProjectId)
        const projectName = selectedProject?.name || 'Unknown'
        const selectedTarget = targets.find(t => t.id === selectedTargetId)
        const targetModelName = selectedTarget?.target_title || 'Unknown'
        // Get target metadata for matching with EvalProjects
        const targetBaseUrl = selectedTarget?.metadata?.base_url || ''
        const targetModelId = selectedTarget?.metadata?.model_name || ''

        try {
            setIsGenerating(true)
            await GenerateReport(selectedProjectId, projectName, targetModelName, targetBaseUrl, targetModelId)
            toast.success('报告生成成功')
            setDialogOpen(false)
            setSelectedProjectId('')
            setSelectedTargetId('')
            loadReports()
        } catch (e) {
            console.error(e)
            toast.error('报告生成失败')
        } finally {
            setIsGenerating(false)
        }
    }

    const handleDeleteClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        setReportToDelete(id)
        setDeleteDialogOpen(true)
    }

    const handleDeleteConfirm = async () => {
        if (!reportToDelete) return

        try {
            await DeleteReport(reportToDelete)
            toast.success('报告已删除')
            loadReports()
        } catch (e) {
            console.error(e)
            toast.error('删除失败')
        } finally {
            setDeleteDialogOpen(false)
            setReportToDelete(null)
        }
    }

    const handleExport = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        try {
            await ExportReport(id)
            // Ideally we check if the user cancelled (path === ""), but since we don't return path,
            // we rely on ExportReport not returning error if cancelled.
            // If the Go export function returns "" path and no error for cancellation, we might assume success.
            // But let's just show success for now if no error.
            toast.success(t('reports:actions.export') + ' ' + t('common:success'))
        } catch (error) {
            console.error('Export failed:', error)
            // Wails returns error if cancelled? No, usually empty string.
            // If my Go code returns nil on empty string, then success toast appears.
            // That's fine for now.
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            case 'generating': return "bg-sky-500/10 text-sky-400 border-sky-500/20"
            case 'failed': return "bg-rose-500/10 text-rose-400 border-rose-500/20"
            default: return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircleIcon className="h-3.5 w-3.5" weight="fill" />
            case 'generating': return <SpinnerIcon className="h-3.5 w-3.5 animate-spin" weight="duotone" />
            case 'failed': return <WarningCircleIcon className="h-3.5 w-3.5" weight="fill" />
            default: return <CircleIcon className="h-3.5 w-3.5" />
        }
    }

    const filteredReports = useMemo(() => {
        return reports.filter(r => {
            // Status Filter
            if (statusFilter !== 'all') {
                if (r.status !== statusFilter) {
                    return false
                }
            }

            // Search Filter
            if (searchQuery) {
                const q = searchQuery.toLowerCase()
                return (
                    r.id.toLowerCase().includes(q) ||
                    r.projectName?.toLowerCase().includes(q)
                )
            }
            return true
        })
    }, [reports, statusFilter, searchQuery])

    const counts = useMemo(() => {
        return {
            all: reports.length,
            completed: reports.filter(r => r.status === 'completed').length,
            generating: reports.filter(r => r.status === 'generating').length,
            failed: reports.filter(r => r.status === 'failed').length
        }
    }, [reports])

    return (
        <PageLayout breadcrumbs={[{ label: t('nav:modelEvaluation') }, { label: t('nav:evaluationReports') }]}>
            {/* Header */}
            <div className="mb-8 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-500 shadow-[0_0_15px_-3px_rgba(139,92,246,0.3)]">
                        <FileTextIcon className="h-6 w-6" weight="duotone" />
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-2xl font-bold tracking-tight text-white">{t('reports:pageTitle')}</h1>
                        <p className="text-sm font-medium text-zinc-400">{t('reports:pageDesc')}</p>
                    </div>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-900/20">
                            <PlusIcon className="mr-2 h-4 w-4" />
                            {t('reports:detail.generate')}
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{t('reports:detail.selectProject')}</DialogTitle>
                            <DialogDescription>
                                {t('reports:detail.selectProjectDesc')}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                            <div>
                                <label className="text-sm font-medium mb-2 block">{t('reports:selectProject')}</label>
                                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="选择项目" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {projects.map((p) => (
                                            <SelectItem key={p.id} value={p.id}>
                                                {p.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-2 block">{t('reports:selectTargetModel')}</label>
                                <div className="flex flex-col gap-2">
                                    {targets.length === 0 ? (
                                        <p className="text-sm text-muted-foreground p-2 border rounded-md bg-muted/50">{t('reports:noTargetModels')}</p>
                                    ) : (
                                        <Select value={selectedTargetId} onValueChange={setSelectedTargetId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="选择目标模型" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {targets.map((t) => (
                                                    <SelectItem key={t.id} value={t.id}>
                                                        {t.target_title}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                {t('common:cancel')}
                            </Button>
                            <Button onClick={handleGenerate} disabled={isGenerating || !selectedProjectId || !selectedTargetId}>
                                {isGenerating && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                                {t('reports:detail.generate')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Filter Bar */}
            <div className="mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
                <Tabs defaultValue="all" value={statusFilter} onValueChange={setStatusFilter} className="w-full md:w-auto">
                    <TabsList className="bg-zinc-900/50 border border-zinc-800/50 p-1">
                        <TabsTrigger value="all" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-400 text-xs px-3 py-1.5 h-auto">
                            <ListDashesIcon className="mr-2 h-4 w-4" />
                            {t('reports:allTab')} <Badge variant="secondary" className="ml-2 bg-zinc-800 text-zinc-400 h-4 px-1 text-[9px]">{counts.all}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="completed" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-400 text-xs px-3 py-1.5 h-auto">
                            <CheckCircleIcon className="mr-2 h-4 w-4 text-emerald-500" weight="fill" />
                            {t('reports:status.completed')} <Badge variant="secondary" className="ml-2 bg-zinc-800 text-zinc-400 h-4 px-1 text-[9px]">{counts.completed}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="generating" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-400 text-xs px-3 py-1.5 h-auto">
                            <SpinnerIcon className="mr-2 h-4 w-4 animate-spin text-sky-500" weight="bold" />
                            {t('reports:status.generating')} <Badge variant="secondary" className="ml-2 bg-zinc-800 text-zinc-400 h-4 px-1 text-[9px]">{counts.generating}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="failed" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-400 text-xs px-3 py-1.5 h-auto">
                            <WarningCircleIcon className="mr-2 h-4 w-4 text-rose-500" weight="fill" />
                            {t('reports:status.failed')} <Badge variant="secondary" className="ml-2 bg-zinc-800 text-zinc-400 h-4 px-1 text-[9px]">{counts.failed}</Badge>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="relative w-full md:w-64">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input
                        placeholder="Search reports..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-zinc-900/40 border-zinc-800 focus-visible:ring-violet-500/30"
                    />
                </div>
            </div>

            {/* Report Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-40 rounded-xl bg-zinc-900/20 border border-zinc-800/50 animate-pulse" />
                    ))}
                </div>
            ) : filteredReports.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 py-16 text-center">
                    <FileTextIcon className="mx-auto mb-4 h-12 w-12 text-zinc-600 opacity-50" />
                    <h3 className="text-lg font-medium text-zinc-300">{t('reports:table.empty')}</h3>
                    <p className="text-sm text-zinc-500 mt-2 max-w-xs mx-auto text-center">{t('reports:emptyHint')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredReports.map((report) => (
                        <div
                            key={report.id}
                            className="group relative flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 transition-all hover:bg-zinc-900 hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-500/5 hover:-translate-y-1"
                        >
                            <div className="p-4 pb-2 space-y-3">
                                {/* Top Row: Title & Status */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="space-y-1.5 min-w-0 flex-1">
                                        <h3
                                            className="font-semibold text-zinc-200 truncate group-hover:text-violet-400 transition-colors cursor-pointer"
                                            onClick={() => navigate(`/tasks/reports/${report.id}`)}
                                        >
                                            {t('reports:reportPrefix')} {report.id.slice(-8)}
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px] gap-1", getStatusColor(report.status))}>
                                                {getStatusIcon(report.status)}
                                                {t(`reports:status.${report.status}`)}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>

                                {/* Metadata */}
                                <div className="grid grid-cols-2 gap-x-2 gap-y-2 text-xs text-zinc-500">
                                    <TooltipProvider delayDuration={200}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="flex items-center gap-2 cursor-help">
                                                    <HashIcon className="h-4 w-4 text-zinc-600 shrink-0" />
                                                    <span className="font-mono truncate">{report.id}</span>
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>{t('reports:reportId')}</p>
                                            </TooltipContent>
                                        </Tooltip>

                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="flex items-center gap-2 cursor-help overflow-hidden">
                                                    <FolderIcon className="h-4 w-4 text-zinc-600 shrink-0" />
                                                    <span className="truncate">{report.projectName || '-'}</span>
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>{t('reports:table.headers.project')}</p>
                                            </TooltipContent>
                                        </Tooltip>

                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="flex items-center gap-2 cursor-help">
                                                    <CalendarBlankIcon className="h-4 w-4 text-zinc-600 shrink-0" />
                                                    <span>{report.createdAt ? new Date(report.createdAt).toLocaleDateString() : '-'}</span>
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>{t('reports:table.headers.createdAt')}</p>
                                            </TooltipContent>
                                        </Tooltip>

                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="flex items-center gap-2 cursor-help">
                                                    <ChartBarIcon className="h-4 w-4 text-zinc-600 shrink-0" />
                                                    <span>{t('reports:scoreLabel', { score: report.score !== undefined ? report.score.toFixed(1) : '-' })}</span>
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>{t('reports:evaluationScore')}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            </div>

                            {/* Action Footer */}
                            <div className="p-2 border-t border-zinc-800/50 mt-auto flex items-center gap-1 bg-zinc-900/20 rounded-b-xl">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="flex-1 h-8 text-xs font-medium text-zinc-400 border border-transparent hover:border-zinc-700 hover:bg-zinc-800 hover:text-white transition-all"
                                    onClick={() => navigate(`/tasks/reports/${report.id}`)}
                                >
                                    <EyeIcon className="mr-2 h-3.5 w-3.5" />
                                    {t('common:view')}
                                </Button>

                                <div className="h-4 w-px bg-zinc-800" />

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="flex-1 h-8 text-xs font-medium text-zinc-400 border border-transparent hover:border-zinc-700 hover:bg-zinc-800 hover:text-white transition-all"
                                    onClick={(e) => handleExport(e, report.id)}
                                >
                                    <DownloadSimpleIcon className="mr-2 h-3.5 w-3.5" />
                                    {t('reports:actions.export')}
                                </Button>

                                <div className="h-4 w-px bg-zinc-800" />

                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 shrink-0 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                                    onClick={(e) => handleDeleteClick(e, report.id)}
                                >
                                    <TrashIcon className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                title="删除报告"
                description="确定要删除这份评测报告吗？此操作无法撤销。"
                onConfirm={handleDeleteConfirm}
                variant="destructive"
            />
        </PageLayout>
    )
}
