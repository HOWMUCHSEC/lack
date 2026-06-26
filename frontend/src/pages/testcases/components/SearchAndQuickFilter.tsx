import { FC } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Props {
  keyword: string
  onKeywordChange: (v: string) => void
  onSearch: () => void
  downloadedMode: boolean
  onToggleDownloadedMode: () => void
  loading?: boolean
}

const SearchAndQuickFilter: FC<Props> = ({
  keyword,
  onKeywordChange,
  onSearch,
  downloadedMode,
  onToggleDownloadedMode,
  loading,
}) => {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-2">
      <Input
        value={keyword}
        onChange={(e) => onKeywordChange(e.target.value)}
        placeholder={t('testcases:filters.searchPlaceholder')}
        className="w-64"
      />
      <Button onClick={onSearch} disabled={!!loading}>
        {t('testcases:filters.search')}
      </Button>
      <Button
        variant={downloadedMode ? 'default' : 'outline'}
        disabled={!!loading}
        onClick={onToggleDownloadedMode}
      >
        <CheckCircle2
          className={`mr-1 h-4 w-4 ${downloadedMode ? 'text-green-600' : 'text-muted-foreground'}`}
        />
        {t('testcases:filters.downloaded')}
      </Button>
    </div>
  )
}

export default SearchAndQuickFilter
