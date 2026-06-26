import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { TestAPIConnection } from '../../../wailsjs/go/main/App'
import { apitest } from '../../../wailsjs/go/models'
import { Loader2, Braces } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

export function ApiTestSection({
  baseUrl,
  headers,
  bodyTemplate,
  method,
  timeoutSeconds,
  onTestComplete,
  onFormatHeaders,
}: {
  baseUrl: string
  headers: string
  bodyTemplate: string
  method: string
  timeoutSeconds: number
  onTestComplete: (result: apitest.Response) => void
  onFormatHeaders?: (formattedHeaders: string) => void
}) {
  const { t } = useTranslation()
  const [testing, setTesting] = useState(false)

  const handleTestConnection = async () => {
    if (!baseUrl.trim()) {
      toast.error(t('objectives:form.toasts.urlRequired'))
      return
    }

    setTesting(true)
    try {
      const result = await TestAPIConnection(
        apitest.Request.createFrom({
          base_url: baseUrl.trim(),
          request_headers: headers || '',
          request_body: bodyTemplate || '',
          method,
          timeout_ms: Math.max(1, timeoutSeconds) * 1000,
        }),
      )
      onTestComplete(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(t('objectives:form.toasts.testError', { message }))
    } finally {
      setTesting(false)
    }
  }

  const formatJsonField = (field: string) => {
    if (!field || !field.trim()) {
      toast.error(t('objectives:form.toasts.jsonEmpty'))
      return
    }
    try {
      const parsed = JSON.parse(field)
      return JSON.stringify(parsed, null, 2)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(t('objectives:form.toasts.jsonInvalid', { message }))
      return field
    }
  }

  return (
    <div className="flex items-center justify-between">
      <div className="grid gap-1">
        <h4 className="text-sm font-medium">{t('objectives:form.apiConfig')}</h4>
        <p className="text-muted-foreground text-xs">{t('objectives:form.apiConfigDesc')}</p>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            const formatted = formatJsonField(headers)
            if (formatted && onFormatHeaders) onFormatHeaders(formatted)
          }}
          title={t('objectives:form.formatJson')}
        >
          <Braces className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleTestConnection}
          disabled={testing || !baseUrl.trim()}
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
    </div>
  )
}
