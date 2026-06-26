import { useState } from 'react'
import { PageLayout } from '@/components/layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useUser } from '@/hooks/use-user'
import {
  UserIcon,
  CrownIcon,
  UsersIcon,
  LightningIcon,
  FolderOpenIcon,
  TestTubeIcon,
  ClockIcon,
  TrendUpIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  EnvelopeIcon,
  IdentificationCardIcon,
  KeyIcon,
  LockKeyIcon,
  CheckCircleIcon,
  SparkleIcon,
} from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

// Subscription Plan Dialog Component
function SubscriptionPlanDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: { plan: string; name: string }
}) {
  const { t } = useTranslation()

  const PlanIcon = user.plan === 'trial' ? UserIcon : user.plan === 'pro' ? CrownIcon : UsersIcon
  const planName = t(`settings:plan.name.${user.plan}`)

  // Mock usage data - replace with real data
  const testsUsed = 326
  const testsLimit = user.plan === 'trial' ? 1000 : user.plan === 'pro' ? 10000 : 100000
  const testsPercent = (testsUsed / testsLimit) * 100

  const projectsUsed = 12
  const projectsLimit = user.plan === 'trial' ? 3 : 999
  const projectsPercent = user.plan === 'trial' ? (projectsUsed / projectsLimit) * 100 : 0

  const daysRemaining = 18 // Mock data

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-zinc-800 bg-zinc-950">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 shadow-[0_0_15px_rgba(147,51,234,0.15)]">
              <PlanIcon className="text-primary h-5 w-5" weight="duotone" />
            </div>
            <div>
              <span className="text-lg">{planName}</span>
              <Badge variant="outline" className="ml-2 text-xs border-primary/30 text-primary">
                {t('settings:plan.current')}
              </Badge>
            </div>
          </DialogTitle>
          <DialogDescription className="text-zinc-400">{t('settings:planDialog.subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Tests Usage */}
          <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-zinc-400">
                <TestTubeIcon className="h-4 w-4 text-violet-500" weight="duotone" />
                <span>{t('settings:plan.usage.testsUsed')}</span>
              </div>
              <span className="font-mono font-medium text-zinc-200">
                {testsUsed.toLocaleString()} / {testsLimit.toLocaleString()}
              </span>
            </div>
            <Progress value={testsPercent} className="h-2" />
            <p className="text-xs text-zinc-500">
              {t('settings:planDialog.testsRemaining', { count: testsLimit - testsUsed })}
            </p>
          </div>

          {/* Projects Usage */}
          <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-zinc-400">
                <FolderOpenIcon className="h-4 w-4 text-amber-500" weight="duotone" />
                <span>{t('settings:plan.usage.activeProjects')}</span>
              </div>
              <span className="font-mono font-medium text-zinc-200">
                {projectsUsed} /{' '}
                {user.plan === 'trial' ? projectsLimit : t('settings:plan.usage.unlimited')}
              </span>
            </div>
            {user.plan === 'trial' && <Progress value={projectsPercent} className="h-2" />}
          </div>

          {/* Billing Cycle */}
          <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-zinc-400">
                <ClockIcon className="h-4 w-4 text-sky-500" weight="duotone" />
                <span>{t('settings:planDialog.billingCycle')}</span>
              </div>
              <span className="font-medium text-zinc-200">
                {t('settings:planDialog.daysRemaining', { days: daysRemaining })}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-zinc-400">
                <TrendUpIcon className="h-4 w-4 text-emerald-500" weight="duotone" />
                <span>{t('settings:planDialog.renewalDate')}</span>
              </div>
              { }
              <span className="font-mono font-medium text-zinc-200">2025-01-15</span>
            </div>
          </div>

          {/* Upgrade CTA */}
          {user.plan !== 'team' && (
            <Button className="w-full gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-[0_0_20px_rgba(147,51,234,0.3)]">
              <LightningIcon className="h-4 w-4" weight="fill" />
              {t('settings:plan.upgrade')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function AccountSettingsPage() {
  const { user } = useUser()
  const { t } = useTranslation()
  const [showPlanDialog, setShowPlanDialog] = useState(false)

  if (!user) {
    return null
  }

  const PlanIcon = user.plan === 'trial' ? UserIcon : user.plan === 'pro' ? CrownIcon : UsersIcon
  const planName = t(`settings:plan.name.${user.plan}`)
  const planColor = user.plan === 'trial' ? 'text-zinc-400 border-zinc-700 bg-zinc-800/50' :
    user.plan === 'pro' ? 'text-violet-400 border-violet-500/30 bg-violet-500/10' :
      'text-amber-400 border-amber-500/30 bg-amber-500/10'

  return (
    <PageLayout breadcrumbs={[{ label: t('nav:settings') }, { label: t('nav:accountSettings') }]}>
      <div className="space-y-6">

        {/* Profile Header Card */}
        <div className="rounded-xl border border-zinc-800 bg-card text-card-foreground shadow-sm overflow-hidden">
          <div className="border-b border-zinc-800 bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-800 p-6">
            <div className="flex items-center gap-6">
              {/* Avatar */}
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/20 to-purple-600/20 shadow-[0_0_30px_rgba(147,51,234,0.2)]">
                  <UserCircleIcon className="h-12 w-12 text-violet-400" weight="duotone" />
                </div>
                <div className={`absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-lg border ${planColor}`}>
                  <PlanIcon className="h-4 w-4" weight="fill" />
                </div>
              </div>

              {/* User Info */}
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-100">{user.name}</h2>
                  <button
                    onClick={() => setShowPlanDialog(true)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all hover:scale-105 ${planColor}`}
                  >
                    <PlanIcon className="h-3 w-3" weight="fill" />
                    {planName}
                  </button>
                </div>
                <p className="text-sm text-zinc-400">{user.email}</p>
              </div>

              {/* Quick Actions */}
              {user.plan !== 'team' && (
                <Button
                  variant="outline"
                  className="gap-2 border-violet-500/30 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 hover:text-violet-300"
                  onClick={() => setShowPlanDialog(true)}
                >
                  <SparkleIcon className="h-4 w-4" weight="fill" />
                  {t('settings:plan.upgrade')}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">

          {/* Profile Section */}
          <Card className="border-zinc-800 bg-zinc-950/50 py-0 gap-0 overflow-hidden">
            <div className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 shadow-[0_0_15px_rgba(14,165,233,0.1)]">
                  <UserCircleIcon className="h-5 w-5 text-sky-400" weight="duotone" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-100">{t('settings:profile.title')}</h3>
                  <p className="text-xs text-zinc-500">{t('settings:profile.desc')}</p>
                </div>
              </div>
            </div>
            <CardContent className="p-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-medium text-zinc-400 flex items-center gap-2">
                  <UserIcon className="h-3.5 w-3.5" />
                  {t('settings:profile.name')}
                </Label>
                <Input
                  id="name"
                  defaultValue={user.name}
                  disabled
                  className="bg-zinc-900 border-zinc-800 text-zinc-200 disabled:opacity-70"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-medium text-zinc-400 flex items-center gap-2">
                  <EnvelopeIcon className="h-3.5 w-3.5" />
                  {t('settings:profile.email')}
                </Label>
                <Input
                  id="email"
                  type="email"
                  defaultValue={user.email}
                  disabled
                  className="bg-zinc-900 border-zinc-800 text-zinc-200 disabled:opacity-70"
                />
                <p className="text-xs text-zinc-500 flex items-center gap-1">
                  <CheckCircleIcon className="h-3 w-3 text-emerald-500" />
                  {t('settings:profile.emailHint')}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-zinc-400 flex items-center gap-2">
                  <IdentificationCardIcon className="h-3.5 w-3.5" />
                  {t('settings:profile.userId')}
                </Label>
                <Input
                  value={user.id}
                  disabled
                  className="bg-zinc-900 border-zinc-800 font-mono text-xs text-zinc-400 disabled:opacity-70"
                />
                <p className="text-xs text-zinc-500">
                  {t('settings:profile.systemIdHint')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Security Section */}
          <Card className="border-zinc-800 bg-zinc-950/50 py-0 gap-0 overflow-hidden">
            <div className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 shadow-[0_0_15px_rgba(244,63,94,0.1)]">
                  <ShieldCheckIcon className="h-5 w-5 text-rose-400" weight="duotone" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-100">{t('settings:security.title')}</h3>
                  <p className="text-xs text-zinc-500">{t('settings:security.desc')}</p>
                </div>
              </div>
            </div>
            <CardContent className="p-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="current-password" className="text-xs font-medium text-zinc-400 flex items-center gap-2">
                  <KeyIcon className="h-3.5 w-3.5" />
                  {t('settings:security.currentPassword')}
                </Label>
                <Input
                  id="current-password"
                  type="password"
                  className="bg-zinc-900 border-zinc-800 text-zinc-200"
                  placeholder="••••••••"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-xs font-medium text-zinc-400 flex items-center gap-2">
                  <LockKeyIcon className="h-3.5 w-3.5" />
                  {t('settings:security.newPassword')}
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  className="bg-zinc-900 border-zinc-800 text-zinc-200"
                  placeholder="••••••••"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-xs font-medium text-zinc-400 flex items-center gap-2">
                  <LockKeyIcon className="h-3.5 w-3.5" />
                  {t('settings:security.confirmPassword')}
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  className="bg-zinc-900 border-zinc-800 text-zinc-200"
                  placeholder="••••••••"
                />
              </div>

              <Button className="w-full gap-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 shadow-[0_0_15px_rgba(244,63,94,0.2)]">
                <ShieldCheckIcon className="h-4 w-4" weight="fill" />
                {t('settings:security.changePassword')}
              </Button>
            </CardContent>
          </Card>

        </div>

        {/* Subscription Plan Dialog */}
        <SubscriptionPlanDialog open={showPlanDialog} onOpenChange={setShowPlanDialog} user={user} />
      </div>
    </PageLayout>
  )
}
