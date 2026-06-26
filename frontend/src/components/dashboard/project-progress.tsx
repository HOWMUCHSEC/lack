import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { CaretRightIcon, CheckCircleIcon, ClockIcon, PauseIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  loadProjectProgress,
  type DashboardObjectiveProgress,
  type DashboardProjectProgress,
} from '@/services/dashboardData'

export function ProjectProgress() {
  const { t } = useTranslation('dashboard')
  const navigate = useNavigate()
  const [projects, setProjects] = useState<DashboardProjectProgress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    loadProjectProgress(3)
      .then((items) => {
        if (mounted) setProjects(items)
      })
      .catch(() => {
        if (mounted) setProjects([])
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  return (
    <Card className="col-span-3">
      <CardHeader>
        <CardTitle>{t('projectProgress.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="text-muted-foreground py-8 text-center text-sm">
            {t('projectProgress.loading')}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-sm">
            {t('projectProgress.empty')}
          </div>
        ) : (
          projects.map((project) => (
            <div key={project.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold">{project.name}</h4>
                  <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                    {project.model || t('projectProgress.modelUnknown')}
                  </Badge>
                </div>
                <span className="text-sm font-medium">{project.progress}%</span>
              </div>
              <Progress value={project.progress} className="h-2" />

              <div className="ml-4 space-y-2">
                {project.objectives.length === 0 ? (
                  <div className="text-muted-foreground text-sm">
                    {t('projectProgress.noObjectives')}
                  </div>
                ) : (
                  project.objectives
                    .slice(0, 3)
                    .map((objective) => <ObjectiveRow key={objective.id} objective={objective} />)
                )}
              </div>
            </div>
          ))
        )}

        <Button variant="ghost" className="w-full" size="sm" onClick={() => navigate('/projects')}>
          {t('projectProgress.viewAllProjects')}
          <CaretRightIcon className="ml-1 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  )
}

function ObjectiveRow({ objective }: { objective: DashboardObjectiveProgress }) {
  const StatusIcon =
    objective.status === 'completed'
      ? CheckCircleIcon
      : objective.status === 'paused'
        ? PauseIcon
        : ClockIcon

  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <StatusIcon className="text-muted-foreground h-3 w-3" />
        <span className="text-muted-foreground">{objective.name}</span>
      </div>
      <span className="text-muted-foreground text-xs">{objective.progress}%</span>
    </div>
  )
}
