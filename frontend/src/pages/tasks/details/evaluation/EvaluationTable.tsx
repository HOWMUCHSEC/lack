import { useTranslation } from 'react-i18next'
import {
    Square,
    AlertCircle,
    Loader2,
    CheckCircle2,
    XCircle,
    Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { EvalItemResult } from './types'

interface EvaluationTableProps {
    evalStatus: 'idle' | 'running' | 'paused' | 'completed'
    evalProgress: { current: number; total: number }
    onStop: () => void
    results: EvalItemResult[]
}

export function EvaluationTable({
    evalStatus,
    evalProgress,
    onStop,
    results,
}: EvaluationTableProps) {
    const { t } = useTranslation()

    return (
        <div className="space-y-4">
            {/* 评测进度条（运行中时显示） */}
            {evalStatus === 'running' && (
                <div className="flex items-center gap-3 rounded-xl border border-blue-900/30 bg-blue-950/20 p-4">
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={onStop}
                        className="shadow-lg shadow-red-900/20"
                    >
                        <Square className="mr-2 h-4 w-4" />
                        {t('task:details.evaluation.stop')}
                    </Button>
                    <div className="flex flex-1 items-center gap-3">
                        <Progress value={(evalProgress.current / evalProgress.total) * 100} className="flex-1 h-2 bg-zinc-800" indicatorClassName="bg-blue-500" />
                        <span className="text-zinc-400 text-sm font-mono">
                            {evalProgress.current} / {evalProgress.total}
                        </span>
                    </div>
                </div>
            )}

            {/* 评测结果表格 */}
            {results.length > 0 && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 overflow-hidden">
                    <ScrollArea className="h-[560px]">
                        <Table className="table-fixed w-full">
                            <colgroup>
                                <col className="w-12" />      {/* # 序号 */}
                                <col className="w-[320px]" /> {/* 样本 */}
                                <col className="w-28" />      {/* 状态 */}
                                <col className="w-16" />      {/* 评分 */}
                                <col className="w-24" />      {/* 标签 */}
                                <col className="w-[200px]" /> {/* 结果 */}
                                <col className="w-16" />      {/* 操作 */}
                            </colgroup>
                            <TableHeader className="bg-zinc-900/50 sticky top-0 z-10">
                                <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
                                    <TableHead className="text-zinc-400 text-center">#</TableHead>
                                    <TableHead className="text-zinc-400">{t('task:details.evaluation.table.sample')}</TableHead>
                                    <TableHead className="text-zinc-400 text-center">{t('task:details.evaluation.table.status')}</TableHead>
                                    <TableHead className="text-zinc-400 text-center">{t('task:details.evaluation.table.score')}</TableHead>
                                    <TableHead className="text-zinc-400 text-center">{t('task:details.evaluation.table.label')}</TableHead>
                                    <TableHead className="text-zinc-400">{t('task:details.evaluation.table.result')}</TableHead>
                                    <TableHead className="text-zinc-400 text-center">{t('task:details.evaluation.table.actions')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {results.map((item) => (
                                    <TableRow key={item.index} className="border-zinc-800 hover:bg-zinc-900/30 transition-colors">
                                        <TableCell className="font-mono text-xs text-zinc-500 text-center">{item.index + 1}</TableCell>
                                        <TableCell className="text-sm py-3">
                                            <div className="truncate text-zinc-300 font-medium mb-0.5">{item.sampleId}</div>
                                            <div className="truncate text-xs text-zinc-500">{item.prompt}</div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {item.status === 'pending' && (
                                                <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700">
                                                    <AlertCircle className="mr-1 h-3 w-3" />
                                                    {t('task:details.evaluation.status.pending')}
                                                </Badge>
                                            )}
                                            {item.status === 'running' && (
                                                <Badge className="bg-blue-900/30 text-blue-400 border-blue-800 hover:bg-blue-900/50">
                                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                                    {t('task:details.evaluation.status.running')}
                                                </Badge>
                                            )}
                                            {item.status === 'completed' && (
                                                <Badge className="bg-emerald-900/30 text-emerald-400 border-emerald-800 hover:bg-emerald-900/50">
                                                    <CheckCircle2 className="mr-1 h-3 w-3" />
                                                    {t('task:details.evaluation.status.completed')}
                                                </Badge>
                                            )}
                                            {item.status === 'failed' && (
                                                <Badge className="bg-red-900/30 text-red-400 border-red-800 hover:bg-red-900/50">
                                                    <XCircle className="mr-1 h-3 w-3" />
                                                    {t('task:details.evaluation.status.failed')}
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {item.status === 'completed' && (
                                                <span
                                                    className={`font-bold font-mono ${item.score >= 60 ? 'text-emerald-500' : 'text-red-500'
                                                        }`}
                                                >
                                                    {item.score}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {item.label === 'pass' && (
                                                <Badge className="bg-emerald-900/30 text-emerald-400 border-emerald-800 hover:bg-emerald-900/50">{t('task:details.evaluation.label.pass')}</Badge>
                                            )}
                                            {item.label === 'fail' && (
                                                <Badge className="bg-red-900/30 text-red-400 border-red-800 hover:bg-red-900/50">{t('task:details.evaluation.label.fail')}</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm text-zinc-400">
                                            <div className="line-clamp-2">{item.reasoning || '-'}</div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800"
                                                        disabled={item.status !== 'completed' && item.status !== 'failed'} // Allow viewing failed too usually
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-zinc-950/95 backdrop-blur-xl border-zinc-800">
                                                    <DialogHeader>
                                                        <DialogTitle className="text-white flex items-center gap-2">
                                                            <span className={`w-2 h-2 rounded-full ${item.score >= 60 ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                                            {t('task:details.evaluation.detailTitle', { index: item.index + 1 })}
                                                        </DialogTitle>
                                                    </DialogHeader>
                                                    <div className="space-y-6 pt-2">
                                                        {/* Score Panel */}
                                                        <div className="flex items-center gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
                                                            <div className="text-center px-4 border-r border-zinc-800">
                                                                <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">{t('task:details.evaluation.detail.score')}</div>
                                                                <div className={`text-3xl font-bold ${item.score >= 60 ? 'text-emerald-500' : 'text-red-500'}`}>{item.score}</div>
                                                            </div>
                                                            <div className="text-center px-4 border-r border-zinc-800">
                                                                <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">{t('task:details.evaluation.detail.label')}</div>
                                                                {item.label === 'pass' && (
                                                                    <Badge className="bg-emerald-900/30 text-emerald-400 border-emerald-800 hover:bg-emerald-900/50">{t('task:details.evaluation.label.pass')}</Badge>
                                                                )}
                                                                {item.label === 'fail' && (
                                                                    <Badge className="bg-red-900/30 text-red-400 border-red-800 hover:bg-red-900/50">{t('task:details.evaluation.label.fail')}</Badge>
                                                                )}
                                                            </div>
                                                            <div className="px-2 flex-1">
                                                                <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">{t('task:details.evaluation.detail.reasoning')}</div>
                                                                <p className="text-sm text-zinc-300 line-clamp-2">{item.reasoning}</p>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-6">
                                                            <div>
                                                                <Label className="text-zinc-400 text-xs uppercase tracking-wider font-semibold">
                                                                    {t('task:details.evaluation.detail.prompt')}
                                                                </Label>
                                                                <div className="mt-2 h-[300px] overflow-auto rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 text-xs whitespace-pre-wrap text-zinc-300 font-mono">
                                                                    {item.prompt || '-'}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <Label className="text-zinc-400 text-xs uppercase tracking-wider font-semibold">
                                                                    {t('task:details.evaluation.detail.response')}
                                                                </Label>
                                                                <div className="mt-2 h-[300px] overflow-auto rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 text-xs whitespace-pre-wrap text-zinc-300 font-mono">
                                                                    {item.response || '-'}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <Label className="text-zinc-400 text-xs uppercase tracking-wider font-semibold">
                                                                {t('task:details.evaluation.detail.fullReasoning')}
                                                            </Label>
                                                            <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 text-sm whitespace-pre-wrap text-zinc-300">
                                                                {item.reasoning || '-'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>
            )}
        </div>
    )
}
