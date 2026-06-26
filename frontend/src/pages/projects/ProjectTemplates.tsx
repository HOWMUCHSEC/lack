import { useState, useEffect } from 'react'
import { PageLayout } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { PlusIcon, PencilIcon, TrashIcon, GitBranchIcon, MagnifyingGlassIcon, CubeIcon } from '@phosphor-icons/react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ProjectTemplateFormDialog } from '@/components/forms/project-template-form-dialog'
import * as localData from '@/services/localData'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

type Template = {
  id: string
  name: string
  description?: string | null
  tags?: string[] | null
  usage_count?: number
}

export default function ProjectTemplatesPage() {
  const { t } = useTranslation()
  const [templates, setTemplates] = useState<Template[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState<string | undefined>()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | undefined>()
  const [searchQuery, setSearchQuery] = useState('')

  const loadTemplates = async () => {
    try {
      const data = await localData.listProjectTemplates()
      setTemplates(data)
    } catch (err) {
      console.error(t('projects:templates.toasts.loadError'), err)
      toast.error(t('projects:templates.toasts.loadError'))
      setTemplates([])
    }
  }

  useEffect(() => {
    loadTemplates()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run once on mount
  }, [])

  const handleEdit = (templateId: string) => {
    setEditingTemplateId(templateId)
    setDialogOpen(true)
  }

  const handleDeleteClick = (templateId: string) => {
    setDeletingTemplateId(templateId)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingTemplateId) return

    try {
      await localData.deleteProjectTemplate(deletingTemplateId)
      toast.success(t('projects:templates.toasts.deleteSuccess'))
      loadTemplates()
    } catch (err) {
      console.error(t('projects:templates.toasts.deleteFailed'), err)
      toast.error(t('projects:templates.toasts.deleteFailed'))
    } finally {
      setDeleteDialogOpen(false)
      setDeletingTemplateId(undefined)
    }
  }

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      setEditingTemplateId(undefined)
    }
  }

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <PageLayout breadcrumbs={[{ label: t('nav:projectManagement') }, { label: t('nav:projectTemplates') }]}>
      <Card className="border-zinc-800 bg-zinc-950/50 backdrop-blur-xl">
        <CardHeader className="border-b border-zinc-800/50 pb-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-500/10 text-emerald-500 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                <CubeIcon className="h-7 w-7" weight="duotone" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-xl font-bold tracking-tight">{t('projects:templates.pageTitle')}</CardTitle>
                <CardDescription className="text-zinc-400 font-medium">{t('projects:templates.pageDesc')}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-full md:w-64">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  placeholder={t('projects:templates.searchPlaceholder')}
                  className="pl-9 bg-zinc-900/50 border-zinc-800 h-10 focus-visible:ring-emerald-500/30"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button onClick={() => setDialogOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20 h-10 px-6">
                <PlusIcon className="mr-2 h-4 w-4" />
                {t('projects:templates.actions.newTemplate')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {templates.length === 0 && !searchQuery ? (
            <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 py-16 text-center text-zinc-500">
              <CubeIcon className="mx-auto h-12 w-12 opacity-20 mb-4" />
              <p className="text-lg font-medium">{t('projects:templates.table.empty')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="group relative flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 transition-all hover:bg-zinc-900 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 hover:-translate-y-1"
                >
                  <div className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-emerald-400 group-hover:bg-emerald-500/10 transition-colors">
                        <GitBranchIcon className="h-5 w-5" />
                      </div>
                      <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 hover:bg-zinc-700">
                        {t('projects:templates.usage', { count: template.usage_count || 0 })}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-bold text-lg text-zinc-100 line-clamp-1 group-hover:text-emerald-400 transition-colors">
                        {template.name}
                      </h3>
                      <p className="text-sm text-zinc-400 line-clamp-2 min-h-[40px]">
                        {template.description || "No description provided."}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {template.tags?.slice(0, 3).map((tag, i) => (
                        <span key={i} className="inline-flex items-center rounded-sm bg-zinc-800/80 border border-zinc-700/50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                          {tag}
                        </span>
                      ))}
                      {template.tags && template.tags.length > 3 && (
                        <span className="text-[10px] text-zinc-500 flex items-center">+{template.tags.length - 3}</span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 pt-0 border-t border-zinc-800/50 mt-auto flex items-center justify-between gap-3">
                    <Button variant="outline" size="sm" className="flex-1 h-8 text-xs border-zinc-700 bg-transparent hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-colors">
                      {t('projects:templates.actions.useTemplate')}
                    </Button>
                    <div className="flex items-center border-l border-zinc-700 pl-3 gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-zinc-500 hover:text-white"
                        onClick={() => handleEdit(template.id)}
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-zinc-500 hover:text-red-500"
                        onClick={() => handleDeleteClick(template.id)}
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ProjectTemplateFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        templateId={editingTemplateId}
        onSuccess={loadTemplates}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t('projects:templates.deleteDialog.title')}
        description={t('projects:templates.deleteDialog.description')}
        onConfirm={handleDeleteConfirm}
        variant="destructive"
      />
    </PageLayout>
  )
}
