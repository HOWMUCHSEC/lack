import * as React from 'react'
import {
  ArrowsClockwiseIcon,
  CaretUpDownIcon,
  PlusIcon,
  WarningIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowRightIcon,
  SpinnerIcon,
} from '@phosphor-icons/react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { BrowserOpenURL } from '../../wailsjs/runtime/runtime'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from 'react-i18next'
import type { updater } from '../../wailsjs/go/models'

export function TeamSwitcher({
  teams,
}: {
  teams: {
    name: string
    logo: React.ElementType
    url: string
  }[]
}) {
  const { isMobile } = useSidebar()
  const { t } = useTranslation()
  const [isContactOpen, setIsContactOpen] = React.useState(false)

  // Update Logic States
  const version = import.meta.env.VITE_APP_VERSION || 'dev'
  const [updateDialogOpen, setUpdateDialogOpen] = React.useState(false)
  const [checkingUpdate, setCheckingUpdate] = React.useState(false)
  const [updateResult, setUpdateResult] = React.useState<updater.CheckResult | null>(null)

  const handleCheckUpdate = async () => {
    const current = String(version)
    setUpdateDialogOpen(true)
    setCheckingUpdate(true)
    setUpdateResult(null)
    try {
      const w = window as typeof window & {
        go?: {
          main?: {
            App?: {
              CheckUpdate?: (arg: string) => Promise<updater.CheckResult>
            }
          }
        }
      }
      const fn = w.go?.main?.App?.CheckUpdate
      if (!fn) {
        throw new Error('CheckUpdate not available')
      }
      const res = await fn(current)
      setUpdateResult(res)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setUpdateResult({
        current_version: current,
        latest_version: '',
        has_update: false,
        raw_body: '',
        last_updated: '',
        error: message,
      })
    } finally {
      setCheckingUpdate(false)
    }
  }

  const hasError = !!updateResult?.error
  const hasUpdate = !!updateResult?.has_update
  const latestVersion = updateResult?.latest_version || ''
  const lastUpdated = updateResult?.last_updated || ''

  const mainTeam = teams[0]
  if (!mainTeam) {
    return null
  }
  const MainLogo = mainTeam.logo

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
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  {MainLogo ? <MainLogo className="size-4" /> : null}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{mainTeam.name}</span>
                </div>
                <CaretUpDownIcon className="ml-auto" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
              align="start"
              side={isMobile ? 'bottom' : 'right'}
              sideOffset={4}
            >
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                {t('common:teamSwitcher.teams')}
              </DropdownMenuLabel>
              {/* Check Update - first item */}
              <DropdownMenuItem
                onClick={handleCheckUpdate}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-sm border">
                  <ArrowsClockwiseIcon className="size-4 shrink-0" />
                </div>
                {t('nav:checkUpdate')}
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <DropdownMenuShortcut>⌘0</DropdownMenuShortcut>
              </DropdownMenuItem>
              {/* Documentation and other team links */}
              {teams.slice(1).map((team, index) => (
                <DropdownMenuItem
                  key={team.name}
                  onClick={() => {
                    if (team.url) {
                      BrowserOpenURL(team.url)
                    }
                  }}
                  className="gap-2 p-2"
                >
                  <div className="flex size-6 items-center justify-center rounded-sm border">
                    <team.logo className="size-4 shrink-0" />
                  </div>
                  {team.name}
                  {/* eslint-disable-next-line i18next/no-literal-string */}
                  <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 p-2"
                onSelect={(e) => {
                  e.preventDefault()
                  setIsContactOpen(true)
                }}
              >
                <div className="bg-background flex size-6 items-center justify-center rounded-md border">
                  <PlusIcon className="size-4" />
                </div>
                <div className="text-muted-foreground font-medium">
                  {t('common:teamSwitcher.contact')}
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <Dialog open={isContactOpen} onOpenChange={setIsContactOpen}>
        <DialogContent>{t('common:teamSwitcher.email', { id: 'admin@lack-lab.com' })}</DialogContent>
      </Dialog>

      {/* Update Check Dialog */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('nav:updateCheck')}</DialogTitle>
            <DialogDescription>
              {t('nav:currentVersion', { version: String(version) })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {checkingUpdate && (
              <div className="text-muted-foreground flex items-center gap-2">
                <SpinnerIcon className="h-4 w-4 animate-spin" />
                <span>{t('nav:checkingUpdate')}</span>
              </div>
            )}
            {!checkingUpdate && hasError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 break-all text-red-600">
                {t('nav:checkFailed', { error: updateResult?.error })}
              </div>
            )}
            {!checkingUpdate && !hasError && updateResult && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{t('nav:currentVersion', { version: '' })}</Badge>
                    <span className="font-mono text-[13px]">{String(version)}</span>
                  </div>
                  <ArrowRightIcon className="text-muted-foreground h-4 w-4" />
                  <div className="flex items-center gap-2">
                    <Badge variant={hasUpdate ? 'default' : 'secondary'}>
                      {latestVersion || '-'}
                    </Badge>
                  </div>
                </div>

                {hasUpdate ? (
                  <div className="flex items-center gap-2 text-amber-600">
                    <WarningIcon className="h-4 w-4" />
                    <span>{t('nav:newVersionFound', { version: latestVersion })}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircleIcon className="h-4 w-4" />
                    <span>{t('nav:alreadyLatest')}</span>
                  </div>
                )}

                {lastUpdated && (
                  <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    <ClockIcon className="h-3 w-3" />
                    <span>{lastUpdated}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <Button size="sm" onClick={() => setUpdateDialogOpen(false)}>
              {t('nav:ok')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
