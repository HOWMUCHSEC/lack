import * as React from 'react'

import { NavMain } from '@/components/nav-main'
import { NavProjects } from '@/components/nav-projects'
import { NavUser } from '@/components/nav-user'
import { TeamSwitcher } from '@/components/team-switcher'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { teams, navMain, projects } from '@/data/sidebar'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  // lastAction: 记录最后一次全局操作，null 表示未执行过全局操作
  const [lastAction, setLastAction] = React.useState<'expand' | 'collapse' | null>(null)
  const [nonce, setNonce] = React.useState(0)

  const toggleAll = () => {
    const nextAction = lastAction === 'expand' ? 'collapse' : 'expand'
    setLastAction(nextAction)
    setNonce((n) => n + 1)
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={navMain}
          lastAction={lastAction}
          expandNonce={nonce}
          onToggleExpandMode={toggleAll}
          isExpand={lastAction === 'expand'}
        />
        <NavProjects projects={projects} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
