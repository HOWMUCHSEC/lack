import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { HttpMethodSelect, type HttpMethod } from '../shared'
import { useTranslation } from 'react-i18next'
import { Loader2, Braces, HelpCircle } from 'lucide-react'
import { toast } from 'sonner'

interface TargetApiConfigSectionProps {
    formData: {
        base_url: string
        request_headers: string
        request_body_template: string
        request_field: string
        response_field: string
        target_details: string
    }
    requestMethod: HttpMethod
    timeoutSeconds: number
    testing: boolean
    onFieldChange: (field: string, value: string) => void
    onMethodChange: (method: HttpMethod) => void
    onTimeoutChange: (seconds: number) => void
    onTestConnection: () => void
    onOpenHelpDialog: (field: 'headers' | 'body' | 'requestField' | 'responseField') => void
}

export function TargetApiConfigSection({
    formData,
    requestMethod,
    timeoutSeconds,
    testing,
    onFieldChange,
    onMethodChange,
    onTimeoutChange,
    onTestConnection,
    onOpenHelpDialog,
}: TargetApiConfigSectionProps) {
    const { t } = useTranslation()

    const formatJsonField = (field: 'request_headers' | 'request_body_template') => {
        try {
            const raw = field === 'request_headers' ? formData.request_headers : formData.request_body_template
            if (!raw || raw.trim().length === 0) {
                toast.error(t('objectives:form.toasts.jsonEmpty'))
                return
            }
            const parsed = JSON.parse(raw)
            const formatted = JSON.stringify(parsed, null, 2)
            onFieldChange(field, formatted)
            toast.success(t('objectives:form.toasts.jsonFormatted'))
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            toast.error(t('objectives:form.toasts.jsonInvalid', { message }))
        }
    }

    return (
        <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/20 p-4 space-y-4">
            {/* Header with test button */}
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                    <span className="w-1 h-4 bg-cyan-500 rounded-full"></span>
                    {t('objectives:form.apiConfig')}
                </h4>
                <Button
                    type="button"
                    size="sm"
                    onClick={onTestConnection}
                    disabled={testing}
                    className="bg-cyan-600 hover:bg-cyan-700 text-white shadow-lg shadow-cyan-900/20"
                >
                    {testing ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t('objectives:form.testing')}
                        </>
                    ) : (
                        t('objectives:form.testConnection')
                    )}
                </Button>
            </div>

            {/* API URL, Method, Timeout */}
            <div className="flex flex-nowrap items-start gap-4">
                <div className="grid min-w-0 shrink-0 grow-0 basis-1/2 gap-2">
                    <div className="flex items-center gap-1">
                        <Label htmlFor="base-url" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                            {t('objectives:form.apiUrlLabel')} <span className="text-red-500">*</span>
                        </Label>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <HelpCircle className="text-zinc-500 h-3.5 w-3.5 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p className="text-xs">{t('objectives:form.apiUrlHint')}</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    <Input
                        id="base-url"
                        placeholder={t('objectives:form.apiUrlPlaceholder')}
                        value={formData.base_url}
                        onChange={(e) => onFieldChange('base_url', e.target.value)}
                        className="bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-cyan-500/30 font-mono text-sm"
                    />
                </div>
                <div className="grid min-w-0 flex-1 gap-2">
                    <Label htmlFor="request-method" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                        {t('objectives:form.methodLabel')}
                    </Label>
                    <HttpMethodSelect value={requestMethod} onValueChange={onMethodChange} />
                </div>
                <div className="grid min-w-0 flex-1 gap-2">
                    <Label htmlFor="timeout" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                        {t('objectives:form.timeoutLabel')}
                    </Label>
                    <Input
                        id="timeout"
                        type="number"
                        min={1}
                        placeholder="5"
                        value={timeoutSeconds}
                        onChange={(e) => onTimeoutChange(parseInt(e.target.value || '5') || 5)}
                        className="bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-cyan-500/30"
                    />
                </div>
            </div>

            {/* Headers and Body */}
            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="request-headers" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                            {t('objectives:form.headersLabel')} <span className="text-red-500">*</span>
                        </Label>
                        <div className="flex items-center gap-1">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => formatJsonField('request_headers')}
                                title={t('objectives:form.formatJson')}
                                className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-zinc-800"
                            >
                                <Braces className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => onOpenHelpDialog('headers')}
                                title={t('objectives:form.help')}
                                className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-zinc-800"
                            >
                                <HelpCircle className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <Textarea
                        id="request-headers"
                        placeholder={t('objectives:form.headersPlaceholder')}
                        value={formData.request_headers}
                        onChange={(e) => onFieldChange('request_headers', e.target.value)}
                        rows={4}
                        className="font-mono text-xs bg-zinc-900/50 border-zinc-800 text-zinc-300 placeholder:text-zinc-700 focus-visible:ring-cyan-500/30"
                    />
                </div>
                <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="request-body" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                            {t('objectives:form.bodyLabel')} <span className="text-red-500">*</span>
                        </Label>
                        <div className="flex items-center gap-1">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => formatJsonField('request_body_template')}
                                title={t('objectives:form.formatJson')}
                                className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-zinc-800"
                            >
                                <Braces className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => onOpenHelpDialog('body')}
                                title={t('objectives:form.help')}
                                className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-zinc-800"
                            >
                                <HelpCircle className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <Textarea
                        id="request-body"
                        placeholder={t('objectives:form.bodyPlaceholder')}
                        value={formData.request_body_template}
                        onChange={(e) => onFieldChange('request_body_template', e.target.value)}
                        rows={4}
                        className="font-mono text-xs bg-zinc-900/50 border-zinc-800 text-zinc-300 placeholder:text-zinc-700 focus-visible:ring-cyan-500/30"
                    />
                </div>
            </div>

            {/* Request and Response Field Paths */}
            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="request-field" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                            {t('objectives:form.requestFieldLabel')} <span className="text-red-500">*</span>
                        </Label>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <HelpCircle className="text-zinc-500 h-3.5 w-3.5 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                                <p className="text-xs">{t('objectives:form.requestFieldHint')}</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    <Input
                        id="request-field"
                        placeholder={t('objectives:form.requestFieldPlaceholder')}
                        value={formData.request_field}
                        onChange={(e) => onFieldChange('request_field', e.target.value)}
                        className="bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-cyan-500/30 font-mono text-sm"
                    />
                </div>
                <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="response-field" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                            {t('objectives:form.responseFieldLabel')} <span className="text-red-500">*</span>
                        </Label>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <HelpCircle className="text-zinc-500 h-3.5 w-3.5 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                                <p className="text-xs">{t('objectives:form.responseFieldHint')}</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    <Input
                        id="response-field"
                        placeholder={t('objectives:form.responseFieldPlaceholder')}
                        value={formData.response_field}
                        onChange={(e) => onFieldChange('response_field', e.target.value)}
                        className="bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-cyan-500/30 font-mono text-sm"
                    />
                </div>
            </div>

            {/* Notes/Details */}
            <div className="grid gap-2">
                <Label htmlFor="details" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                    {t('objectives:form.detailsLabel')}
                </Label>
                <Textarea
                    id="details"
                    placeholder={t('objectives:form.detailsPlaceholder')}
                    value={formData.target_details}
                    onChange={(e) => onFieldChange('target_details', e.target.value)}
                    rows={2}
                    className="bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-cyan-500/30 resize-none"
                />
            </div>
        </div>
    )
}
