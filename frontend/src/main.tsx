import '../sentry.client.config.js'
import React, { Suspense } from 'react'
import * as Sentry from '@sentry/react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/globals.css'
import { HashRouter } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import i18next from '@/i18n'
import { I18nextProvider } from 'react-i18next'

export function ErrorFallback({ error, resetError }: { error?: Error; resetError?: () => void }) {
  const handleReload = () => {
    if (resetError) {
      resetError()
    } else {
      window.location.reload()
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="max-w-md text-center">
        <h1 className="mb-4 text-2xl font-bold text-destructive">
          {i18next.t('app.error', '应用发生错误')}
        </h1>
        <p className="mb-4 text-muted-foreground">
          {i18next.t('app.errorDescription', '抱歉，应用遇到了一个问题。请尝试刷新页面。')}
        </p>
        {error?.message && (
          <details className="mb-4 rounded border p-2 text-left text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              {i18next.t('app.errorDetails', '错误详情')}
            </summary>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs text-destructive">
              {error.message}
            </pre>
          </details>
        )}
        <button
          onClick={handleReload}
          className="rounded bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          {i18next.t('app.reload', '刷新页面')}
        </button>
      </div>
    </div>
  )
}

import { ThemeProvider } from '@/components/theme-provider'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18next}>
      <Sentry.ErrorBoundary fallback={<ErrorFallback />} showDialog={false}>
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
          <HashRouter>
            <Suspense
              fallback={
                <div className="flex min-h-screen items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              }
            >
              <App />
              <Toaster richColors position="top-center" />
            </Suspense>
          </HashRouter>
        </ThemeProvider>
      </Sentry.ErrorBoundary>
    </I18nextProvider>
  </React.StrictMode>,
)
