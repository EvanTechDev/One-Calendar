"use client"

import { useEffect, useState } from "react"
import {
  getEncryptionState,
  readEncryptedLocalStorage,
  subscribeEncryptionState,
  writeEncryptedLocalStorage,
} from "@/hooks/useLocalStorage"
import { translations, type Language } from "@/lib/locales"

const LANGUAGE_STORAGE_KEY = "preferred-language"

export const supportedLanguages = Object.keys(translations) as Language[]

const LANGUAGE_AUTONYM: Partial<Record<Language, string>> = {
  en: "English",
  de: "Deutsch",
  es: "Español",
  fr: "Français",
  yue: "粵語",
  "zh-CN": "简体中文",
  "zh-HK": "繁體中文（香港）",
  "zh-TW": "繁體中文（台灣）",
}

const byExactLowercase = new Map(
  supportedLanguages.map((lang) => [lang.toLowerCase(), lang] as const),
)

const byBaseLowercase = new Map(
  supportedLanguages.map((lang) => [lang.toLowerCase().split("-")[0], lang] as const),
)

const normalizeLanguage = (value: string | null | undefined): Language | null => {
  if (!value) return null

  const normalized = value.toLowerCase()
  const exact = byExactLowercase.get(normalized)
  if (exact) return exact

  const base = normalized.split("-")[0]
  return byBaseLowercase.get(base) ?? null
}

export const getLanguageAutonym = (language: Language) => {
  const configured = LANGUAGE_AUTONYM[language]
  if (configured) return configured

  return new Intl.DisplayNames([language], { type: "language" }).of(language) ?? language
}

export const isZhLanguage = (language: Language) => language.startsWith("zh")

export const getStoredLanguage = async (): Promise<Language> => {
  const storedLanguage = await readEncryptedLocalStorage<string | null>(LANGUAGE_STORAGE_KEY, null)
  return normalizeLanguage(storedLanguage) ?? detectSystemLanguage()
}

// 检测系统语言
function detectSystemLanguage(): Language {
  if (typeof window === "undefined") {
    return "en"
  }

  // 获取浏览器语言
  const browserLang = navigator.language
  return normalizeLanguage(browserLang) ?? "en"
}

export function useLanguage(): [Language, (lang: Language) => void] {
  const [language, setLanguageState] = useState<Language>("en")

  useEffect(() => {
    // 初始化时读取语言设置
    let active = true
    const loadLanguage = () =>
      readEncryptedLocalStorage<string | null>(LANGUAGE_STORAGE_KEY, null).then((storedLanguage) => {
        if (!active) return
        const normalized = normalizeLanguage(storedLanguage) ?? detectSystemLanguage()
        setLanguageState(normalized)
        if (storedLanguage && normalized !== storedLanguage) {
          void writeEncryptedLocalStorage(LANGUAGE_STORAGE_KEY, normalized)
        }
      })

    loadLanguage()

    // 创建一个事件监听器，当localStorage变化时触发
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LANGUAGE_STORAGE_KEY) {
        readEncryptedLocalStorage<string | null>(LANGUAGE_STORAGE_KEY, null).then((newLanguage) => {
          const normalized = normalizeLanguage(newLanguage)
          if (normalized) {
            setLanguageState(normalized)
          }
        })
      }
    }

    const unsubscribe = subscribeEncryptionState(() => {
      if (getEncryptionState().ready) {
        loadLanguage()
      }
    })

    window.addEventListener("storage", handleStorageChange)
    return () => {
      active = false
      unsubscribe()
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    void writeEncryptedLocalStorage(LANGUAGE_STORAGE_KEY, lang)
    // 触发一个自定义事件，通知其他组件语言已更改
    window.dispatchEvent(new CustomEvent("languagechange", { detail: { language: lang } }))
  }

  return [language, setLanguage]
}


export { translations }
export type { Language }
