'use client'

import { useEffect, useState } from 'react'
import { getEncryptionState, readEncryptedLocalStorage, subscribeEncryptionState, writeEncryptedLocalStorage } from '@/hooks/useLocalStorage'
import { localeLoaders, type Language } from '@/lib/locales'

const LANGUAGE_STORAGE_KEY = 'preferred-language'
export const supportedLanguages = Object.keys(localeLoaders) as Language[]
const baseLanguage = 'en' as const

const translationCache = new Map<Language, Record<string, string>>()
const loadingCache = new Map<Language, Promise<Record<string, string>>>()

const loadLanguageMessages = async (language: Language) => {
  const cached = translationCache.get(language)
  if (cached) return cached
  const loading = loadingCache.get(language)
  if (loading) return loading

  const promise = Promise.all([localeLoaders[baseLanguage](), localeLoaders[language]()]).then(([base, current]) => {
    const merged = { ...base, ...current }
    translationCache.set(language, merged)
    loadingCache.delete(language)
    return merged
  })

  loadingCache.set(language, promise)
  return promise
}

export const translations = new Proxy({} as Record<Language, Record<string, string>>, {
  get(_target, prop: string) {
    const lang = (supportedLanguages.includes(prop as Language) ? prop : baseLanguage) as Language
    return translationCache.get(lang) ?? translationCache.get(baseLanguage) ?? {}
  },
}) as Record<Language, Record<string, string>>

void loadLanguageMessages(baseLanguage)

// ... keep rest minimal
const byExactLowercase = new Map(supportedLanguages.map((lang) => [lang.toLowerCase(), lang] as const))
const byBaseLowercase = new Map(supportedLanguages.map((lang) => [lang.toLowerCase().split('-')[0], lang] as const))
const normalizeLanguage = (value: string | null | undefined): Language | null => { if (!value) return null; const n=value.toLowerCase(); return byExactLowercase.get(n) ?? byBaseLowercase.get(n.split('-')[0]) ?? null }

export const getStoredLanguage = async (): Promise<Language> => normalizeLanguage(await readEncryptedLocalStorage<string | null>(LANGUAGE_STORAGE_KEY, null)) ?? 'en'
export const isZhLanguage = (language: Language) => ['zh-CN','zh-HK','zh-TW'].includes(language)
export const getLanguageAutonym = (language: Language) => new Intl.DisplayNames([language], { type: 'language' }).of(language) ?? language

export function useLanguage(): [Language, (lang: Language) => void] {
  const [language, setLanguageState] = useState<Language>('en')
  useEffect(() => {
    let active = true
    const load = async (lang?: Language) => {
      const selected = lang ?? normalizeLanguage(await readEncryptedLocalStorage<string | null>(LANGUAGE_STORAGE_KEY, null)) ?? 'en'
      await loadLanguageMessages(selected)
      if (active) setLanguageState(selected)
    }
    void load()
    const unsubscribe = subscribeEncryptionState(() => { if (getEncryptionState().ready) void load() })
    return () => { active = false; unsubscribe() }
  }, [])

  const setLanguage = (lang: Language) => {
    void loadLanguageMessages(lang)
    setLanguageState(lang)
    void writeEncryptedLocalStorage(LANGUAGE_STORAGE_KEY, lang)
    window.dispatchEvent(new CustomEvent('languagechange', { detail: { language: lang } }))
  }
  return [language, setLanguage]
}
export type { Language }
