import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageLayout } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import * as LocalDB from '../../../wailsjs/go/main/DB'
import { toast } from 'sonner'
import { Database, Trash2 } from 'lucide-react'

type LocalItem = {
  key: string
  value: string
}

const PAGE_SIZE = 20
const PREFIX = 'sets:'
const LEGACY_INDEX_PREFIX = 'sets:idx:'
const LIST_LIMIT = 200

export default function LocalSetsPage() {
  const { t } = useTranslation('testcases')
  const [items, setItems] = useState<LocalItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])

  const load = async (pageIndex = 1) => {
    try {
      const rows = await listLocalSetItems()
      const nextPageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
      const nextPage = Math.min(Math.max(1, pageIndex), nextPageCount)
      const from = (nextPage - 1) * PAGE_SIZE

      setTotal(rows.length)
      setItems(rows.slice(from, from + PAGE_SIZE))
      setPage(nextPage)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(e)
      toast.error(t('localSets.toasts.loadFailed', { message: msg }))
    }
  }

  useEffect(() => {
    load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run once on mount
  }, [])

  const handleDelete = async (key: string) => {
    try {
      await LocalDB.Delete(key)
      toast.success(t('localSets.toasts.deleted'))
      // 重新加载当前页；若删除导致当前页空且非第一页，则回退一页
      const remain = items.length - 1
      const nextPage = remain === 0 && page > 1 ? page - 1 : page
      await load(nextPage)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(t('localSets.toasts.deleteFailed', { message: msg }))
    }
  }

  const renderPagination = () => (
    <div className="mt-4 flex items-center justify-between">
      <div className="text-muted-foreground text-xs">
        {t('pagination.summary', { total, page, pageCount })}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => load(page - 1)}>
          {t('pagination.prev')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => load(page + 1)}
        >
          {t('pagination.next')}
        </Button>
      </div>
    </div>
  )

  return (
    <PageLayout
      breadcrumbs={[
        { label: t('localSets.breadcrumb.parent'), href: '/testcases' },
        { label: t('localSets.breadcrumb.current') },
      ]}
    >
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-xl">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl">{t('testcases:localSets.pageTitle')}</CardTitle>
              <CardDescription className="mt-1">
                {t('testcases:localSets.pageDesc')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[28%]">{t('localSets.table.headers.title')}</TableHead>
                  <TableHead className="w-[40%]">
                    {t('localSets.table.headers.promptPreview')}
                  </TableHead>
                  <TableHead className="w-[20%]">{t('localSets.table.headers.key')}</TableHead>
                  <TableHead className="w-[12%]" style={{ textAlign: 'right' }}>
                    {t('localSets.table.headers.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <div className="text-muted-foreground py-10 text-center text-sm">
                        {t('localSets.table.empty')}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((it) => {
                    const parsed = (() => {
                      try {
                        return JSON.parse(it.value) as {
                          title?: string
                          label_lv1?: string
                          label_lv2?: string
                          prompt_text?: string
                        }
                      } catch {
                        return undefined
                      }
                    })()
                    const title =
                      parsed?.title ||
                      parsed?.label_lv2 ||
                      parsed?.label_lv1 ||
                      t('localSets.table.untitled')
                    const prompt = parsed?.prompt_text || ''
                    return (
                      <TableRow key={it.key} className="group">
                        <TableCell className="truncate">{title}</TableCell>
                        <TableCell>
                          <div
                            className="text-muted-foreground line-clamp-2 text-xs"
                            title={prompt}
                          >
                            {prompt}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground truncate text-xs">
                          {it.key}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => handleDelete(it.key)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {renderPagination()}
        </CardContent>
      </Card>
    </PageLayout>
  )
}

async function listLocalSetItems(): Promise<LocalItem[]> {
  const rows: LocalItem[] = []
  let offset = 0

  while (true) {
    const chunk = await LocalDB.ListPrefix(PREFIX, offset, LIST_LIMIT)
    rows.push(...chunk.filter((kv) => !kv.key.startsWith(LEGACY_INDEX_PREFIX)))
    offset += chunk.length
    if (chunk.length < LIST_LIMIT) break
  }

  return rows
}
