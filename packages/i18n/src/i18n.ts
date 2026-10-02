'use client'

import { useCallback, useSyncExternalStore } from 'react'
import {
  translations as localeTranslations,
  type Language,
} from './calendar/locales'

export const LANGUAGE_STORAGE_KEY = 'preferred-language'

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

function readStoredLanguage(): string | null {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY)
  } catch {
    // localStorage not available
    return null
  }
}

function writeStoredLanguage(language: Language): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    // localStorage not available
  }
}

export const getStoredLanguage = async (): Promise<Language> =>
  normalizeLanguage(readStoredLanguage()) ?? detectSystemLanguage()

function detectSystemLanguage(): Language {
  if (typeof window === 'undefined') {
    return 'en'
  }

  const browserLang = navigator.language
  return normalizeLanguage(browserLang) ?? 'en'
}

/**
 * One module-level store behind every {@link useLanguage} call.
 *
 * This used to be 26 copies of the same value. Each call site owned a
 * `useState`, an effect that read localStorage on mount, and two window
 * listeners — so the app held 26 independent states that could disagree, 52
 * live listeners, and one language change fanned out to 26 separate
 * `setState` calls. A 27th copy was hand-rolled in analytics-view.tsx to
 * listen for the same events.
 *
 * Now there is one value, and the two window listeners are attached only
 * while something is actually subscribed. `useSyncExternalStore` reads it, so
 * every call site is unchanged at the call and the change propagates in one
 * pass rather than 26.
 */
let currentLanguage: Language | null = null
const listeners = new Set<() => void>()

function readLanguageSnapshot(): Language {
  // Lazily resolved rather than at module scope: this module is imported by
  // server components too, and localStorage does not exist there.
  if (currentLanguage === null) {
    currentLanguage =
      normalizeLanguage(readStoredLanguage()) ?? detectSystemLanguage()
  }
  return currentLanguage
}

/**
 * What the server rendered with. The stored language is only knowable in the
 * browser, so a non-English session still paints English and settles on the
 * stored language once React re-checks the snapshot after hydration. React
 * drives that re-check itself and reports no mismatch, which is strictly
 * better than the effect this replaced, where the same swap happened as an
 * unannounced post-mount state update.
 */
const SERVER_LANGUAGE: Language = 'en'

function publish(language: Language): void {
  if (currentLanguage === language) return
  currentLanguage = language
  for (const listener of listeners) listener()
}

function attach(): void {
  // Cross-tab: `storage` only fires in the OTHER tab, which is exactly why it
  // is a separate signal rather than redundant with the store.
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key !== LANGUAGE_STORAGE_KEY) return
    const normalized = normalizeLanguage(e.newValue)
    if (normalized) publish(normalized)
  })

  // Inbound for callers that cannot reach the store — the onboarding flow
  // dispatches this directly. Publishing here also keeps them from having to
  // know that persistence lives in this module.
  window.addEventListener('languagechange', (e: Event) => {
    const normalized = normalizeLanguage(
      (e as CustomEvent<{ language?: string }>).detail?.language,
    )
    if (!normalized) return
    writeStoredLanguage(normalized)
    publish(normalized)
  })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  // Attached once and left for the lifetime of the module. Tearing them down
  // when the last subscriber leaves would silently drop a `languagechange`
  // dispatched by a screen that renders no translated copy, and one pair of
  // listeners is not worth losing a signal over.
  if (listeners.size === 1) attach()
  return () => {
    listeners.delete(listener)
  }
}

export function useLanguage(): [Language, (lang: Language) => void] {
  const language = useSyncExternalStore(
    subscribe,
    readLanguageSnapshot,
    () => SERVER_LANGUAGE,
  )

  const setLanguage = useCallback((lang: Language) => {
    writeStoredLanguage(lang)
    publish(lang)
    // Announced for the benefit of anything outside the store that is still
    // listening. Our own handler ignores the language it just published.
    window.dispatchEvent(
      new CustomEvent('languagechange', { detail: { language: lang } }),
    )
  }, [])

  return [language, setLanguage]
}
export type { Language }
