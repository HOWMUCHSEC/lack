import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Copy, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { DetailsPayload } from './DetailsSheetProvider'
import { DetailSection, projectSections, objectiveSections, testCaseSections } from './schemas'
import { ProjectDetails } from './ProjectDetails'
import { ObjectiveDetails } from './ObjectiveDetails'

type TFunction = (key: string) => string

function resolveSections(payload: DetailsPayload | null, t: TFunction): DetailSection<Record<string, unknown>>[] {
  if (!payload) return []
  const { type } = payload
  if (type === 'project') return projectSections(t) as DetailSection<Record<string, unknown>>[]
  if (type === 'objective') return objectiveSections(t) as DetailSection<Record<string, unknown>>[]
  return testCaseSections(t) as DetailSection<Record<string, unknown>>[]
}

function getDefaultTitle(payload: DetailsPayload | null, t: TFunction): string {
  if (!payload) return ''
  const { type, data } = payload
  if (payload.title) return payload.title
  const d = data as Record<string, unknown> | undefined
  if (type === 'project') return (d?.name as string) ?? t('projects:form.detailsTitle')
  if (type === 'objective') return (d?.target_title as string) ?? t('objectives:form.detailsTitle')
  if (type === 'testcase') return (d?.title as string) ?? t('testcases:form.detailsTitle')
  return t('common:details.sections.basic')
}

//

export function DetailsSheetUI({
  open,
  onOpenChange,
  payload,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  payload: DetailsPayload | null
}) {
  const { t } = useTranslation()
  const sections = useMemo(() => resolveSections(payload, t), [payload, t])
  const title = useMemo(() => getDefaultTitle(payload, t), [payload, t])

  const handleCopyId = async () => {
    const id = (payload?.data as Record<string, unknown> | undefined)?.id
    if (!id) return
    try {
      await navigator.clipboard.writeText(String(id))
      toast.success(t('common:toasts.success'))
    } catch {
      toast.error(t('common:toasts.error'))
    }
  }

  const handleEdit = () => {
    if (payload?.actions?.onEdit) return payload.actions.onEdit()
    toast.info(t('common:toasts.processing'))
  }

  // Use specialized view for projects
  if (payload?.type === 'project' && payload.data) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[57vw] p-0 md:w-[47vw] lg:w-[40vw] border-zinc-800 bg-zinc-950">
          <ProjectDetails
            data={payload.data as Record<string, unknown>}
            onEdit={payload.actions?.onEdit}
          />
        </SheetContent>
      </Sheet>
    )
  }

  // Use specialized view for objectives
  if (payload?.type === 'objective' && payload.data) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[57vw] p-0 md:w-[47vw] lg:w-[40vw] border-zinc-800 bg-zinc-950">
          <ObjectiveDetails
            data={payload.data as Record<string, unknown>}
            onEdit={payload.actions?.onEdit}
          />
        </SheetContent>
      </Sheet>
    )
  }

  // Generic view for other types
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[57vw] p-0 md:w-[47vw] lg:w-[40vw]">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-2 border-b p-4">
            <div>
              <SheetTitle>{title}</SheetTitle>
              <SheetDescription>{t('common:details.sections.basic')}</SheetDescription>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4">
            <Accordion type="multiple" defaultValue={sections.length ? [sections[0].id] : []}>
              {sections.map((section) => (
                <AccordionItem key={section.id} value={section.id}>
                  <AccordionTrigger>{section.label}</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {section.fields.map((field) => {
                        const value = payload?.data
                        let display: React.ReactNode
                        if (field.render) {
                          display = field.render(value as Record<string, unknown>)
                        } else {
                          const keys = String(field.key).split('.')
                          let v: unknown = value
                          for (const k of keys) v = (v as Record<string, unknown>)?.[k]
                          if (Array.isArray(v)) display = v.join(', ')
                          else if (v == null || v === '') display = '-'
                          else if (typeof v === 'object')
                            display = (
                              <pre className="break-words whitespace-pre-wrap">
                                {JSON.stringify(v, null, 2)}
                              </pre>
                            )
                          else display = String(v)
                        }
                        return (
                          <div key={String(field.key)} className="space-y-1">
                            <div className="text-muted-foreground text-xs">{field.label}</div>
                            <div className="text-sm break-words">{display}</div>
                          </div>
                        )
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <div className="border-t p-4">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Button variant="ghost" className="h-7 px-2 text-xs" onClick={handleCopyId}>
                <Copy className="mr-1 h-3.5 w-3.5" />
                {t('common:details.fields.id')}
              </Button>
              <Button variant="ghost" className="h-7 px-2 text-xs" onClick={handleEdit}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                {t('common:common.refresh')}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
