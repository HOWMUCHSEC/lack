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
import { getRiskCategoryIcon, TaskDetailsData } from './types'
import { useTranslation } from 'react-i18next'

export function TaskRiskPromptsTable({ data }: { data: TaskDetailsData }) {
  const { t } = useTranslation()
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('task:details.riskPrompts.headers.category')}</TableHead>
          <TableHead>{t('task:details.riskPrompts.headers.prompt')}</TableHead>
          <TableHead className="text-right">
            {t('task:details.riskPrompts.headers.severity')}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.riskyPrompts.map((rp) => (
          <TableRow key={rp.id}>
            <TableCell className="text-sm whitespace-nowrap">
              <span className="inline-flex items-center gap-1">
                <span
                  className={
                    rp.severity === 'critical'
                      ? 'text-red-600'
                      : rp.severity === 'high'
                        ? 'text-amber-600'
                        : rp.severity === 'medium'
                          ? 'text-blue-600'
                          : 'text-emerald-600'
                  }
                >
                  {getRiskCategoryIcon(rp.category)}
                </span>
                <span>{rp.category}</span>
              </span>
            </TableCell>
            <TableCell className="text-sm">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="line-clamp-2 cursor-default">{rp.prompt}</div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="max-w-[420px] text-xs">{rp.prompt}</div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </TableCell>
            <TableCell className="text-right">
              <Badge
                variant={rp.severity === 'critical' ? 'destructive' : 'secondary'}
                className={
                  rp.severity === 'high'
                    ? 'bg-amber-100 text-amber-700'
                    : rp.severity === 'medium'
                      ? 'bg-blue-100 text-blue-700'
                      : rp.severity === 'low'
                        ? 'bg-emerald-100 text-emerald-700'
                        : ''
                }
              >
                {rp.severity}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
