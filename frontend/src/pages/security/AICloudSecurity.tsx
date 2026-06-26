import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CloudWarningIcon,
  ShieldCheckIcon,
  GlobeHemisphereWestIcon,
  WarningIcon,
  CheckCircleIcon,
  SirenIcon,
  NetworkIcon,
  LockKeyIcon,
  DatabaseIcon,
  MagnifyingGlassIcon,
  GitBranchIcon,
  CodeIcon,
  SpinnerIcon,
  KeyIcon,
  FileSearchIcon,
  FolderOpenIcon,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import * as AICloudSecurityService from '../../../wailsjs/go/main/AICloudSecurityService'
import { cloudscan } from '../../../wailsjs/go/models'

function getSeverityColor(severity?: string) {
  switch (severity) {
    case 'critical':
      return 'text-red-400 border-red-500/20 bg-red-500/10'
    case 'high':
      return 'text-orange-400 border-orange-500/20 bg-orange-500/10'
    case 'medium':
      return 'text-yellow-400 border-yellow-500/20 bg-yellow-500/10'
    case 'low':
      return 'text-blue-400 border-blue-500/20 bg-blue-500/10'
    default:
      return 'text-zinc-400 border-zinc-700 bg-zinc-800/60'
  }
}

function getFindingDot(severity?: string) {
  switch (severity) {
    case 'critical':
      return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
    case 'high':
      return 'bg-orange-500'
    case 'medium':
      return 'bg-yellow-500'
    case 'low':
      return 'bg-blue-500'
    default:
      return 'bg-zinc-500'
  }
}

function formatLineRange(finding: cloudscan.Finding) {
  if (!finding.startLine) return ''
  if (finding.endLine && finding.endLine !== finding.startLine) {
    return `:${finding.startLine}-${finding.endLine}`
  }
  return `:${finding.startLine}`
}

type ScanSource = 'url' | 'local' | 'yaml'

export default function AICloudSecurityPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<ScanSource>('url')
  const [url, setUrl] = useState('')
  const [localPath, setLocalPath] = useState('')
  const [yaml, setYaml] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [result, setResult] = useState<cloudscan.ScanResult | null>(null)
  const [engineStatus, setEngineStatus] = useState<cloudscan.EngineStatus | null>(null)

  useEffect(() => {
    AICloudSecurityService.GetEngineStatus()
      .then((status) => setEngineStatus(status))
      .catch((error: unknown) => {
        const status = new cloudscan.EngineStatus()
        status.available = false
        status.engine = 'KICS'
        status.repository = 'https://github.com/Checkmarx/kics'
        status.error = error instanceof Error ? error.message : String(error)
        setEngineStatus(status)
      })
  }, [])

  const metrics = result?.metrics
  const findings = useMemo(() => result?.findings ?? [], [result])
  const totalFindings = metrics?.totalFindings ?? findings.length
  const hasResults = result !== null

  const handleSelectLocalRepository = async () => {
    try {
      const selectedPath = await AICloudSecurityService.SelectLocalRepository()
      if (selectedPath) {
        setLocalPath(selectedPath)
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(t('mcp:aiCloudPosture.selectLocalPathFailed', 'Unable to select folder'), {
        description: message,
      })
    }
  }

  const handleScan = async () => {
    if (activeTab === 'url' && !url.trim()) {
      toast.error(t('mcp:aiCloudPosture.enterUrl', 'Please enter a URL'))
      return
    }
    if (activeTab === 'local' && !localPath.trim()) {
      toast.error(t('mcp:aiCloudPosture.enterLocalPath', 'Please choose or enter a local repository path'))
      return
    }
    if (activeTab === 'yaml' && !yaml.trim()) {
      toast.error(t('mcp:aiCloudPosture.enterYaml', 'Please enter YAML content'))
      return
    }

    setIsScanning(true)
    try {
      const req: cloudscan.ScanRequest = {
        sourceType: activeTab === 'url' ? 'repository' : activeTab === 'local' ? 'localRepository' : 'content',
        target: activeTab === 'url'
          ? url.trim()
          : activeTab === 'local'
            ? localPath.trim()
            : t('mcp:aiCloudPosture.inlineContent', 'Inline IaC content'),
        content: activeTab === 'yaml' ? yaml : undefined,
      }
      const scanResult = await AICloudSecurityService.Scan(req)
      setResult(scanResult)
      toast.success(t('mcp:aiCloudPosture.scanCompleted', 'Scan Completed'), {
        description: scanResult.summary || t('mcp:aiCloudPosture.scanCompletedDesc', 'Security posture analysis finished successfully.'),
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(t('mcp:aiCloudPosture.scanFailed', 'Scan failed'), {
        description: message,
      })
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <PageLayout
      breadcrumbs={[
        { label: t('nav:securityScan'), href: '/security' },
        { label: t('nav:aiCloudSecurity') },
      ]}
    >
      <div className="space-y-4">
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
          <div className="border-b bg-muted/40 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-purple-500/10 text-purple-500 flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.15)] relative">
                  <CloudWarningIcon className="h-7 w-7" weight="duotone" />
                  {hasResults && <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 border-2 border-zinc-950" />}
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold tracking-tight">{t('mcp:aiCloudPosture.title', 'AI Cloud Posture')}</h2>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    {hasResults ? (
                      <>
                        <span className="font-mono text-white font-bold text-lg">{result.score}</span>
                        <div className="h-1.5 w-24 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all"
                            style={{ width: `${Math.max(0, Math.min(100, result.score))}%` }}
                          />
                        </div>
                        <span className="text-xs">{t('mcp:aiCloudPosture.securityScore', 'Security Score')}</span>
                        <Badge variant="outline" className="border-zinc-800 text-zinc-400">
                          {result.engine}
                        </Badge>
                      </>
                    ) : (
                      <>
                        <span>{t('mcp:aiCloudPosture.configureToSeeScore', 'Configure and scan to see security score')}</span>
                        {engineStatus && (
                          <Badge
                            variant="outline"
                            className={engineStatus.available ? 'border-green-500/20 text-green-400' : 'border-orange-500/20 text-orange-400'}
                          >
                            {engineStatus.available
                              ? t('mcp:aiCloudPosture.engineReady', 'KICS embedded')
                              : t('mcp:aiCloudPosture.engineMissing', 'KICS unavailable')}
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {hasResults && (
                <Button variant="outline" onClick={() => setResult(null)}>
                  {t('mcp:aiCloudPosture.newScan', 'New Scan')}
                </Button>
              )}
            </div>
          </div>
        </div>

        {!hasResults && (
          <div className="mx-auto max-w-2xl mt-12 animate-in fade-in zoom-in-95 duration-500">
            <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MagnifyingGlassIcon className="h-5 w-5 text-purple-500" />
                  {t('mcp:aiCloudPosture.startScan', 'Start Security Scan')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {engineStatus?.available === false && (
                  <div className="rounded-lg border border-orange-500/20 bg-orange-500/10 p-3 text-xs text-orange-200">
                    <p className="font-semibold">{t('mcp:aiCloudPosture.engineMissingTitle', 'Embedded KICS engine is unavailable')}</p>
                    <p className="mt-1 text-orange-200/80">{engineStatus.error}</p>
                    {engineStatus.installHint && <p className="mt-2 font-mono text-[11px] text-orange-100/90">{engineStatus.installHint}</p>}
                    {engineStatus.repository && (
                      <p className="mt-2 text-orange-200/80">
                        {t('mcp:aiCloudPosture.engineSource', 'Open-source engine')}:{' '}
                        <span className="font-mono">{engineStatus.repository}</span>
                      </p>
                    )}
                  </div>
                )}

                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ScanSource)} className="w-full">
                  <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-zinc-950 border border-zinc-800 rounded-lg">
                    <TabsTrigger
                      value="url"
                      className="gap-2 py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white transition-all duration-300"
                    >
                      <GitBranchIcon className="h-4 w-4" />
                      {t('mcp:aiCloudPosture.gitSource', 'Git Source / URL')}
                    </TabsTrigger>
                    <TabsTrigger
                      value="local"
                      className="gap-2 py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white transition-all duration-300"
                    >
                      <FolderOpenIcon className="h-4 w-4" />
                      {t('mcp:aiCloudPosture.localSource', 'Local Folder')}
                    </TabsTrigger>
                    <TabsTrigger
                      value="yaml"
                      className="gap-2 py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white transition-all duration-300"
                    >
                      <CodeIcon className="h-4 w-4" />
                      {t('mcp:aiCloudPosture.yamlConfig', 'IaC Content')}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="url" className="pt-4">
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">{t('mcp:aiCloudPosture.repoUrl', 'Repository URL')}</label>
                      <Input
                        placeholder={t('mcp:aiCloudPosture.repoUrlPlaceholder', 'https://github.com/org/repo')}
                        className="bg-zinc-950 border-zinc-800 h-11"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                      />
                      <p className="text-[10px] text-zinc-500">{t('mcp:aiCloudPosture.repoUrlHelp', 'Supports public repositories or authenticated HTTPS URLs.')}</p>
                    </div>
                  </TabsContent>
                  <TabsContent value="local" className="pt-4">
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">{t('mcp:aiCloudPosture.localRepositoryPath', 'Local repository path')}</label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          placeholder={t('mcp:aiCloudPosture.localPathPlaceholder', '/path/to/iac-repository')}
                          className="bg-zinc-950 border-zinc-800 h-11 font-mono text-xs"
                          value={localPath}
                          onChange={(e) => setLocalPath(e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 shrink-0 border-zinc-800 bg-zinc-950 hover:bg-zinc-900"
                          onClick={handleSelectLocalRepository}
                          disabled={isScanning}
                        >
                          <FolderOpenIcon className="h-4 w-4 mr-2" />
                          {t('mcp:aiCloudPosture.browseFolder', 'Browse')}
                        </Button>
                      </div>
                      <p className="text-[10px] text-zinc-500">
                        {t('mcp:aiCloudPosture.localPathHelp', 'Select a local Terraform, CloudFormation, Kubernetes, or Docker IaC directory. Repositories over 250 MB or 20k files are rejected.')}
                      </p>
                    </div>
                  </TabsContent>
                  <TabsContent value="yaml" className="pt-4">
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">{t('mcp:aiCloudPosture.iacYaml', 'Infrastructure as Code')}</label>
                      <Textarea
                        placeholder={`Resources:\n  MyBucket:\n    Type: AWS::S3::Bucket\n    Properties:\n      ...`}
                        className="min-h-[200px] font-mono text-sm bg-zinc-950 border-zinc-800"
                        value={yaml}
                        onChange={(e) => setYaml(e.target.value)}
                      />
                    </div>
                  </TabsContent>
                </Tabs>

                <Button
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-900/20 h-11"
                  onClick={handleScan}
                  disabled={isScanning}
                >
                  {isScanning ? <SpinnerIcon className="h-4 w-4 animate-spin mr-2" /> : <MagnifyingGlassIcon className="h-4 w-4 mr-2" />}
                  {isScanning ? t('mcp:aiCloudPosture.analyzing', 'Analyzing Posture...') : t('mcp:aiCloudPosture.runAnalysis', 'Run Analysis')}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {hasResults && metrics && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{t('mcp:aiCloudPosture.compliance', 'Compliance')}</p>
                    <p className="text-2xl font-bold text-white mt-1">{metrics.compliance}%</p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-green-400">
                      <CheckCircleIcon className="h-3 w-3" />
                      <span>{t('mcp:aiCloudPosture.passedChecks', { count: metrics.passedChecks, defaultValue: '{{count}} checks passed' })}</span>
                    </div>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
                    <ShieldCheckIcon className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{t('mcp:aiCloudPosture.iamRisks', 'IAM Risks')}</p>
                    <p className="text-2xl font-bold text-white mt-1">{metrics.iamRisks}</p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-red-400">
                      <WarningIcon className="h-3 w-3" />
                      <span>{t('mcp:aiCloudPosture.secretsFound', { count: metrics.secrets, defaultValue: '{{count}} secrets detected' })}</span>
                    </div>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                    <LockKeyIcon className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{t('mcp:aiCloudPosture.publicAssets', 'Public Assets')}</p>
                    <p className="text-2xl font-bold text-white mt-1">{metrics.publicAssets}</p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-orange-400">
                      <GlobeHemisphereWestIcon className="h-3 w-3" />
                      <span>{t('mcp:aiCloudPosture.filesScanned', { count: metrics.filesScanned, defaultValue: '{{count}} files scanned' })}</span>
                    </div>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
                    <DatabaseIcon className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-zinc-800 bg-zinc-950/50">
              <CardHeader className="pb-2 border-b border-zinc-800/50">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <SirenIcon className="h-4 w-4 text-red-500" />
                    {t('mcp:aiCloudPosture.findingsAlerts', 'Security Findings & Alerts')}
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-zinc-500 border-zinc-800">
                      {t('mcp:aiCloudPosture.issuesFound', { count: totalFindings, defaultValue: '{{count}} Issues Found' })}
                    </Badge>
                    {totalFindings > findings.length && (
                      <Badge variant="outline" className="text-zinc-500 border-zinc-800">
                        {t('mcp:aiCloudPosture.showingFindings', {
                          shown: findings.length,
                          total: totalFindings,
                          defaultValue: 'Showing {{shown}} of {{total}}',
                        })}
                      </Badge>
                    )}
                    <Badge className="border-red-500/20 bg-red-500/10 text-red-300">
                      C {result.severityCounts.critical}
                    </Badge>
                    <Badge className="border-orange-500/20 bg-orange-500/10 text-orange-300">
                      H {result.severityCounts.high}
                    </Badge>
                    <Badge className="border-yellow-500/20 bg-yellow-500/10 text-yellow-300">
                      M {result.severityCounts.medium}
                    </Badge>
                    <Badge className="border-blue-500/20 bg-blue-500/10 text-blue-300">
                      L {result.severityCounts.low}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {findings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-10 text-center text-zinc-500">
                    <FileSearchIcon className="h-10 w-10 text-zinc-700" />
                    <p className="mt-3 text-sm font-medium text-zinc-300">{t('mcp:aiCloudPosture.noFindings', 'No findings detected')}</p>
                    <p className="mt-1 text-xs">{result.summary}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800/50">
                    {findings.map((finding, idx) => (
                      <div key={`${finding.id}-${idx}`} className="p-4 hover:bg-zinc-900/30 transition-colors flex items-start gap-4">
                        <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${getFindingDot(finding.severity)}`} />

                        <div className="flex-1 space-y-1">
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <h4 className="text-sm font-semibold text-zinc-200">{finding.title}</h4>
                            <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                              {finding.filePath}
                              {formatLineRange(finding)}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400">{finding.message || finding.description}</p>
                          {finding.resolution && (
                            <p className="text-xs text-emerald-300/80">{finding.resolution}</p>
                          )}
                          <div className="pt-2 flex flex-wrap items-start gap-2">
                            <Badge variant="outline" className={`uppercase text-[10px] h-5 ${getSeverityColor(finding.severity)}`}>
                              {finding.severity || 'unknown'}
                            </Badge>
                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono bg-black/40 px-2 py-0.5 rounded border border-white/5">
                              {finding.type === 'secret' ? <KeyIcon className="h-3 w-3" /> : <NetworkIcon className="h-3 w-3" />}
                              {finding.resource || finding.service || finding.type}
                            </div>
                            {finding.id && (
                              <Badge variant="outline" className="text-[10px] h-5 border-zinc-800 text-zinc-500">
                                {finding.id}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PageLayout>
  )
}
