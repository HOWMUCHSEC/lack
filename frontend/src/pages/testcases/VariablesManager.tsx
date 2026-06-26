import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { PageLayout } from '@/components/layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  PlusIcon,
  MinusIcon,
  FunctionIcon,
  LockIcon,
  TextAaIcon,
  CopyIcon,
  EyeIcon,
  EyeSlashIcon,
  ClockIcon
} from '@phosphor-icons/react'
import * as TestCaseService from '../../../wailsjs/go/main/TestCaseService'
import { main } from '../../../wailsjs/go/models'
import { cn } from '@/lib/utils'

// 使用本地 DB 的 UserVariable 类型
type UserVariable = main.UserVariable

export default function VariablesManagerPage() {
  const { t } = useTranslation()
  const [items, setItems] = useState<UserVariable[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', values: [''], enabled: true, description: '' })

  // Local state for visibility toggles on cards
  const [visibleValues, setVisibleValues] = useState<Record<string, boolean>>({})

  // Pre-process items
  const processedItems = useMemo(() => {
    return items.map((it) => {
      let displayValue = it.value
      let isSecret = false
      let type: 'string' | 'json' | 'number' = 'string'

      // Simple heuristic for secrets
      if (it.name.toUpperCase().includes('KEY') || it.name.toUpperCase().includes('SECRET') || it.name.toUpperCase().includes('TOKEN') || it.name.toUpperCase().includes('PASSWORD')) {
        isSecret = true
      }

      try {
        const parsed = JSON.parse(it.value)
        if (Array.isArray(parsed)) {
          displayValue = parsed.join(', ')
          type = 'json'
        } else if (typeof parsed === 'number') {
          type = 'number'
        }
      } catch {
        // Keep original value if not valid JSON
        if (!isNaN(Number(it.value)) && it.value.trim() !== '') {
          type = 'number'
        }
      }
      return { ...it, displayValue, isSecret, type }
    })
  }, [items])

  const load = async () => {
    try {
      setLoading(true)
      const result = await TestCaseService.ListVariables(0, 500)
      const rawItems = (result.items as UserVariable[]) || []
      // 按 updatedAt 降序排列
      rawItems.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      setItems(rawItems)
    } catch (e: unknown) {
      toast.error(
        t('testcases:variables.toasts.loadFailedWithMsg', {
          message: e instanceof Error ? e.message : String(e),
        }),
      )
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error(t('testcases:variables.toasts.nameRequired'))
      return
    }
    const nonEmptyValues = (form.values || []).map((v) => v.trim()).filter(Boolean)
    if (nonEmptyValues.length === 0) {
      toast.error(t('testcases:variables.toasts.valueRequired'))
      return
    }
    try {
      const valueToSave =
        nonEmptyValues.length > 1 ? JSON.stringify(nonEmptyValues) : nonEmptyValues[0]

      const payload: main.UserVariable = {
        id: '',
        name: form.name.trim(),
        value: valueToSave,
        enabled: !!form.enabled,
        description: form.description || '',
        createdAt: 0,
        updatedAt: 0,
      }
      await TestCaseService.CreateVariable(payload)
      toast.success(t('testcases:variables.toasts.created'))
      setOpen(false)
      setForm({ name: '', values: [''], enabled: true, description: '' })
      load()
    } catch (e: unknown) {
      toast.error(
        t('testcases:variables.toasts.createFailedWithMsg', {
          message: e instanceof Error ? e.message : String(e),
        }),
      )
    }
  }

  const toggleVisibility = (id: string) => {
    setVisibleValues(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success(t('common:common.copied', 'Copied to clipboard'))
  }

  return (
    <PageLayout
      breadcrumbs={[
        { label: t('nav:testManagement') },
        { label: t('nav:variableManagement') },
      ]}
    >
      {/* Header */}
      <div className="mb-8 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-500 shadow-[0_0_15px_-3px_rgba(139,92,246,0.3)]">
            <FunctionIcon className="h-6 w-6" weight="duotone" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-white">{t('testcases:variables.pageTitle')}</h1>
            <p className="text-sm font-medium text-zinc-400">{t('testcases:variables.pageDesc')}</p>
          </div>
        </div>
        <Button
          onClick={() => setOpen(true)}
          className="bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-900/20"
        >
          <PlusIcon className="mr-2 h-4 w-4" />
          {t('testcases:variables.actions.new')}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4">
            <FunctionIcon className="h-8 w-8 text-zinc-600" />
          </div>
          <h3 className="text-lg font-medium text-zinc-300">{t('testcases:variables.table.empty', 'No variables found')}</h3>
          <p className="text-sm text-zinc-500 mt-2 max-w-xs">{t('testcases:variables.emptyHint', 'Create a new variable to get started with your test configuration.')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {processedItems.map((item) => (
            <Card key={item.id} className="group border-zinc-800 bg-zinc-900/40 backdrop-blur-sm hover:bg-zinc-900/60 hover:border-violet-500/30 transition-all duration-300 overflow-hidden">
              {/* Accent line */}
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-violet-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <CardContent className="px-5 py-2.5 space-y-2.5">
                {/* Card Header area */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                      item.isSecret ? "bg-rose-500/10 text-rose-500" : "bg-blue-500/10 text-blue-500"
                    )}>
                      {item.isSecret ? <LockIcon className="h-4 w-4" /> : <TextAaIcon className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-mono text-sm font-bold text-zinc-200 truncate" title={item.name}>{item.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {item.isSecret && (
                          <Badge variant="secondary" className="bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 h-5 px-1.5 text-[10px] border-rose-500/20">{t('testcases:variables.sensitive')}</Badge>
                        )}
                        <Badge variant="secondary" className={cn(
                          "h-5 px-1.5 text-[10px] bg-zinc-800 text-zinc-400 hover:bg-zinc-700 border-zinc-700",
                          item.type === 'number' && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                          item.type === 'json' && "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        )}>
                          {item.type.toUpperCase()}
                        </Badge>
                        {!item.enabled && (
                          <Badge variant="outline" className="text-zinc-500 border-zinc-700 h-5 px-1.5 text-[10px]">{t('testcases:variables.status.disabled')}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Value Display */}
                <div className="bg-zinc-950/50 rounded-lg p-2.5 border border-zinc-800/50 group-hover:border-zinc-700 transition-colors">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider font-mono">{t('testcases:variables.table.headers.value')}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.isSecret && (
                        <Button
                          variant="ghost" size="icon" className="h-6 w-6 text-zinc-600 hover:text-zinc-300"
                          onClick={() => toggleVisibility(item.id)}
                        >
                          {visibleValues[item.id] ? <EyeSlashIcon className="h-3.5 w-3.5" /> : <EyeIcon className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                      <Button
                        variant="ghost" size="icon" className="h-6 w-6 text-zinc-600 hover:text-zinc-300"
                        onClick={() => copyToClipboard(item.value)}
                      >
                        <CopyIcon className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="font-mono text-sm text-zinc-300 truncate">
                    {item.isSecret && !visibleValues[item.id]
                      ? '••••••••••••••••'
                      : item.displayValue}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-end justify-between pt-1">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <ClockIcon className="h-3.5 w-3.5" />
                    <span>{item.updatedAt ? new Date(item.updatedAt).toLocaleTimeString() : 'Just now'}</span>
                  </div>
                  {/* TODO: Add Edit/Delete Actions here if APIs support it easily, currently Create-only in provided code but standard CRUD usually implies more. The original code didn't exhibit Edit/Delete buttons in the table explicitly, so keeping it safe but the layout handles them for future. */}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px] border-zinc-800 bg-zinc-950">
          <DialogHeader>
            <DialogTitle>{t('testcases:variables.dialog.title')}</DialogTitle>
            <DialogDescription>{t('testcases:variables.dialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-zinc-300">
                {t('testcases:variables.dialog.fields.name')}{' '}
                <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-zinc-900 border-zinc-800 focus:ring-violet-500/20"
                placeholder="e.g. API_KEY"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="value" className="text-zinc-300">
                {t('testcases:variables.dialog.fields.value')}{' '}
                <span className="text-rose-500">*</span>
              </Label>
              <div className="flex flex-col gap-2">
                {form.values.map((val, idx) => (
                  <div className="flex items-center gap-2" key={idx}>
                    <Input
                      id={idx === 0 ? 'value' : undefined}
                      value={val}
                      onChange={(e) => {
                        const next = [...form.values]
                        next[idx] = e.target.value
                        setForm({ ...form, values: next })
                      }}
                      className="bg-zinc-900 border-zinc-800 focus:ring-violet-500/20"
                      placeholder={idx === 0 ? "Value..." : "Additional value..."}
                    />
                    {idx === form.values.length - 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
                        onClick={() => setForm({ ...form, values: [...form.values, ''] })}
                      >
                        <PlusIcon className="h-4 w-4" />
                      </Button>
                    )}
                    {form.values.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-zinc-500 hover:text-zinc-300"
                        onClick={() => {
                          const next = form.values.filter((_, i) => i !== idx)
                          setForm({ ...form, values: next.length ? next : [''] })
                        }}
                      >
                        <MinusIcon className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-zinc-300">{t('testcases:variables.dialog.fields.status')}</Label>
              <div className="flex items-center gap-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="enabled"
                    value="true"
                    checked={form.enabled === true}
                    onChange={() => setForm({ ...form, enabled: true })}
                    className="accent-violet-500"
                  />
                  <span className="text-sm text-zinc-300">{t('testcases:variables.status.enabled')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="enabled"
                    value="false"
                    checked={form.enabled === false}
                    onChange={() => setForm({ ...form, enabled: false })}
                    className="accent-zinc-500"
                  />
                  <span className="text-sm text-zinc-400">{t('testcases:variables.status.disabled')}</span>
                </label>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="desc" className="text-zinc-300">{t('testcases:variables.dialog.fields.description')}</Label>
              <Input
                id="desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="bg-zinc-900 border-zinc-800 focus:ring-violet-500/20"
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} className="hover:bg-zinc-800">
              {t('common:common.cancel')}
            </Button>
            <Button onClick={handleCreate} className="bg-violet-600 hover:bg-violet-700">{t('testcases:variables.dialog.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
