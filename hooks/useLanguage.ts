"use client"

import { useState, useEffect } from "react"
import { isSupportedLanguage, type Language } from "@/lib/i18n"
import {
  getEncryptionState,
  readEncryptedLocalStorage,
  subscribeEncryptionState,
  writeEncryptedLocalStorage,
} from "@/hooks/useLocalStorage"

export function useLanguage(): [Language, (lang: Language) => void] {
  const [language, setLanguageState] = useState<Language>("zh")

  useEffect(() => {
    let active = true
    const loadLanguage = () =>
      readEncryptedLocalStorage<Language | null>("preferred-language", null).then((storedLanguage) => {
        if (!active) return
        if (isSupportedLanguage(storedLanguage)) {
          setLanguageState(storedLanguage)
        } else {
          setLanguageState("zh")
        }
      })

    loadLanguage()
    const unsubscribe = subscribeEncryptionState(() => {
      if (getEncryptionState().ready) {
        loadLanguage()
      }
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    void writeEncryptedLocalStorage("preferred-language", lang)
  }

  return [language, setLanguage]
}
