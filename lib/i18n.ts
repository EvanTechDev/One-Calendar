'use client'

import { useEffect, useState } from 'react'
import {
  getEncryptionState,
  readEncryptedLocalStorage,
  subscribeEncryptionState,
  writeEncryptedLocalStorage,
} from '@/hooks/useLocalStorage'
import { localeLoaders, type Language } from '@/lib/locales'

const LANGUAGE_STORAGE_KEY = 'preferred-language'
const BASE_LANGUAGE = 'en' as const

export const supportedLanguages = Object.keys(localeLoaders) as Language[]

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
