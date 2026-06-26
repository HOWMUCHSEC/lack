import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { RefreshCw, Loader2 } from 'lucide-react'
import { scanner } from '../../../../wailsjs/go/models'
import * as ScannerService from '../../../../wailsjs/go/main/ScannerService'
import { toast } from 'sonner'

interface TaskRunsHistoryTableProps {
  runs: scanner.RunResult[]
  onRetrySuccess?: () => void
}

export function TaskRunsHistoryTable({ runs, onRetrySuccess }: TaskRunsHistoryTableProps) {
  const { t } = useTranslation()
  const [retryingRunId, setRetryingRunId] = useState<string | null>(null)

  const handleRetryFailed = async (runId: string) => {
    setRetryingRunId(runId)
    try {
      const newRunId = await ScannerService.RetryFailedRequests(runId)
      toast.success(t('task:details.retryFailed.success', { runId: newRunId }))
      onRetrySuccess?.()
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      toast.error(t('task:details.retryFailed.error', { error: msg }))
    } finally {
      setRetryingRunId(null)
    }
  }

  const formatDuration = (ms: number) => {
    const sec = Math.floor(ms / 1000)
    if (sec < 60) return `${sec}s`
    const min = Math.floor(sec / 60)
    const remSec = sec % 60
    return `${min}m ${remSec}s`
  }

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (runs.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        {t('task:details.empty.runs')}
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('task:details.table.runId')}</TableHead>
          <TableHead>{t('task:details.table.startTime')}</TableHead>
          <TableHead>{t('task:details.table.duration')}</TableHead>
          <TableHead>{t('task:details.table.samples')}</TableHead>
          <TableHead>{t('task:details.table.success')}</TableHead>
          <TableHead>{t('task:details.table.failed')}</TableHead>
          <TableHead>{t('task:details.table.status')}</TableHead>
          <TableHead className="w-[100px]">{t('task:center.table.headers.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.slice().reverse().map((run) => (
          <TableRow key={run.runID}>
            <TableCell className="font-mono text-xs">{run.runID}</TableCell>
            <TableCell>{formatTime(run.startedAt)}</TableCell>
            <TableCell>{formatDuration(run.finishedAt - run.startedAt)}</TableCell>
            <TableCell>{run.total}</TableCell>
            <TableCell className="text-green-600">{run.ok}</TableCell>
            <TableCell className="text-red-600">{run.failed}</TableCell>
            <TableCell>
              {run.aborted ? (
                <Badge variant="destructive">{t('task:details.status.aborted')}</Badge>
              ) : run.failed > 0 ? (
                <Badge className="bg-yellow-100 text-yellow-700">{t('task:details.status.partialFailed')}</Badge>
              ) : (
                <Badge className="bg-green-100 text-green-700">{t('task:details.status.success')}</Badge>
              )}
            </TableCell>
            <TableCell>
              {run.failed > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-orange-600 hover:text-orange-700 hover:bg-orange-100 gap-1"
                        onClick={() => handleRetryFailed(run.runID)}
                        disabled={retryingRunId === run.runID}
                      >
                        {retryingRunId === run.runID ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        <span className="text-xs">{t('task:details.retryFailed.button')}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('task:details.retryFailed.tooltip', { count: run.failed })}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
