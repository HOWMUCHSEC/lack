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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import * as localData from '@/services/localData'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

interface ProjectTemplateFormDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    templateId?: string
    onSuccess?: () => void
}

export function ProjectTemplateFormDialog({
    open,
    onOpenChange,
    templateId,
    onSuccess,
}: ProjectTemplateFormDialogProps) {
    const { t } = useTranslation()
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        tags: '',
    })
    const [loading, setLoading] = useState(false)

    const loadTemplate = useCallback(async () => {
        if (!templateId) return
        try {
            setLoading(true)
            const data = await localData.getProjectTemplate(templateId)
            if (data) {
                setFormData({
                    name: data.name || '',
                    description: data.description || '',
                    tags: data.tags?.join(', ') || '',
                })
            }
        } catch (err) {
            console.error(t('projects:templates.toasts.loadError'), err)
            toast.error(t('projects:templates.toasts.loadError'))
        } finally {
            setLoading(false)
        }
    }, [templateId, t])

    useEffect(() => {
        if (open) {
            if (templateId) {
                loadTemplate()
            } else {
                setFormData({ name: '', description: '', tags: '' })
            }
        }
    }, [open, templateId, loadTemplate])

    const handleSubmit = async () => {
        if (!formData.name.trim()) {
            toast.error(t('projects:templates.toasts.nameRequired'))
            return
        }

        try {
            const normalizedTags = formData.tags ? formData.tags.replace(/，/g, ',') : ''
            const tagsArray = normalizedTags
                ? normalizedTags
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                : []

            const templateData = {
                name: formData.name,
                description: formData.description || null,
                tags: tagsArray,
                is_public: false,
            }

            if (templateId) {
                await localData.updateProjectTemplate(templateId, templateData)
                toast.success(t('projects:templates.toasts.updateSuccess'))
            } else {
                await localData.createProjectTemplate(templateData)
                toast.success(t('projects:templates.toasts.createSuccess'))
            }

            onOpenChange(false)
            onSuccess?.()
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : t('projects:templates.toasts.saveFailed')
            toast.error(errorMessage)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[525px] bg-zinc-950/95 backdrop-blur-xl border-zinc-800 shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-zinc-100">
                        {templateId
                            ? t('projects:templates.dialog.editTitle')
                            : t('projects:templates.dialog.createTitle')}
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        {t('projects:templates.dialog.description')}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-5 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                            {t('projects:templates.dialog.nameLabel')}{' '}
                            <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="name"
                            placeholder={t('projects:templates.dialog.namePlaceholder')}
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500/50"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="description" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                            {t('projects:templates.dialog.descriptionLabel')}
                        </Label>
                        <Textarea
                            id="description"
                            placeholder={t('projects:templates.dialog.descriptionPlaceholder')}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            className="bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500/50 resize-none"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="tags" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                            {t('projects:templates.dialog.tagsLabel')}
                        </Label>
                        <Input
                            id="tags"
                            placeholder={t('projects:templates.dialog.tagsPlaceholder')}
                            value={formData.tags}
                            onChange={(e) =>
                                setFormData({ ...formData, tags: e.target.value.replace(/，/g, ',') })
                            }
                            className="bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500/50"
                        />
                    </div>
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:text-white"
                    >
                        {t('projects:templates.dialog.cancel')}
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        className="bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-900/20"
                        disabled={loading}
                    >
                        {templateId
                            ? t('projects:templates.dialog.save')
                            : t('projects:templates.dialog.create')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
