import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Download, Send, Pencil, Trash2, Wrench } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

interface HttpMethodSelectProps {
  value: HttpMethod
  onValueChange: (value: HttpMethod) => void
  showColors?: boolean
}

const methodIcons: Record<HttpMethod, { icon: typeof Send; colorClass?: string }> = {
  GET: { icon: Download, colorClass: 'text-green-600' },
  POST: { icon: Send, colorClass: 'text-blue-600' },
  PUT: { icon: Pencil, colorClass: 'text-orange-600' },
  PATCH: { icon: Wrench, colorClass: 'text-yellow-600' },
  DELETE: { icon: Trash2, colorClass: 'text-red-600' },
}

export function HttpMethodSelect({
  value,
  onValueChange,
  showColors = true,
}: HttpMethodSelectProps) {
  const { t } = useTranslation()

  return (
    <Select value={value} onValueChange={(v) => onValueChange(v as HttpMethod)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(methodIcons) as HttpMethod[]).map((method) => {
          const { icon: Icon, colorClass } = methodIcons[method]
          return (
            <SelectItem key={method} value={method}>
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${showColors ? colorClass : ''}`} />
                <span>{t(`objectives:form.methods.${method}`, method)}</span>
              </div>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
