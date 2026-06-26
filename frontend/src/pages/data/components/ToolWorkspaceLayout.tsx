import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

export function ToolWorkspaceLayout({
  titleKey,
  descriptionKey,
}: {
  titleKey: string
  descriptionKey: string
}) {
  const { t } = useTranslation('data')
  const [resultOpen, setResultOpen] = useState(false)
  const title = t(titleKey)
  const description = t(descriptionKey)

  const handleExecute = () => {
    setResultOpen(true)
  }

  const handleCopy = () => {
    toast.success(t('common.copySuccess'))
  }

  return (
    <div className="animate-in fade-in grid h-full grid-cols-1 gap-6 pt-4 duration-500 lg:grid-cols-5">
      {/* 文本输入区 */}
      <div className="flex flex-col lg:col-span-2">
        <Card className="flex h-[350px] flex-col border-zinc-800 bg-zinc-900/40 shadow-sm">
          <CardHeader className="border-b border-zinc-800/50 pb-3">
            <CardTitle className="text-sm font-medium text-zinc-300">
              {t('workspace.inputTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="relative h-full flex-1 p-0">
            <Textarea
              placeholder={t('workspace.inputPlaceholder', { title })}
              className="h-full w-full resize-none border-0 bg-transparent p-4 text-zinc-300 placeholder:text-zinc-600 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </CardContent>
        </Card>
      </div>

      {/* 配置区域 (扩大) */}
      <div className="flex h-full flex-col lg:col-span-3">
        <Card className="flex h-full flex-col border-zinc-800 bg-zinc-900/40 shadow-sm">
          <CardHeader className="border-b border-zinc-800/50 pb-3">
            <CardTitle className="text-sm font-medium text-zinc-300">
              {t('workspace.configTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4 p-6">
            <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-900/20 p-6 text-center text-zinc-500">
              <p className="text-base font-medium text-zinc-400">
                {t('workspace.advancedConfig', { title })}
              </p>
              <p className="mt-2 max-w-[300px] text-sm leading-relaxed text-zinc-600">
                {description}
              </p>
            </div>
          </CardContent>
          <div className="mt-auto flex gap-3 px-6 pb-6">
            <Button
              variant="outline"
              className="h-10 flex-1 border-red-900/50 bg-zinc-900/50 text-sm text-red-400 hover:border-red-800/80 hover:bg-red-950/30 hover:text-red-300"
            >
              {t('common.reset')}
            </Button>
            <Button
              onClick={handleExecute}
              className="h-10 flex-1 bg-blue-600 text-sm text-white shadow-md shadow-blue-900/20 hover:bg-blue-700"
            >
              {t('workspace.execute')}
            </Button>
          </div>
        </Card>
      </div>

      {/* 结果 Model 框弹窗 */}
      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-950 shadow-2xl sm:max-w-[800px]">
          <DialogHeader className="border-b border-zinc-800/50 pb-4">
            <DialogTitle className="flex items-center justify-between pr-8 text-zinc-100">
              <span>{t('workspace.resultTitle')}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopy}
                className="h-8 border-zinc-700 bg-zinc-900 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                {t('common.copyCode')}
              </Button>
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {t('workspace.resultDescription', { title })}
            </DialogDescription>
          </DialogHeader>
          <div className="pt-2">
            <Textarea
              readOnly
              value={t('workspace.resultPlaceholder')}
              className="h-full min-h-[400px] w-full resize-none border border-zinc-800 bg-zinc-900/50 p-4 font-mono text-sm text-zinc-300 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
