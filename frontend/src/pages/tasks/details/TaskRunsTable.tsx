import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { TaskDetailsData } from './types'

export function TaskRunsTable({ data }: { data: TaskDetailsData }) {
  const { t } = useTranslation()
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('task:details.runs.headers.runId')}</TableHead>
          <TableHead>{t('task:details.runs.headers.startTime')}</TableHead>
          <TableHead>{t('task:details.runs.headers.duration')}</TableHead>
          <TableHead>{t('task:details.runs.headers.status')}</TableHead>
          <TableHead className="text-right">{t('task:details.runs.headers.findings')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.runs.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-medium">{r.id}</TableCell>
            <TableCell className="text-muted-foreground text-sm">{r.startedAt}</TableCell>
            <TableCell>{r.durationSec}</TableCell>
            <TableCell>
              <div className="inline-flex items-center gap-1.5 text-sm">
                {r.status === 'in_progress' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                ) : r.status === 'done' ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                )}
                <span>
                  {r.status === 'in_progress' ? '进行中' : r.status === 'done' ? '已完成' : '失败'}
                </span>
              </div>
            </TableCell>
            <TableCell className="text-right">{r.findings}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
