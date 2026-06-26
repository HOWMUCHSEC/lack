import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronDown } from 'lucide-react'
import type { ResultData } from './types'

interface ScanResultCardProps {
  result: ResultData
  isExpanded: boolean
  onToggle: () => void
}

export function ScanResultCard({ result: r, isExpanded, onToggle }: ScanResultCardProps) {
  const { t } = useTranslation()

  return (
    <Card className="overflow-hidden py-0 gap-0">
      <div
        className="flex items-center gap-2 p-2.5 text-xs cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <Badge
          variant={r.severity === 'high' || r.severity === 'critical' ? 'destructive' : r.severity === 'medium' ? 'secondary' : 'outline'}
          className="h-5 shrink-0 px-1.5 text-[10px]"
        >
          {r.severity}
        </Badge>
        <span className="truncate font-medium">{r.ruleName}</span>
        <span className="text-muted-foreground ml-auto shrink-0 font-mono text-[11px]" title={r.filePath}>
          {r.filePath.split('/').pop()}:{r.line}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </div>
      {isExpanded && (
        <div className="border-t bg-muted/30 p-3 space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-muted-foreground">{t('mcp:rule')}:</span>
              <span className="ml-1 font-mono">{r.ruleId}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('mcp:language')}:</span>
              <span className="ml-1">{r.language || '-'}</span>
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">{t('mcp:file')}:</span>
            <div className="mt-1 font-mono bg-muted/50 rounded px-2 py-1 break-all">
              {r.filePath}:{r.line}:{r.column}
            </div>
          </div>
          {r.matchedText && (
            <div>
              <span className="text-muted-foreground">{t('mcp:matchedText')}:</span>
              <div className="mt-1 bg-red-50 border border-red-200 rounded p-2 font-mono text-red-800 break-all">
                {r.matchedText}
              </div>
            </div>
          )}
          {r.description && (
            <div>
              <span className="text-muted-foreground">{t('mcp:description')}:</span>
              <p className="mt-1">{r.description}</p>
            </div>
          )}
          {r.context && (
            <div>
              <span className="text-muted-foreground">{t('mcp:context')}:</span>
              <pre className="mt-1 bg-zinc-950 text-zinc-300 rounded p-2 font-mono overflow-x-auto whitespace-pre-wrap">
                {r.context}
              </pre>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
