"use client"

import { useEffect, useState } from "react"
import {
  getEncryptionState,
  readEncryptedLocalStorage,
  subscribeEncryptionState,
  writeEncryptedLocalStorage,
} from "@/hooks/useLocalStorage"
import en from "@/locales/en.json"
import zhCN from "@/locales/zh-CN.json"

export const translations = {
  en,
  zh: zhCN,
} as const

export type Language = keyof typeof translations

export const languageOptions: Array<{ value: Language; labelKey: "languageEnglish" | "languageChinese" }> = [
  { value: "en", labelKey: "languageEnglish" },
  { value: "zh", labelKey: "languageChinese" },
]

const supportedLanguages = Object.keys(translations) as Language[]

export function isSupportedLanguage(value: string | null): value is Language {
  return value !== null && supportedLanguages.includes(value as Language)
}

function resolveLanguage(language: string): Language {
  if (language.toLowerCase().startsWith("zh")) {
    return "zh"
  }
  return "en"
}

function detectSystemLanguage(): Language {
  if (typeof window === "undefined") {
    return "zh" // 默认为中文
  }

  return resolveLanguage(navigator.language || "")
}

export function useLanguage(): [Language, (lang: Language) => void] {
  const [language, setLanguageState] = useState<Language>("zh") // 默认为中文

  useEffect(() => {
    // 初始化时读取语言设置
    let active = true
    const loadLanguage = () =>
      readEncryptedLocalStorage<Language | null>("preferred-language", null).then((storedLanguage) => {
        if (!active) return
        if (isSupportedLanguage(storedLanguage)) {
          setLanguageState(storedLanguage)
        } else {
          setLanguageState(detectSystemLanguage())
        }
      })

    loadLanguage()

    // 创建一个事件监听器，当localStorage变化时触发
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "preferred-language") {
        readEncryptedLocalStorage<Language | null>("preferred-language", null).then((newLanguage) => {
          if (isSupportedLanguage(newLanguage)) {
            setLanguageState(newLanguage)
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
    void writeEncryptedLocalStorage("preferred-language", lang)
    // 触发一个自定义事件，通知其他组件语言已更改
    window.dispatchEvent(new Event("languagechange"))
  }

  return [language, setLanguage]
}
