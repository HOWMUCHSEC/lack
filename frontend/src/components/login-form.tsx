import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AppToast, type ToastType } from '@/components/app-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useTranslation } from 'react-i18next'

export function LoginForm({ className, cardClassName, ...props }: React.ComponentPropsWithoutRef<'div'> & { cardClassName?: string }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const emailInputRef = React.useRef<HTMLInputElement>(null)
  const [toastState, setToastState] = React.useState<{
    open: boolean
    type: ToastType
    title: string
    description: string
    id?: string | number
    duration?: number
  }>({ open: false, type: 'info', title: '', description: '' })
  const TOAST_ID = 'auth-login'

  React.useEffect(() => {
    if (emailInputRef.current) {
      emailInputRef.current.focus()
    }
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    setToastState({
      open: true,
      type: 'loading',
      title: t('auth:login.toast.loggingIn'),
      description: '',
      id: TOAST_ID,
    })
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      setToastState({
        open: true,
        type: 'success',
        title: t('auth:login.toast.success'),
        description: '',
        id: TOAST_ID,
        duration: 1800,
      })
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('auth:login.toast.retry')
      setError(message)
      setToastState({
        open: true,
        type: 'error',
        title: t('auth:login.toast.failure'),
        description: message,
        id: TOAST_ID,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <AppToast
        open={toastState.open}
        type={toastState.type}
        title={toastState.title}
        description={toastState.description}
        id={toastState.id}
        duration={toastState.duration}
        onClose={() => setToastState((s) => ({ ...s, open: false }))}
      />
      <Card className={cardClassName}>
        <CardHeader>
          <CardTitle className="text-2xl">{t('auth:login.title')}</CardTitle>
          <CardDescription>{t('auth:login.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">{t('auth:login.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('auth:login.emailPlaceholder')}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  ref={emailInputRef}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">{t('auth:login.password')}</Label>
                  <a
                    href="#"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    {t('auth:login.forgot')}
                  </a>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error ? <div className="text-sm text-red-600">{error}</div> : null}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t('auth:login.toast.loggingIn') : t('auth:login.button.submit')}
              </Button>
            </div>
            <AlertDialog>
              <div className="mt-4 text-center text-sm">
                {t('auth:login.register.prompt')}{' '}
                <AlertDialogTrigger asChild>
                  <a href="#" className="underline underline-offset-4">
                    {t('auth:login.register.now')}
                  </a>
                </AlertDialogTrigger>
              </div>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('auth:login.register.dialogTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('auth:login.register.dialogDesc')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogAction>{t('auth:login.register.ok')}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
