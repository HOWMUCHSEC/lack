import { useTranslation } from 'react-i18next'
import { Quit } from '../../wailsjs/runtime/runtime'

interface Props {
  visible: boolean
  localMacs: string[]
  onRetry: () => void
}

export default function IllegalTerminalOverlay({ visible, localMacs, onRetry }: Props) {
  const { t } = useTranslation()
  if (!visible) return null

  // 格式化为双引号包裹、逗号分隔，方便直接插入数据库
  const formattedMacs = localMacs.map((m) => `"${m}"`).join(', ')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formattedMacs)
    } catch (e) {
      console.warn('copy mac failed', e)
    }
  }

  const closeApp = async () => {
    try {
      Quit()
    } catch (e) {
      console.warn('quit failed', e)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur">
      <div className="w-[92vw] max-w-md rounded-md bg-white p-6 shadow-lg">
        <div className="mb-4 text-center text-lg font-semibold text-red-600">
          {t('auth:illegalTerminal.title')}
        </div>
        <div className="mb-4 text-sm text-gray-700">{t('auth:illegalTerminal.description')}</div>
        <div className="mb-2 text-sm font-medium">{t('auth:illegalTerminal.listTitle')}</div>
        <div className="mb-4 max-h-40 overflow-auto rounded border bg-gray-50 p-2 text-xs leading-6 text-gray-800">
          {localMacs && localMacs.length > 0 ? (
            <code className="block break-all font-mono">{formattedMacs}</code>
          ) : (
            <div>{t('auth:illegalTerminal.empty')}</div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={copy}
            className="inline-flex h-9 items-center justify-center rounded-md bg-gray-100 px-3 text-sm font-medium text-gray-900 hover:bg-gray-200"
          >
            {t('auth:illegalTerminal.copyButton')}
          </button>
          <button
            onClick={onRetry}
            className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
          >
            {t('auth:illegalTerminal.retryButton')}
          </button>
          <button
            onClick={closeApp}
            className="ml-auto inline-flex h-9 items-center justify-center rounded-md bg-gray-100 px-3 text-sm font-medium text-gray-900 hover:bg-gray-200"
          >
            {t('auth:illegalTerminal.closeButton')}
          </button>
        </div>
      </div>
    </div>
  )
}
