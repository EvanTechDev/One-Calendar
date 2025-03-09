"use client"

import { useState, useEffect } from "react"
import type { Language } from "@/lib/i18n"

export function useLanguage(): [Language, (lang: Language) => void] {
  const [language, setLanguageState] = useState<Language>("zh")

  useEffect(() => {
    const storedLanguage = localStorage.getItem("preferred-language")
    if (storedLanguage === "en" || storedLanguage === "zh") {
      setLanguageState(storedLanguage)
    } else {
      setLanguageState("zh")
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem("preferred-language", lang)
  }

  return [language, setLanguage]
}

