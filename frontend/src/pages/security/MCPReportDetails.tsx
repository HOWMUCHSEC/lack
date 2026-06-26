import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import * as LocalServer from '@/lib/localServer'
import { formatDateTime } from '@/lib/date'

interface ReportMeta {
  createdAt?: string
  agent?: string
  total?: number
  high?: number
  medium?: number
  low?: number
}

interface ReportIssue {
  severity?: string
  title?: string
  rule?: string
  file?: string
  line?: number
  evidence?: string
  remediation?: string
}

interface Report {
  meta: ReportMeta
  issues: ReportIssue[]
}

type SeverityFilter = 'all' | 'high' | 'medium' | 'low'

export default function MCPReportDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation('mcp')
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<Report | null>(null)
  const [severity, setSeverity] = useState<SeverityFilter>('all')
  const [q, setQ] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        if (id) {
          const rep = await LocalServer.GetMCPReport(id)
          setReport(rep as Report)
        }
      } catch {
        setReport(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const filtered = useMemo(() => {
    const items = report?.issues || []
    return items.filter((it) => {
      if (severity !== 'all') {
        const sv = String(it.severity || '').toLowerCase()
        if (sv !== severity) return false
      }
      if (q) {
        const text =
          `${it.title} ${it.rule} ${it.file} ${it.evidence} ${it.remediation}`.toLowerCase()
        if (!text.includes(q.toLowerCase())) return false
      }
      return true
    })
  }, [report, severity, q])

  return (
    <PageLayout
      breadcrumbs={[
        { label: t('nav:securityScan'), href: '/security' },
        { label: t('nav:mcpScan'), href: '/security/mcp' },
        { label: t('reportDetails.breadcrumb') },
      ]}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('reportDetails.reportId', { id })}</CardTitle>
            <CardDescription>
              {t('reportDetails.time')}: {report?.meta?.createdAt ? formatDateTime(report.meta.createdAt) : '-'} ·{' '}
              {t('reportDetails.agent')}: {report?.meta?.agent || '-'}
            </CardDescription>
          </div>
          <div className="text-muted-foreground text-xs">
            {t('reportDetails.total')} {report?.meta?.total ?? 0} · {t('reportDetails.high')} {report?.meta?.high ?? 0} · {t('reportDetails.medium')}{' '}
            {report?.meta?.medium ?? 0} · {t('reportDetails.low')} {report?.meta?.low ?? 0}
          </div>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <Select value={severity} onValueChange={(v) => setSeverity(v as SeverityFilter)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder={t('reportDetails.severityFilter')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('reportDetails.severityAll')}</SelectItem>
              <SelectItem value="high">{t('reportDetails.severityHigh')}</SelectItem>
              <SelectItem value="medium">{t('reportDetails.severityMedium')}</SelectItem>
              <SelectItem value="low">{t('reportDetails.severityLow')}</SelectItem>
            </SelectContent>
          </Select>
          <Input
            className="max-w-xs"
            placeholder={t('reportDetails.searchPlaceholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button asChild variant="outline" size="sm">
            <Link to="/security/mcp">{t('reportDetails.backToList')}</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('reportDetails.issueList')}</CardTitle>
          <CardDescription>{t('reportDetails.issueListDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground text-sm">{t('reportDetails.loading')}</div>
          ) : !report ? (
            <div className="text-muted-foreground text-sm">{t('reportDetails.notFound')}</div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">{t('reportDetails.headers.severity')}</TableHead>
                    <TableHead>{t('reportDetails.headers.titleRule')}</TableHead>
                    <TableHead className="w-[22%]">{t('reportDetails.headers.location')}</TableHead>
                    <TableHead className="w-[28%]">{t('reportDetails.headers.evidence')}</TableHead>
                    <TableHead className="w-[22%]">{t('reportDetails.headers.remediation')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((it, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="align-top text-xs font-medium">
                        {String(it.severity || 'low').toUpperCase()}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="text-sm font-medium">{it.title || '-'}</div>
                        <div className="text-muted-foreground text-xs">{it.rule || '-'}</div>
                      </TableCell>
                      <TableCell className="align-top text-xs">
                        <div className="font-mono break-all">{it.file || '-'}</div>
                        <div>
                          {t('reportDetails.line')}: {it.line ?? '-'}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        {it.evidence ? (
                          <pre className="bg-muted max-h-52 overflow-auto rounded p-2 text-xs break-words whitespace-pre-wrap">
                            {String(it.evidence)}
                          </pre>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top text-xs">
                        {it.remediation ? (
                          <div className="break-words whitespace-pre-wrap">
                            {String(it.remediation)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filtered.length === 0 && (
                <div className="text-muted-foreground py-6 text-center text-sm">{t('reportDetails.noMatches')}</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  )
}
