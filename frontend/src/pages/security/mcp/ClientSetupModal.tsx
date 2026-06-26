import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CopySimpleIcon, CheckCircleIcon, DownloadSimpleIcon } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { BrowserOpenURL } from '../../../../wailsjs/runtime'
import { withAuthToken } from '@/lib/localServer'

interface ClientSetupModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  endpoint?: string
  authToken?: string
}

export function ClientSetupModal({
  open,
  onOpenChange,
  endpoint,
  authToken,
}: ClientSetupModalProps) {
  const { t } = useTranslation()
  const [configCopied, setConfigCopied] = useState(false)
  const endpointValue = endpoint || 'ws://127.0.0.1:8080/v1/ws'
  const tokenValue = authToken || '<start-server-to-generate-token>'
  const endpointWithToken = authToken ? withAuthToken(endpointValue, authToken) : ''
  const tokenConfigKey = 'token:'
  const endpointWithTokenConfigKey = 'endpoint_with_token:'
  const clientConfig = [
    `endpoint: "${endpointValue}"`,
    `token: "${tokenValue}"`,
    ...(endpointWithToken ? [`endpoint_with_token: "${endpointWithToken}"`] : []),
    'agent_id: "my-local-agent"',
    'workspace: "./src"',
  ].join('\n')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden border-zinc-800 bg-zinc-950 p-0 sm:max-w-md">
        <div className="border-b border-zinc-800 bg-zinc-900/50 p-6">
          <DialogTitle className="text-xl">{t('mcp:connectAgent')}</DialogTitle>
          <DialogDescription className="mt-1.5 text-zinc-400">
            {t('mcp:generateClientDesc')}
          </DialogDescription>
        </div>

        <div className="flex">
          {/* Sidebar / Steps - simplified as just a vertical list in the main content for now, or distinct section. 
              Let's put steps inside the main body with a timeline look. */}
          <div className="w-full space-y-8 p-6">
            {/* Step 1 */}
            <div className="relative pl-8">
              {/* Timeline Line */}
              <div className="absolute top-8 left-[11px] h-full w-px bg-zinc-800" />
              {/* Dot */}
              <div className="absolute top-1 left-0 h-6 w-6 rounded-full border-2 border-purple-500 bg-zinc-950 text-center text-xs leading-5 font-bold text-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.2)]">
                1
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">{t('mcp:installCLI')}</h3>
                  <p className="text-xs text-zinc-400">{t('mcp:installCLIDesc')}</p>
                </div>

                <div className="group relative rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                  <Button
                    className="w-full gap-2 bg-purple-600 text-white hover:bg-purple-700"
                    onClick={() =>
                      BrowserOpenURL(
                        'https://github.com/opalite-fracture/Lack-MCP-Scan-Agent/releases/',
                      )
                    }
                  >
                    <DownloadSimpleIcon className="h-4 w-4" />
                    {t('mcp:downloadAgent')}
                  </Button>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative pl-8">
              {/* Dot */}
              <div className="absolute top-1 left-0 h-6 w-6 rounded-full border-2 border-purple-500 bg-purple-500 text-center text-xs leading-5 font-bold text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]">
                2
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">{t('mcp:configure')}</h3>
                  <p className="text-xs text-zinc-400">{t('mcp:configureDesc')}</p>
                </div>

                <div className="group relative rounded-lg border border-zinc-800 bg-black p-4">
                  <pre className="font-mono text-xs leading-relaxed text-zinc-300">
                    <span className="text-purple-400">{t('mcp:config.keys.endpoint')}</span>{' '}
                    <span className="text-green-400">"{endpointValue}"</span>
                    {'\n'}
                    <span className="text-purple-400">{tokenConfigKey}</span>{' '}
                    <span className="text-green-400">"{tokenValue}"</span>
                    {'\n'}
                    {endpointWithToken && (
                      <>
                        <span className="text-purple-400">{endpointWithTokenConfigKey}</span>{' '}
                        <span className="text-green-400">"{endpointWithToken}"</span>
                        {'\n'}
                      </>
                    )}
                    <span className="text-purple-400">{t('mcp:config.keys.agentId')}</span>{' '}
                    <span className="text-green-400">"{t('mcp:config.values.agentId')}"</span>
                    {'\n'}
                    <span className="text-purple-400">{t('mcp:config.keys.workspace')}</span>{' '}
                    <span className="text-green-400">"{t('mcp:config.values.workspace')}"</span>
                  </pre>
                  <div className="absolute top-2 right-2 flex gap-2">
                    <Button
                      variant="secondary"
                      className="h-7 gap-1.5 bg-zinc-800 text-xs text-zinc-300 hover:bg-zinc-700"
                      onClick={async () => {
                        await navigator.clipboard.writeText(clientConfig)
                        setConfigCopied(true)
                        toast.success(t('mcp:configCopied'))
                        setTimeout(() => setConfigCopied(false), 2000)
                      }}
                    >
                      {configCopied ? (
                        <CheckCircleIcon className="h-3 w-3" />
                      ) : (
                        <CopySimpleIcon className="h-3 w-3" />
                      )}
                      {t('mcp:copyConfig')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-zinc-800 bg-zinc-900/50 p-4">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-zinc-400 hover:text-zinc-200"
          >
            {t('common:common.close')}
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            className="bg-purple-600 text-white hover:bg-purple-700"
          >
            {t('common:common.ok', 'Done')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
