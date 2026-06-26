import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PlusIcon, TargetIcon, CheckSquareIcon, BookOpenIcon } from '@phosphor-icons/react'
import { ProjectFormDialog } from '@/components/forms/project-form-dialog'
import { TargetFormDialog } from '@/components/forms/target-form-dialog'
import { TaskFormDialog } from '@/components/forms/task-form-dialog'
import { useTranslation } from 'react-i18next'
import { BrowserOpenURL } from '../../../wailsjs/runtime/runtime'
import { Separator } from '@/components/ui/separator'

const TUTORIAL_URL =
  'https://xjp9l1obtsre.jp.larksuite.com/wiki/MXMewCdFNikoW6kZtiDjWAMYpfF?from=from_copylink'

export function QuickActions() {
  const { t } = useTranslation()
  const [projectOpen, setProjectOpen] = useState(false)
  const [objectiveOpen, setObjectiveOpen] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)

  const handleOpenTutorial = () => {
    BrowserOpenURL(TUTORIAL_URL)
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="h-8 border border-dashed bg-secondary/50 text-xs font-medium text-muted-foreground hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-500"
          onClick={() => setProjectOpen(true)}
        >
          <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
          {t('task:quickActions.newProject')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="h-8 border border-dashed bg-secondary/50 text-xs font-medium text-muted-foreground hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-500"
          onClick={() => setObjectiveOpen(true)}
        >
          <TargetIcon className="mr-1.5 h-3.5 w-3.5" />
          {t('task:quickActions.createObjective')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="h-8 border border-dashed bg-secondary/50 text-xs font-medium text-muted-foreground hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-500"
          onClick={() => setTaskOpen(true)}
        >
          <CheckSquareIcon className="mr-1.5 h-3.5 w-3.5" />
          {t('task:quickActions.addTask')}
        </Button>

        <Separator orientation="vertical" className="mx-1 h-4" />

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground transition-colors hover:text-foreground"
          onClick={handleOpenTutorial}
          title={t('task:quickActions.tutorial')}
        >
          <BookOpenIcon className="h-4 w-4" />
        </Button>
      </div>

      <ProjectFormDialog open={projectOpen} onOpenChange={setProjectOpen} />
      <TargetFormDialog open={objectiveOpen} onOpenChange={setObjectiveOpen} />
      <TaskFormDialog open={taskOpen} onOpenChange={setTaskOpen} />
    </>
  )
}
