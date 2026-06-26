import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Database, Users, Globe } from 'lucide-react'
import { PageLayout } from '@/components/layout'

// 导入子页面内容组件
import LocalSamplesContent from './LocalSamplesContent'
import CloudSamplesContent from './CloudSamplesContent'
import PublicDatasetsContent from './PublicDatasetsContent'
import { useDataStatistics } from './hooks/useDataStatistics'
import { formatCount } from './utils/formatCount'

/** 是否为企业版 (默认 true，构建时可通过 VITE_EDITION=personal 禁用) */
const isEnterprise = import.meta.env.VITE_EDITION !== 'personal'

export default function SampleLibraryPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'local' | 'community' | 'public'>('local')
  const { localCount, communityCount, publicCount, refreshLocal, refreshCommunity, refreshPublic } = useDataStatistics()

  // 根据版本动态计算 tab 数量，用于 grid-cols
  const tabCount = useMemo(() => (isEnterprise ? 3 : 1), [])

  return (
    <PageLayout
      breadcrumbs={[
        { label: t('nav:modelEvaluation') },
        { label: t('nav:dataManagement') },
      ]}
    >
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'local' | 'community' | 'public')}>
        <TabsList className={`grid w-full max-w-lg ${tabCount === 3 ? 'grid-cols-3' : 'grid-cols-1'}`}>
          <TabsTrigger value="local" className="gap-2">
            <Database className="h-4 w-4" />
            {t('samples:library.localTab')}
            {localCount !== null && (
              <Badge variant="secondary" className="ml-1 bg-zinc-800 text-zinc-400 h-4 px-1 text-[9px]">
                {formatCount(localCount)}
              </Badge>
            )}
          </TabsTrigger>
          {isEnterprise && (
            <TabsTrigger value="community" className="gap-2">
              <Users className="h-4 w-4" />
              {t('samples:library.communityTab')}
              {communityCount !== null && (
                <Badge variant="secondary" className="ml-1 bg-zinc-800 text-zinc-400 h-4 px-1 text-[9px]">
                  {formatCount(communityCount)}
                </Badge>
              )}
            </TabsTrigger>
          )}
          {isEnterprise && (
            <TabsTrigger value="public" className="gap-2">
              <Globe className="h-4 w-4" />
              {t('samples:library.publicTab')}
              {publicCount !== null && (
                <Badge variant="secondary" className="ml-1 bg-zinc-800 text-zinc-400 h-4 px-1 text-[9px]">
                  {formatCount(publicCount)}
                </Badge>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="local" className="mt-4">
          <LocalSamplesContent onRefresh={refreshLocal} />
        </TabsContent>

        {isEnterprise && (
          <TabsContent value="community" className="mt-4">
            <CloudSamplesContent onRefresh={refreshCommunity} />
          </TabsContent>
        )}

        {isEnterprise && (
          <TabsContent value="public" className="mt-4">
            <PublicDatasetsContent onRefresh={refreshPublic} />
          </TabsContent>
        )}
      </Tabs>
    </PageLayout>
  )
}
