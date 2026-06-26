import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface RunnerConfig {
  maxAttempts: number
  perAttemptTimeoutMs: number
  baseBackoffMs: number
  maxBackoffMs: number
  jitterPct: number
  abortAfterFailures: number
  expectedSuccess: string
  retryOn: string
  failOn: string
}

interface RunnerConfigSectionProps {
  config: RunnerConfig
  onChange: (config: RunnerConfig) => void
}

function normalizeCodes(value: string, strict = false) {
  const s = value.replace(/[，、]/g, ',').replace(/\u3000/g, ' ')
  if (!strict) return s
  const parts = s
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
  return parts.join(',')
}

export function RunnerConfigSection({ config, onChange }: RunnerConfigSectionProps) {
  const { t } = useTranslation()

  const updateField = <K extends keyof RunnerConfig>(field: K, value: RunnerConfig[K]) => {
    onChange({ ...config, [field]: value })
  }

  return (
    <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/20 p-4 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1 h-4 bg-purple-500 rounded-full"></span>
        <h4 className="text-sm font-semibold text-zinc-300">{t('task:form.runnerConfig.title')}</h4>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="maxAttempts" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
            {t('task:form.runnerConfig.maxAttempts')}
          </Label>
          <Input
            id="maxAttempts"
            type="number"
            value={config.maxAttempts}
            onChange={(e) => updateField('maxAttempts', Number(e.target.value) || 0)}
            className="bg-zinc-900/50 border-zinc-800 text-zinc-100 focus-visible:ring-purple-500/30"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="perAttemptTimeoutMs" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
            {t('task:form.runnerConfig.perAttemptTimeoutMs')}
          </Label>
          <Input
            id="perAttemptTimeoutMs"
            type="number"
            value={config.perAttemptTimeoutMs}
            onChange={(e) => updateField('perAttemptTimeoutMs', Number(e.target.value) || 0)}
            className="bg-zinc-900/50 border-zinc-800 text-zinc-100 focus-visible:ring-purple-500/30"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="baseBackoffMs" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
            {t('task:form.runnerConfig.baseBackoffMs')}
          </Label>
          <Input
            id="baseBackoffMs"
            type="number"
            value={config.baseBackoffMs}
            onChange={(e) => updateField('baseBackoffMs', Number(e.target.value) || 0)}
            className="bg-zinc-900/50 border-zinc-800 text-zinc-100 focus-visible:ring-purple-500/30"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="maxBackoffMs" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
            {t('task:form.runnerConfig.maxBackoffMs')}
          </Label>
          <Input
            id="maxBackoffMs"
            type="number"
            value={config.maxBackoffMs}
            onChange={(e) => updateField('maxBackoffMs', Number(e.target.value) || 0)}
            className="bg-zinc-900/50 border-zinc-800 text-zinc-100 focus-visible:ring-purple-500/30"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="jitterPct" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
            {t('task:form.runnerConfig.jitterPct')}
          </Label>
          <Input
            id="jitterPct"
            type="number"
            value={config.jitterPct}
            onChange={(e) => updateField('jitterPct', Number(e.target.value) || 0)}
            className="bg-zinc-900/50 border-zinc-800 text-zinc-100 focus-visible:ring-purple-500/30"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="abortAfterFailures" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
            {t('task:form.runnerConfig.abortAfterFailures')}
          </Label>
          <Input
            id="abortAfterFailures"
            type="number"
            value={config.abortAfterFailures}
            onChange={(e) => updateField('abortAfterFailures', Number(e.target.value) || 0)}
            className="bg-zinc-900/50 border-zinc-800 text-zinc-100 focus-visible:ring-purple-500/30"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="expectedSuccess" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
            {t('task:form.runnerConfig.expectedSuccess')}
          </Label>
          <Input
            id="expectedSuccess"
            placeholder={t('task:form.runnerConfig.expectedSuccessPlaceholder')}
            value={config.expectedSuccess}
            onChange={(e) => updateField('expectedSuccess', normalizeCodes(e.target.value))}
            onBlur={(e) => updateField('expectedSuccess', normalizeCodes(e.target.value, true))}
            className="bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-purple-500/30 font-mono text-xs"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="retryOn" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
            {t('task:form.runnerConfig.retryOn')}
          </Label>
          <Input
            id="retryOn"
            placeholder={t('task:form.runnerConfig.retryOnPlaceholder')}
            value={config.retryOn}
            onChange={(e) => updateField('retryOn', normalizeCodes(e.target.value))}
            onBlur={(e) => updateField('retryOn', normalizeCodes(e.target.value, true))}
            className="bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-purple-500/30 font-mono text-xs"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="failOn" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
            {t('task:form.runnerConfig.failOn')}
          </Label>
          <Input
            id="failOn"
            placeholder={t('task:form.runnerConfig.failOnPlaceholder')}
            value={config.failOn}
            onChange={(e) => updateField('failOn', normalizeCodes(e.target.value))}
            onBlur={(e) => updateField('failOn', normalizeCodes(e.target.value, true))}
            className="bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-purple-500/30 font-mono text-xs"
          />
        </div>
      </div>
    </div>
  )
}
