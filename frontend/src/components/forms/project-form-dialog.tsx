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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import * as localData from '@/services/localData'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

interface ProjectFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId?: string
  onSuccess?: () => void
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}: ProjectFormDialogProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'Active',
    tags: '',
  })

  const loadProject = useCallback(async () => {
    try {
      const data = await localData.getProject(projectId!)
      if (data) {
        setFormData({
          name: data.name || '',
          description: data.description || '',
          status: data.status || 'Active',
          tags: data.tags?.join(', ') || '',
        })
      }
    } catch (err) {
      console.error('加载项目失败:', err)
      toast.error(t('projects:form.toasts.loadFailed'))
    }
  }, [projectId, t])

  // 如果是编辑模式，加载项目数据
  useEffect(() => {
    if (projectId && open) {
      loadProject()
    } else if (!open) {
      // 重置表单
      setFormData({
        name: '',
        description: '',
        status: 'Active',
        tags: '',
      })
    }
  }, [projectId, open, loadProject])

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error(t('projects:form.toasts.nameRequired'))
      return
    }

    setLoading(true)

    try {
      // 处理标签
      const tagsArray = formData.tags
        ? formData.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
        : []

      const projectData = {
        name: formData.name,
        description: formData.description || null,
        status: formData.status as 'Active' | 'Completed' | 'Paused',
        tags: tagsArray,
        metadata: {},
      }

      if (projectId) {
        // 更新项目
        await localData.updateProject(projectId, projectData)
        toast.success(t('projects:form.toasts.updateSuccess'))
      } else {
        // 创建项目
        await localData.createProject(projectData)
        toast.success(t('projects:form.toasts.createSuccess'))
      }

      onOpenChange(false)
      onSuccess?.()
    } catch (err: unknown) {
      console.error('保存项目失败:', err)
      toast.error(err instanceof Error ? err.message : t('projects:form.toasts.saveFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px] bg-zinc-950/95 backdrop-blur-xl border-zinc-800 shadow-2xl">
        <DialogHeader className="space-y-3 pb-4 border-b border-zinc-800/50">
          <DialogTitle className="text-xl font-bold tracking-tight text-white">
            {projectId ? t('projects:form.editTitle') : t('projects:form.createTitle')}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {projectId ? t('projects:form.editDesc') : t('projects:form.createDesc')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 py-5">
          <div className="grid gap-2">
            <Label htmlFor="project-name" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
              {t('projects:form.nameLabel')} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="project-name"
              placeholder={t('projects:form.namePlaceholder')}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="status" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                {t('projects:form.statusLabel')}
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger className="bg-zinc-900/50 border-zinc-800 text-zinc-100 focus:ring-emerald-500/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="Active" className="text-zinc-100 focus:bg-zinc-800 focus:text-white">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                      <span>{t('projects:form.status.active')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="Paused" className="text-zinc-100 focus:bg-zinc-800 focus:text-white">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
                      <span>{t('projects:form.status.paused')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="Completed" className="text-zinc-100 focus:bg-zinc-800 focus:text-white">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-zinc-500" />
                      <span>{t('projects:form.status.completed')}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tags" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                {t('projects:form.tagsLabel')}
              </Label>
              <Input
                id="tags"
                placeholder={t('projects:form.tagsPlaceholder')}
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className="bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500/50"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
              {t('projects:form.descriptionLabel')}
            </Label>
            <Textarea
              id="description"
              placeholder={t('projects:form.descriptionPlaceholder')}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500/50 resize-none"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="border-t border-zinc-800/50 pt-4 gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:text-white"
          >
            {t('projects:form.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20"
          >
            {loading
              ? t('projects:form.saving')
              : projectId
                ? t('projects:form.save')
                : t('projects:form.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

