import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { SpinnerGapIcon, WifiHighIcon, ArchiveIcon } from '@phosphor-icons/react'
import { ScanResultCard } from './ScanResultCard'
import { getSeverityCounts, type ActiveScan } from './types'

interface RealtimeTabProps {
  activeScans: Map<string, ActiveScan>
  clientConnected: boolean
  expandedResults: Set<string>
  onToggleExpand: (key: string) => void
  onArchive: (scanId: string) => void
}

export function RealtimeTab({
  activeScans,
  clientConnected,
  expandedResults,
  onToggleExpand,
  onArchive,
}: RealtimeTabProps) {
  const { t } = useTranslation()

  const getScanChrome = (status: ActiveScan['status']) => {
    switch (status) {
      case 'completed':
        return {
          border: 'border-green-500/20',
          bar: 'bg-green-500',
          dot: 'bg-green-500',
          label: t('mcp:statusCompleted'),
        }
      case 'disconnected':
        return {
          border: 'border-orange-500/20',
          bar: 'bg-orange-500',
          dot: 'bg-orange-500',
          label: t('mcp:statusDisconnected', 'Disconnected'),
        }
      case 'aborted':
        return {
          border: 'border-red-500/20',
          bar: 'bg-red-500',
          dot: 'bg-red-500',
          label: t('mcp:statusAborted'),
        }
      default:
        return {
          border: 'border-purple-500/20',
          bar: 'animate-pulse bg-purple-500',
          dot: 'animate-pulse bg-purple-500',
          label: t('mcp:statusRunning'),
        }
    }
  }

  if (activeScans.size === 0) {
    return (
      <div className="flex h-[300px] flex-col items-center justify-center text-center">
        <div className="bg-muted/50 flex h-16 w-16 items-center justify-center rounded-full">
          <SpinnerGapIcon
            className={`h-8 w-8 ${clientConnected ? 'animate-spin text-blue-500' : 'text-muted-foreground opacity-50'}`}
          />
        </div>
        <p className="text-muted-foreground mt-4 font-medium">{t('mcp:noActiveScans')}</p>
        <p className="text-muted-foreground mt-1 text-xs">{t('mcp:noActiveScansDesc')}</p>
        {clientConnected && (
          <Badge variant="outline" className="mt-3 gap-1">
            <WifiHighIcon className="h-3 w-3 text-green-500" />
            {t('mcp:clientConnected')}
          </Badge>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from(activeScans.values()).map((scan) => {
        const counts = getSeverityCounts(scan)
        const chrome = getScanChrome(scan.status)
        return (
          <div
            key={scan.id}
            className={`group bg-card text-card-foreground relative flex flex-col overflow-hidden rounded-xl border shadow-sm transition-all hover:shadow-md ${chrome.border}`}
          >
            {/* Status Bar Top Line */}
            <div className={`h-1 w-full ${chrome.bar}`} />

            <div className="flex flex-1 flex-col p-4">
              {/* Header: ID & Status */}
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-mono text-xs font-medium">ID</span>
                    <span className="font-mono text-sm font-bold tracking-tight">
                      {scan.scannerId}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div
                      className={`h-1.5 w-1.5 rounded-full ${chrome.dot}`}
                    />
                    <span className="text-muted-foreground text-xs font-medium">
                      {chrome.label}
                    </span>
                  </div>
                </div>
                {scan.status === 'completed' && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground h-7 w-7"
                    onClick={() => onArchive(scan.id)}
                    title={t('mcp:archive')}
                  >
                    <ArchiveIcon className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Progress & Stats */}
              <div className="mb-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t('mcp:progress')}</span>
                  <span className="font-mono">
                    {scan.totalFiles > 0
                      ? Math.round((scan.scannedFiles / scan.totalFiles) * 100)
                      : 0}
                    %
                  </span>
                </div>
                <Progress
                  value={scan.totalFiles > 0 ? (scan.scannedFiles / scan.totalFiles) * 100 : 0}
                  className="bg-muted h-1"
                  // Applying custom color to indicator via class if simpler or standard component supports it.
                  // Assuming standard component, we rely on parent text color or modify component.
                  // Using standard for now.
                />
                <div className="text-muted-foreground flex items-center justify-between text-xs">
                  <span>
                    {scan.scannedFiles} / {scan.totalFiles} {t('mcp:files')}
                  </span>
                </div>
              </div>

              {/* Matches / Findings */}
              <div className="mt-auto grid grid-cols-4 gap-2 border-t pt-3">
                <div className="flex flex-col items-center justify-center rounded-md bg-rose-500/10 p-1.5">
                  <span className="text-lg font-bold text-rose-600">{counts.critical}</span>
                  <span className="text-[10px] font-medium tracking-wide text-rose-600/80">
                    CRIT
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center rounded-md bg-red-500/10 p-1.5">
                  <span className="text-lg font-bold text-red-500">{counts.high}</span>
                  <span className="text-[10px] font-medium tracking-wide text-red-500/80">
                    HIGH
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center rounded-md bg-orange-500/10 p-1.5">
                  <span className="text-lg font-bold text-orange-500">{counts.medium}</span>
                  <span className="text-[10px] font-medium tracking-wide text-orange-500/80">
                    MED
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center rounded-md bg-blue-500/10 p-1.5">
                  <span className="text-lg font-bold text-blue-500">{counts.low}</span>
                  <span className="text-[10px] font-medium tracking-wide text-blue-500/80">
                    LOW
                  </span>
                </div>
              </div>
            </div>

            {/* Results List (Expandable) -- Only showing summary or limited list inside card could be tricky.
              The original design had listing below. The prompt requested Data Grid.
              Let's make the card expandable to show detailed results Overlay or inline.
              For now, let's keep it simple: matches are summary.
              If user wants details, maybe clicking the card expands it?
              Current implementation expects results to be listed.
              Let's render results *below* the stats if they exist, but maybe collapsed by default.
           */}
            {scan.results.length > 0 && (
              <div className="bg-muted/30 border-t p-2">
                <div className="flex flex-col gap-1">
                  {scan.results.map((r, idx) => {
                    const resultKey = `${scan.id}-${idx}`
                    // Use a very compact row for results inside the grid card
                    return (
                      <ScanResultCard
                        key={idx}
                        result={r}
                        isExpanded={expandedResults.has(resultKey)}
                        onToggle={() => onToggleExpand(resultKey)}
                      />
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
