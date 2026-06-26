import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'

/**
 * 主布局：侧边栏 + 内容区域
 * 侧边栏始终渲染，内容区域通过 Outlet 懒加载
 */
export function MainLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center">
              <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </SidebarInset>
    </SidebarProvider>
  )
}
