import { FC } from 'react'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'

interface Props {
  total: number
  page: number
  pageCount: number
  loading?: boolean
  onPrev: () => void
  onNext: () => void
}

const PaginationRow: FC<Props> = ({ total, page, pageCount, loading, onPrev, onNext }) => {
  const { t } = useTranslation()
  return (
    <div className="mt-4 flex items-center justify-between">
      <div className="text-muted-foreground text-xs">
        {t('testcases:pagination.summary', { total, page, pageCount })}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1 || !!loading} onClick={onPrev}>
          {t('testcases:pagination.prev')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pageCount || !!loading}
          onClick={onNext}
        >
          {t('testcases:pagination.next')}
        </Button>
      </div>
    </div>
  )
}

export default PaginationRow
