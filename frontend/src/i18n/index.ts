import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import resourcesToBackend from 'i18next-resources-to-backend'
import { DEFAULT_NAMESPACE, NAMESPACES, STORAGE_KEY, normalizeLanguage } from './config'

type LocaleResource = Record<string, unknown>

const localeModules = import.meta.glob<{ default: LocaleResource } | LocaleResource>(
  '../locales/*/*.json',
)

function detectInitialLanguage() {
  const saved = typeof localStorage === 'object' ? localStorage.getItem(STORAGE_KEY) : null
  if (saved) return normalizeLanguage(saved)
  if (typeof navigator !== 'undefined') {
    return normalizeLanguage(navigator.language)
  }
  return 'en'
}

const initialLng = detectInitialLanguage()

void i18next
  .use(initReactI18next)
  .use(
    resourcesToBackend((lng: string, ns: string) => {
      const key = `../locales/${lng}/${ns}.json`
      const loader = localeModules[key]
      if (!loader) return Promise.reject(new Error(`Missing locale: ${key}`))
      return loader().then((m) => ('default' in m ? m.default : m))
    }),
  )
  .init({
    lng: initialLng,
    fallbackLng: 'en',
    defaultNS: DEFAULT_NAMESPACE,
    ns: [...NAMESPACES],
    interpolation: { escapeValue: false },
    returnNull: false,
  })

export function changeLanguage(lng: string) {
  const norm = normalizeLanguage(lng)
  if (typeof localStorage === 'object') {
    localStorage.setItem(STORAGE_KEY, norm)
  }
  return i18next.changeLanguage(norm)
}

export default i18next
