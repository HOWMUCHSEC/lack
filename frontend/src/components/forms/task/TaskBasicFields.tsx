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
import { useTranslation } from 'react-i18next'

export interface Project {
    id: string
    name: string
}

export interface Target {
    id: string
    target_title: string
}

interface TaskBasicFieldsProps {
    formData: {
        project_id: string
        goal_id: string
        title: string
        description: string
        order_index: number
        tags: string
    }
    projects: Project[]
    targets: Target[]
    onFieldChange: (field: string, value: string | number) => void
}

export function TaskBasicFields({
    formData,
    projects,
    targets,
    onFieldChange,
}: TaskBasicFieldsProps) {
    const { t } = useTranslation()

    return (
        <div className="space-y-4">
            {/* Project and Target Selection */}
            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="project" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                        {t('task:form.projectLabel')} <span className="text-red-500">*</span>
                    </Label>
                    <Select
                        value={formData.project_id}
                        onValueChange={(value) => onFieldChange('project_id', value)}
                    >
                        <SelectTrigger className="bg-zinc-900/50 border-zinc-800 text-zinc-100 focus:ring-emerald-500/30">
                            <SelectValue placeholder={t('task:form.projectPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800">
                            {projects.map((project) => (
                                <SelectItem key={project.id} value={project.id} className="text-zinc-100 focus:bg-zinc-800 focus:text-white">
                                    {project.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="goal" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                        {t('task:form.targetLabel')}
                    </Label>
                    <Select
                        value={formData.goal_id}
                        onValueChange={(value) => onFieldChange('goal_id', value)}
                        disabled={!formData.project_id}
                    >
                        <SelectTrigger className="bg-zinc-900/50 border-zinc-800 text-zinc-100 focus:ring-emerald-500/30 disabled:opacity-50">
                            <SelectValue
                                placeholder={
                                    formData.project_id
                                        ? t('task:form.targetPlaceholder')
                                        : t('task:form.targetPlaceholderNoProject')
                                }
                            />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800">
                            {targets.map((target) => (
                                <SelectItem key={target.id} value={target.id} className="text-zinc-100 focus:bg-zinc-800 focus:text-white">
                                    {target.target_title}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Task Name */}
            <div className="grid gap-2">
                <Label htmlFor="title" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                    {t('task:form.nameLabel')} <span className="text-red-500">*</span>
                </Label>
                <Input
                    id="title"
                    placeholder={t('task:form.namePlaceholder')}
                    value={formData.title}
                    onChange={(e) => onFieldChange('title', e.target.value)}
                    className="bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/30"
                />
            </div>

            {/* Order and Tags */}
            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="order" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                        {t('task:form.orderLabel')}
                    </Label>
                    <Input
                        id="order"
                        type="number"
                        placeholder="0"
                        value={formData.order_index}
                        onChange={(e) =>
                            onFieldChange('order_index', parseInt(e.target.value) || 0)
                        }
                        className="bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/30"
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="tags" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                        {t('task:form.tagsLabel')}
                    </Label>
                    <Input
                        id="tags"
                        placeholder={t('task:form.tagsPlaceholder')}
                        value={formData.tags}
                        onChange={(e) => onFieldChange('tags', e.target.value)}
                        className="bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/30"
                    />
                </div>
            </div>

            {/* Description */}
            <div className="grid gap-2">
                <Label htmlFor="description" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                    {t('task:form.descriptionLabel')}
                </Label>
                <Textarea
                    id="description"
                    placeholder={t('task:form.descriptionPlaceholder')}
                    value={formData.description}
                    onChange={(e) => onFieldChange('description', e.target.value)}
                    rows={3}
                    className="bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/30 resize-none"
                />
            </div>
        </div>
    )
}
