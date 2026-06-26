import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { CopyIcon, BookOpenIcon, QuotesIcon, FileTextIcon, FlaskIcon, RobotIcon, CaretLeftIcon, Link as LinkIcon } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { PaperInsight } from '@/services/papers'
import { getPaperById } from '@/services/papers'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'
import { BrowserOpenURL, ClipboardSetText } from '../../../wailsjs/runtime/runtime'
import { AIGenerationDialog } from '@/components/dialogs/AIGenerationDialog'
import { cn } from '@/lib/utils'

function TextBlock({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap", className)}>
      {children}
    </div>
  )
}

function SectionCard({
  title,
  icon: Icon,
  children,
  className,
  action
}: {
  title: string;
  icon?: Icon;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <Card className={cn("border-zinc-800 bg-zinc-900/40 backdrop-blur-sm overflow-hidden", className)}>
      <CardHeader className="border-b border-zinc-800/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {Icon && <Icon className="h-5 w-5 text-teal-500" weight="duotone" />}
            <h3 className="text-base font-semibold text-zinc-100 tracking-tight">{title}</h3>
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {children}
      </CardContent>
    </Card>
  )
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const { t } = useTranslation()
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
      onClick={async () => {
        try {
          await ClipboardSetText(text || '')
          toast.success(t('research:toasts.copied'))
        } catch {
          toast.error(t('research:toasts.copyFailed'))
        }
      }}
    >
      <CopyIcon className="mr-1.5 h-3.5 w-3.5" />
      {label || t('research:details.copy')}
    </Button>
  )
}

export default function PaperDetailsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const params = useParams()
  const paperId = params.id || ''

  const [paper, setPaper] = useState<PaperInsight | undefined>(undefined)
  const [generateOpen, setGenerateOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          const data = await getPaperById(paperId)
          if (!cancelled) setPaper(data ?? undefined)
        } catch {
          if (!cancelled) setPaper(undefined)
        }
      })()
    return () => {
      cancelled = true
    }
  }, [paperId])

  if (!paper) {
    return (
      <PageLayout
        breadcrumbs={[
          { label: t('nav:paperInsights'), href: '/research/papers' },
          { label: t('research:details.loading') },
        ]}
      >
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="h-10 w-10 text-teal-500 animate-spin flex items-center justify-center rounded-full border-2 border-teal-500/30 border-t-teal-500" />
          <span className="text-zinc-500 text-sm font-medium animate-pulse">{t('research:loading')}</span>
        </div>
      </PageLayout>
    )
  }

  const canConstruct = paper.canConstruct

  return (
    <PageLayout
      contentClassName="p-4 md:p-8 max-w-[1600px] mx-auto w-full"
      breadcrumbs={[
        { label: t('nav:paperInsights'), href: '/research/papers' },
        { label: paper.title },
      ]}
    >
      {/* Top Header Section */}
      <div className="flex flex-col gap-6 mb-8">
        <Button
          variant="ghost"
          className="w-fit pl-0 text-zinc-500 hover:text-zinc-300 hover:bg-transparent -ml-2"
          onClick={() => navigate('/research/papers')}
        >
          <CaretLeftIcon className="mr-2 h-4 w-4" />
          {t('research:details.backToList')}
        </Button>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="space-y-4 max-w-4xl">
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">
              {paper.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-zinc-400 font-medium">
              <div className="flex items-center gap-2">
                <span className="text-teal-400">{paper.venue}</span>
                <span className="text-zinc-700">•</span>
                <span>{paper.year}</span>
              </div>
              {paper.authors && (
                <>
                  <span className="text-zinc-700 hidden sm:block">•</span>
                  <span className="text-zinc-500">{paper.authors}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              size="lg"
              className="bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-900/20 font-medium"
              disabled={!canConstruct}
              onClick={() => setGenerateOpen(true)}
            >
              <RobotIcon className="mr-2 h-5 w-5" />
              {t('nav:aiGeneration')}
            </Button>
            {paper.link && (
              <Button
                size="lg"
                variant="outline"
                className="border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300"
                onClick={() => BrowserOpenURL(paper.link!)}
              >
                <BookOpenIcon className="mr-2 h-5 w-5" />
                {t('research:details.openLink')}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Sidebar - Metadata */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-6">

          {/* Metadata Card */}
          <Card className="border-zinc-800 bg-zinc-900/40 backdrop-blur-sm">
            <CardHeader className="px-5 py-4 border-b border-zinc-800/50">
              <CardTitle className="text-sm font-bold text-zinc-400 uppercase tracking-wider">
                {t('research:details.metadata')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-6">
              {/* Tags */}
              <div className="space-y-3">
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide block">
                  {t('research:details.tagsLabel')}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {paper.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border-zinc-700">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator className="bg-zinc-800/50" />

              {/* Resources */}
              <div className="space-y-3">
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide block">
                  {t('research:details.resources')}
                </span>
                <div className="space-y-2">
                  {paper.link ? (
                    <button
                      onClick={() => BrowserOpenURL(paper.link!)}
                      className="flex items-center gap-3 w-full p-2 rounded-md hover:bg-zinc-800/50 transition-colors group text-left"
                    >
                      <div className="h-8 w-8 rounded bg-teal-500/10 text-teal-500 flex items-center justify-center border border-teal-500/20 group-hover:border-teal-500/40 transition-colors">
                        <LinkIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-200 group-hover:text-teal-400 transition-colors truncate">{t('research:details.sections.originalPaper')}</div>
                        <div className="text-xs text-zinc-500 truncate">{paper.link}</div>
                      </div>
                    </button>
                  ) : (
                    <span className="text-sm text-zinc-500 italic block px-2">{t('research:details.sections.noLinksAvailable')}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Authors Card - Moved from Quick Summary if needed, or keep strictly metadata */}
          {/* For now keeping authors in header and metadata card simple */}
        </div>

        {/* Main Content */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-8">

          {/* Quick Summary Section */}
          {(paper.summary || paper.highlights) && (
            <SectionCard
              title={t('research:details.sections.quickSummary')}
              icon={QuotesIcon}
              action={paper.summary ? <CopyButton text={paper.summary} /> : null}
            >
              <div className="space-y-6">
                {paper.summary && (
                  <div className="text-base text-zinc-300 leading-relaxed font-serif italic border-l-2 border-teal-500/30 pl-4 py-1">
                    "{paper.summary}"
                  </div>
                )}

                {paper.highlights && (
                  <div className="bg-zinc-950/50 rounded-lg p-5 border border-zinc-800/50">
                    <h4 className="text-sm font-bold text-teal-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <FlaskIcon className="h-4 w-4" /> {t('research:details.sections.highlights')}
                    </h4>
                    <TextBlock>{paper.highlights}</TextBlock>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* Technical Deep Dive */}
          {(paper.problem || paper.method || paper.pros || paper.cons) && (
            <SectionCard
              title={t('research:details.sections.detailedAnalysis')}
              icon={FileTextIcon}
            >
              <div className="grid gap-8">
                {paper.problem && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wide">
                        {t('research:details.sections.problem')}
                      </h4>
                      <CopyButton text={paper.problem} label=" " />
                    </div>

                    <div className="markdown-content text-sm text-zinc-300 leading-relaxed">
                      <ReactMarkdown>
                        {paper.problem}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}

                {(paper.problem && paper.method) && <Separator className="bg-zinc-800/50" />}

                {paper.method && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wide">
                        {t('research:details.sections.approach')}
                      </h4>
                      <CopyButton text={paper.method} label=" " />
                    </div>
                    <div className="markdown-content text-sm text-zinc-300 leading-relaxed">
                      <ReactMarkdown>
                        {paper.method}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}

                {((paper.problem || paper.method) && (paper.pros || paper.cons)) && <Separator className="bg-zinc-800/50" />}

                {(paper.pros || paper.cons) && (
                  <div className="grid md:grid-cols-2 gap-6">
                    {paper.pros && (
                      <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-4">
                        <h4 className="text-emerald-400 font-bold text-xs uppercase tracking-wide mb-2">{t('research:details.sections.pros')}</h4>
                        <div className="text-sm text-zinc-300">{paper.pros}</div>
                      </div>
                    )}
                    {paper.cons && (
                      <div className="bg-rose-500/5 border border-rose-500/10 rounded-lg p-4">
                        <h4 className="text-rose-400 font-bold text-xs uppercase tracking-wide mb-2">{t('research:details.sections.cons')}</h4>
                        <div className="text-sm text-zinc-300">{paper.cons}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* AI Analysis / Construction */}
          {paper.useCases && (
            <SectionCard
              title={t('research:details.sections.aiAnalysis')}
              icon={RobotIcon}
              action={<CopyButton text={paper.useCases} />}
            >
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                    {t('research:details.sections.implementationGuide')}
                  </Badge>
                </div>
                <TextBlock className="font-mono text-xs bg-black/20 p-4 rounded-lg border border-zinc-800/50">
                  {paper.useCases}
                </TextBlock>
              </div>
            </SectionCard>
          )}

        </div>
      </div>

      <AIGenerationDialog open={generateOpen} onOpenChange={setGenerateOpen} paper={paper} />
    </PageLayout>
  )
}
