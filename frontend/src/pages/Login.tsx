import { LoginForm } from '@/components/login-form'
import logo from '@/assets/logo.png'
import { useTranslation } from 'react-i18next'

export default function LoginPage() {
  const { t } = useTranslation()
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-zinc-950 flex items-center justify-center p-4">

      {/* Background Effects */}
      <div className="absolute inset-0 z-0">
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

        {/* Radial Glows */}
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-purple-500/20 blur-[100px]" />
        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 w-[600px] h-[600px] rounded-full bg-indigo-500/10 blur-[120px]" />
      </div>

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-[420px] animate-in fade-in zoom-in duration-500 slide-in-from-bottom-4">

        {/* Logo Section */}
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900/80 shadow-2xl ring-1 ring-white/10 backdrop-blur-md">
            <img src={logo} alt={t('app.name')} className="h-10 w-10 opacity-90" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {t('auth:login.welcomeTitle')}
            </h1>
            <p className="text-sm text-zinc-400">
              {t('auth:login.welcomeDesc')}
            </p>
          </div>
        </div>

        {/* Glassmorphism Form Container */}
        {/* We wrap LoginForm but also override some internal Card styles via class merging if supported, 
            or rely on the fact that LoginForm renders a Card. 
            Actually LoginForm renders a <Card>, so we might want to style THAT card.
            Since we can pass className to LoginForm, and it passes it to the generic div wrapper, 
            we might need to wrap it specifically or accept that generic Card styles apply.
            The generic Card style in dark mode is dark (zinc-900/950). 
            Let's see if we can enhance it.
        */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-1 backdrop-blur-xl shadow-2xl">
          <div className="rounded-lg bg-zinc-950/40 p-1">
            <LoginForm cardClassName="border-0 bg-transparent shadow-none" />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-zinc-600">
          <p>{t('auth:login.copyright')}</p>
        </div>

      </div>
    </div>
  )
}
