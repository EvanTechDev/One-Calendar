'use client'

import { useEffect, useState } from 'react'
import {
  translations as localeTranslations,
  type Language,
} from './calendar/locales'

const LANGUAGE_STORAGE_KEY = 'preferred-language'

export const supportedLanguages = Object.keys(localeTranslations) as Language[]

const baseLanguage = 'en' as const

export const translations = Object.fromEntries(
  supportedLanguages.map((lang) => [
    lang,
    {
      ...localeTranslations[baseLanguage],
      ...localeTranslations[lang],
    },
  ]),
) as Record<Language, typeof localeTranslations.en>

const LANGUAGE_AUTONYM: Partial<Record<Language, string>> = {
  en: 'English',
  'en-GB': 'British English',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
  ja: '日本語',
  yue: '粵語',
  'zh-CN': '简体中文',
  'zh-HK': '繁體中文（香港）',
  'zh-TW': '繁體中文（台灣）',
  it: 'Italiano',
  ko: '한국어',
  pl: 'Polski',
  nl: 'Nederlands',
  pt: 'Português',
  ru: 'Русский',
  sv: 'Svenska',
  fi: 'Suomi',
  hi: 'हिन्दी',
  nb: 'Norsk bokmål',
  vi: 'Tiếng Việt',
  ro: 'Română',
  uk: 'Українська',
  is: 'Íslenska',
  sw: 'Kiswahili',
  bn: 'বাংলা',
  el: 'Ελληνικά',
  sq: 'Shqip',
  lt: 'Lietuvių',
  lv: 'Latviešu',
  sl: 'Slovenščina',
  mk: 'Македонски',
  sr: 'Српски',
}

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
  const exact = byExactLowercase.get(normalized)
  if (exact) return exact

  const base = normalized.split('-')[0]
  return byBaseLowercase.get(base) ?? null
}

export const getLanguageAutonym = (language: Language) => {
  const configured = LANGUAGE_AUTONYM[language]
  if (configured) return configured

  return (
    new Intl.DisplayNames([language], { type: 'language' }).of(language) ??
    language
  )
}

const zhLanguages: Language[] = ['zh-CN', 'zh-HK', 'zh-TW']

export const isZhLanguage = (language: Language) =>
  zhLanguages.includes(language)

export const getStoredLanguage = async (): Promise<Language> => {
  let storedLanguage: string | null = null
  try {
    storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY)
  } catch {
    // localStorage not available
  }
  return normalizeLanguage(storedLanguage) ?? detectSystemLanguage()
}

function detectSystemLanguage(): Language {
  if (typeof window === 'undefined') {
    return 'en'
  }

  const browserLang = navigator.language
  return normalizeLanguage(browserLang) ?? 'en'
}

export function useLanguage(): [Language, (lang: Language) => void] {
  const [language, setLanguageState] = useState<Language>('en')

  useEffect(() => {
    let active = true
    const loadLanguage = () => {
      let storedLanguage: string | null = null
      try {
        storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY)
      } catch {
        // localStorage not available
      }
      if (!active) return
      const normalized =
        normalizeLanguage(storedLanguage) ?? detectSystemLanguage()
      setLanguageState(normalized)
    }

    loadLanguage()

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LANGUAGE_STORAGE_KEY) {
        const normalized = normalizeLanguage(e.newValue)
        if (normalized) {
          setLanguageState(normalized)
        }
      }
    }

    const handleCustomLanguageChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ language?: string }>
      const normalized = normalizeLanguage(customEvent.detail?.language)
      if (normalized) {
        setLanguageState(normalized)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('languagechange', handleCustomLanguageChange)
    return () => {
      active = false
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('languagechange', handleCustomLanguageChange)
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
    } catch {
      // localStorage not available
    }

    window.dispatchEvent(
      new CustomEvent('languagechange', { detail: { language: lang } }),
    )
  }

  return [language, setLanguage]
}
export type { Language }
