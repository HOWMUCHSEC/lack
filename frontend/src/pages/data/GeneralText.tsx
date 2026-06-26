import { lazy, Suspense } from 'react'
import { PageLayout } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileTextIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const TextConversionTab = lazy(() => import('./tabs/TextConversion'))
const EmojiTab = lazy(() => import('./tabs/Emoji'))
const InputPerturbationTab = lazy(() => import('./tabs/InputPerturbation'))
const CharMappingTab = lazy(() => import('./tabs/CharMapping'))
const SplitterTab = lazy(() => import('./tabs/Splitter'))
const AiRewriteTab = lazy(() => import('./tabs/AiRewrite'))
const AncientStyleTab = lazy(() => import('./tabs/AncientStyle'))

export default function GeneralTextPage() {
  const { t } = useTranslation(['data', 'nav'])

  const tabs = [
    {
      value: 'text-conversion',
      label: t('data:tabs.textConversion.title'),
      Component: TextConversionTab,
    },
    { value: 'emoji', label: t('data:tabs.emoji.title'), Component: EmojiTab },
    {
      value: 'input-perturbation',
      label: t('data:tabs.inputPerturbation.title'),
      Component: InputPerturbationTab,
    },
    { value: 'char-mapping', label: t('data:tabs.charMapping.title'), Component: CharMappingTab },
    { value: 'splitter', label: t('data:tabs.splitter.title'), Component: SplitterTab },
    { value: 'ai-rewrite', label: t('data:tabs.aiRewrite.title'), Component: AiRewriteTab },
    {
      value: 'ancient-style',
      label: t('data:tabs.ancientStyle.title'),
      Component: AncientStyleTab,
    },
  ]

  return (
    <PageLayout
      breadcrumbs={[{ label: t('nav:realtimeGeneration') }, { label: t('nav:generalText') }]}
    >
      <Card className="flex h-full min-h-[calc(100vh-120px)] flex-col border-zinc-800 bg-zinc-950/50 backdrop-blur-xl">
        <CardHeader className="shrink-0 border-b border-zinc-800/50 pb-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                <FileTextIcon className="h-7 w-7" weight="duotone" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-xl font-bold tracking-tight">
                  {t('nav:generalText')}
                </CardTitle>
                <CardDescription className="font-medium text-zinc-400">
                  {t('data:general.description')}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col p-6">
          <Tabs defaultValue="text-conversion" className="flex flex-1 flex-col">
            <TabsList className="h-auto w-full flex-nowrap justify-start gap-6 overflow-x-auto rounded-none border-b border-zinc-800/50 bg-transparent p-0 [&::-webkit-scrollbar]:hidden">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="rounded-none border-b-2 border-transparent px-2 py-3 whitespace-nowrap text-zinc-400 transition-colors hover:text-zinc-200 data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:text-zinc-100 data-[state=active]:shadow-none"
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
