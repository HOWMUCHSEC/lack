import { useState, useEffect, useCallback } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ApiResponseDialog, type ApiResponseDialogState, type HttpMethod } from '../shared'
import { TargetBasicFields } from './target-basic-fields'
import { TargetApiConfigSection } from './target-api-config-section'
import * as localData from '@/services/localData'
import type { TargetMetadata } from '@/types'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { TestAPIConnection } from '../../../../wailsjs/go/main/App'
import { apitest } from '../../../../wailsjs/go/models'

interface TargetFormDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    targetId?: string
    onSuccess?: () => void
}

export function TargetFormDialog({
    open,
    onOpenChange,
    targetId,
    onSuccess,
}: TargetFormDialogProps) {
    const { t } = useTranslation()
    const [loading, setLoading] = useState(false)
    const [testing, setTesting] = useState(false)
    const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])
    const [formData, setFormData] = useState({
        project_id: '',
        target_title: '',
        target_details: '',
        target_status: 'planned',
        order_index: 0,
        tags: '',
        base_url: '',
        request_headers: '',
        request_body_template: '',
        purpose: 'target' as 'target' | 'judge',
        request_field: '',
        response_field: '',
        model_name: '',
    })
    const [requestMethod, setRequestMethod] = useState<HttpMethod>('POST')
    const [timeoutSeconds, setTimeoutSeconds] = useState<number>(5)
    const [respDialog, setRespDialog] = useState<ApiResponseDialogState>({ open: false })
    const [helpDialog, setHelpDialog] = useState<{ open: boolean; field: 'headers' | 'body' | 'requestField' | 'responseField' | null }>({
        open: false,
        field: null,
    })

    const loadProjects = useCallback(async () => {
        try {
            const data = await localData.listProjects()
            setProjects(data.map((p) => ({ id: p.id, name: p.name })))
        } catch (err) {
            console.error('加载项目列表失败:', err)
        }
    }, [])

    const loadTarget = useCallback(async () => {
        try {
            const data = await localData.getTarget(targetId!)
            if (data) {
                const md = (data.metadata ?? {}) as TargetMetadata
                setFormData({
                    project_id: data.project_id ?? '',
                    target_title: data.target_title ?? '',
                    target_details: data.target_details ?? '',
                    target_status: data.target_status ?? 'planned',
                    order_index: data.order_index ?? 0,
                    tags: Array.isArray(data.tags) ? data.tags.join(', ') : '',
                    base_url: md.base_url ?? '',
                    request_headers: md.request_headers ?? '',
                    request_body_template: md.request_body_template ?? '',
                    purpose: md.purpose ?? 'target',
                    request_field: md.request_field ?? '',
                    response_field: md.response_field ?? '',
                    model_name: md.model_name ?? '',
                })
                setRequestMethod(md.method ?? 'POST')
                setTimeoutSeconds(md.timeout_ms ? Math.max(1, Math.round(md.timeout_ms / 1000)) : 5)
            }
        } catch (err) {
            console.error('加载目标失败:', err)
            toast.error(t('objectives:form.toasts.loadFailed'))
        }
    }, [targetId, t])

    useEffect(() => {
        if (open) {
            loadProjects()
        }
    }, [open, loadProjects])

    useEffect(() => {
        if (targetId && open) {
            loadTarget()
        } else if (!open) {
            setFormData({
                project_id: '',
                target_title: '',
                target_details: '',
                target_status: 'planned',
                order_index: 0,
                tags: '',
                base_url: '',
                request_headers: '',
                request_body_template: '',
                purpose: 'target',
                request_field: '',
                response_field: '',
                model_name: '',
            })
            setRequestMethod('POST')
            setTimeoutSeconds(5)
        }
    }, [targetId, open, loadTarget])

    const getValueByPath = (obj: unknown, path: string): unknown => {
        if (!path || !obj) return obj
        const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.')
        let current: unknown = obj
        for (const part of parts) {
            if (current === null || current === undefined) return undefined
            if (typeof current === 'object') {
                current = (current as Record<string, unknown>)[part]
            } else {
                return undefined
            }
        }
        return current
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
                let extractedValue: unknown = null

                try {
                    const parsed = JSON.parse(preview)
                    if (formData.response_field?.trim()) {
                        extractedValue = getValueByPath(parsed, formData.response_field.trim())
                    }
                    preview = JSON.stringify(parsed, null, 2)
                } catch {
                    /* ignore JSON parse error */
                }

                const maxLen = 4000
                if (preview.length > maxLen) preview = preview.slice(0, maxLen) + '...'

                let displayBody = preview
                if (extractedValue !== null && extractedValue !== undefined) {
                    displayBody = typeof extractedValue === 'string'
                        ? extractedValue
                        : JSON.stringify(extractedValue, null, 2)
                }

                setRespDialog({
                    open: true,
                    status: result.status_code,
                    time: result.response_time,
                    body: displayBody || t('objectives:form.response.empty'),
                })
            } else {
                const msg =
                    result?.error ||
                    t('objectives:form.toasts.connectionFailed', { status: result?.status_code ?? '未知' })
                toast.error(msg)
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            toast.error(t('objectives:form.toasts.testError', { message }))
        } finally {
            setTesting(false)
        }
    }

    const handleSubmit = async () => {
        if (!formData.target_title.trim()) {
            toast.error(t('objectives:form.toasts.nameRequired'))
            return
        }

        if (!formData.project_id) {
            toast.error(t('objectives:form.toasts.projectRequired'))
            return
        }

        if (!formData.base_url.trim()) {
            toast.error(t('objectives:form.toasts.urlRequired'))
            return
        }

        if (!formData.request_headers.trim()) {
            toast.error(t('objectives:form.toasts.headersRequired'))
            return
        }

        if (!formData.request_body_template.trim()) {
            toast.error(t('objectives:form.toasts.bodyRequired'))
            return
        }

        if (!formData.request_field.trim()) {
            toast.error(t('objectives:form.toasts.requestFieldRequired'))
            return
        }

        if (!formData.response_field.trim()) {
            toast.error(t('objectives:form.toasts.responseFieldRequired'))
            return
        }

        setLoading(true)

        try {
            const tagsArray = formData.tags
                ? formData.tags
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                : []

            const targetData = {
                project_id: formData.project_id,
                target_title: formData.target_title,
                target_details: formData.target_details || null,
                target_status: formData.target_status,
                order_index: formData.order_index,
                tags: tagsArray,
                metadata: {
                    base_url: formData.base_url || null,
                    request_headers: formData.request_headers || null,
                    request_body_template: formData.request_body_template || null,
                    method: requestMethod,
                    timeout_ms: Math.max(1, timeoutSeconds) * 1000,
                    purpose: formData.purpose,
                    request_field: formData.request_field || null,
                    response_field: formData.response_field || null,
                    model_name: formData.model_name || null,
                },
            }

            if (targetId) {
                await localData.updateTarget(targetId, targetData)
                toast.success(t('objectives:form.toasts.updateSuccess'))
            } else {
                await localData.createTarget(targetData)
                toast.success(t('objectives:form.toasts.createSuccess'))
            }

            onOpenChange(false)
            onSuccess?.()
        } catch (err) {
            console.error('保存目标失败:', err)
            const errorMessage =
                err instanceof Error ? err.message : t('objectives:form.toasts.saveFailed')
            toast.error(errorMessage)
        } finally {
            setLoading(false)
        }
    }

    const handleBasicFieldChange = (field: string, value: string | number) => {
        setFormData({ ...formData, [field]: value })
    }

    const handleApiFieldChange = (field: string, value: string) => {
        setFormData({ ...formData, [field]: value })
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[800px] bg-zinc-950/95 backdrop-blur-xl border-zinc-800 shadow-2xl">
                    <DialogHeader className="space-y-3 pb-4 border-b border-zinc-800/50">
                        <DialogTitle className="text-xl font-bold tracking-tight text-white">
                            {targetId ? t('objectives:form.editTitle') : t('objectives:form.createTitle')}
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            {targetId ? t('objectives:form.editDesc') : t('objectives:form.createDesc')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-5 py-5">
                        <TargetBasicFields
                            formData={{
                                project_id: formData.project_id,
                                target_title: formData.target_title,
                                target_status: formData.target_status,
                                order_index: formData.order_index,
                                purpose: formData.purpose,
                                tags: formData.tags,
                                model_name: formData.model_name,
                            }}
                            projects={projects}
                            onFieldChange={handleBasicFieldChange}
                        />

                        <TargetApiConfigSection
                            formData={{
                                base_url: formData.base_url,
                                request_headers: formData.request_headers,
                                request_body_template: formData.request_body_template,
                                request_field: formData.request_field,
                                response_field: formData.response_field,
                                target_details: formData.target_details,
                            }}
                            requestMethod={requestMethod}
                            timeoutSeconds={timeoutSeconds}
                            testing={testing}
                            onFieldChange={handleApiFieldChange}
                            onMethodChange={setRequestMethod}
                            onTimeoutChange={setTimeoutSeconds}
                            onTestConnection={handleTestConnection}
                            onOpenHelpDialog={(field) => setHelpDialog({ open: true, field })}
                        />
                    </div>

                    <DialogFooter className="border-t border-zinc-800/50 pt-4 gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                            className="border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:text-white"
                        >
                            {t('objectives:form.cancel')}
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="bg-cyan-600 hover:bg-cyan-700 text-white shadow-lg shadow-cyan-900/20"
                        >
                            {loading
                                ? t('objectives:form.saving')
                                : targetId
                                    ? t('objectives:form.save')
                                    : t('objectives:form.create')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ApiResponseDialog
                state={respDialog}
                onOpenChange={(o) => setRespDialog((prev) => ({ ...prev, open: o }))}
            />

            {/* Help Dialog */}
            <AlertDialog
                open={helpDialog.open}
                onOpenChange={(o) => setHelpDialog((prev) => ({ ...prev, open: o }))}
            >
                <AlertDialogContent className="sm:max-w-[500px] bg-zinc-950/95 backdrop-blur-xl border-zinc-800">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-white">
                            {t(`objectives:form.helpDialog.${helpDialog.field}Title`)}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                            {t(`objectives:form.helpDialog.${helpDialog.field}Desc`)}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction
                            onClick={() => setHelpDialog({ open: false, field: null })}
                            className="bg-cyan-600 hover:bg-cyan-700 text-white"
                        >
                            {t('objectives:form.response.close')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
