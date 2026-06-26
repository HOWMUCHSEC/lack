import { useState, useCallback, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import * as localData from '@/services/localData'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Loader2, Braces } from 'lucide-react'
import {
  ApiResponseDialog,
  HttpMethodSelect,
  type ApiResponseDialogState,
  type HttpMethod,
} from './shared'
import { TestAPIConnection } from '../../../wailsjs/go/main/App'
import { apitest } from '../../../wailsjs/go/models'

interface FormData {
  name: string
  description: string
  base_url: string
  api_token: string
  tags: string
  request_headers: string
  request_body_template: string
}

const initialFormData: FormData = {
  name: '',
  description: '',
  base_url: '',
  api_token: '',
  tags: '',
  request_headers: '',
  request_body_template: '',
}

interface TargetTemplateFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  templateId?: string
  onSuccess?: () => void
}

export function TargetTemplateFormDialog({
  open,
  onOpenChange,
  templateId,
  onSuccess,
}: TargetTemplateFormDialogProps) {
  const { t } = useTranslation()
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [requestMethod, setRequestMethod] = useState<HttpMethod>('POST')
  const [timeoutSeconds, setTimeoutSeconds] = useState<number>(5)
  const [testing, setTesting] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [respDialog, setRespDialog] = useState<ApiResponseDialogState>({ open: false })

  const resetState = useCallback(() => {
    setFormData(initialFormData)
    setRequestMethod('POST')
    setTimeoutSeconds(5)
    setTesting(false)
    setShowAdvanced(false)
  }, [])

  useEffect(() => {
    if (!open) {
      resetState()
      return
    }

    if (!templateId) {
      resetState()
      return
    }

    let active = true

    const loadTemplate = async () => {
      try {
        const data = await localData.getTargetTemplate(templateId)
        if (!active || !data) return

        setFormData({
          name: data.name || '',
          description: data.description || '',
          base_url: data.base_url || '',
          api_token: data.api_token || '',
          tags: data.tags?.join(', ') || '',
          request_headers: data.request_headers || '',
          request_body_template: data.request_body_template || '',
        })
        const md = (data.metadata || {}) as Record<string, unknown>
        const method = String(md?.method || 'POST').toUpperCase()
        const allowed: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
        setRequestMethod((allowed.includes(method as HttpMethod) ? method : 'POST') as HttpMethod)
        setTimeoutSeconds(
          md?.timeout_ms ? Math.max(1, Math.round(Number(md.timeout_ms) / 1000)) : 5,
        )
      } catch {
        if (active) toast.error(t('objectives:toast.loadError'))
      }
    }

    loadTemplate()

    return () => {
      active = false
    }
  }, [open, templateId, resetState, t])

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        resetState()
      }
      onOpenChange(isOpen)
    },
    [resetState, onOpenChange],
  )

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error(t('objectives:toast.nameRequired'))
      return
    }

    try {
      const tagsArray = formData.tags
        ? formData.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
        : []

      let headers = formData.request_headers
      let bodyTemplate = formData.request_body_template

      if (headers && headers.trim()) {
        try {
          headers = JSON.stringify(JSON.parse(headers), null, 2)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          toast.error(t('objectives:form.toasts.jsonInvalid', { message }))
          return
        }
      }

      if (bodyTemplate && bodyTemplate.trim()) {
        try {
          bodyTemplate = JSON.stringify(JSON.parse(bodyTemplate), null, 2)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          toast.error(t('objectives:form.toasts.jsonInvalid', { message }))
          return
        }
      }

      const templateData = {
        name: formData.name,
        description: formData.description || null,
        base_url: formData.base_url || null,
        api_token: formData.api_token || null,
        request_headers: headers || null,
        request_body_template: bodyTemplate || null,
        tags: tagsArray,
        is_public: false,
        metadata: {
          method: requestMethod,
          timeout_ms: Math.max(1, timeoutSeconds) * 1000,
        },
      }

      if (templateId) {
        await localData.updateTargetTemplate(templateId, templateData)
        toast.success(t('objectives:toast.updateSuccess'))
      } else {
        await localData.createTargetTemplate(templateData)
        toast.success(t('objectives:toast.createSuccess'))
      }

      handleOpenChange(false)
      onSuccess?.()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('objectives:toast.saveFailed')
      toast.error(errorMessage)
    }
  }

  const handleTestConnection = async () => {
    if (!formData.base_url.trim()) {
      toast.error(t('objectives:form.toasts.urlRequired'))
      return
    }

    setTesting(true)
    try {
      const result = await TestAPIConnection(
        apitest.Request.createFrom({
          base_url: formData.base_url.trim(),
          request_headers: formData.request_headers || '',
          request_body: formData.request_body_template || '',
          method: requestMethod,
          timeout_ms: Math.max(1, timeoutSeconds) * 1000,
        }),
      )

      if (result?.success) {
        let preview = result.response_body || ''
        try {
          const parsed = JSON.parse(preview)
          preview = JSON.stringify(parsed, null, 2)
        } catch {
          /* ignore */
        }
        const maxLen = 4000
        if (preview.length > maxLen) preview = preview.slice(0, maxLen) + '...'
        setRespDialog({
          open: true,
          status: result.status_code,
          time: result.response_time,
          body: preview || t('objectives:form.response.empty'),
        })
      } else {
        const msg =
          result?.error ||
          t('objectives:form.toasts.connectionFailed', {
            status: result?.status_code ?? t('objectives:form.response.unknown'),
          })
        toast.error(msg)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(t('objectives:form.toasts.testError', { message }))
    } finally {
      setTesting(false)
    }
  }

  const formatJsonField = (field: 'request_headers' | 'request_body_template') => {
    const raw = formData[field]
    if (!raw || !raw.trim()) {
      toast.error(t('objectives:form.toasts.jsonEmpty'))
      return
    }
    try {
      const parsed = JSON.parse(raw)
      const formatted = JSON.stringify(parsed, null, 2)
      setFormData((prev) => ({ ...prev, [field]: formatted }))
      toast.success(t('objectives:form.toasts.jsonFormatted'))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(t('objectives:form.toasts.jsonInvalid', { message }))
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-zinc-800 bg-zinc-950/95 shadow-2xl backdrop-blur-xl sm:max-w-[780px]">
          <DialogHeader className="space-y-3 border-b border-zinc-800/50 pb-4">
            <DialogTitle className="text-xl font-bold tracking-tight text-white">
              {templateId ? t('objectives:dialog.editTitle') : t('objectives:dialog.createTitle')}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {t('objectives:dialog.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-6">
            {/* 名称和标签 */}
            <div className="grid grid-cols-2 gap-6">
              <div className="grid gap-2">
                <Label
                  htmlFor="name"
                  className="text-xs font-medium tracking-wider text-zinc-400 uppercase"
                >
                  {t('objectives:dialog.nameLabel')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder={t('objectives:dialog.namePlaceholder')}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="border-zinc-800 bg-zinc-900/50 text-zinc-100 placeholder:text-zinc-600 focus-visible:border-cyan-500/50 focus-visible:ring-cyan-500/30"
                />
              </div>
              <div className="grid gap-2">
                <Label
                  htmlFor="tags"
                  className="text-xs font-medium tracking-wider text-zinc-400 uppercase"
                >
                  {t('objectives:dialog.tagsLabel')}
                </Label>
                <Input
                  id="tags"
                  placeholder={t('objectives:dialog.tagsPlaceholder')}
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="border-zinc-800 bg-zinc-900/50 text-zinc-100 placeholder:text-zinc-600 focus-visible:border-cyan-500/50 focus-visible:ring-cyan-500/30"
                />
              </div>
            </div>

            {/* 描述 */}
            <div className="grid gap-2">
              <Label
                htmlFor="description"
                className="text-xs font-medium tracking-wider text-zinc-400 uppercase"
              >
                {t('objectives:dialog.descriptionLabel')}
              </Label>
              <Textarea
                id="description"
                placeholder={t('objectives:dialog.descriptionPlaceholder')}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="resize-none border-zinc-800 bg-zinc-900/50 text-zinc-100 placeholder:text-zinc-600 focus-visible:border-cyan-500/50 focus-visible:ring-cyan-500/30"
              />
            </div>

            <div className="space-y-4 rounded-xl border border-zinc-800/50 bg-zinc-900/20 p-4">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
                <span className="h-4 w-1 rounded-full bg-cyan-500"></span>
                {t('objectives:form.apiConfig')}
              </h4>

              {/* API URL 和 Token */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label
                    htmlFor="base-url"
                    className="text-xs font-medium tracking-wider text-zinc-400 uppercase"
                  >
                    {t('objectives:form.apiUrlLabel')}
                  </Label>
                  <Input
                    id="base-url"
                    placeholder={t('objectives:form.apiUrlPlaceholder')}
                    value={formData.base_url}
                    onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                    className="border-zinc-800 bg-zinc-900/50 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:border-cyan-500/50 focus-visible:ring-cyan-500/30"
                  />
                </div>
                <div className="grid gap-2">
                  <Label
                    htmlFor="api-token"
                    className="text-xs font-medium tracking-wider text-zinc-400 uppercase"
                  >
                    {t('objectives:form.apiTokenLabel')}
                  </Label>
                  <Input
                    id="api-token"
                    type="password"
                    placeholder={t('objectives:form.apiTokenPlaceholder')}
                    value={formData.api_token}
                    onChange={(e) => setFormData({ ...formData, api_token: e.target.value })}
                    className="border-zinc-800 bg-zinc-900/50 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:border-cyan-500/50 focus-visible:ring-cyan-500/30"
                  />
                </div>
              </div>

              {/* 方法和超时 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label
                    htmlFor="request-method"
                    className="text-xs font-medium tracking-wider text-zinc-400 uppercase"
                  >
                    {t('objectives:form.methodLabel')}
                  </Label>
                  <HttpMethodSelect
                    value={requestMethod}
                    onValueChange={setRequestMethod}
                    showColors={false}
                  />
                </div>
                <div className="grid gap-2">
                  <Label
                    htmlFor="timeout"
                    className="text-xs font-medium tracking-wider text-zinc-400 uppercase"
                  >
                    {t('objectives:form.timeoutLabel')}
                  </Label>
                  <Input
                    id="timeout"
                    type="number"
                    min={1}
                    placeholder={t('objectives:form.timeoutPlaceholder')}
                    value={timeoutSeconds}
                    onChange={(e) =>
                      setTimeoutSeconds(Math.max(1, parseInt(e.target.value || '5', 10)) || 5)
                    }
                    className="border-zinc-800 bg-zinc-900/50 text-zinc-100 placeholder:text-zinc-600 focus-visible:border-cyan-500/50 focus-visible:ring-cyan-500/30"
                  />
                </div>
              </div>
            </div>

            {/* 高级配置 */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:text-white"
                >
                  {showAdvanced ? t('objectives:form.hideAdvanced') : t('objectives:form.advanced')}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={testing || !formData.base_url.trim()}
                  className="bg-cyan-600 text-white shadow-lg shadow-cyan-900/20 hover:bg-cyan-700"
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

              {showAdvanced && (
                <div className="animate-in fade-in slide-in-from-top-2 mt-2 grid grid-cols-2 gap-4 duration-200">
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="request-headers"
                        className="text-xs font-medium tracking-wider text-zinc-400 uppercase"
                      >
                        {t('objectives:form.headersLabel')}
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => formatJsonField('request_headers')}
                        title={t('objectives:form.formatJson')}
                        className="h-6 w-6 text-zinc-500 hover:text-zinc-300"
                      >
                        <Braces className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Textarea
                      id="request-headers"
                      placeholder={t('objectives:form.headersPlaceholder')}
                      value={formData.request_headers}
                      onChange={(e) =>
                        setFormData({ ...formData, request_headers: e.target.value })
                      }
                      rows={4}
                      className="border-zinc-800 bg-zinc-900/50 font-mono text-xs text-zinc-300 placeholder:text-zinc-700 focus-visible:border-cyan-500/50 focus-visible:ring-cyan-500/30"
                    />
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="request-body"
                        className="text-xs font-medium tracking-wider text-zinc-400 uppercase"
                      >
                        {t('objectives:form.bodyLabel')}
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => formatJsonField('request_body_template')}
                        title={t('objectives:form.formatJson')}
                        className="h-6 w-6 text-zinc-500 hover:text-zinc-300"
                      >
                        <Braces className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Textarea
                      id="request-body"
                      placeholder={t('objectives:form.bodyPlaceholder')}
                      value={formData.request_body_template}
                      onChange={(e) =>
                        setFormData({ ...formData, request_body_template: e.target.value })
                      }
                      rows={4}
                      className="border-zinc-800 bg-zinc-900/50 font-mono text-xs text-zinc-300 placeholder:text-zinc-700 focus-visible:border-cyan-500/50 focus-visible:ring-cyan-500/30"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 border-t border-zinc-800/50 pt-4 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:text-white"
            >
              {t('objectives:dialog.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              className="bg-cyan-600 text-white shadow-lg shadow-cyan-900/20 hover:bg-cyan-700"
            >
              {templateId ? t('objectives:dialog.save') : t('objectives:dialog.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ApiResponseDialog
        state={respDialog}
        onOpenChange={(open) => setRespDialog((prev) => ({ ...prev, open }))}
        maxWidth="sm:max-w-[780px]"
      />
    </>
  )
}
