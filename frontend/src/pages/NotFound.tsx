import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import { HouseIcon, ArrowLeftIcon } from '@phosphor-icons/react'

export default function NotFoundPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
        <p className="mt-2 text-lg text-muted-foreground">{t('common:notFound.title')}</p>
        <p className="mt-1 text-sm text-muted-foreground/70">{t('common:notFound.desc')}</p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeftIcon className="mr-1.5 h-4 w-4" />
          {t('common:notFound.back')}
        </Button>
        <Button size="sm" onClick={() => navigate('/dashboard')}>
          <HouseIcon className="mr-1.5 h-4 w-4" />
          {t('common:notFound.home')}
        </Button>
      </div>
    </div>
  )
}
