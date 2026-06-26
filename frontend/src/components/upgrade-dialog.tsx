import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

interface UpgradeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UpgradeDialog({ open, onOpenChange }: UpgradeDialogProps) {
  const { t } = useTranslation('settings')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('upgradeDialog.title')}</DialogTitle>
          <DialogDescription>{t('upgradeDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="mx-auto mt-4 grid max-w-2xl gap-4 md:grid-cols-2">
          {/* Pro 版本 */}
          <Card className="border-primary border-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {t('upgradeDialog.proPlan.title')}
                <span className="text-muted-foreground text-sm font-normal">{t('upgradeDialog.proPlan.badge')}</span>
              </CardTitle>
              <CardDescription>{t('upgradeDialog.proPlan.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold">
                {t('upgradeDialog.proPlan.price')}
                <span className="text-muted-foreground text-sm font-normal">{t('upgradeDialog.proPlan.period')}</span>
              </div>

              <ul className="space-y-2">
                {(t('upgradeDialog.proPlan.features', { returnObjects: true }) as string[]).map((feature: string, index: number) => (
                  <li key={index} className="flex items-center gap-2">
                    <CheckIcon className="text-primary h-4 w-4" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button className="w-full">{t('upgradeDialog.proPlan.upgradeButton')}</Button>
            </CardContent>
          </Card>

          {/* 团队版本 */}
          <Card>
            <CardHeader>
              <CardTitle>{t('upgradeDialog.teamPlan.title')}</CardTitle>
              <CardDescription>{t('upgradeDialog.teamPlan.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold">
                {t('upgradeDialog.teamPlan.price')}
                <span className="text-muted-foreground text-sm font-normal">{t('upgradeDialog.teamPlan.period')}</span>
              </div>

              <ul className="space-y-2">
                {(t('upgradeDialog.teamPlan.features', { returnObjects: true }) as string[]).map((feature: string, index: number) => (
                  <li key={index} className="flex items-center gap-2">
                    <CheckIcon className="text-primary h-4 w-4" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button variant="outline" className="w-full">
                {t('upgradeDialog.teamPlan.contactButton')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}
