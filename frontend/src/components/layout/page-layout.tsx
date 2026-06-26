import { Fragment, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SidebarTrigger } from '@/components/ui/sidebar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { DashboardHomeCrumb } from '@/components/breadcrumbs/dashboard-home-crumb'
import { Separator } from '@/components/ui/separator'

export interface BreadcrumbItemConfig {
  label: string
  href?: string
}

interface PageLayoutProps {
  /** Breadcrumb items after the dashboard home crumb */
  breadcrumbs?: BreadcrumbItemConfig[]
  /** Page content */
  children: ReactNode
  /** Custom content area className */
  contentClassName?: string
  /** Content to render on the right side of the header */
  headerRight?: ReactNode
}

const ABSOLUTE_HREF_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i

function isExternalHref(href: string) {
  return ABSOLUTE_HREF_RE.test(href)
}

function toRouterHref(href: string) {
  return href.startsWith('#/') ? href.slice(1) : href
}

/**
 * 页面内容布局：头部面包屑 + 内容区域
 * 注意：侧边栏已移至 MainLayout，此组件仅负责页面内容
 */
export function PageLayout({
  breadcrumbs = [],
  children,
  contentClassName = 'flex flex-1 flex-col gap-4 p-4',
  headerRight,
}: PageLayoutProps) {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b">
        <div
          className={`flex items-center gap-2 px-4 ${headerRight ? 'w-full justify-between' : ''}`}
        >
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <DashboardHomeCrumb />
                {breadcrumbs.map((item, index) => {
                  const isLast = index === breadcrumbs.length - 1
                  return (
                    <Fragment key={index}>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        {!isLast && item.href ? (
                          isExternalHref(item.href) ? (
                            <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
                          ) : (
                            <BreadcrumbLink asChild>
                              <Link to={toRouterHref(item.href)}>{item.label}</Link>
                            </BreadcrumbLink>
                          )
                        ) : !isLast ? (
                          <span className="text-muted-foreground">{item.label}</span>
                        ) : (
                          <BreadcrumbPage>{item.label}</BreadcrumbPage>
                        )}
                      </BreadcrumbItem>
                    </Fragment>
                  )
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          {headerRight}
        </div>
      </header>
      <div className={contentClassName}>{children}</div>
    </>
  )
}
