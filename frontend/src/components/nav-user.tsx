import { useState, useMemo, useCallback } from 'react'
import {
  UserIcon,
  CrownIcon,
  UsersIcon,
  CaretUpDownIcon,
  SignOutIcon,
  SparkleIcon,
  GearIcon,
  TranslateIcon,
  SunIcon,
  MoonIcon,
} from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { useUser, type UserPlan } from '@/hooks/use-user'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { UpgradeDialog } from '@/components/upgrade-dialog'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { changeLanguage } from '@/i18n'
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n/config'
import { useTheme } from '@/components/theme-context'
import { cn } from '@/lib/utils'

function getPlanIcon(plan: UserPlan) {
  switch (plan) {
    case 'trial':
      return UserIcon
    case 'pro':
      return CrownIcon
    case 'team':
      return UsersIcon
    default:
      return UserIcon
  }
}

function getPlanName(plan: UserPlan, t: TFunction) {
  switch (plan) {
    case 'trial':
      return t('common.plan.trial')
    case 'pro':
      return t('common.plan.pro')
    case 'team':
      return t('common.plan.team')
    default:
      return t('common.plan.trial')
  }
}

export function NavUser() {
  const { isMobile } = useSidebar()
  const { user, loading } = useUser()
  const navigate = useNavigate()
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()

  const PlanIcon = useMemo(() => (user ? getPlanIcon(user.plan) : UserIcon), [user])
  const planName = useMemo(() => (user ? getPlanName(user.plan, t) : ''), [user, t])
  const showUpgrade = useMemo(() => (user ? user.plan !== 'team' : false), [user])

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
    navigate('/')
  }, [navigate])

  // 循环切换主题
  const cycleTheme = useCallback(() => {
    const themes = ['light', 'dark', 'system'] as const
    const idx = themes.indexOf(theme as (typeof themes)[number])
    setTheme(themes[(idx + 1) % themes.length])
  }, [theme, setTheme])

  // 循环切换语言
  const cycleLanguage = useCallback(() => {
    const currentLang = i18n.language as SupportedLanguage
    const idx = SUPPORTED_LANGUAGES.indexOf(currentLang)
    const next = SUPPORTED_LANGUAGES[(idx + 1) % SUPPORTED_LANGUAGES.length]
    void changeLanguage(next)
  }, [i18n.language])

  if (loading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="flex h-12 items-center gap-2 px-2">
            <div className="bg-muted h-8 w-8 animate-pulse rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="bg-muted h-3 w-20 animate-pulse rounded" />
              <div className="bg-muted h-2 w-32 animate-pulse rounded" />
            </div>
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (!user) {
    return null
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">
                    <PlanIcon className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user.name}</span>
                  <span className="text-muted-foreground truncate text-xs">{planName}</span>
                </div>
                <CaretUpDownIcon className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-44 rounded-lg p-1"
              side={isMobile ? 'bottom' : 'right'}
              align="end"
              sideOffset={4}
            >
              {/* 用户信息 */}
              <div className="px-2 py-1.5 mb-1">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>

              <DropdownMenuSeparator className="my-1" />

              {/* 快捷切换区 */}
              <div className="flex items-center gap-1 px-1 py-1">
                <button
                  onClick={cycleTheme}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs',
                    'hover:bg-accent transition-colors'
                  )}
                >
                  {theme === 'dark' ? (
                    <MoonIcon className="h-3.5 w-3.5" />
                  ) : theme === 'light' ? (
                    <SunIcon className="h-3.5 w-3.5" />
                  ) : (
                    <SunIcon className="h-3.5 w-3.5" />
                  )}
                  <span className="capitalize">{theme === 'system' ? 'Auto' : theme}</span>
                </button>
                <div className="w-px h-4 bg-border" />
                <button
                  onClick={cycleLanguage}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs',
                    'hover:bg-accent transition-colors'
                  )}
                >
                  <TranslateIcon className="h-3.5 w-3.5" />
                  <span>{i18n.language === 'zh-CN' ? '中文' : 'EN'}</span>
                </button>
              </div>

              <DropdownMenuSeparator className="my-1" />

              {/* 菜单项 */}
              {showUpgrade && (
                <DropdownMenuItem onClick={() => setUpgradeOpen(true)} className="gap-2 text-xs">
                  <SparkleIcon className="h-3.5 w-3.5 text-amber-500" />
                  {t('navUser.upgradePro')}
                </DropdownMenuItem>
              )}

              <DropdownMenuItem onClick={() => navigate('/account')} className="gap-2 text-xs">
                <GearIcon className="h-3.5 w-3.5" />
                {t('navUser.accountSettings')}
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1" />

              <DropdownMenuItem
                onClick={handleLogout}
                className="gap-2 text-xs text-red-500 focus:text-red-500"
              >
                <SignOutIcon className="h-3.5 w-3.5" />
                {t('navUser.signOut')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </>
  )
}
