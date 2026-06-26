import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui/card'

interface EvaluationStatsProps {
    stats: {
        total: number
        completed: number
        passed: number
        failed: number
        avgScore: number
    }
}

export function EvaluationStats({ stats }: EvaluationStatsProps) {
    const { t } = useTranslation()

    return (
        <div className="grid grid-cols-5 gap-3">
            <Card className="border-zinc-800 bg-zinc-900/50 p-3 text-center">
                <div className="text-zinc-500 text-xs uppercase tracking-wider font-semibold">
                    {t('task:details.evaluation.stats.total')}
                </div>
                <div className="text-2xl font-bold text-zinc-100">{stats.total}</div>
            </Card>

            <Card className="border-zinc-800 bg-zinc-900/50 p-3 text-center">
                <div className="text-zinc-500 text-xs uppercase tracking-wider font-semibold">
                    {t('task:details.evaluation.stats.completed')}
                </div>
                <div className="text-2xl font-bold text-blue-400">{stats.completed}</div>
            </Card>

            <Card className="border-emerald-900/30 bg-emerald-950/20 p-3 text-center">
                <div className="text-emerald-600 text-xs uppercase tracking-wider font-semibold">
                    {t('task:details.evaluation.stats.passed')}
                </div>
                <div className="text-2xl font-bold text-emerald-400">{stats.passed}</div>
            </Card>

            <Card className="border-red-900/30 bg-red-950/20 p-3 text-center">
                <div className="text-red-600 text-xs uppercase tracking-wider font-semibold">
                    {t('task:details.evaluation.stats.failed')}
                </div>
                <div className="text-2xl font-bold text-red-400">{stats.failed}</div>
            </Card>

            <Card className="border-cyan-900/30 bg-cyan-950/20 p-3 text-center">
                <div className="text-cyan-600 text-xs uppercase tracking-wider font-semibold">
                    {t('task:details.evaluation.stats.avgScore')}
                </div>
                <div className="text-2xl font-bold text-cyan-400">{stats.avgScore}</div>
            </Card>
        </div>
    )
}
