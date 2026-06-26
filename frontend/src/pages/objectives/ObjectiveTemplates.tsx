import { useState, useEffect, useRef } from 'react'
import { PageLayout } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  LayoutIcon,
  TargetIcon,
  MagnifyingGlassIcon,
} from '@phosphor-icons/react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { TargetTemplateFormDialog } from '@/components/forms/target-template-form-dialog'
import * as localData from '@/services/localData'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { testCaseCategories } from '@/data/test-case-categories'

type TemplateRow = {
  id: string
  name: string
  description?: string | null
  category?: string | null
  usage_count?: number
  is_public: boolean
}

export default function ObjectiveTemplatesPage() {
  const { t } = useTranslation()
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState<string | undefined>()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | undefined>()
  const [searchQuery, setSearchQuery] = useState('')
  const hasLoadedRef = useRef(false)

  const loadTemplates = async () => {
    try {
      const data = await localData.listTargetTemplates()
      setTemplates(data)
    } catch (err) {
      console.error(t('objectives:toast.loadError'), err)
      toast.error(t('objectives:toast.loadError'))
      setTemplates([])
    }
  }

  useEffect(() => {
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true
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
      await localData.deleteTargetTemplate(deletingTemplateId)
      toast.success(t('objectives:toast.deleteSuccess'))
      loadTemplates()
    } catch {
      toast.error(t('objectives:toast.deleteFailed'))
    } finally {
      setDeleteDialogOpen(false)
      setDeletingTemplateId(undefined)
    }
  }

  const handleDialogOpenChange = (isOpen: boolean) => {
    setDialogOpen(isOpen)
    if (!isOpen) {
      setEditingTemplateId(undefined)
    }
  }

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.category &&
        testCaseCategories
          .find((c) => c.id === t.category)
          ?.name.toLowerCase()
          .includes(searchQuery.toLowerCase())),
  )

  return (
    <PageLayout
      breadcrumbs={[{ label: t('nav:workPlanning') }, { label: t('nav:objectiveTemplates') }]}
    >
      <Card className="border-zinc-800 bg-zinc-950/50 backdrop-blur-xl">
        <CardHeader className="border-b border-zinc-800/50 pb-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                <LayoutIcon className="h-7 w-7" weight="duotone" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-xl font-bold tracking-tight">
                  {t('objectives:pageTitle')}
                </CardTitle>
                <CardDescription className="font-medium text-zinc-400">
                  {t('objectives:pageDesc')}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-full md:w-64">
                <MagnifyingGlassIcon className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  placeholder={t('objectives:templates.searchPlaceholder')}
                  className="h-10 border-zinc-800 bg-zinc-900/50 pl-9 focus-visible:ring-cyan-500/30"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button
                onClick={() => setDialogOpen(true)}
                className="h-10 bg-cyan-600 px-6 text-white shadow-lg shadow-cyan-900/20 hover:bg-cyan-700"
              >
                <PlusIcon className="mr-2 h-4 w-4" />
                {t('objectives:actions.newTemplateBtn')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {templates.length === 0 && !searchQuery ? (
            <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 py-16 text-center text-zinc-500">
              <LayoutIcon className="mx-auto mb-4 h-12 w-12 opacity-20" />
              <p className="text-lg font-medium">{t('objectives:table.empty')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="group relative flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 transition-all hover:-translate-y-1 hover:border-cyan-500/30 hover:bg-zinc-900 hover:shadow-lg hover:shadow-cyan-500/5"
                >
                  <div className="space-y-4 p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 transition-colors group-hover:bg-cyan-500/10 group-hover:text-cyan-400">
                        <TargetIcon className="h-5 w-5" />
                      </div>
                      <Badge
                        variant="secondary"
                        className="bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                      >
                        {t('objectives:templates.usage', { count: template.usage_count || 0 })}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <h3
                        className="line-clamp-2 text-base font-semibold text-zinc-100"
                        title={template.name}
                      >
                        {template.name}
                      </h3>
                      <p className="line-clamp-2 min-h-[40px] text-sm text-zinc-400">
                        {template.description || t('objectives:templates.noDesc')}
                      </p>
                    </div>

                    <div className="pt-2">
                      {template.category && (
                        <Badge
                          variant="outline"
                          className="border-cyan-500/20 bg-cyan-500/5 text-cyan-400"
                        >
                          {testCaseCategories.find((c) => c.id === template.category)?.name}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-zinc-800/50 p-4 pt-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 flex-1 border-zinc-700 bg-transparent text-xs transition-colors hover:border-cyan-500 hover:bg-cyan-500 hover:text-white"
                    >
                      {t('objectives:actions.useTemplate')}
                    </Button>
                    <div className="flex items-center gap-1 border-l border-zinc-700 pl-3">
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
      <TargetTemplateFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        templateId={editingTemplateId}
        onSuccess={loadTemplates}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t('objectives:deleteDialog.title')}
        description={t('objectives:deleteDialog.description')}
        onConfirm={handleDeleteConfirm}
        variant="destructive"
      />
    </PageLayout>
  )
}
