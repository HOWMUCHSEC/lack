import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    TargetIcon,
    CalendarIcon,
    TagIcon,
    HashIcon,
    CopyIcon,
    FolderOpenIcon,
    SortAscendingIcon
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { formatDateTime } from '@/lib/date'

interface ObjectiveDetailsProps {
    data: Record<string, unknown>
    onEdit?: () => void
}

export function ObjectiveDetails({ data, onEdit }: ObjectiveDetailsProps) {
    const { t } = useTranslation()

    const objective = {
        id: data.id as string,
        title: data.target_title as string,
        status: data.target_status as string,
        orderIndex: data.order_index as number | undefined,
        tags: (data.tags as string[]) || [],
        created_at: data.created_at as string,
        parentProject: (data.projects as { name?: string } | null)?.name,
    }

    const handleCopyId = async () => {
        if (!objective.id) return
        try {
            await navigator.clipboard.writeText(objective.id)
            toast.success(t('common:toasts.success'))
        } catch {
            toast.error(t('common:toasts.error'))
        }
    }

    return (
        <div className="flex h-full flex-col bg-zinc-950">
            {/* Header Section */}
            <div className="p-6 border-b border-zinc-800/50 bg-zinc-900/10">
                <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.15)] shrink-0">
                        <TargetIcon className="h-6 w-6 text-cyan-400" weight="duotone" />
                    </div>
                    <div className="space-y-1 flex-1 min-w-0">
                        <h2 className="text-xl font-bold text-zinc-100 truncate">{objective.title}</h2>
                        <div className="flex flex-col gap-2">
                            <Badge
                                variant="outline"
                                className={`w-fit border-0 px-2 py-0.5 ${objective.status === 'Active' ? 'text-green-400 bg-green-500/10' :
                                        objective.status === 'Completed' ? 'text-blue-400 bg-blue-500/10' :
                                            'text-zinc-500 bg-zinc-500/10'
                                    }`}
                            >
                                {t('common:details.fields.status')}: {objective.status || '-'}
                            </Badge>
                            <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
                                <span className="truncate max-w-[200px] sm:max-w-md" title={objective.id}>
                                    {objective.id}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                                    onClick={handleCopyId}
                                >
                                    <CopyIcon className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-6 space-y-8">
                    {/* Metadata Grid */}
                    <section className="space-y-3">
                        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                            <HashIcon className="h-4 w-4" />
                            {t('common:details.sections.meta')}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="rounded-lg border border-zinc-800/50 bg-zinc-900/20 p-3 flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-zinc-800/50 flex items-center justify-center text-zinc-400">
                                    <CalendarIcon className="h-4 w-4" />
                                </div>
                                <div>
                                    <div className="text-[10px] text-zinc-500 font-medium uppercase">{t('common:details.fields.createdAt')}</div>
                                    <div className="text-sm text-zinc-200">{formatDateTime(objective.created_at)}</div>
                                </div>
                            </div>

                            <div className="rounded-lg border border-zinc-800/50 bg-zinc-900/20 p-3 flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-zinc-800/50 flex items-center justify-center text-zinc-400">
                                    <FolderOpenIcon className="h-4 w-4" />
                                </div>
                                <div>
                                    <div className="text-[10px] text-zinc-500 font-medium uppercase">{t('common:details.fields.parentProject')}</div>
                                    <div className="text-sm text-zinc-200">{objective.parentProject || '-'}</div>
                                </div>
                            </div>

                            {objective.orderIndex !== undefined && (
                                <div className="rounded-lg border border-zinc-800/50 bg-zinc-900/20 p-3 flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-lg bg-zinc-800/50 flex items-center justify-center text-zinc-400">
                                        <SortAscendingIcon className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-zinc-500 font-medium uppercase">{t('common:details.fields.orderIndex')}</div>
                                        <div className="text-sm text-zinc-200">{objective.orderIndex}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Tags */}
                    {objective.tags.length > 0 && (
                        <section className="space-y-3">
                            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                                <TagIcon className="h-4 w-4" />
                                {t('common:details.fields.tags')}
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {objective.tags.map((tag, i) => (
                                    <Badge
                                        key={i}
                                        variant="secondary"
                                        className="bg-zinc-800/50 text-zinc-300 border-zinc-700/50 hover:bg-zinc-800 hover:text-white transition-colors"
                                    >
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </ScrollArea>

            {/* Footer Actions */}
            <div className="p-4 border-t border-zinc-800/50 bg-zinc-900/10 flex justify-end gap-3">
                {onEdit && (
                    <Button
                        onClick={onEdit}
                        className="bg-cyan-600/90 hover:bg-cyan-600 text-white shadow-lg shadow-cyan-900/20 border border-cyan-500/20 w-full"
                    >
                        <FolderOpenIcon className="mr-2 h-4 w-4" />
                        {t('objectives:list.actions.edit')}
                    </Button>
                )}
            </div>
        </div>
    )
}
