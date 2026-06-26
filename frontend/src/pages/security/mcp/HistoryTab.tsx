import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
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
import { ClockIcon, EyeIcon, TrashIcon } from '@phosphor-icons/react'
import { toast } from 'sonner'
import * as LocalServer from '@/lib/localServer'
import type { ScanSession } from './types'
import { formatTimestamp, getSeverityCounts } from './types'

interface HistoryTabProps {
  sessions: ScanSession[]
  onReload: () => Promise<void>
}

export function HistoryTab({ sessions, onReload }: HistoryTabProps) {
  const { t } = useTranslation()

  if (sessions.length === 0) {
    return (
      <div className="flex h-[300px] flex-col items-center justify-center text-center">
        <div className="bg-muted/50 flex h-16 w-16 items-center justify-center rounded-full">
          <ClockIcon className="text-muted-foreground h-8 w-8 opacity-50" />
        </div>
        <p className="text-muted-foreground mt-4 font-medium">{t('mcp:noHistory')}</p>
        <p className="text-muted-foreground mt-1 text-xs">{t('mcp:noHistoryDesc')}</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[180px]">{t('mcp:time')}</TableHead>
          <TableHead>{t('mcp:scannerID')}</TableHead>
          <TableHead className="w-[100px]">{t('mcp:status')}</TableHead>
          <TableHead className="w-[120px]">{t('mcp:riskLevel')}</TableHead>
          <TableHead className="w-[80px] text-center">{t('mcp:issues')}</TableHead>
          <TableHead className="text-right">{t('mcp:actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map((sess) => {
          const counts = getSeverityCounts(sess)
          return (
            <TableRow key={sess.id} className="group">
              <TableCell className="text-muted-foreground font-mono text-xs">
                {formatTimestamp(sess.completedAt)}
              </TableCell>
              <TableCell className="font-medium">{sess.scannerId}</TableCell>
              <TableCell>
                <Badge
                  variant={sess.status === 'finished' ? 'secondary' : 'destructive'}
                  className={sess.status === 'finished' ? 'bg-green-100 text-green-700' : ''}
                >
                  {sess.status === 'finished' ? t('mcp:statusFinished') : t('mcp:statusAborted')}
                </Badge>
              </TableCell>
              <TableCell>
                {counts.critical > 0 ? (
                  <Badge
                    variant="destructive"
                    className="h-5 bg-rose-600 px-1.5 py-0.5 text-[10px]"
                  >
                    {t('mcp:severityCritical')}
                  </Badge>
                ) : counts.high > 0 ? (
                  <Badge variant="destructive" className="h-5 px-1.5 py-0.5 text-[10px]">
                    {t('mcp:riskHigh')}
                  </Badge>
                ) : counts.medium > 0 ? (
                  <Badge
                    variant="secondary"
                    className="h-5 bg-orange-100 px-1.5 py-0.5 text-[10px] text-orange-700"
                  >
                    {t('mcp:riskMedium')}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-muted-foreground h-5 px-1.5 py-0.5 text-[10px]"
                  >
                    {t('mcp:riskLow')}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs">
                  {counts.critical > 0 && (
                    <span className="font-medium text-rose-700">{counts.critical}C</span>
                  )}
                  {counts.high > 0 && (
                    <span className="font-medium text-red-600">{counts.high}H</span>
                  )}
                  {counts.medium > 0 && (
                    <span className="font-medium text-orange-600">{counts.medium}M</span>
                  )}
                  {counts.low > 0 && <span className="text-muted-foreground">{counts.low}L</span>}
                  {sess.totalMatches === 0 && <span className="text-muted-foreground">-</span>}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button asChild size="sm" variant="ghost" className="h-8 gap-1 px-2 text-xs">
                    <Link to={`/security/mcp/session/${sess.id}`}>
                      <EyeIcon className="h-3 w-3" />
                      {t('mcp:viewResults')}
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={async () => {
                      if (confirm(t('mcp:deleteConfirm'))) {
                        try {
                          await LocalServer.DeleteScanSession(sess.id)
                          toast.success(t('mcp:deleteSuccess'))
                          await onReload()
                        } catch {
                          toast.error(t('mcp:deleteFailed'))
                        }
                      }
                    }}
                  >
                    <TrashIcon className="h-3 w-3" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
