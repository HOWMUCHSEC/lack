import { BreadcrumbItem, BreadcrumbLink } from '@/components/ui/breadcrumb'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export function DashboardHomeCrumb() {
  const { t } = useTranslation()
  return (
    <BreadcrumbItem className="hidden md:block">
      <BreadcrumbLink asChild>
        <Link to="/dashboard">{t('nav:console')}</Link>
      </BreadcrumbLink>
    </BreadcrumbItem>
  )
}
