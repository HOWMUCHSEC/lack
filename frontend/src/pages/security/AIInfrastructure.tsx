import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { PageLayout } from '@/components/layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  TerminalWindowIcon,
  GlobeIcon,
  ShieldWarningIcon,
  PlayIcon,
  StopIcon,
  SirenIcon,
  CircleIcon,
  InfoIcon,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { EventsOn } from '../../../wailsjs/runtime'
import * as NucleiService from '../../../wailsjs/go/main/NucleiService'
import { nucleiscan } from '../../../wailsjs/go/models'

// 扫描阶段
type ScanPhase = 'idle' | 'port-scan' | 'vuln-scan' | 'completed'

const AI_PORT_SCAN_PROFILE = 'ai'
const NUCLEI_AI_TEMPLATE_COUNT = 212
const MAX_LOG_LINES = 500
const MAX_PORTS_SHOWN = 256
const MAX_FINDINGS_SHOWN = 500

function formatScanDuration(startedAt?: number, finishedAt?: number) {
  if (!startedAt || !finishedAt || finishedAt < startedAt) {
    return 'n/a'
  }

  const totalSeconds = Math.round((finishedAt - startedAt) / 1000)
  if (totalSeconds < 60) {
    return `${totalSeconds}s`
  }

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${seconds}s`
}

export default function AIInfrastructurePage() {
  const { t } = useTranslation()
  const [target, setTarget] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [scanPhase, setScanPhase] = useState<ScanPhase>('idle')
  const [logs, setLogs] = useState<string[]>([])
  const [isConsoleExpanded, setIsConsoleExpanded] = useState(true)
  const [ports, setPorts] = useState<nucleiscan.PortInfo[]>([])
  const [vulns, setVulns] = useState<nucleiscan.FindingEvent[]>([])
  const [, setCurrentRunID] = useState<string | null>(null)

  const consoleEndRef = useRef<HTMLDivElement>(null)
  const isScanningRef = useRef(false)
  const scanSessionRef = useRef(0)
  const scanCancelledRef = useRef(false)
  const currentRunIDRef = useRef<string | null>(null)
  const activeTaskIDRef = useRef<string | null>(null)

  // Auto-scroll console
  useEffect(() => {
    if (logs.length > 0 && isConsoleExpanded) {
      consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [isConsoleExpanded, logs])

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${time}] ${msg}`].slice(-MAX_LOG_LINES))
  }, [])

  const setActiveRunID = useCallback((runID: string | null) => {
    currentRunIDRef.current = runID
    setCurrentRunID(runID)
  }, [])

  const isCurrentNucleiRun = useCallback((runID?: string, taskID?: string) => {
    if (scanCancelledRef.current || !activeTaskIDRef.current) return false
    if (taskID !== activeTaskIDRef.current) return false
    if (currentRunIDRef.current && runID !== currentRunIDRef.current) return false
    return true
  }, [])

  const addBackendRunSummaryLog = useCallback((result: nucleiscan.ScanResult) => {
    addLog(`[INFO] ${t('mcp:aiInfra.logs.backendSummary', {
      runID: result.runID || '-',
      targets: result.total ?? 0,
      findings: result.findings ?? 0,
      errors: result.errors ?? 0,
      aborted: String(Boolean(result.aborted)),
      duration: formatScanDuration(result.startedAt, result.finishedAt),
    })}`)
  }, [addLog, t])

  const queryLatestRun = useCallback(async () => {
    try {
      const runs = await NucleiService.ListRecentRuns(0, 1)
      if (!runs || runs.length === 0) {
        addLog(`[INFO] ${t('mcp:aiInfra.logs.noRecentRuns')}`)
        return
      }

      addLog(`[INFO] ${t('mcp:aiInfra.logs.latestRun')}`)
      addBackendRunSummaryLog(runs[0])
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      addLog(`[ERROR] ${t('mcp:aiInfra.logs.latestRunFailed', { error: message })}`)
      toast.error(t('mcp:aiInfra.latestRunFailed'))
    }
  }, [addBackendRunSummaryLog, addLog, t])

  // 注册后端事件监听
  useEffect(() => {
    // 端口发现事件
    const offPortFound = EventsOn('nuclei:port:found', (port: nucleiscan.PortInfo) => {
      if (!isScanningRef.current || scanCancelledRef.current) return
      if (port.taskID !== activeTaskIDRef.current) return
      addLog(`[FOUND] ${t('mcp:aiInfra.logs.foundPort', { port: port.port, protocol: port.protocol, service: port.service })}`)
      setPorts(prev => [...prev, port].slice(-MAX_PORTS_SHOWN))
    })

    // 扫描开始事件
    const offStarted = EventsOn('nuclei:run:started', (data: { runID: string; taskID: string; total: number }) => {
      if (!isCurrentNucleiRun(data.runID, data.taskID)) return
      setActiveRunID(data.runID)
      addLog(`[NUCLEI] ${t('mcp:aiInfra.logs.nuclei', { count: NUCLEI_AI_TEMPLATE_COUNT, targets: data.total })}`)
      setScanPhase('vuln-scan')
    })

    // 漏洞发现事件
    const offFinding = EventsOn('nuclei:run:finding', (finding: nucleiscan.FindingEvent) => {
      if (!isScanningRef.current || !isCurrentNucleiRun(finding.runID, finding.taskID)) return
      const sevLabel = finding.severity?.toUpperCase() || 'INFO'
      addLog(`[VULN] [${sevLabel}] ${finding.templateName} - ${finding.host}`)
      setVulns(prev => [...prev, finding].slice(-MAX_FINDINGS_SHOWN))
    })

    // 扫描完成事件
    const offFinished = EventsOn('nuclei:run:finished', (result: nucleiscan.ScanResult) => {
      if (!isCurrentNucleiRun(result.runID, result.taskID)) return
      addLog(`[INFO] ${t('mcp:aiInfra.logs.completed', { count: result.findings })}`)
      addBackendRunSummaryLog(result)
      setScanPhase('completed')
      setIsScanning(false)
      isScanningRef.current = false
      activeTaskIDRef.current = null
      setActiveRunID(null)
      toast.success(t('mcp:aiInfra.scanFinished'), {
        description: `${result.findings} ${t('mcp:aiInfra.findingsFound')}`
      })
    })

    return () => {
      offPortFound()
      offStarted()
      offFinding()
      offFinished()
    }
  }, [addBackendRunSummaryLog, addLog, isCurrentNucleiRun, setActiveRunID, t])

  // 启动扫描
  const startScan = async () => {
    const trimmedTarget = target.trim()
    if (!trimmedTarget) {
      toast.error(t('mcp:aiInfra.targetRequired'))
      return
    }
    if (isScanningRef.current) {
      return
    }

    const sessionID = scanSessionRef.current + 1
    const taskID = `infra-${Date.now()}`
    scanSessionRef.current = sessionID
    scanCancelledRef.current = false
    isScanningRef.current = true
    activeTaskIDRef.current = taskID
    setActiveRunID(null)
    setIsScanning(true)
    setScanPhase('port-scan')
    setLogs([])
    setPorts([])
    setVulns([])

    addLog(`[INF] ${t('mcp:aiInfra.logs.init', { target: trimmedTarget })}`)
    addLog(`[INF] ${t('mcp:aiInfra.logs.profile', { count: NUCLEI_AI_TEMPLATE_COUNT })}`)

    try {
      // 阶段一：端口扫描
      addLog(`[SCANNING] ${t('mcp:aiInfra.logs.scanning')}`)
      const portResult = await NucleiService.ScanPorts({
        taskID,
        target: trimmedTarget,
        profile: AI_PORT_SCAN_PROFILE,
        ports: [],
        timeout: 1000,
        concurrency: 50,
      })

      if (scanCancelledRef.current || scanSessionRef.current !== sessionID) {
        return
      }

      if (portResult.openPorts.length === 0) {
        addLog(`[WARN] ${t('mcp:aiInfra.noOpenPorts')}`)
        setScanPhase('completed')
        setIsScanning(false)
        isScanningRef.current = false
        activeTaskIDRef.current = null
        return
      }

      addLog(`[INFO] ${t('mcp:aiInfra.portsFound', { count: portResult.openPorts.length })}`)

      // Use backend-recommended URLs so protocol choices stay near port metadata.
      const scanTargets = portResult.recommendedTargets ?? []
      if (scanTargets.length === 0) {
        addLog(`[WARN] ${t('mcp:aiInfra.noScanTargets')}`)
        setScanPhase('completed')
        setIsScanning(false)
        isScanningRef.current = false
        activeTaskIDRef.current = null
        return
      }

      addLog(`[NUCLEI] ${t('mcp:aiInfra.logs.recommendedTargets', { count: scanTargets.length })}`)

      const runID = await NucleiService.StartScan({
        taskID,
        targets: scanTargets,
        templates: [],  // 空 = 后端按默认 AI/LLM 过滤配置选择模板
        concurrency: 10,
        rateLimit: 150,
        timeout: 30,
      })

      if (scanCancelledRef.current || scanSessionRef.current !== sessionID) {
        try {
          await NucleiService.CancelScan(runID)
        } catch (cancelError) {
          console.error('Cancel stale scan error:', cancelError)
        }
        return
      }

      setActiveRunID(runID)

    } catch (error) {
      if (scanSessionRef.current !== sessionID) return
      console.error('Scan error:', error)
      addLog(`[ERROR] ${String(error)}`)
      toast.error(t('mcp:aiInfra.scanFailed'))
      setScanPhase('idle')
      setIsScanning(false)
      isScanningRef.current = false
      activeTaskIDRef.current = null
      setActiveRunID(null)
    }
  }

  // 停止扫描
  const stopScan = async () => {
    scanCancelledRef.current = true
    scanSessionRef.current += 1
    isScanningRef.current = false

    const runID = currentRunIDRef.current
    const taskID = activeTaskIDRef.current
    if (taskID) {
      try {
        await NucleiService.CancelPortScan(taskID)
      } catch (error) {
        console.error('Cancel port scan error:', error)
      }
    }
    if (runID) {
      try {
        await NucleiService.CancelScan(runID)
      } catch (error) {
        console.error('Cancel error:', error)
      }
    }
    addLog(`[WARN] ${t('mcp:aiInfra.scanCancelled')}`)
    setScanPhase('idle')
    setIsScanning(false)
    activeTaskIDRef.current = null
    setActiveRunID(null)
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500/50 bg-red-500/10 text-red-500'
      case 'high': return 'border-orange-500/50 bg-orange-500/10 text-orange-500'
      case 'medium': return 'border-yellow-500/50 bg-yellow-500/10 text-yellow-500'
      case 'low': return 'border-blue-500/50 bg-blue-500/10 text-blue-500'
      default: return 'border-zinc-500/50 bg-zinc-500/10 text-zinc-500'
    }
  }

  const getLogColor = (log: string) => {
    if (log.includes('[CRITICAL]')) return 'text-red-500 font-bold'
    if (log.includes('[HIGH]')) return 'text-orange-500 font-bold'
    if (log.includes('[FOUND]')) return 'text-green-400'
    if (log.includes('[VULN]')) return 'text-red-400'
    return 'text-zinc-300'
  }

  return (
    <PageLayout
      breadcrumbs={[{ label: t('nav:securityScan') }, { label: t('mcp:aiInfra.title') }]}
      contentClassName="flex min-w-0 flex-1 flex-col gap-4 overflow-x-hidden p-4"
    >
      <div className="min-w-0 space-y-4 overflow-x-hidden">

        {/* Header & Controls */}
        <div className="min-w-0 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="border-b bg-muted/40 p-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <div className="bg-blue-500/10 text-blue-500 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                  <GlobeIcon className="h-7 w-7" weight="duotone" />
                </div>
                <div className="min-w-0 space-y-1">
                  <h2 className="truncate text-lg font-semibold tracking-tight">{t('mcp:aiInfra.title')}</h2>
                  <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                    <span className={isScanning ? 'text-green-500 flex items-center gap-1.5' : 'flex items-center gap-1.5'}>
                      <div className={`h-2 w-2 rounded-full ${isScanning ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`} />
                      {scanPhase === 'port-scan' ? t('mcp:aiInfra.logs.scanning') :
                        scanPhase === 'vuln-scan' ? t('mcp:aiInfra.scanning') :
                          scanPhase === 'completed' ? t('mcp:aiInfra.scanFinished') :
                            t('mcp:statusOffline', 'Status: IDLE')}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>
          <CardContent className="p-6">
            <div className="w-full lg:w-1/2">
              <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                <label className="text-xs font-medium text-zinc-400">{t('mcp:aiInfra.targetHost')}</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-zinc-400">{t('mcp:aiInfra.templateScope')}</span>
                  <TooltipProvider>
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <InfoIcon className="h-3.5 w-3.5 text-zinc-500 hover:text-zinc-300 cursor-help transition-colors" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[400px] text-xs bg-zinc-950 border-zinc-800 text-zinc-300 p-3 shadow-xl">
                        {t('mcp:aiInfra.templateScopeTooltip', { count: NUCLEI_AI_TEMPLATE_COUNT })}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                  <GlobeIcon className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                  <Input
                    placeholder={t('mcp:aiInfra.targetPlaceholder')}
                    className="pl-9 font-mono bg-zinc-900 border-zinc-800 h-10"
                    value={target}
                    disabled={isScanning}
                    onChange={(e) => setTarget(e.target.value)}
                  />
                </div>
                <Button
                  className={`h-10 w-full min-w-[120px] gap-2 sm:w-auto ${isScanning ? 'bg-red-900/50 hover:bg-red-900/70 text-red-200' : 'bg-purple-600 hover:bg-purple-700 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]'}`}
                  onClick={isScanning ? stopScan : startScan}
                >
                  {isScanning ? <StopIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
                  {isScanning ? t('mcp:aiInfra.stopScan') : t('mcp:aiInfra.startScan')}
                </Button>
              </div>
            </div>
          </CardContent>
        </div>

        {/* Main Content Area: Split View */}
        <div className={`grid min-h-[400px] min-w-0 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-12 ${isConsoleExpanded ? 'h-[calc(100vh-380px)]' : 'h-[calc(100vh-220px)]'}`}>

          {/* Left Column: Port Discovery (30%) */}
          <div className="flex h-full min-h-0 min-w-0 flex-col lg:col-span-4">
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                <CircleIcon className="h-3 w-3 text-green-500 fill-green-500 animate-pulse" weight="fill" />
                {t('mcp:aiInfra.openPorts')}
              </h3>
              <Badge variant="outline" className="border-zinc-800 bg-zinc-900 text-zinc-400">{ports.length}</Badge>
            </div>
            <Card className="min-h-0 min-w-0 flex-1 overflow-hidden border-zinc-800 bg-zinc-950/30">
              <ScrollArea className="h-full min-h-0">
                <div className="p-2 space-y-2">
                  {ports.length === 0 && !isScanning && (
                    <div className="p-8 text-center text-xs text-zinc-500">
                      {t('mcp:aiInfra.waitingForScan')}
                    </div>
                  )}
                  {ports.map((p, idx) => (
                    <div key={idx} className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-zinc-800/50 bg-zinc-900/50 p-2.5 transition-colors hover:border-green-500/30 hover:bg-zinc-900">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                        <span className="font-mono text-sm font-bold text-green-400">{p.port}</span>
                        <span className="min-w-0 truncate text-xs text-zinc-500">{p.protocol}/{p.service.toLowerCase()}</span>
                      </div>
                      <Badge variant="secondary" className="h-5 shrink-0 bg-zinc-800 text-[10px] text-zinc-400">{p.service}</Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          </div>

          {/* Right Column: Vulnerability Findings (70%) */}
          <div className="flex h-full min-h-0 min-w-0 flex-col lg:col-span-8">
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                <ShieldWarningIcon className="h-4 w-4 text-red-500" />
                {t('mcp:aiInfra.vulnerabilities')}
              </h3>
              <Badge variant="outline" className="border-zinc-800 bg-zinc-900 text-zinc-400">{vulns.length}</Badge>
            </div>
            <ScrollArea className="min-h-0 min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-950/30">
              <div className="p-4 space-y-4">
                {vulns.length === 0 && !isScanning && (
                  <div className="flex h-full flex-col items-center justify-center p-12 opacity-50">
                    <SirenIcon className="h-12 w-12 text-zinc-700" />
                    <p className="mt-4 text-sm text-zinc-500">{t('mcp:aiInfra.noVulns')}</p>
                  </div>
                )}
                {vulns.map((v, idx) => (
                  <div key={`${v.templateID}-${idx}`} className={`relative min-w-0 overflow-hidden rounded-lg border bg-zinc-950 p-4 transition-all hover:translate-x-1 ${getSeverityColor(v.severity)}`}>
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <h4 className="min-w-0 text-base font-bold tracking-tight text-white [overflow-wrap:anywhere]">{v.templateName}</h4>
                        </div>
                        <p className="max-w-2xl text-xs leading-relaxed text-zinc-400 [overflow-wrap:anywhere]">
                          <span className="text-zinc-500">{t('mcp:aiInfra.host')}:</span> {v.host}
                          {v.matched && <><br /><span className="text-zinc-500">{t('mcp:aiInfra.matched')}:</span> {v.matched}</>}
                        </p>
                      </div>
                      <Badge className={`shrink-0 uppercase ${v.severity === 'critical' ? 'bg-red-500 hover:bg-red-600' : v.severity === 'high' ? 'bg-orange-500 hover:bg-orange-600' : v.severity === 'medium' ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-500 hover:bg-blue-600'}`}>
                        {v.severity?.toUpperCase() || 'INFO'}
                      </Badge>
                    </div>

                    {v.extractedResults && v.extractedResults.length > 0 && (
                      <div className="mt-3 min-w-0 rounded bg-black/40 p-2.5">
                        <p className="flex min-w-0 gap-2 text-xs">
                          <span className="shrink-0 font-semibold text-zinc-500">{t('mcp:aiInfra.extracted')}:</span>
                          <span className="min-w-0 font-mono text-zinc-300 [overflow-wrap:anywhere]">{v.extractedResults.join(', ')}</span>
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

        </div>

        {/* Bottom Panel: Console */}
        <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-zinc-800 bg-black">
          <div className="flex min-w-0 items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-3 py-1.5">
            <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-zinc-400">
              <TerminalWindowIcon className="h-3.5 w-3.5" />
              {t('mcp:aiInfra.console')}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded border border-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-200"
                onClick={queryLatestRun}
              >
                {t('mcp:aiInfra.queryLatestRun')}
              </button>
              <button
                type="button"
                className="rounded border border-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-200"
                onClick={() => setIsConsoleExpanded((value) => !value)}
              >
                {isConsoleExpanded ? t('common:collapse', 'Collapse') : t('common:expand', 'Expand')}
              </button>
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
              </div>
            </div>
          </div>
          {isConsoleExpanded && (
            <ScrollArea className="h-[150px] max-w-full font-mono text-xs">
              <div className="min-w-0 max-w-full overflow-hidden p-3">
                {logs.length === 0 ? (
                  <span className="text-zinc-600 cursor-blink [overflow-wrap:anywhere]">_ {t('mcp:aiInfra.consolePlaceholder')}</span>
                ) : (
                  logs.map((log, i) => {
                    const timestampEnd = log.indexOf(']')
                    const timestamp = timestampEnd >= 0 ? log.slice(0, timestampEnd + 1) : ''
                    const message = timestampEnd >= 0 ? log.slice(timestampEnd + 1).trimStart() : log

                    return (
                      <div key={i} className="mb-1 grid min-w-0 max-w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-2 text-zinc-300">
                        {timestamp && <span className="shrink-0 opacity-50">{timestamp}</span>}
                        <span className={`min-w-0 max-w-full whitespace-pre-wrap [overflow-wrap:anywhere] ${getLogColor(log)}`}>
                          {message}
                        </span>
                      </div>
                    )
                  })
                )}
                <div ref={consoleEndRef} />
              </div>
            </ScrollArea>
          )}
        </div>

      </div>
    </PageLayout>
  )
}
