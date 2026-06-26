import { lazy, Suspense } from 'react'
import { PageLayout } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { WrenchIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const MultiTurnTemplateTab = lazy(() => import('./tabs/MultiTurnTemplate'))
const AsciiSmugglingTab = lazy(() => import('./tabs/AsciiSmuggling'))
const ImageInjectionTab = lazy(() => import('./tabs/ImageInjection'))
const AudioInjectionTab = lazy(() => import('./tabs/AudioInjection'))
const RichTextInjectionTab = lazy(() => import('./tabs/RichTextInjection'))
const DocxInjectionTab = lazy(() => import('./tabs/DocxInjection'))
const PdfInjectionTab = lazy(() => import('./tabs/PdfInjection'))

export default function AdvancedToolsPage() {
  const { t } = useTranslation(['data', 'nav'])

  const tabs = [
    {
      value: 'multi-turn-template',
      label: t('data:tabs.multiTurnTemplate.title'),
      Component: MultiTurnTemplateTab,
    },
    {
      value: 'ascii-smuggling',
      label: t('data:tabs.asciiSmuggling.title'),
      Component: AsciiSmugglingTab,
    },
    {
      value: 'image-injection',
      label: t('data:tabs.imageInjection.title'),
      Component: ImageInjectionTab,
    },
    {
      value: 'audio-injection',
      label: t('data:tabs.audioInjection.title'),
      Component: AudioInjectionTab,
    },
    {
      value: 'rich-text-injection',
      label: t('data:tabs.richTextInjection.title'),
      Component: RichTextInjectionTab,
    },
    {
      value: 'docx-injection',
      label: t('data:tabs.docxInjection.title'),
      Component: DocxInjectionTab,
    },
    {
      value: 'pdf-injection',
      label: t('data:tabs.pdfInjection.title'),
      Component: PdfInjectionTab,
    },
  ]

  return (
    <PageLayout
      breadcrumbs={[{ label: t('nav:realtimeGeneration') }, { label: t('nav:advancedTools') }]}
    >
      <Card className="flex h-full min-h-[calc(100vh-120px)] flex-col border-zinc-800 bg-zinc-950/50 backdrop-blur-xl">
        <CardHeader className="shrink-0 border-b border-zinc-800/50 pb-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10 text-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.15)]">
                <WrenchIcon className="h-7 w-7" weight="duotone" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-xl font-bold tracking-tight">
                  {t('nav:advancedTools')}
                </CardTitle>
                <CardDescription className="font-medium text-zinc-400">
                  {t('data:advanced.description')}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col p-6">
          <Tabs defaultValue="multi-turn-template" className="flex flex-1 flex-col">
            <TabsList className="h-auto w-full flex-nowrap justify-start gap-6 overflow-x-auto rounded-none border-b border-zinc-800/50 bg-transparent p-0 [&::-webkit-scrollbar]:hidden">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="rounded-none border-b-2 border-transparent px-2 py-3 whitespace-nowrap text-zinc-400 transition-colors hover:text-zinc-200 data-[state=active]:border-orange-500 data-[state=active]:bg-transparent data-[state=active]:text-zinc-100 data-[state=active]:shadow-none"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="mt-6 flex-1 overflow-hidden">
              {tabs.map((tab) => (
                <TabsContent key={tab.value} value={tab.value} className="m-0 h-full outline-none">
                  <Suspense
                    fallback={
                      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 py-16 text-zinc-500">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-500/30 border-t-zinc-500" />
                      </div>
                    }
                  >
                    <tab.Component />
                  </Suspense>
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </PageLayout>
  )
}
