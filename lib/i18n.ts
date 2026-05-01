'use client'

import { useEffect, useState } from 'react'
import {
  getEncryptionState,
  readEncryptedLocalStorage,
  subscribeEncryptionState,
  writeEncryptedLocalStorage,
} from '@/hooks/useLocalStorage'

const LANGUAGE_STORAGE_KEY = 'preferred-language'
const BASE_LANGUAGE = 'en' as const

type Language =
  | 'bn'
  | 'de'
  | 'el'
  | 'en-GB'
  | 'en'
  | 'es'
  | 'fi'
  | 'fr'
  | 'hi'
  | 'is'
  | 'it'
  | 'ja'
  | 'ko'
  | 'lt'
  | 'lv'
  | 'mk'
  | 'nb'
  | 'nl'
  | 'pl'
  | 'pt'
  | 'ro'
  | 'ru'
  | 'sl'
  | 'sq'
  | 'sr'
  | 'sv'
  | 'sw'
  | 'th'
  | 'tr'
  | 'uk'
  | 'vi'
  | 'yue'
  | 'zh-CN'
  | 'zh-HK'
  | 'zh-TW'

const SUPPORTED_LANGUAGES: readonly Language[] = [
  'bn','de','el','en-GB','en','es','fi','fr','hi','is','it','ja','ko','lt','lv','mk','nb','nl','pl','pt','ro','ru','sl','sq','sr','sv','sw','th','tr','uk','vi','yue','zh-CN','zh-HK','zh-TW',
]

const localeLoaders: Record<Language, () => Promise<Record<string, string>>> = {
  bn: () => import('@/locales/bn.json').then((m) => m.default),
  de: () => import('@/locales/de.json').then((m) => m.default),
  el: () => import('@/locales/el.json').then((m) => m.default),
  'en-GB': () => import('@/locales/en-GB.json').then((m) => m.default),
  en: () => import('@/locales/en.json').then((m) => m.default),
  es: () => import('@/locales/es.json').then((m) => m.default),
  fi: () => import('@/locales/fi.json').then((m) => m.default),
  fr: () => import('@/locales/fr.json').then((m) => m.default),
  hi: () => import('@/locales/hi.json').then((m) => m.default),
  is: () => import('@/locales/is.json').then((m) => m.default),
  it: () => import('@/locales/it.json').then((m) => m.default),
  ja: () => import('@/locales/ja.json').then((m) => m.default),
  ko: () => import('@/locales/ko.json').then((m) => m.default),
  lt: () => import('@/locales/lt.json').then((m) => m.default),
  lv: () => import('@/locales/lv.json').then((m) => m.default),
  mk: () => import('@/locales/mk.json').then((m) => m.default),
  nb: () => import('@/locales/nb.json').then((m) => m.default),
  nl: () => import('@/locales/nl.json').then((m) => m.default),
  pl: () => import('@/locales/pl.json').then((m) => m.default),
  pt: () => import('@/locales/pt.json').then((m) => m.default),
  ro: () => import('@/locales/ro.json').then((m) => m.default),
  ru: () => import('@/locales/ru.json').then((m) => m.default),
  sl: () => import('@/locales/sl.json').then((m) => m.default),
  sq: () => import('@/locales/sq.json').then((m) => m.default),
  sr: () => import('@/locales/sr.json').then((m) => m.default),
  sv: () => import('@/locales/sv.json').then((m) => m.default),
  sw: () => import('@/locales/sw.json').then((m) => m.default),
  th: () => import('@/locales/th.json').then((m) => m.default),
  tr: () => import('@/locales/tr.json').then((m) => m.default),
  uk: () => import('@/locales/uk.json').then((m) => m.default),
  vi: () => import('@/locales/vi.json').then((m) => m.default),
  yue: () => import('@/locales/yue.json').then((m) => m.default),
  'zh-CN': () => import('@/locales/zh-CN.json').then((m) => m.default),
  'zh-HK': () => import('@/locales/zh-HK.json').then((m) => m.default),
  'zh-TW': () => import('@/locales/zh-TW.json').then((m) => m.default),
}

export const supportedLanguages = [...SUPPORTED_LANGUAGES] as Language[]

const translationCache = new Map<Language, Record<string, string>>()
const loadingCache = new Map<Language, Promise<Record<string, string>>>()

const byExactLowercase = new Map(
  supportedLanguages.map((lang) => [lang.toLowerCase(), lang] as const),
)
const byBaseLowercase = new Map(
  supportedLanguages.map(
    (lang) => [lang.toLowerCase().split('-')[0], lang] as const,
  ),
)

const normalizeLanguage = (
  value: string | null | undefined,
): Language | null => {
  if (!value) return null
  const normalized = value.toLowerCase()
  return (
    byExactLowercase.get(normalized) ??
    byBaseLowercase.get(normalized.split('-')[0]) ??
    null
  )
}

async function loadLanguageMessages(language: Language) {
  const cached = translationCache.get(language)
  if (cached) return cached

  const pending = loadingCache.get(language)
  if (pending) return pending

  const promise = Promise.all([
    localeLoaders[BASE_LANGUAGE](),
    localeLoaders[language](),
  ]).then(([base, current]) => {
    const merged = { ...base, ...current }
    translationCache.set(language, merged)
    loadingCache.delete(language)
    return merged
  })

  loadingCache.set(language, promise)
  return promise
}

export const translations = new Proxy(
  {} as Record<Language, Record<string, string>>,
  {
    get(_target, prop: string) {
      const language = (
        supportedLanguages.includes(prop as Language) ? prop : BASE_LANGUAGE
      ) as Language
      return (
        translationCache.get(language) ??
        translationCache.get(BASE_LANGUAGE) ??
        {}
      )
    },
  },
) as Record<Language, Record<string, string>>

void loadLanguageMessages(BASE_LANGUAGE)

function detectSystemLanguage(): Language {
  if (typeof window === 'undefined') return BASE_LANGUAGE
  return normalizeLanguage(navigator.language) ?? BASE_LANGUAGE
}

export const getStoredLanguage = async (): Promise<Language> => {
  const stored = await readEncryptedLocalStorage<string | null>(
    LANGUAGE_STORAGE_KEY,
    null,
  )
  return normalizeLanguage(stored) ?? detectSystemLanguage()
}

export const isZhLanguage = (language: Language) =>
  ['zh-CN', 'zh-HK', 'zh-TW'].includes(language)

export const getLanguageAutonym = (language: Language) =>
  new Intl.DisplayNames([language], { type: 'language' }).of(language) ??
  language

export function useLanguage(): [Language, (lang: Language) => void] {
  const [language, setLanguageState] = useState<Language>(BASE_LANGUAGE)

  useEffect(() => {
    let active = true

    const loadFromStorage = async () => {
      const selected = await getStoredLanguage()
      await loadLanguageMessages(selected)
      if (active) setLanguageState(selected)
    }

    void loadFromStorage()

    const onStorage = (event: StorageEvent) => {
      if (event.key !== LANGUAGE_STORAGE_KEY) return
      void loadFromStorage()
    }

    const onLanguageChange = (event: Event) => {
      const custom = event as CustomEvent<{ language?: string }>
      const normalized = normalizeLanguage(custom.detail?.language)
      if (!normalized) return
      void loadLanguageMessages(normalized)
      setLanguageState(normalized)
    }

    const unsubscribe = subscribeEncryptionState(() => {
      if (getEncryptionState().ready) {
        void loadFromStorage()
      }
    })

    window.addEventListener('storage', onStorage)
    window.addEventListener('languagechange', onLanguageChange)

    return () => {
      active = false
      unsubscribe()
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('languagechange', onLanguageChange)
    }
  }, [])

  const setLanguage = (lang: Language) => {
    void loadLanguageMessages(lang)
    setLanguageState(lang)
    void writeEncryptedLocalStorage(LANGUAGE_STORAGE_KEY, lang)
    window.dispatchEvent(
      new CustomEvent('languagechange', { detail: { language: lang } }),
    )
  }

  return [language, setLanguage]
}

export type { Language }
