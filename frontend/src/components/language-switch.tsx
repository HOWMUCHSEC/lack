import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import i18n, { changeLanguage } from '@/i18n'
import { SUPPORTED_LANGUAGES, normalizeLanguage } from '@/i18n/config'
import { useTranslation } from 'react-i18next'

export default function LanguageSwitch() {
  const { t } = useTranslation()
  const current = (SUPPORTED_LANGUAGES as readonly string[]).includes(i18n.language)
    ? (i18n.language as (typeof SUPPORTED_LANGUAGES)[number])
    : normalizeLanguage(i18n.language)
  return (
    <Select value={current} onValueChange={(v) => void changeLanguage(v)}>
      <SelectTrigger className="h-8 w-[130px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LANGUAGES.map((lng) => (
          <SelectItem key={lng} value={lng}>
            {t(`language.${lng}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
