import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import * as TestCaseService from '../../../wailsjs/go/main/TestCaseService'
import { main } from '../../../wailsjs/go/models'
import { toast } from 'sonner'
import { testCaseCategories } from '@/data/test-case-categories'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Variable } from 'lucide-react'
import { SampleGeneratorDialog } from './sample-generator-dialog'
import { extractPlaceholders } from '@/lib/placeholder'

interface TestCaseFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  testCaseId?: string
  defaultCategory?: string
  onSuccess?: () => void
}

export function TestCaseFormDialog({
  open,
  onOpenChange,
  testCaseId,
  defaultCategory,
  onSuccess,
}: TestCaseFormDialogProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    category: defaultCategory || 'violence',
    title: '',
    content: '',
    expected_response: '',
    severity: 'medium',
    status: 'active',
    tags: '',
  })
  const [generatorOpen, setGeneratorOpen] = useState(false)

  // 从内容中检测 {{变量}} 占位符
  const detectedPlaceholders = extractPlaceholders(formData.content)

  const loadTestCase = useCallback(async () => {
    try {
      if (!testCaseId) return
      const data = await TestCaseService.GetTestCase(testCaseId)
      if (data) {
        setFormData({
          category: data.category || 'violence',
          title: data.title || '',
          content: data.content || '',
          expected_response: data.expectedResponse || '',
          severity: data.severity || 'medium',
          status: data.status || 'active',
          tags: data.tags?.join(', ') || '',
        })
      }
    } catch (error) {
      console.error('加载测试用例失败:', error)
      toast.error(t('testcases:form.toasts.loadFailed'))
    }
  }, [testCaseId, t])

  // 如果是编辑模式，加载测试用例数据
  useEffect(() => {
    if (testCaseId && open) {
      loadTestCase()
    } else if (!open) {
      // 重置表单
      setFormData({
        category: defaultCategory || 'violence',
        title: '',
        content: '',
        expected_response: '',
        severity: 'medium',
        status: 'active',
        tags: '',
      })
    }
  }, [testCaseId, open, defaultCategory, loadTestCase])

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error(t('testcases:form.toasts.titleRequired'))
      return
    }

    if (!formData.content.trim()) {
      toast.error(t('testcases:form.toasts.contentRequired'))
      return
    }

    setLoading(true)

    try {
      // 处理标签
      const tagsArray = formData.tags
        ? formData.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
        : []

      const testCaseData: main.TestCase = {
        id: testCaseId || '',
        category: formData.category,
        title: formData.title,
        content: formData.content,
        expectedResponse: formData.expected_response || '',
        severity: formData.severity,
        status: formData.status,
        tags: tagsArray,
        createdAt: 0,
        updatedAt: 0,
      }

      if (testCaseId) {
        // 更新测试用例
        await TestCaseService.UpdateTestCase(testCaseData)
        toast.success(t('testcases:form.toasts.updateSuccess'))
      } else {
        // 创建测试用例
        await TestCaseService.CreateTestCase(testCaseData)
        toast.success(t('testcases:form.toasts.createSuccess'))
      }

      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('保存测试用例失败:', error)
      const errorMessage =
        error instanceof Error ? error.message : t('testcases:form.toasts.saveFailed')
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>
            {testCaseId ? t('testcases:form.editTitle') : t('testcases:form.createTitle')}
          </DialogTitle>
          <DialogDescription>
            {testCaseId ? t('testcases:form.editDesc') : t('testcases:form.createDesc')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Row 1: 风险分类 + 风险等级 + 状态 */}
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="category">
                {t('testcases:form.categoryLabel')} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {testCaseCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="severity">{t('testcases:form.severityLabel')}</Label>
              <Select
                value={formData.severity}
                onValueChange={(value) => setFormData({ ...formData, severity: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                    {t('testcases:form.severity.low')}
                  </SelectItem>
                  <SelectItem value="medium">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
                    {t('testcases:form.severity.medium')}
                  </SelectItem>
                  <SelectItem value="high">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-orange-500" />
                    {t('testcases:form.severity.high')}
                  </SelectItem>
                  <SelectItem value="critical">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-rose-600" />
                    {t('testcases:form.severity.critical')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">{t('testcases:form.statusLabel')}</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                    {t('testcases:form.status.active')}
                  </SelectItem>
                  <SelectItem value="inactive">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-slate-400" />
                    {t('testcases:form.status.inactive')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: 用例标题 + 标签 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="title">
                {t('testcases:form.titleLabel')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder={t('testcases:form.titlePlaceholder')}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tags">{t('testcases:form.tagsLabel')}</Label>
              <Input
                id="tags"
                placeholder={t('testcases:form.tagsPlaceholder')}
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              />
            </div>
          </div>

          {/* Row 3: 测试内容 + 预期响应 */}
          <div className="grid grid-cols-2 gap-4 items-start">
            <div className="flex flex-col gap-2">
              <Label htmlFor="content">
                {t('testcases:form.contentLabel')} <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="content"
                placeholder={t('testcases:form.contentPlaceholder')}
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="min-h-[120px]"
              />
              <p className="text-muted-foreground text-xs">{t('testcases:form.contentHint')}</p>
              {detectedPlaceholders.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Variable className="h-3 w-3" />
                    {t('testcases:form.detectedVars')}:
                  </div>
                  {detectedPlaceholders.map((ph) => (
                    <Badge key={ph} variant="outline" className="font-mono text-xs">
                      {`{{${ph}}}`}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="expected">{t('testcases:form.expectedLabel')}</Label>
              <Textarea
                id="expected"
                placeholder={t('testcases:form.expectedPlaceholder')}
                value={formData.expected_response}
                onChange={(e) => setFormData({ ...formData, expected_response: e.target.value })}
                className="min-h-[120px]"
              />
              <p className="text-muted-foreground text-xs">{t('testcases:form.expectedHint')}</p>
            </div>
          </div>
        </div>
        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div>
            {detectedPlaceholders.length > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setGeneratorOpen(true)}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {t('testcases:form.generateSamples')}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              {t('testcases:form.cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading
                ? t('testcases:form.saving')
                : testCaseId
                  ? t('testcases:form.save')
                  : t('testcases:form.create')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* 样本生成对话框 */}
      <SampleGeneratorDialog
        open={generatorOpen}
        onOpenChange={setGeneratorOpen}
        testCase={{
          id: testCaseId || `temp-${Date.now()}`,
          title: formData.title || t('testcases:form.untitledTestCase'),
          content: formData.content,
          category: formData.category,
          severity: formData.severity,
          tags: formData.tags
            ? formData.tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
            : [],
        }}
      />
    </Dialog>
  )
}
