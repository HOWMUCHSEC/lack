import { useState, useEffect, useMemo } from 'react'
import { PageLayout } from '@/components/layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  PlusIcon,
  DotsThreeIcon,
  CopyIcon,
  PowerIcon,
  EyeIcon,
  PencilSimpleIcon,
  TrashIcon,
  SparkleIcon,
  CaretUpDownIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  BooksIcon,
  WarningIcon,
  WarningCircleIcon,
  InfoIcon
} from '@phosphor-icons/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { testCaseCategories, categoryGroups } from '@/data/test-case-categories'
import { TestCaseFormDialog } from '@/components/forms/testcase-form-dialog'
import { SampleGeneratorDialog } from '@/components/forms/sample-generator-dialog'
import { ConfirmDialog } from '@/components/confirm-dialog'
import * as TestCaseService from '../../../wailsjs/go/main/TestCaseService'
import { main } from '../../../wailsjs/go/models'
import { toast } from 'sonner'
import { useDetailsSheet } from '@/components/details/DetailsSheetProvider'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

// 使用本地 DB 的 TestCase 类型
type TestCase = main.TestCase

export default function TestCaseLibraryPage() {
  const { t } = useTranslation()
  const [testCases, setTestCases] = useState<TestCase[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTestCaseId, setEditingTestCaseId] = useState<string | undefined>()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingTestCaseId, setDeletingTestCaseId] = useState<string | undefined>()
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const [generatorTestCase, setGeneratorTestCase] = useState<TestCase | null>(null)
  const { openDetails } = useDetailsSheet()

  const [selectedCategory, setSelectedCategory] = useState<string>('violence')
  const [categorySearchOpen, setCategorySearchOpen] = useState(false)
  const [categorySearch, setCategorySearch] = useState('')

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return testCaseCategories
    const search = categorySearch.toLowerCase()
    return testCaseCategories.filter(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        c.description.toLowerCase().includes(search),
    )
  }, [categorySearch])

  const selectedCategoryData = testCaseCategories.find((c) => c.id === selectedCategory)

  const loadTestCases = async () => {
    try {
      const result = await TestCaseService.ListTestCases(0, 500)
      const items = (result.items as TestCase[]) || []
      // 按 updatedAt 降序排列
      items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      setTestCases(items)
    } catch (e) {
      console.error(t('testcases:library.toasts.loadFailed'), e)
      toast.error(t('testcases:library.toasts.loadFailed'))
      setTestCases([])
    }
  }

  useEffect(() => {
    loadTestCases()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleEdit = (testCaseId: string) => {
    setEditingTestCaseId(testCaseId)
    setDialogOpen(true)
  }

  const handleDeleteClick = (testCaseId: string) => {
    setDeletingTestCaseId(testCaseId)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingTestCaseId) return

    try {
      await TestCaseService.DeleteTestCase(deletingTestCaseId)
      toast.success(t('testcases:library.toasts.deleted'))
      loadTestCases()
    } catch (e) {
      console.error(t('testcases:library.toasts.deleteFailed'), e)
      toast.error(t('testcases:library.toasts.deleteFailed'))
    } finally {
      setDeleteDialogOpen(false)
      setDeletingTestCaseId(undefined)
    }
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingTestCaseId(undefined)
  }

  const handleViewDetails = (testCase: TestCase) => {
    openDetails({
      type: 'testcase',
      data: testCase,
      actions: { onEdit: () => handleEdit(testCase.id) },
    })
  }

  const handleToggleStatus = async (testCaseId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'

    try {
      await TestCaseService.ToggleTestCaseStatus(testCaseId)
      toast.success(
        newStatus === 'active'
          ? t('testcases:library.toasts.toggledOn')
          : t('testcases:library.toasts.toggledOff'),
      )
      loadTestCases()
    } catch (e) {
      console.error(t('testcases:library.toasts.copyFailed'), e)
      toast.error(t('testcases:library.toasts.copyFailed'))
    }
  }

  const handleCopy = async (testCase: TestCase) => {
    try {
      await TestCaseService.CopyTestCase(testCase.id)
      toast.success(t('testcases:library.toasts.copySuccess'))
      loadTestCases()
    } catch (e) {
      console.error(t('testcases:library.toasts.copyFailed'), e)
      toast.error(t('testcases:library.toasts.copyFailed'))
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <WarningIcon className="h-4 w-4 text-rose-500" weight="fill" />
      case 'high': return <WarningCircleIcon className="h-4 w-4 text-orange-500" weight="fill" />
      case 'medium': return <WarningCircleIcon className="h-4 w-4 text-amber-500" weight="duotone" />
      default: return <InfoIcon className="h-4 w-4 text-blue-500" weight="duotone" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return "bg-rose-500/10 text-rose-500 border-rose-500/20"
      case 'high': return "bg-orange-500/10 text-orange-500 border-orange-500/20"
      case 'medium': return "bg-amber-500/10 text-amber-500 border-amber-500/20"
      default: return "bg-blue-500/10 text-blue-500 border-blue-500/20"
    }
  }

  const filteredCases = testCases.filter((c) => c.category === selectedCategory)
  const categoryName = selectedCategoryData?.name

  return (
    <PageLayout breadcrumbs={[{ label: t('nav:testManagement') }, { label: t('nav:testCases') }]}>
      {/* Header */}
      <div className="mb-8 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-500 shadow-[0_0_15px_-3px_rgba(139,92,246,0.3)]">
            <BooksIcon className="h-6 w-6" weight="duotone" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-white">{t('testcases:library.pageTitle')}</h1>
            <p className="text-sm font-medium text-zinc-400">{t('testcases:library.pageDesc')}</p>
          </div>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-900/20"
        >
          <PlusIcon className="mr-2 h-4 w-4" />
          {t('testcases:library.actions.newCase')}
        </Button>
      </div>

      {/* Category Filter */}
      <div className="mb-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-zinc-900/40 p-1.5 rounded-xl border border-zinc-800/50 backdrop-blur-sm">
        <Popover open={categorySearchOpen} onOpenChange={setCategorySearchOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              role="combobox"
              aria-expanded={categorySearchOpen}
              className="w-[280px] shrink-0 justify-between text-zinc-300 hover:text-white hover:bg-zinc-800"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="text-zinc-500 text-xs font-medium uppercase tracking-wider shrink-0">{t('testcases:library.table.headers.category')}:</span>
                <span className="truncate font-medium">
                  {selectedCategoryData ? t(`testcases:categories.items.${selectedCategoryData.id}.name`) : t('testcases:library.selectCategory')}
                </span>
              </div>
              <CaretUpDownIcon className="ml-2 h-3.5 w-3.5 opacity-50 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0 border-zinc-800 bg-zinc-950 shadow-xl" align="start">
            <div className="flex items-center border-b border-zinc-800 px-3">
              <MagnifyingGlassIcon className="mr-2 h-4 w-4 shrink-0 opacity-50 bg-zinc-950" />
              <Input
                placeholder={t('testcases:library.searchCategory')}
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent h-10"
              />
            </div>
            <ScrollArea className="h-[300px]">
              <div className="p-2">
                {categoryGroups.map((group) => {
                  const groupCategories = filteredCategories.filter(
                    (c) => c.group === group.id,
                  )
                  if (groupCategories.length === 0) return null
                  return (
                    <div key={group.id} className="mb-2">
                      <div className="text-zinc-500 mb-1 px-2 text-[10px] font-bold uppercase tracking-wider">
                        {t(`testcases:categories.groups.${group.id}`)}
                      </div>
                      {groupCategories.map((category) => (
                        <button
                          key={category.id}
                          onClick={() => {
                            setSelectedCategory(category.id)
                            setCategorySearchOpen(false)
                            setCategorySearch('')
                          }}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                            selectedCategory === category.id
                              ? "bg-violet-500/10 text-violet-400"
                              : "hover:bg-zinc-800 text-zinc-300 hover:text-white"
                          )}
                        >
                          <div className="flex items-center justify-center w-4 h-4">
                            {selectedCategory === category.id && <CheckIcon className="h-3.5 w-3.5" />}
                          </div>
                          <div className="flex-1 text-left">
                            <div className="font-medium">{t(`testcases:categories.items.${category.id}.name`)}</div>
                            <div className="text-zinc-500 line-clamp-1 text-xs">
                              {t(`testcases:categories.items.${category.id}.description`)}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )
                })}
                {filteredCategories.length === 0 && (
                  <div className="text-zinc-500 py-6 text-center text-sm">
                    {t('testcases:library.noCategoryFound')}
                  </div>
                )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
        {selectedCategoryData && (
          <div className="flex-1 px-3 text-sm text-zinc-500 border-l border-zinc-800 hidden md:block truncate">
            {t(`testcases:categories.items.${selectedCategoryData.id}.description`)}
          </div>
        )}
        <div className="shrink-0 px-3 border-l border-zinc-800 hidden md:flex items-center gap-2">
          <span className="text-xs text-zinc-500">{t('testcases:library.localCount', '本地数据')}</span>
          <Badge variant="secondary" className="bg-violet-500/10 text-violet-400 border-violet-500/20 h-5 px-1.5 text-xs font-medium">
            {filteredCases.length}
          </Badge>
        </div>
      </div>

      {/* Grid Content */}
      {filteredCases.length === 0 ? (
        <Card className="border-dashed border-zinc-800 bg-zinc-900/20">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="h-16 w-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4">
              <BooksIcon className="h-8 w-8 text-zinc-600" />
            </div>
            <h3 className="text-lg font-medium text-zinc-300">{t('testcases:library.table.emptyByCategory', { name: categoryName })}</h3>
            <p className="text-sm text-zinc-500 mt-2 max-w-xs text-center">{t('testcases:library.emptyHint', 'No test cases found in this category.')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCases.map((testCase) => (
            <Card key={testCase.id} className="group border-zinc-800 bg-zinc-900/40 backdrop-blur-sm hover:bg-zinc-900/60 hover:border-violet-500/30 transition-all duration-300">
              <CardContent className="p-5 flex flex-col h-full gap-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-zinc-200 truncate pr-2 group-hover:text-violet-400 transition-colors cursor-pointer" onClick={() => handleViewDetails(testCase)}>
                        {testCase.title}
                      </h3>
                    </div>
                    <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", getSeverityColor(testCase.severity))}>
                      <span className="flex items-center gap-1">
                        {getSeverityIcon(testCase.severity)}
                        {t(`testcases:library.severity.${testCase.severity}`)}
                      </span>
                    </Badge>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-white -mr-2">
                        <DotsThreeIcon className="h-5 w-5" weight="bold" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border-zinc-800 bg-zinc-950">
                      <DropdownMenuItem
                        onClick={() => handleViewDetails(testCase)}
                      >
                        <EyeIcon className="mr-2 h-4 w-4 text-zinc-400" />
                        {t('testcases:library.actions.view')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleEdit(testCase.id)}
                      >
                        <PencilSimpleIcon className="mr-2 h-4 w-4 text-zinc-400" />
                        {t('testcases:library.actions.edit')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setGeneratorTestCase(testCase)
                          setGeneratorOpen(true)
                        }}
                      >
                        <SparkleIcon className="mr-2 h-4 w-4 text-amber-500" />
                        {t('testcases:library.actions.generate')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-zinc-800" />
                      <DropdownMenuItem onClick={() => handleCopy(testCase)}>
                        <CopyIcon className="mr-2 h-4 w-4 text-violet-500" />
                        {t('testcases:library.actions.copy')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-zinc-800" />
                      <DropdownMenuItem
                        onClick={() => handleToggleStatus(testCase.id, testCase.status)}
                      >
                        {testCase.status === 'active' ? (
                          <>
                            <PowerIcon className="mr-2 h-4 w-4 text-zinc-500" />
                            {t('testcases:library.actions.disable')}
                          </>
                        ) : (
                          <>
                            <PowerIcon className="mr-2 h-4 w-4 text-green-500" />
                            {t('testcases:library.actions.enable')}
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-zinc-800" />
                      <DropdownMenuItem
                        className="text-rose-500 focus:text-rose-500 focus:bg-rose-500/10"
                        onClick={() => handleDeleteClick(testCase.id)}
                      >
                        <TrashIcon className="mr-2 h-4 w-4" />
                        {t('testcases:library.actions.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Content Preview */}
                <div className="flex-1 bg-zinc-950/50 rounded-lg p-3 border border-zinc-800/50 group-hover:border-zinc-700/50 transition-colors cursor-pointer" onClick={() => handleViewDetails(testCase)}>
                  <p className="text-sm text-zinc-400 line-clamp-3 leading-relaxed font-mono text-[13px]">
                    {testCase.content}
                  </p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-1">
                  <Badge variant="outline" className={cn(
                    "h-5 px-1.5 text-[10px] border-zinc-800",
                    testCase.status === 'active' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-zinc-800 text-zinc-500"
                  )}>
                    {testCase.status === 'active' ? t('testcases:library.status.active') : t('testcases:library.status.inactive')}
                  </Badge>
                </div>

              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TestCaseFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        testCaseId={editingTestCaseId}
        onSuccess={loadTestCases}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t('testcases:library.deleteDialog.title')}
        description={t('testcases:library.deleteDialog.description')}
        onConfirm={handleDeleteConfirm}
        variant="destructive"
      />

      <SampleGeneratorDialog
        open={generatorOpen}
        onOpenChange={setGeneratorOpen}
        testCase={
          generatorTestCase
            ? {
              id: generatorTestCase.id,
              title: generatorTestCase.title,
              content: generatorTestCase.content,
              category: generatorTestCase.category,
              severity: generatorTestCase.severity,
              tags: generatorTestCase.tags,
            }
            : null
        }
      />
    </PageLayout>
  )
}
