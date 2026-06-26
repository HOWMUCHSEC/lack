import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RobotIcon, CheckIcon, ClipboardIcon, WarningIcon, XIcon, RocketLaunchIcon } from '@phosphor-icons/react'
import type { PaperInsight } from '@/services/papers'
import { supabase } from '@/lib/supabaseClient'
import { Badge } from '@/components/ui/badge'

function TextBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative group">
      <pre className="bg-black/30 mt-1 max-h-[500px] overflow-auto rounded-lg px-4 py-3 font-mono text-[11px] whitespace-pre-wrap md:text-xs text-zinc-300 border border-zinc-800/50">
        {children}
      </pre>
    </div>
  )
}

interface AIGenerationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  paper: PaperInsight
}

export function AIGenerationDialog({ open, onOpenChange, paper }: AIGenerationDialogProps) {
  const { t } = useTranslation()
  const [harmfulQuestion, setHarmfulQuestion] = useState('')
  const [generating, setGenerating] = useState(false)
  const [resultOpen, setResultOpen] = useState(false)
  const [resultText, setResultText] = useState('')
  const [errorOpen, setErrorOpen] = useState(false)
  const [errorText, setErrorText] = useState('')

  const handleGenerate = useCallback(async () => {
    if (!paper || !harmfulQuestion.trim() || generating) return

    setGenerating(true)
    setResultText('')
    const toastId = `gen-${paper.id}`
    toast.loading(t('research:generation.toasts.generating'), { id: toastId })

    try {
      const { data, error } = await supabase.functions.invoke('api/generate_jailbreak_stream', {
        body: {
          arxiv_id: paper.arxivId,
          harmful_question: harmfulQuestion.trim(),
        },
      })

      if (error) {
        throw new Error(error.message || 'Function invocation failed')
      }

      // 如果返回的是流式响应 (ReadableStream)
      if (data instanceof ReadableStream) {
        const reader = data.getReader()
        const decoder = new TextDecoder()
        let accumulated = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          accumulated += decoder.decode(value, { stream: true })
          setResultText(accumulated)
        }
      } else {
        // 非流式响应，直接使用返回的数据
        setResultText(typeof data === 'string' ? data : JSON.stringify(data, null, 2))
      }

      onOpenChange(false)
      setResultOpen(true)
      toast.success(t('research:generation.toasts.success'), { id: toastId })
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        toast.dismiss(toastId)
        return
      }
      const msg = err instanceof Error ? err.message : String(err)
      setErrorText(msg)
      onOpenChange(false)
      setErrorOpen(true)
      toast.error(t('research:generation.toasts.failed'), { id: toastId })
    } finally {
      setGenerating(false)
    }
  }, [paper, harmfulQuestion, generating, t, onOpenChange])

  const handleCopyResult = async () => {
    if (!resultText) return
    try {
      await navigator.clipboard.writeText(resultText)
      toast.success(t('research:generation.toasts.copied'))
    } catch {
      toast.error(t('research:generation.toasts.copyFailed'))
    }
  }

  const handleClose = () => {
    setHarmfulQuestion('')
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg border-zinc-800 bg-zinc-950/90 backdrop-blur-xl shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20">
                <RobotIcon className="h-6 w-6 text-teal-400" weight="duotone" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-white">{t('research:generation.pageTitle')}</DialogTitle>
                <DialogDescription className="text-zinc-400">{t('research:generation.pageDesc')}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-4">
              <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">
                {t('research:table.headers.title')}
              </div>
              <div className="text-sm font-medium text-zinc-200">{paper.title}</div>
              {paper.arxivId && (
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="bg-zinc-800 hover:bg-zinc-800 text-zinc-400 border-zinc-700 text-[10px] px-1.5 py-0 h-5">
                    {t('research:generation.arxivLabel')}: {paper.arxivId}
                  </Badge>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label htmlFor="harmfulQuestion" className="text-sm font-medium text-zinc-300">
                {t('research:generation.form.harmfulQuestion')}
              </Label>
              <Textarea
                id="harmfulQuestion"
                rows={4}
                placeholder={t('research:generation.form.harmfulQuestionPlaceholder')}
                value={harmfulQuestion}
                onChange={(e) => setHarmfulQuestion(e.target.value)}
                disabled={generating}
                className="bg-zinc-900 border-zinc-800 text-zinc-200 focus:border-teal-500/50 focus:ring-teal-500/20 resize-none"
              />
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button variant="ghost" onClick={handleClose} disabled={generating} className="text-zinc-400 hover:text-white hover:bg-zinc-800">
              {t('research:generation.form.cancel')}
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generating || !harmfulQuestion.trim()}
              className="bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-lg shadow-teal-900/20"
            >
              {generating ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white mr-2" />
                  {t('research:generation.form.generating')}
                </>
              ) : (
                <>
                  <RocketLaunchIcon className="mr-2 h-4 w-4" weight="fill" />
                  {t('research:generation.form.generate')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="max-w-3xl border-zinc-800 bg-zinc-950/90 backdrop-blur-xl h-[80vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2 border-b border-zinc-800/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-teal-500/10 flex items-center justify-center border border-teal-500/20">
                  <CheckIcon className="h-5 w-5 text-teal-400" />
                </div>
                <DialogTitle>{t('research:generation.result.title')}</DialogTitle>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-white" onClick={() => setResultOpen(false)}>
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
            <DialogDescription className="text-zinc-400">{t('research:generation.result.desc')}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto p-6">
            <TextBlock>{resultText}</TextBlock>
          </div>

          <DialogFooter className="p-6 pt-4 border-t border-zinc-800/50 bg-zinc-900/30">
            <Button variant="outline" onClick={handleCopyResult} disabled={!resultText} className="border-zinc-700 hover:bg-zinc-800 text-zinc-300">
              <ClipboardIcon className="mr-2 h-4 w-4" />
              {t('research:generation.result.copy')}
            </Button>
            <Button onClick={() => setResultOpen(false)} className="bg-teal-600 hover:bg-teal-700">
              {t('research:generation.result.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={errorOpen} onOpenChange={setErrorOpen}>
        <DialogContent className="max-w-md border-red-900/50 bg-zinc-950 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-red-500 mb-2">
              <WarningIcon className="h-6 w-6" weight="fill" />
              <DialogTitle className="text-red-500">{t('research:generation.error.title')}</DialogTitle>
            </div>
            <DialogDescription className="text-zinc-400">{t('research:generation.error.desc')}</DialogDescription>
          </DialogHeader>
          <div className="bg-red-950/20 border border-red-900/30 rounded-md p-3 text-red-300 text-sm font-mono break-all">
            {errorText}
          </div>
          <DialogFooter>
            <Button onClick={() => setErrorOpen(false)} variant="destructive" className="bg-red-600 hover:bg-red-700">
              {t('research:generation.error.ok')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
