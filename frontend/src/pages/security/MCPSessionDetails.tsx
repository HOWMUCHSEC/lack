import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ArrowLeft, AlertTriangle, AlertCircle, Info } from 'lucide-react'
import * as LocalServer from '@/lib/localServer'
import type { ScanSession, ResultData } from './mcp/types'
import { formatTimestamp, getSeverityCounts, normalizeScanSession } from './mcp/types'

type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low'

export default function MCPSessionDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation('mcp')
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<ScanSession | null>(null)
  const [severity, setSeverity] = useState<SeverityFilter>('all')
  const [q, setQ] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        if (id) {
          const sess = await LocalServer.GetScanSession(id)
          setSession(normalizeScanSession(sess as ScanSession))
        }
      } catch {
        setSession(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const filtered = useMemo(() => {
    const items = session?.results || []
    return items.filter((it) => {
      if (severity !== 'all') {
        const sv = String(it.severity || '').toLowerCase()
        if (sv !== severity) return false
      }
      if (q) {
        const text =
          `${it.ruleName} ${it.ruleId} ${it.filePath} ${it.matchedText} ${it.description}`.toLowerCase()
        if (!text.includes(q.toLowerCase())) return false
      }
      return true
    })
  }, [session, severity, q])

  const getSeverityIcon = (sev: string) => {
    const s = sev.toLowerCase()
    if (s === 'critical') return <AlertTriangle className="h-4 w-4 text-rose-600" />
    if (s === 'high') return <AlertTriangle className="h-4 w-4 text-red-500" />
    if (s === 'medium') return <AlertCircle className="h-4 w-4 text-orange-500" />
    return <Info className="h-4 w-4 text-gray-500" />
  }

  const getSeverityBadgeVariant = (sev: string) => {
    const s = sev.toLowerCase()
    if (s === 'critical' || s === 'high') return 'destructive' as const
    if (s === 'medium') return 'secondary' as const
    return 'outline' as const
  }

  const counts = getSeverityCounts(session)

  return (
    <PageLayout
      breadcrumbs={[
        { label: t('nav:securityScan'), href: '/security' },
        { label: t('nav:mcpScan'), href: '/security/mcp' },
        { label: t('sessionDetails') },
      ]}
      contentClassName="flex flex-1 flex-col gap-4 overflow-hidden p-4"
    >
      {/* 顶部信息卡片 */}
      <Card className="shrink-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {t('sessionDetails')}
                <span className="bg-muted rounded px-2 py-0.5 font-mono text-sm">
                  #{id?.slice(0, 8)}
                </span>
              </CardTitle>
              <CardDescription className="mt-1">
                {t('scanner')}: {session?.scannerId || '-'} · {t('time')}:{' '}
                {session ? formatTimestamp(session.completedAt) : '-'}
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/security/mcp">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('backToList')}
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* 概览统计 */}
          <div className="bg-muted/30 grid grid-cols-2 gap-4 rounded-lg border p-4 sm:grid-cols-3 md:grid-cols-6">
            <div className="space-y-1 text-center">
              <div className="text-2xl font-bold">{session?.totalFiles || 0}</div>
              <div className="text-muted-foreground text-xs">{t('targets')}</div>
            </div>
            <div className="space-y-1 text-center">
              <div className="text-2xl font-bold">{session?.totalMatches || 0}</div>
              <div className="text-muted-foreground text-xs">{t('totalMatches')}</div>
            </div>
            <div className="space-y-1 text-center">
              <div className="text-2xl font-bold text-rose-700">{counts.critical}</div>
              <div className="text-muted-foreground text-xs">{t('severityCritical')}</div>
            </div>
            <div className="space-y-1 text-center">
              <div className="text-2xl font-bold text-red-600">{counts.high}</div>
              <div className="text-muted-foreground text-xs">{t('riskHigh')}</div>
            </div>
            <div className="space-y-1 text-center">
              <div className="text-2xl font-bold text-orange-600">{counts.medium}</div>
              <div className="text-muted-foreground text-xs">{t('riskMedium')}</div>
            </div>
            <div className="space-y-1 text-center">
              <div className="text-muted-foreground text-2xl font-bold">{counts.low}</div>
              <div className="text-muted-foreground text-xs">{t('riskLow')}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 筛选和结果列表 */}
      <Card className="min-h-0 flex-1 overflow-hidden">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{t('scanResults')}</CardTitle>
              <CardDescription>
                {t('showing')} {filtered.length} / {session?.results?.length || 0} {t('issues')}
              </CardDescription>
            </div>
            <div className="flex flex-1 items-center gap-2 sm:justify-end">
              <Select value={severity} onValueChange={(v) => setSeverity(v as SeverityFilter)}>
                <SelectTrigger className="w-28 shrink-0">
                  <SelectValue placeholder={t('severityFilter')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('severityAll')}</SelectItem>
                  <SelectItem value="critical">{t('severityCritical')}</SelectItem>
                  <SelectItem value="high">{t('severityHigh')}</SelectItem>
                  <SelectItem value="medium">{t('severityMedium')}</SelectItem>
                  <SelectItem value="low">{t('severityLow')}</SelectItem>
                </SelectContent>
              </Select>
              <Input
                className="min-w-0 flex-1 sm:max-w-xs"
                placeholder={t('searchPlaceholder')}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="h-full overflow-auto">
          {loading ? (
            <div className="text-muted-foreground py-12 text-center text-sm">{t('loading')}</div>
          ) : !session ? (
            <div className="text-muted-foreground py-12 text-center text-sm">
              {t('sessionNotFound')}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">{t('noReports')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((r: ResultData, idx: number) => (
                <Card key={idx} className="min-w-0 overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        {getSeverityIcon(r.severity)}
                        <div className="space-y-1">
                          <div className="font-medium">{r.ruleName}</div>
                          <div className="text-muted-foreground font-mono text-xs">{r.ruleId}</div>
                        </div>
                      </div>
                      <Badge
                        variant={getSeverityBadgeVariant(r.severity)}
                        className="text-[10px] uppercase"
                      >
                        {r.severity}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground bg-muted/50 mt-3 rounded px-2 py-1.5 font-mono text-xs break-all">
                      {r.filePath}:{r.line}:{r.column}
                    </div>
                    {r.matchedText && (
                      <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 font-mono text-xs break-all text-red-800">
                        {r.matchedText}
                      </div>
                    )}
                    {r.description && (
                      <p className="text-muted-foreground mt-2 text-sm">{r.description}</p>
                    )}
                    {r.context && (
                      <pre className="mt-2 max-w-full overflow-x-auto rounded border bg-zinc-950 p-3 font-mono text-xs whitespace-pre-wrap text-zinc-300">
                        {r.context}
                      </pre>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  )
}
