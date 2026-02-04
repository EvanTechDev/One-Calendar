"use client"

import { useEffect, useState } from "react"
import en from "@/locales/en.json"
import zhCN from "@/locales/zh-CN.json"
import {
  getEncryptionState,
  readEncryptedLocalStorage,
  subscribeEncryptionState,
  writeEncryptedLocalStorage,
} from "@/hooks/useLocalStorage"

export const translations = {
  en,
  "zh-CN": zhCN,
} as const

export type Language = keyof typeof translations

const LANGUAGE_STORAGE_KEY = "preferred-language"

const normalizeLanguage = (value: string | null | undefined): Language | null => {
  if (!value) return null
  if (value in translations) {
    return value as Language
  }
  const lower = value.toLowerCase()
  if (lower.startsWith("zh")) return "zh-CN"
  if (lower.startsWith("en")) return "en"
  return null
}

export const isZhLanguage = (language: Language) => language === "zh-CN"

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
