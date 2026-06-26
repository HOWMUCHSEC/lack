import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, XCircle, Target as TargetIcon, Gavel } from 'lucide-react'

interface Project {
    id: string
    name: string
}

interface TargetBasicFieldsProps {
    formData: {
        project_id: string
        target_title: string
        target_status: string
        order_index: number
        purpose: 'target' | 'judge'
        tags: string
        model_name: string
    }
    projects: Project[]
    onFieldChange: (field: string, value: string | number) => void
}

export function TargetBasicFields({
    formData,
    projects,
    onFieldChange,
}: TargetBasicFieldsProps) {
    const { t } = useTranslation()

    return (
        <>
            {/* 所属项目、状态、排序 - 一行三列 */}
            <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="project" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                        {t('objectives:form.projectLabel')} <span className="text-red-500">*</span>
                    </Label>
                    <Select
                        value={formData.project_id}
                        onValueChange={(value) => onFieldChange('project_id', value)}
                    >
                        <SelectTrigger className="bg-zinc-900/50 border-zinc-800 text-zinc-100 focus:ring-cyan-500/30">
                            <SelectValue placeholder={t('objectives:form.projectPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800">
                            {projects.map((project) => (
                                <SelectItem key={project.id} value={project.id}>
                                    {project.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="status" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                        {t('objectives:form.statusLabel')}
                    </Label>
                    <Select
                        value={formData.target_status}
                        onValueChange={(value) => onFieldChange('target_status', value)}
                    >
                        <SelectTrigger className="bg-zinc-900/50 border-zinc-800 text-zinc-100 focus:ring-cyan-500/30">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800">
                            <SelectItem value="planned">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    <span>{t('objectives:form.status.planned')}</span>
                                </div>
                            </SelectItem>
                            <SelectItem value="archived">
                                <div className="flex items-center gap-2">
                                    <XCircle className="text-muted-foreground h-4 w-4" />
                                    <span>{t('objectives:form.status.archived')}</span>
                                </div>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="order" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                        {t('objectives:form.orderLabel')}
                    </Label>
                    <Input
                        id="order"
                        type="number"
                        placeholder="0"
                        value={formData.order_index}
                        onChange={(e) =>
                            onFieldChange('order_index', parseInt(e.target.value) || 0)
                        }
                        className="bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-cyan-500/30"
                    />
                </div>
            </div>

            {/* 用途、模型名称、标签 - 一行三列 */}
            <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="purpose" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                        {t('objectives:form.purposeLabel')}
                    </Label>
                    <Select
                        value={formData.purpose}
                        onValueChange={(value) =>
                            onFieldChange('purpose', (value as 'target' | 'judge') || 'target')
                        }
                    >
                        <SelectTrigger className="bg-zinc-900/50 border-zinc-800 text-zinc-100 focus:ring-cyan-500/30">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800">
                            <SelectItem value="target">
                                <div className="flex items-center gap-2">
                                    <TargetIcon className="h-4 w-4" />
                                    <span>{t('objectives:form.purpose.target')}</span>
                                </div>
                            </SelectItem>
                            <SelectItem value="judge">
                                <div className="flex items-center gap-2">
                                    <Gavel className="h-4 w-4" />
                                    <span>{t('objectives:form.purpose.judge')}</span>
                                </div>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="target-title" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                        {t('objectives:form.nameLabel')} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        id="target-title"
                        placeholder={t('objectives:form.namePlaceholder')}
                        value={formData.target_title}
                        onChange={(e) => onFieldChange('target_title', e.target.value)}
                        className="bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-cyan-500/30"
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="tags" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                        {t('objectives:form.tagsLabel')}
                    </Label>
                    <Input
                        id="tags"
                        placeholder={t('objectives:form.tagsPlaceholder')}
                        value={formData.tags}
                        onChange={(e) => onFieldChange('tags', e.target.value)}
                        className="bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-cyan-500/30"
                    />
                </div>
            </div>

            {/* 模型名称 - 仅当 purpose=judge 时显示 */}
            {formData.purpose === 'judge' && (
                <div className="grid gap-2">
                    <Label htmlFor="model-name" className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                        {t('objectives:form.modelNameLabel')}
                    </Label>
                    <Input
                        id="model-name"
                        placeholder={t('objectives:form.modelNamePlaceholder')}
                        value={formData.model_name}
                        onChange={(e) => onFieldChange('model_name', e.target.value)}
                        className="bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-cyan-500/30"
                    />
                    <p className="text-zinc-500 text-xs">{t('objectives:form.modelNameHint')}</p>
                </div>
            )}
        </>
    )
}
