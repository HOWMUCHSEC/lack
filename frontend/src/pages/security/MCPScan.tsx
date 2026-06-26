import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { PageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EventsOn } from '../../../wailsjs/runtime'
import * as LocalServer from '@/lib/localServer'
import {
  ShieldCheckIcon,
  CopyIcon,
  CheckIcon,
  PulseIcon,
  DownloadSimpleIcon,
  WifiHighIcon,
  WifiSlashIcon,
  ClockIcon,
  MagnifyingGlassIcon,
} from '@phosphor-icons/react'
import { toast } from 'sonner'

// 导入拆分的组件和类型
import {
  type ServerStatus,
  type ResultData,
  type ScanSession,
  type ActiveScan,
  isValidServerStatus,
  getSeverityCounts,
  normalizeScanSession,
  RealtimeTab,
  HistoryTab,
  ClientSetupModal,
} from './mcp'

function formatUptime(status: ServerStatus, now: number) {
  if (!status.running || !status.startedAt) return '--'
  const elapsedSeconds = Math.max(0, Math.floor((now - status.startedAt) / 1000))
  const hours = Math.floor(elapsedSeconds / 3600)
  const minutes = Math.floor((elapsedSeconds % 3600) / 60)
  const seconds = elapsedSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

function redactServerStatus(value: unknown): unknown {
  if (isValidServerStatus(value)) {
    return { ...value, authToken: value.authToken ? '[redacted]' : value.authToken }
  }
  return value
}

export default function MCPScanPage() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<ServerStatus>({ running: false })
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showClientModal, setShowClientModal] = useState(false)

  // 实时扫描和历史记录
  const [activeTab, setActiveTab] = useState<'realtime' | 'history'>('realtime')
  const [activeScans, setActiveScans] = useState<Map<string, ActiveScan>>(new Map())
  const [historySessions, setHistorySessions] = useState<ScanSession[]>([])
  const [clientConnected, setClientConnected] = useState(false)
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set())
  const [now, setNow] = useState(() => Date.now())
  const activeScansRef = useRef<Map<string, ActiveScan>>(new Map())

  // 切换结果展开/收起
  const toggleResultExpand = useCallback((key: string) => {
    setExpandedResults((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  // 加载历史扫描记录
  const reloadHistory = useCallback(async () => {
    try {
      const list = await LocalServer.ListScanSessions(0, 50)
      if (Array.isArray(list)) {
        setHistorySessions(list.map((session) => normalizeScanSession(session as ScanSession)))
      }
    } catch (error) {
      console.error('Failed to load scan sessions:', error)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        const st = await LocalServer.GetLocalServerStatus()
        if (isValidServerStatus(st)) {
          setStatus(st)
        } else {
          console.error('Invalid server status received:', redactServerStatus(st))
          toast.error(t('mcp:invalidStatus'))
        }
      } catch (error) {
        console.error('Failed to get server status:', error)
        toast.error(t('mcp:statusFetchFailed'))
      }
      await reloadHistory()
    }
    init()

    const off1 = EventsOn('mcp:server:started', (st: unknown) => {
      if (isValidServerStatus(st)) {
        setStatus(st)
      } else {
        console.error('Invalid server status from event:', redactServerStatus(st))
      }
    })
    const off2 = EventsOn('mcp:server:stopped', () => setStatus({ running: false }))

    // WebSocket 连接事件
    const off3 = EventsOn('mcp:ws:connected', () => {
      setClientConnected(true)
      toast.success(t('mcp:clientConnected'), {
        icon: <WifiHighIcon className="h-4 w-4 text-green-500" />,
      })
    })
    const off4 = EventsOn('mcp:ws:disconnected', () => {
      setClientConnected(false)
      // A websocket disconnect is not a scan-complete signal.
      setActiveScans((prev) => {
        const next = new Map(prev)
        for (const [id, scan] of next) {
          if (scan.status === 'running') {
            next.set(id, { ...scan, status: 'disconnected', completedAt: Date.now() })
          }
        }
        activeScansRef.current = next
        return next
      })
      // 延迟 2 秒再显示断开提示，避免闪烁
      setTimeout(() => {
        toast.info(t('mcp:clientDisconnected'), {
          icon: <WifiSlashIcon className="h-4 w-4 text-gray-500" />,
        })
      }, 2000)
    })

    // 扫描事件
    const off5 = EventsOn('mcp:scan:started', (session: ActiveScan) => {
      const counts = getSeverityCounts(session)
      toast.info(t('mcp:scanStarted'), {
        description: `Scanner: ${session.scannerId}`,
        icon: <MagnifyingGlassIcon className="h-4 w-4 text-blue-500" />,
      })
      setActiveScans((prev) => {
        const next = new Map(prev)
        next.set(session.id, {
          ...session,
          status: 'running',
          critical: counts.critical,
          high: counts.high,
          medium: counts.medium,
          low: counts.low,
          results: session.results || [],
        })
        activeScansRef.current = next
        return next
      })
      setActiveTab('realtime')
    })

    const off6 = EventsOn(
      'mcp:scan:result',
      (data: {
        scanId: string
        result: ResultData
        meta: { scannedFiles: number; totalMatches: number }
      }) => {
        setActiveScans((prev) => {
          const next = new Map(prev)
          const scan = next.get(data.scanId)
          if (scan) {
            const sev = data.result.severity?.trim().toLowerCase()
            const updatedScan: ActiveScan = {
              ...scan,
              results: [...scan.results, data.result],
              scannedFiles: data.meta.scannedFiles,
              totalMatches: data.meta.totalMatches,
              critical: scan.critical + (sev === 'critical' ? 1 : 0),
              high: scan.high + (sev === 'high' ? 1 : 0),
              medium: scan.medium + (sev === 'medium' ? 1 : 0),
              low: scan.low + (sev !== 'critical' && sev !== 'high' && sev !== 'medium' ? 1 : 0),
            }
            next.set(data.scanId, updatedScan)
          }
          activeScansRef.current = next
          return next
        })
      },
    )

    // 扫描完成时标记为 completed，保留在实时列表中等待手动归档
    const off7 = EventsOn('mcp:scan:completed', (session: ScanSession) => {
      const counts = getSeverityCounts(session)
      const scanStatus: ActiveScan['status'] = session.status === 'aborted' ? 'aborted' : 'completed'
      if (scanStatus === 'completed') {
        toast.success(t('mcp:scanCompleted'), {
          description: `${session.totalMatches} ${t('mcp:matchesFound', { count: session.totalMatches })}`,
          icon: <CheckIcon className="h-4 w-4 text-green-500" />,
        })
      } else {
        toast.info(t('mcp:statusAborted'), {
          description: `${session.totalMatches} ${t('mcp:matchesFound', { count: session.totalMatches })}`,
        })
      }
      // 标记为已完成，但不移除
      setActiveScans((prev) => {
        const next = new Map(prev)
        const scan = next.get(session.id)
        if (scan) {
          next.set(session.id, {
            ...scan,
            status: scanStatus,
            completedAt: Date.now(),
            scannedFiles: session.scannedFiles,
            totalFiles: session.totalFiles,
            totalMatches: session.totalMatches,
            critical: counts.critical,
            high: counts.high,
            medium: counts.medium,
            low: counts.low,
          })
        }
        activeScansRef.current = next
        return next
      })
    })

    return () => {
      if (typeof off1 === 'function') off1()
      if (typeof off2 === 'function') off2()
      if (typeof off3 === 'function') off3()
      if (typeof off4 === 'function') off4()
      if (typeof off5 === 'function') off5()
      if (typeof off6 === 'function') off6()
      if (typeof off7 === 'function') off7()
    }
  }, [reloadHistory, t])

  useEffect(() => {
    if (!status.running) return undefined
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [status.running])

  const handleStart = async () => {
    setLoading(true)
    try {
      const st = await LocalServer.StartLocalServer()
      if (isValidServerStatus(st)) {
        setStatus(st)
        toast.success(t('mcp:serverStarted'))
      } else {
        console.error('Invalid server status after start:', redactServerStatus(st))
        toast.error(t('mcp:invalidStatusAfterStart'))
      }
    } catch (error) {
      console.error('Failed to start server:', error)
      toast.error(t('mcp:startFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleStop = async () => {
    setLoading(true)
    try {
      await LocalServer.StopLocalServer()
      setStatus({ running: false })
      toast.info(t('mcp:serverStopped'))
    } catch (error) {
      console.error('Failed to stop server:', error)
      toast.error(t('mcp:stopFailed'))
    } finally {
      setLoading(false)
    }
  }

  const copyEndpoint = async () => {
    if (!status.endpoint) {
      toast.error(t('mcp:noEndpoint'))
      return
    }
    if (!status.authToken) {
      toast.error(t('mcp:copyFailed'))
      return
    }
    try {
      await navigator.clipboard.writeText(
        LocalServer.withAuthToken(status.endpoint, status.authToken),
      )
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success(t('mcp:copySuccess'))
    } catch (error) {
      console.error('Failed to copy endpoint:', error)
      toast.error(t('mcp:copyFailed'))
    }
  }

  // 归档扫描结果到历史记录
  const handleArchive = useCallback(
    async (scanId: string) => {
      const scan = activeScans.get(scanId)
      if (!scan) return
      if (scan.status !== 'completed') {
        toast.error(t('mcp:archiveUnavailable', 'Only completed scans can be archived.'))
        return
      }
      const counts = getSeverityCounts(scan)

      try {
        await LocalServer.ArchiveScanSession({
          id: scan.id,
          scannerId: scan.scannerId,
          status: 'finished',
          targets: scan.targets,
          totalFiles: scan.totalFiles,
          scannedFiles: scan.scannedFiles,
          totalMatches: scan.totalMatches,
          critical: counts.critical,
          high: counts.high,
          medium: counts.medium,
          low: counts.low,
          startedAt: scan.startedAt,
          completedAt: scan.completedAt || Date.now(),
          results: scan.results,
        })

        setActiveScans((prev) => {
          const next = new Map(prev)
          next.delete(scanId)
          activeScansRef.current = next
          return next
        })

        await reloadHistory()
        toast.success(t('mcp:archiveSuccess'))
      } catch (error) {
        console.error('Failed to archive scan:', error)
        toast.error(t('mcp:archiveFailed'))
      }
    },
    [activeScans, reloadHistory, t],
  )

  return (
    <PageLayout
      breadcrumbs={[
        { label: t('nav:securityScan'), href: '/security' },
        { label: t('nav:mcpScan') },
      ]}
    >
      {/* Server Control Panel */}
      <div className="bg-card text-card-foreground overflow-hidden rounded-xl border shadow-sm">
        <div className="bg-muted/40 border-b p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.15)]">
                <ShieldCheckIcon className="h-7 w-7" weight="duotone" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight">{t('mcp:serverControl')}</h2>
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <span
                    className={
                      status.running
                        ? 'flex items-center gap-1.5 text-green-500'
                        : 'flex items-center gap-1.5'
                    }
                  >
                    <div
                      className={`h-2 w-2 rounded-full ${status.running ? 'animate-pulse bg-green-500' : 'bg-muted-foreground'}`}
                    />
                    {status.running ? t('mcp:statusOnline') : t('mcp:statusOffline')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm font-medium">{t('mcp:power')}:</span>
                <button
                  onClick={status.running ? handleStop : handleStart}
                  disabled={loading}
                  className={`focus-visible:ring-ring focus-visible:ring-offset-background relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                    status.running ? 'bg-green-500' : 'bg-input'
                  }`}
                >
                  <span
                    className={`bg-background pointer-events-none block h-5 w-5 rounded-full shadow-lg ring-0 transition-transform duration-200 ease-in-out ${
                      status.running ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="bg-border h-8 w-px" />

              <Button variant="outline" onClick={() => setShowClientModal(true)}>
                <DownloadSimpleIcon className="mr-2 h-4 w-4" />
                {t('mcp:downloadClient')}
              </Button>
            </div>
          </div>
        </div>

        {/* Technical Data Bar */}
        <div className="bg-muted/20 grid grid-cols-1 gap-4 p-4 font-mono text-sm md:grid-cols-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <PulseIcon className="h-4 w-4 shrink-0 text-purple-500" />
            <span className="text-muted-foreground shrink-0">{t('mcp:endpoint')}:</span>
            {status.running ? (
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-foreground truncate">{status.endpoint}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0 hover:bg-transparent"
                  onClick={copyEndpoint}
                >
                  {copied ? (
                    <CheckIcon className="h-3 w-3 text-green-500" />
                  ) : (
                    <CopyIcon className="h-3 w-3" />
                  )}
                </Button>
              </div>
            ) : (
              <span className="text-muted-foreground">--</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ClockIcon className="h-4 w-4 shrink-0 text-blue-500" />
            <span className="text-muted-foreground">{t('mcp:uptime')}:</span>
            <span className="text-foreground">{formatUptime(status, now)}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger
              value="realtime"
              className="data-[state=active]:bg-background data-[state=active]:text-foreground gap-2 data-[state=active]:shadow-sm"
            >
              {clientConnected && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                </span>
              )}
              {t('mcp:tabRealtime')}
              {activeScans.size > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 rounded-sm px-1.5 text-[10px]">
                  {activeScans.size}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="data-[state=active]:bg-background data-[state=active]:text-foreground gap-2 data-[state=active]:shadow-sm"
            >
              <ClockIcon className="h-3.5 w-3.5" />
              {t('mcp:tabHistory')}
            </TabsTrigger>
          </TabsList>

          <Button variant="ghost" size="sm" onClick={() => reloadHistory()}>
            {t('mcp:refresh')}
          </Button>
        </div>

        <TabsContent value="realtime" className="mt-0">
          <RealtimeTab
            activeScans={activeScans}
            clientConnected={clientConnected}
            expandedResults={expandedResults}
            onToggleExpand={toggleResultExpand}
            onArchive={handleArchive}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <HistoryTab sessions={historySessions} onReload={reloadHistory} />
        </TabsContent>
      </Tabs>

      <ClientSetupModal
        open={showClientModal}
        onOpenChange={setShowClientModal}
        endpoint={status.endpoint}
        authToken={status.authToken}
      />
    </PageLayout>
  )
}
