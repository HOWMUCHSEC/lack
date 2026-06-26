import { useState, useEffect, useCallback } from 'react'
import { PageLayout } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { PlusIcon, EyeIcon, PencilIcon, TrashIcon, FolderOpenIcon, MagnifyingGlassIcon } from '@phosphor-icons/react'
import { ProjectFormDialog } from '@/components/forms/project-form-dialog'
import { ConfirmDialog } from '@/components/confirm-dialog'
import * as localData from '@/services/localData'
import { toast } from 'sonner'
import { useDetailsSheet } from '@/components/details/DetailsSheetProvider'
import { useTranslation } from 'react-i18next'

interface Project {
  id: string
  name: string
  description?: string | null
  status: 'Active' | 'Completed' | 'Paused'
  tags?: string[]
  metadata?: { model?: string }
  created_at: string
  deleted_at?: string | null
}

export default function AllProjectsPage() {
  const { t } = useTranslation()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProjectId, setEditingProjectId] = useState<string | undefined>()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingProjectId, setDeletingProjectId] = useState<string | undefined>()
  const [searchQuery, setSearchQuery] = useState('')

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true)
      const data = await localData.listProjects()
      setProjects(data)
    } catch (err) {
      console.error(t('projects:list.toasts.loadFailed'), err)
      toast.error(t('projects:list.toasts.loadFailed'))
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const { openDetails } = useDetailsSheet()

  const handleEdit = (projectId: string) => {
    setEditingProjectId(projectId)
    setDialogOpen(true)
  }

  const handleDeleteClick = (projectId: string) => {
    setDeletingProjectId(projectId)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingProjectId) return

    try {
      await localData.deleteProject(deletingProjectId)
      toast.success(t('projects:list.toasts.deleted'))
      loadProjects()
    } catch (err) {
      console.error(t('projects:list.toasts.deleteFailed'), err)
      toast.error(t('projects:list.toasts.deleteFailed'))
    } finally {
      setDeleteDialogOpen(false)
      setDeletingProjectId(undefined)
    }
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingProjectId(undefined)
  }

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <PageLayout breadcrumbs={[{ label: t('nav:workPlanning') }, { label: t('nav:allProjects') }]}>
      <Card className="border-zinc-800 bg-zinc-950/50 backdrop-blur-xl">
        <CardHeader className="border-b border-zinc-800/50 pb-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-purple-500/10 text-purple-500 flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                <FolderOpenIcon className="h-7 w-7" weight="duotone" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-xl font-bold tracking-tight">{t('projects:list.pageTitle')}</CardTitle>
                <CardDescription className="text-zinc-400 font-medium">{t('projects:list.pageDesc')}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-full md:w-64">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  placeholder={t('projects:list.searchPlaceholder')}
                  className="pl-9 bg-zinc-900/50 border-zinc-800 h-10 focus-visible:ring-purple-500/30"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button onClick={() => setDialogOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-900/20 h-10 px-6">
                <PlusIcon className="mr-2 h-4 w-4" />
                {t('projects:list.actions.newProject')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="text-muted-foreground py-12 text-center flex flex-col items-center gap-3">
              <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              <p>{t('projects:list.loading')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProjects.length === 0 ? (
                <div className="col-span-full rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 py-16 text-center text-zinc-500">
                  <FolderOpenIcon className="mx-auto h-12 w-12 opacity-20 mb-4" />
                  <p className="text-lg font-medium">{t('projects:list.table.empty')}</p>
                  <p className="text-sm mt-1 text-zinc-600">{t('projects:list.table.emptyDesc')}</p>
                </div>
              ) : (
                filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    className="group relative flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 transition-all hover:bg-zinc-900 hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/5 hover:-translate-y-1"
                  >
                    <div className="p-5 pb-2 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-purple-400 group-hover:bg-purple-500/10 transition-colors">
                          <FolderOpenIcon className="h-5 w-5" />
                        </div>
                        <Badge
                          variant="outline"
                          className={`h-6 border-0 bg-white/5 ${project.status === 'Active' ? 'text-green-400 bg-green-500/10' :
                            project.status === 'Completed' ? 'text-blue-400 bg-blue-500/10' :
                              'text-zinc-500 bg-zinc-500/10'
                            }`}
                        >
                          {project.status === 'Active' ? t('projects:list.status.active') :
                            project.status === 'Completed' ? t('projects:list.status.completed') :
                              t('projects:list.status.paused')}
                        </Badge>
                      </div>

                      <div className="space-y-1">
                        <h3 className="font-bold text-lg text-zinc-100 line-clamp-1 group-hover:text-purple-400 transition-colors">
                          {project.name}
                        </h3>
                        {project.description && (
                          <p className="text-sm text-zinc-400 line-clamp-2 min-h-[40px]">
                            {project.description}
                          </p>
                        )}
                        {!project.description && (
                          <p className="text-xs text-zinc-500 font-mono pt-1">
                            {t('projects:list.table.idPrefix')}{project.id.slice(0, 8)}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-2">
                        {project.tags?.slice(0, 3).map((tag, i) => (
                          <span key={i} className="inline-flex items-center rounded-sm bg-zinc-800/80 border border-zinc-700/50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                            {tag}
                          </span>
                        ))}
                        {project.tags && project.tags.length > 3 && (
                          <span className="text-[10px] text-zinc-500 flex items-center">+{project.tags.length - 3}</span>
                        )}
                      </div>
                    </div>

                    <div className="p-4 pt-4 border-t border-zinc-800/50 mt-auto flex items-center gap-2 bg-zinc-900/20 rounded-b-xl">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 h-8 text-xs font-medium text-zinc-400 border border-transparent hover:border-zinc-700 hover:bg-zinc-800 hover:text-white transition-all"
                        onClick={() =>
                          openDetails({
                            type: 'project',
                            data: project,
                            actions: { onEdit: () => handleEdit(project.id) },
                          })
                        }
                      >
                        <EyeIcon className="mr-2 h-3.5 w-3.5" />
                        {t('projects:list.actions.view')}
                      </Button>
                      <div className="h-4 w-px bg-zinc-800" />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 h-8 text-xs font-medium text-zinc-400 border border-transparent hover:border-zinc-700 hover:bg-zinc-800 hover:text-white transition-all"
                        onClick={() => handleEdit(project.id)}
                      >
                        <PencilIcon className="mr-2 h-3.5 w-3.5" />
                        {t('projects:list.actions.edit')}
                      </Button>
                      <div className="h-4 w-px bg-zinc-800" />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => handleDeleteClick(project.id)}
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <ProjectFormDialog

        open={dialogOpen}
        onOpenChange={handleDialogClose}
        projectId={editingProjectId}
        onSuccess={loadProjects}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t('projects:list.deleteConfirm.title')}
        description={t('projects:list.deleteConfirm.description')}
        onConfirm={handleDeleteConfirm}
        variant="destructive"
      />
    </PageLayout>
  )
}
