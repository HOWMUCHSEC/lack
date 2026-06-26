import {
  FolderIcon,
  ShareFatIcon,
  DotsThreeIcon,
  TrashIcon,
  Icon,
} from '@phosphor-icons/react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useTranslation } from 'react-i18next'

export function NavProjects({
  projects,
}: {
  projects: {
    nameKey: string
    url: string
    icon: Icon
  }[]
}) {
  const { isMobile } = useSidebar()
  const { t } = useTranslation()

  if (projects.length === 0) {
    return null
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarMenu>
        {projects.map((item) => (
          <SidebarMenuItem key={item.nameKey}>
            <SidebarMenuButton asChild>
              <a href={item.url}>
                <item.icon />
                <span>{t(item.nameKey)}</span>
              </a>
            </SidebarMenuButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction showOnHover>
                  <DotsThreeIcon />
                  <span className="sr-only">{t('nav:srOnlyMore')}</span>
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-48 rounded-lg"
                side={isMobile ? 'bottom' : 'right'}
                align={isMobile ? 'end' : 'start'}
              >
                <DropdownMenuItem>
                  <FolderIcon className="text-muted-foreground" />
                  <span>{t('nav:viewProject')}</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <ShareFatIcon className="text-muted-foreground" />
                  <span>{t('nav:shareProject')}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <TrashIcon className="text-muted-foreground" />
                  <span>{t('nav:deleteProject')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
