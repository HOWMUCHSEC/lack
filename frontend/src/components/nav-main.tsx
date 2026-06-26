import { memo, useMemo } from 'react'
import { CaretRightIcon, ArrowsOutIcon, ArrowsInIcon, Icon } from '@phosphor-icons/react'

import { useLocation, Link } from 'react-router-dom'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar'
import { useTranslation } from 'react-i18next'

interface NavItem {
  titleKey: string
  url: string
  icon?: Icon
  isActive?: boolean
  items?: {
    titleKey: string
    url: string
    dot?: boolean
    dotColor?: string
    items?: {
      titleKey: string
      url: string
    }[]
  }[]
  iconClassName?: string
}

export const NavMain = memo(function NavMain({
  items,
  lastAction = null,
  expandNonce,
  onToggleExpandMode,
  isExpand,
}: {
  items: NavItem[]
  lastAction?: 'expand' | 'collapse' | null
  expandNonce?: number
  onToggleExpandMode?: () => void
  isExpand?: boolean
}) {
  const location = useLocation()
  const pathname = location.pathname
  const toPath = useMemo(() => (url: string) => url, [])
  const { t } = useTranslation()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        <span className="flex w-full items-center justify-between">
          <span>{t('nav:platform')}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleExpandMode}
            title={isExpand ? t('common:sidebar.collapseAll') : t('common:sidebar.expandAll')}
            aria-label={isExpand ? t('common:sidebar.collapseAll') : t('common:sidebar.expandAll')}
            disabled={!onToggleExpandMode}
          >
            {isExpand ? <ArrowsInIcon className="h-4 w-4" /> : <ArrowsOutIcon className="h-4 w-4" />}
          </Button>
        </span>
      </SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const title = t(item.titleKey)
          // 如果没有子菜单，直接渲染为链接
          if (!item.items || item.items.length === 0) {
            return (
              <SidebarMenuItem key={item.titleKey}>
                <SidebarMenuButton
                  asChild
                  tooltip={title}
                  isActive={pathname === toPath(item.url) || pathname.startsWith(toPath(item.url))}
                >
                  <Link to={item.url}>
                    {item.icon && <item.icon className={item.iconClassName} />}
                    <span>{title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          }

          // 有子菜单，使用 Collapsible（非受控）。
          // 通过 key 绑定激活状态变化时重新挂载，以便 defaultOpen 生效。
          const isGroupActive =
            pathname.startsWith(toPath(item.url)) ||
            (item.items?.some((subItem) => pathname.startsWith(toPath(subItem.url))) ?? false)
          const activeSubPath = item.items?.reduce<string | undefined>((best, subItem) => {
            const subPath = toPath(subItem.url)
            const match = pathname === subPath || pathname.startsWith(subPath + '/')
            if (match) {
              if (!best || subPath.length > best.length) return subPath
            }
            return best
          }, undefined)

          // 根据 lastAction 决定 defaultOpen：
          // - null: 使用路由匹配状态
          // - 'expand': 全部展开
          // - 'collapse': 全部收起
          const defaultOpen = lastAction === null ? isGroupActive : lastAction === 'expand'

          return (
            <Collapsible
              key={`${item.titleKey}-${expandNonce ?? 0}`}
              asChild
              defaultOpen={defaultOpen}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={title} isActive={false}>
                    {item.icon && <item.icon className={item.iconClassName} />}
                    <span>{title}</span>
                    <CaretRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items?.map((subItem) => {
                      const subTitle = t(subItem.titleKey)
                      if (subItem.items && subItem.items.length > 0) {
                        return (
                          <Collapsible key={subItem.titleKey} asChild defaultOpen={activeSubPath?.startsWith(toPath(subItem.url))} className="group/sub-collapsible">
                            <SidebarMenuSubItem>
                              <CollapsibleTrigger asChild>
                                <SidebarMenuSubButton className="justify-between cursor-pointer">
                                  <span>{subTitle}</span>
                                  <CaretRightIcon className="size-3 transition-transform duration-200 group-data-[state=open]/sub-collapsible:rotate-90" />
                                </SidebarMenuSubButton>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <SidebarMenuSub className="mx-0 border-l-0">
                                  {subItem.items.map((subSubItem) => {
                                    const subSubTitle = t(subSubItem.titleKey)
                                    return (
                                      <SidebarMenuSubItem key={subSubItem.titleKey}>
                                        <SidebarMenuSubButton
                                          asChild
                                          isActive={activeSubPath === toPath(subSubItem.url)}
                                        >
                                          <Link to={subSubItem.url}>
                                            <span className="truncate">{subSubTitle}</span>
                                          </Link>
                                        </SidebarMenuSubButton>
                                      </SidebarMenuSubItem>
                                    )
                                  })}
                                </SidebarMenuSub>
                              </CollapsibleContent>
                            </SidebarMenuSubItem>
                          </Collapsible>
                        )
                      }
                      return (
                        <SidebarMenuSubItem key={subItem.titleKey}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={activeSubPath === toPath(subItem.url)}
                          >
                            <Link to={subItem.url}>
                              <span className="flex items-center gap-2 min-w-0">
                                <span className="truncate">{subTitle}</span>
                                {subItem.dot ? (
                                  <span
                                    className={`inline-block h-2 w-2 rounded-full ${subItem.dotColor === 'green' ? 'bg-emerald-500' : 'bg-red-500'
                                      }`}
                                  />
                                ) : null}
                              </span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
})
