import { FC } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export type SetRow = {
  id: string
  label_lv1: string | null
  label_lv2: string | null
  prompt_text: string
  expected_output: string | null
  version: string | null
  lang: string
  min_plan: 'trial' | 'pro' | 'team'
  created_at: string
}

interface Props {
  items: SetRow[]
  statusById: Record<string, 'none' | 'downloaded' | 'update'>
  canAccess: (row: SetRow) => boolean
  onOpenDetails: (row: SetRow) => void
  onDownload: (row: SetRow) => void
}

const SetsTable: FC<Props> = ({ items, statusById, canAccess, onOpenDetails, onDownload }) => {
  const { t } = useTranslation()
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[22%]">{t('testcases:table.headers.category')}</TableHead>
            <TableHead className="w-[36%]">{t('testcases:table.headers.prompt')}</TableHead>
            <TableHead className="w-[10%]">{t('testcases:table.headers.plan')}</TableHead>
            <TableHead className="w-[8%]">{t('testcases:table.headers.lang')}</TableHead>
            <TableHead className="w-[8%]">{t('testcases:table.headers.version')}</TableHead>
            <TableHead className="w-[16%]">{t('testcases:table.headers.createdAt')}</TableHead>
            <TableHead className="w-[16%] text-right">
              {t('testcases:table.headers.actions')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((row) => {
            const planColor =
              row.min_plan === 'team'
                ? 'bg-purple-100 text-purple-700'
                : row.min_plan === 'pro'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
            const status = statusById[row.id] || 'none'
            return (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <div className="truncate font-medium">
                      {row.label_lv2 || row.label_lv1 || t('testcases:table.notGrouped')}
                    </div>
                    {row.label_lv2 && (
                      <div className="text-muted-foreground truncate text-xs">{row.label_lv1}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {canAccess(row) ? (
                    <div className="line-clamp-2 text-sm" title={row.prompt_text}>
                      {row.prompt_text}
                    </div>
                  ) : (
                    <div className="text-muted-foreground text-xs">
                      {t('testcases:table.upgradeToView')}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge className={`text-xs ${planColor}`} variant="secondary">
                    {row.min_plan}
                  </Badge>
                </TableCell>
                <TableCell>{row.lang}</TableCell>
                <TableCell>{row.version || t('testcases:table.versionDefault')}</TableCell>
                <TableCell>{new Date(row.created_at).toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => onOpenDetails(row)}>
                      {t('testcases:table.view')}
                    </Button>
                    {status === 'downloaded' ? (
                      <Button size="sm" variant="outline" disabled>
                        <CheckCircle2 className="mr-1 h-4 w-4 text-green-600" />
                        {t('testcases:table.downloaded')}
                      </Button>
                    ) : status === 'update' ? (
                      <Button size="sm" variant="outline" onClick={() => onDownload(row)}>
                        {t('testcases:table.update')}
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => onDownload(row)}>
                        {t('testcases:table.download')}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export default SetsTable
