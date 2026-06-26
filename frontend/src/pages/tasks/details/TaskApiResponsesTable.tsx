import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { TaskDetailsData } from './types'
import { useTranslation } from 'react-i18next'

export function TaskApiResponsesTable({ data }: { data: TaskDetailsData }) {
  const { t } = useTranslation()
  const rows = data.responses ?? []
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('task:details.apiResponses.headers.time')}</TableHead>
          <TableHead>{t('task:details.apiResponses.headers.method')}</TableHead>
          <TableHead>{t('task:details.apiResponses.headers.endpoint')}</TableHead>
          <TableHead>{t('task:details.apiResponses.headers.statusCode')}</TableHead>
          <TableHead>{t('task:details.apiResponses.headers.duration')}</TableHead>
          <TableHead className="text-right">
            {t('task:details.apiResponses.headers.preview')}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="text-muted-foreground text-sm">{r.timestamp}</TableCell>
            <TableCell>
              <Badge variant="secondary" className="text-xs">
                {r.method}
              </Badge>
            </TableCell>
            <TableCell className="max-w-[360px] truncate text-sm" title={r.endpoint}>
              {r.endpoint}
            </TableCell>
            <TableCell>
              <span
                className={
                  r.statusCode >= 500
                    ? 'text-red-600'
                    : r.statusCode >= 400
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                }
              >
                {r.statusCode}
              </span>
            </TableCell>
            <TableCell>{r.durationMs}</TableCell>
            <TableCell className="text-right">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-muted-foreground line-clamp-2 cursor-default text-xs">
                      {r.responsePreview || r.requestPreview || '-'}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="max-w-[520px] text-xs break-words whitespace-pre-wrap">
                      {r.responsePreview || r.requestPreview || '-'}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
