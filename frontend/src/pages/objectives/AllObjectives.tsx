import { useState, useEffect, Suspense, lazy, useCallback } from 'react'
import { PageLayout } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { PlusIcon, EyeIcon, PencilIcon, TrashIcon, TargetIcon, MagnifyingGlassIcon } from '@phosphor-icons/react'
const TargetFormDialog = lazy(() =>
  import('@/components/forms/target-form-dialog').then((m) => ({ default: m.TargetFormDialog })),
)
import { ConfirmDialog } from '@/components/confirm-dialog'
import * as localData from '@/services/localData'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useDetailsSheet } from '@/components/details/DetailsSheetProvider'

interface Target {
  id: string
  target_title: string
  target_status: string
  order_index: number
  tags?: string[]
  created_at: string
  projects?: { name: string }
  metadata?: { purpose?: 'target' | 'judge' } | null
}

export default function AllObjectivesPage() {
  const { t } = useTranslation()
  const [targets, setTargets] = useState<Target[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTargetId, setEditingTargetId] = useState<string | undefined>()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingTargetId, setDeletingTargetId] = useState<string | undefined>()
  const [searchQuery, setSearchQuery] = useState('')

  const loadTargets = useCallback(async () => {
    try {
      setLoading(true)

      // 获取所有目标
      const targetsData = await localData.listTargets()

      // 如果有目标，再查询关联的项目信息
      if (targetsData && targetsData.length > 0) {
        const projectIds = targetsData
          .map((t) => t.project_id)
          .filter((id): id is string => id != null)

        if (projectIds.length > 0) {
          const projectsData = await localData.listProjects()
          const projectMap = new Map(projectsData.map((p) => [p.id, p]))

          // 合并数据
          const targetsWithProjects = targetsData.map((target) => ({
            ...target,
            projects: target.project_id ? projectMap.get(target.project_id) : undefined,
          }))

          setTargets(targetsWithProjects)
        } else {
          setTargets(targetsData)
        }
      } else {
        setTargets([])
      }
    } catch (err) {
      console.error('加载目标异常:', err)
      toast.error(t('objectives:toast.loadError'))
      setTargets([])
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadTargets()
  }, [loadTargets])
  const { openDetails } = useDetailsSheet()

  const handleEdit = useCallback((targetId: string) => {
    setEditingTargetId(targetId)
    setDialogOpen(true)
  }, [])

  const handleDeleteClick = useCallback((targetId: string) => {
    setDeletingTargetId(targetId)
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingTargetId) return

    try {
      await localData.deleteTarget(deletingTargetId)
      toast.success(t('objectives:toast.deleteSuccess'))
      loadTargets()
    } catch (err) {
      console.error('删除目标失败:', err)
      toast.error(t('objectives:toast.deleteFailed'))
    } finally {
      setDeleteDialogOpen(false)
      setDeletingTargetId(undefined)
    }
  }, [deletingTargetId, loadTargets, t])

  const handleDialogClose = useCallback(() => {
    setDialogOpen(false)
    setEditingTargetId(undefined)
  }, [])

  const filteredTargets = targets.filter(t =>
    t.target_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <PageLayout breadcrumbs={[{ label: t('nav:workPlanning') }, { label: t('nav:allModels') }]}>
      <Card className="border-zinc-800 bg-zinc-950/50 backdrop-blur-xl">
        <CardHeader className="border-b border-zinc-800/50 pb-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-500/10 text-indigo-500 flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.15)]">
                <TargetIcon className="h-7 w-7" weight="duotone" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-xl font-bold tracking-tight">{t('nav:allObjectives')}</CardTitle>
                <CardDescription className="text-zinc-400 font-medium">{t('nav:allObjectives')}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-full md:w-64">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  placeholder={t('objectives:allObjectives.searchPlaceholder')}
                  className="pl-9 bg-zinc-900/50 border-zinc-800 h-10 focus-visible:ring-indigo-500/30"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button onClick={() => setDialogOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-900/20 h-10 px-6">
                <PlusIcon className="mr-2 h-4 w-4" />
                {t('objectives:allObjectives.newModel')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="text-muted-foreground py-12 text-center flex flex-col items-center gap-3">
              <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              <div className="text-muted-foreground">{t('objectives:allObjectives.loading')}</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredTargets.length === 0 ? (
                <div className="col-span-full rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 py-16 text-center text-zinc-500">
                  <TargetIcon className="mx-auto h-12 w-12 opacity-20 mb-4" />
                  <p className="text-lg font-medium">{t('objectives:allObjectives.empty')}</p>
                </div>
              ) : (
                filteredTargets.map((target) => (
                  <div
                    key={target.id}
                    className="group relative flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 transition-all hover:bg-zinc-900 hover:border-indigo-700/30 hover:shadow-lg hover:shadow-indigo-500/5 hover:-translate-y-1"
                  >
                    <div className="p-5 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className={`h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-white transition-colors ${target.metadata?.purpose === 'judge' ? 'group-hover:bg-orange-500/10' : 'group-hover:bg-cyan-500/10'}`}>
                          <TargetIcon className={`h-5 w-5 ${target.metadata?.purpose === 'judge' ? 'text-orange-400' : 'text-cyan-400'}`} weight="duotone" />
                        </div>
                        <div className="flex gap-1.5">
                          <Badge
                            variant="outline"
                            className={`h-6 border-0 bg-white/5 ${target.target_status === 'planned' ? 'text-green-400 bg-green-500/10' :
                              'text-zinc-500 bg-zinc-500/10'
                              }`}
                          >
                            {target.target_status === 'planned'
                              ? t('objectives:form.status.planned')
                              : t('objectives:form.status.archived')}
                          </Badge>
                          <Badge variant="outline" className={`h-6 border-0 bg-white/5 ${target.metadata?.purpose === 'judge' ? 'text-orange-400 bg-orange-500/10' : 'text-cyan-400 bg-cyan-500/10'}`}>
                            {target.metadata?.purpose === 'judge'
                              ? t('objectives:form.purpose.judge')
                              : t('objectives:form.purpose.target')}
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <h3 className="font-bold text-lg text-zinc-100 line-clamp-1 group-hover:text-indigo-400 transition-colors">{target.target_title}</h3>
                        {target.projects?.name && (
                          <p className="text-xs text-zinc-500 font-medium">
                            {t('objectives:allObjectives.table.headers.project')}: {target.projects.name}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-2 min-h-[32px]">
                        {target.tags?.slice(0, 3).map((tag, i) => (
                          <span key={i} className="inline-flex items-center rounded-sm bg-zinc-800/80 border border-zinc-700/50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                            {tag}
                          </span>
                        ))}
                        {target.tags && target.tags.length > 3 && (
                          <span className="text-[10px] text-zinc-500 flex items-center">+{target.tags.length - 3}</span>
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
                            type: 'objective',
                            data: target,
                            actions: { onEdit: () => handleEdit(target.id) },
                          })
                        }
                      >
                        <EyeIcon className="mr-2 h-3.5 w-3.5" />
                        {t('objectives:actions.view')}
                      </Button>
                      <div className="h-4 w-px bg-zinc-800" />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 h-8 text-xs font-medium text-zinc-400 border border-transparent hover:border-zinc-700 hover:bg-zinc-800 hover:text-white transition-all"
                        onClick={() => handleEdit(target.id)}
                      >
                        <PencilIcon className="mr-2 h-3.5 w-3.5" />
                        {t('objectives:actions.edit')}
                      </Button>
                      <div className="h-4 w-px bg-zinc-800" />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => handleDeleteClick(target.id)}
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
      {dialogOpen && (
        <Suspense fallback={null}>
          <TargetFormDialog
            open={dialogOpen}
            onOpenChange={handleDialogClose}
            targetId={editingTargetId}
            onSuccess={loadTargets}
          />
        </Suspense>
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t('objectives:allObjectives.deleteDialog.title')}
        description={t('objectives:allObjectives.deleteDialog.description')}
        onConfirm={handleDeleteConfirm}
        variant="destructive"
      />
    </PageLayout>
  )
}
