import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTranslation } from 'react-i18next'

interface TargetFormData {
  name: string
  project_id: string
  description: string
  base_url: string
  api_token: string
  request_headers: string
  request_body_template: string
}

interface Project {
  id: string
  name: string
}

export function TargetFormFields({
  formData,
  onFieldChange,
  requestMethod,
  onMethodChange,
  timeoutSeconds,
  onTimeoutChange,
  projects,
}: {
  formData: TargetFormData
  onFieldChange: (field: string, value: string) => void
  requestMethod: string
  onMethodChange: (method: string) => void
  timeoutSeconds: number
  onTimeoutChange: (seconds: number) => void
  projects: Project[]
}) {
  const { t } = useTranslation()

  return (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="name">
            {t('objectives:form.nameLabel')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            placeholder={t('objectives:form.namePlaceholder')}
            value={formData.name}
            onChange={(e) => onFieldChange('name', e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="project">{t('objectives:form.projectLabel')}</Label>
          <Select
            value={formData.project_id}
            onValueChange={(value) => onFieldChange('project_id', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('objectives:form.projectPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="description">{t('objectives:form.descriptionLabel')}</Label>
        <Textarea
          id="description"
          placeholder={t('objectives:form.descriptionPlaceholder')}
          value={formData.description}
          onChange={(e) => onFieldChange('description', e.target.value)}
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="base-url">{t('objectives:form.apiUrlLabel')}</Label>
          <Input
            id="base-url"
            placeholder={t('objectives:form.apiUrlPlaceholder')}
            value={formData.base_url}
            onChange={(e) => onFieldChange('base_url', e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="api-token">{t('objectives:form.apiTokenLabel')}</Label>
          <Input
            id="api-token"
            type="password"
            placeholder={t('objectives:form.apiTokenPlaceholder')}
            value={formData.api_token}
            onChange={(e) => onFieldChange('api_token', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="request-method">{t('objectives:form.methodLabel')}</Label>
          <Select value={requestMethod} onValueChange={onMethodChange}>
            <SelectTrigger>
              <SelectValue placeholder={t('objectives:form.methodPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GET">{t('objectives:form.methods.GET')}</SelectItem>
              <SelectItem value="POST">{t('objectives:form.methods.POST')}</SelectItem>
              <SelectItem value="PUT">{t('objectives:form.methods.PUT')}</SelectItem>
              <SelectItem value="PATCH">{t('objectives:form.methods.PATCH')}</SelectItem>
              <SelectItem value="DELETE">{t('objectives:form.methods.DELETE')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="timeout">{t('objectives:form.timeoutLabel')}</Label>
          <Input
            id="timeout"
            type="number"
            min={1}
            placeholder={t('objectives:form.timeoutPlaceholder')}
            value={timeoutSeconds}
            onChange={(e) => onTimeoutChange(Math.max(1, parseInt(e.target.value || '5', 10)) || 5)}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="request-headers">{t('objectives:form.headersLabel')}</Label>
        <Textarea
          id="request-headers"
          placeholder={t('objectives:form.headersPlaceholder')}
          value={formData.request_headers}
          onChange={(e) => onFieldChange('request_headers', e.target.value)}
          rows={4}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="request-body">{t('objectives:form.bodyLabel')}</Label>
        <Textarea
          id="request-body"
          placeholder={t('objectives:form.bodyPlaceholder')}
          value={formData.request_body_template}
          onChange={(e) => onFieldChange('request_body_template', e.target.value)}
          rows={4}
        />
      </div>
    </div>
  )
}
