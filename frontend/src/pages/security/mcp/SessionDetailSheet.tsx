import { useTranslation } from 'react-i18next'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ScanSession } from './types'
import { formatTimestamp } from './types'

interface SessionDetailSheetProps {
  session: ScanSession | null
  onClose: () => void
}

export function SessionDetailSheet({ session, onClose }: SessionDetailSheetProps) {
  const { t } = useTranslation()

  return (
    <Sheet open={!!session} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[600px] border-l p-0 shadow-xl sm:w-[700px]">
        <div className="bg-background flex h-full flex-col">
          <SheetHeader className="bg-muted/10 border-b px-6 py-4">
            <SheetTitle className="text-lg font-semibold">{t('mcp:resultDetails')}</SheetTitle>
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <span className="bg-muted rounded px-1.5 py-0.5 font-mono">#{session?.id.slice(0, 8)}</span>
              <span>•</span>
              <span>{session ? formatTimestamp(session.completedAt) : ''}</span>
            </div>
          </SheetHeader>
          <ScrollArea className="flex-1 p-6">
            {session && (
              <div className="space-y-4">
                {/* 概览 */}
                <div className="bg-muted/30 grid grid-cols-4 gap-4 rounded-lg border p-4">
                  <div className="space-y-1 text-center">
                    <div className="text-2xl font-bold">{session.totalFiles}</div>
                    <div className="text-muted-foreground text-xs">{t('mcp:targets')}</div>
                  </div>
                  <div className="space-y-1 text-center">
                    <div className="text-2xl font-bold text-red-600">{session.high}</div>
                    <div className="text-muted-foreground text-xs">{t('mcp:riskHigh')}</div>
                  </div>
                  <div className="space-y-1 text-center">
                    <div className="text-2xl font-bold text-orange-600">{session.medium}</div>
                    <div className="text-muted-foreground text-xs">{t('mcp:riskMedium')}</div>
                  </div>
                  <div className="space-y-1 text-center">
                    <div className="text-muted-foreground text-2xl font-bold">{session.low}</div>
                    <div className="text-muted-foreground text-xs">{t('mcp:riskLow')}</div>
                  </div>
                </div>
                {/* 结果列表 */}
                <div className="space-y-3">
                  {session.results.map((r, idx) => (
                    <Card key={idx} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="font-medium">{r.ruleName}</div>
                            <div className="text-muted-foreground font-mono text-xs">{r.ruleId}</div>
                          </div>
                          <Badge
                            variant={r.severity === 'high' ? 'destructive' : r.severity === 'medium' ? 'secondary' : 'outline'}
                            className="text-[10px] uppercase"
                          >
                            {r.severity}
                          </Badge>
                        </div>
                        <div className="text-muted-foreground bg-muted/50 mt-3 rounded px-2 py-1.5 font-mono text-xs break-all">
                          {r.filePath}:{r.line}:{r.column}
                        </div>
                        {r.matchedText && (
                          <div className="bg-red-50 border-red-200 mt-2 rounded border p-2 font-mono text-xs text-red-800">
                            {r.matchedText}
                          </div>
                        )}
                        {r.description && (
                          <p className="text-muted-foreground mt-2 text-sm">{r.description}</p>
                        )}
                        {r.context && (
                          <pre className="mt-2 overflow-x-auto rounded border bg-zinc-950 p-3 font-mono text-xs text-zinc-300 whitespace-pre-wrap">
                            {r.context}
                          </pre>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {session.results.length === 0 && (
                    <div className="py-8 text-center">
                      <p className="text-muted-foreground">{t('mcp:noReports')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}
