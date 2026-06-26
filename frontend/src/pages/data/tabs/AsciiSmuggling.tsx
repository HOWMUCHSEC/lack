import { useState } from 'react'
import { FileText, Ghost, SlidersHorizontal, Zap, Copy, Wand2 } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

export default function AsciiSmugglingTab() {
  const { t } = useTranslation('data')
  const [resultOpen, setResultOpen] = useState(false)

  const handleExecute = () => {
    setResultOpen(true)
  }

  const handleCopy = () => {
    toast.success(t('common.copySuccess'))
  }

  return (
    <div className="animate-in fade-in flex h-full flex-col gap-8 pt-4 duration-500">
      {/* 顶部主要网格 */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* 左侧区域：可见文本与设置 */}
        <div className="flex flex-col gap-8">
          {/* 可见文本 */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-cyan-400">
              <FileText className="h-5 w-5" />
              <h3 className="text-[15px] font-semibold">{t('ascii.visibleText.title')}</h3>
            </div>
            <p className="text-sm text-zinc-400">{t('ascii.visibleText.description')}</p>
            <Textarea
              placeholder={t('ascii.visibleText.placeholder')}
              className="min-h-[250px] resize-none border-zinc-800/80 bg-[#0c141f]/50 p-4 text-zinc-300 focus-visible:border-cyan-500/50 focus-visible:ring-cyan-500/30"
            />
          </div>

          {/* 插入设置 */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-cyan-400">
              <SlidersHorizontal className="h-5 w-5" />
              <h3 className="text-[15px] font-semibold">{t('ascii.insertSettings.title')}</h3>
            </div>

            <div className="mt-1 grid grid-cols-2 gap-5">
              <div className="space-y-3">
                <Label className="font-medium text-zinc-300">
                  {t('ascii.insertSettings.positionLabel')}
                </Label>
                <Select defaultValue="append">
                  <SelectTrigger className="h-10 border-zinc-800/80 bg-[#0c141f]/50 text-zinc-300">
                    <SelectValue placeholder={t('ascii.insertSettings.positionPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="append">
                      {t('ascii.insertSettings.positions.append')}
                    </SelectItem>
                    <SelectItem value="prepend">
                      {t('ascii.insertSettings.positions.prepend')}
                    </SelectItem>
                    <SelectItem value="middle">
                      {t('ascii.insertSettings.positions.middle')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="font-medium text-zinc-300">
                  {t('ascii.insertSettings.encodingLabel')}
                </Label>
                <Select defaultValue="auto">
                  <SelectTrigger className="h-10 border-zinc-800/80 bg-[#0c141f]/50 text-zinc-300">
                    <SelectValue placeholder={t('ascii.insertSettings.encodingPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">{t('ascii.insertSettings.encodings.auto')}</SelectItem>
                    <SelectItem value="base64">
                      {t('ascii.insertSettings.encodings.base64')}
                    </SelectItem>
                    <SelectItem value="raw">{t('ascii.insertSettings.encodings.raw')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* 右侧区域：隐藏payload与操作 */}
        <div className="flex flex-col gap-8">
          {/* 隐藏payload */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-cyan-400">
              <Ghost className="h-5 w-5" />
              <h3 className="text-[15px] font-semibold">{t('ascii.hiddenPayload.title')}</h3>
            </div>
            <p className="text-sm text-zinc-400">{t('ascii.hiddenPayload.description')}</p>
            <Textarea
              placeholder={t('ascii.hiddenPayload.placeholder')}
              className="min-h-[250px] resize-none border-zinc-800/80 bg-[#0c141f]/50 p-4 text-zinc-300 focus-visible:border-cyan-500/50 focus-visible:ring-cyan-500/30"
            />
          </div>

          {/* 快捷操作 */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-cyan-400">
              <Zap className="h-5 w-5" />
              <h3 className="text-[15px] font-semibold">{t('ascii.quickActions.title')}</h3>
            </div>

            <div className="mt-1">
              <div className="space-y-3">
                {/* 使用透明文本占位，与左侧的 Label 高度完全保持一致 */}
                <Label className="pointer-events-none block font-medium text-transparent select-none">
                  {t('ascii.quickActions.placeholderLabel')}
                </Label>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="h-10 rounded-lg border-red-900/50 bg-transparent px-6 text-red-400 hover:border-red-800/80 hover:bg-red-950/30 hover:text-red-300"
                  >
                    {t('common.reset')}
                  </Button>
                  <Button
                    onClick={handleExecute}
                    className="h-10 rounded-lg bg-[#56B9EB] px-6 font-semibold text-black shadow-lg shadow-cyan-900/20 hover:bg-[#48a5d6]"
                  >
                    <Wand2 className="mr-2 h-4 w-4" />
                    {t('ascii.quickActions.write')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 结果弹窗 */}
      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="flex flex-col gap-5 border-zinc-800 bg-[#0A111A] p-6 shadow-2xl sm:max-w-[700px] [&>button]:hidden">
          <DialogHeader className="hidden">
            <DialogTitle>{t('ascii.result.statsTitle')}</DialogTitle>
          </DialogHeader>

          {/* 顶部两张统计卡片 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-4 rounded-xl border border-zinc-800/80 bg-[#0F1722] p-5">
              <div className="flex items-center gap-2">
                <h4 className="text-[15px] font-medium text-[#56B9EB]">
                  {t('ascii.result.statsTitle')}
                </h4>
              </div>
              <div className="space-y-2.5 text-sm text-zinc-300">
                <p>{t('ascii.result.payloadCount', { count: 0, chars: 0 })}</p>
                <p>{t('ascii.result.visibleLength', { count: 0 })}</p>
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-xl border border-zinc-800/80 bg-[#0F1722] p-5">
              <div className="flex items-center gap-2">
                <h4 className="text-[15px] font-medium text-[#56B9EB]">
                  {t('ascii.result.firstPayloadTitle')}
                </h4>
              </div>
              <div className="space-y-2.5 text-sm text-zinc-300">
                <p>{t('ascii.result.emptyPayload')}</p>
                <p className="text-zinc-500">{t('ascii.visibleText.placeholder')}</p>
              </div>
            </div>
          </div>

          {/* 底部结果输入框 */}
          <div className="relative mt-1 flex-1">
            <Textarea
              readOnly
              placeholder={t('ascii.result.placeholder')}
              className="min-h-[350px] resize-none border-zinc-800/80 bg-[#0F1722] p-5 text-zinc-300 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <Button
              size="icon"
              variant="secondary"
              onClick={handleCopy}
              className="absolute right-4 bottom-4 h-9 w-9 rounded-lg border-zinc-700 bg-zinc-800/80 text-zinc-300 shadow-md backdrop-blur-sm hover:bg-zinc-700"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
