"use client";

import { useEffect, useState } from "react";
import {
  getEncryptionState,
  readEncryptedLocalStorage,
  subscribeEncryptionState,
  writeEncryptedLocalStorage,
} from "@/hooks/useLocalStorage";
import {
  translations as localeTranslations,
  type Language,
} from "@/lib/locales";

const LANGUAGE_STORAGE_KEY = "preferred-language";

export const supportedLanguages = Object.keys(localeTranslations) as Language[];

const baseLanguage = "en" as const;

export const translations = Object.fromEntries(
  supportedLanguages.map((lang) => [
    lang,
    {
      ...localeTranslations[baseLanguage],
      ...localeTranslations[lang],
    },
  ]),
) as typeof localeTranslations;

const LANGUAGE_AUTONYM: Partial<Record<Language, string>> = {
  en: "English",
  "en-GB": "British English",
  de: "Deutsch",
  es: "Español",
  fr: "Français",
  ja: "日本語",
  yue: "粵語",
  "zh-CN": "简体中文",
  "zh-HK": "繁體中文（香港）",
  "zh-TW": "繁體中文（台灣）",
  it: "Italiano",
  ko: "한국어",
  pl: "Polski",
  nl: "Nederlands",
  pt: "Português",
  ru: "Русский",
  sv: "Svenska",
  fi: "Suomi",
  hi: "हिन्दी",
  nb: "Norsk bokmål",
  vi: "Tiếng Việt",
  ro: "Română",
  uk: "Українська",
  is: "Íslenska",
  sw: "Kiswahili",
  bn: "বাংলা",
  el: "Ελληνικά",
  sq: "Shqip",
  lt: "Lietuvių",
  lv: "Latviešu",
  sl: "Slovenščina",
  mk: "Македонски",
  sr: "Српски",
};

const byExactLowercase = new Map(
  supportedLanguages.map((lang) => [lang.toLowerCase(), lang] as const),
);

const byBaseLowercase = new Map(
  supportedLanguages.map(
    (lang) => [lang.toLowerCase().split("-")[0], lang] as const,
  ),
);

const normalizeLanguage = (
  value: string | null | undefined,
): Language | null => {
  if (!value) return null;

  const normalized = value.toLowerCase();
  const exact = byExactLowercase.get(normalized);
  if (exact) return exact;

  const base = normalized.split("-")[0];
  return byBaseLowercase.get(base) ?? null;
};

export const getLanguageAutonym = (language: Language) => {
  const configured = LANGUAGE_AUTONYM[language];
  if (configured) return configured;

  return (
    new Intl.DisplayNames([language], { type: "language" }).of(language) ??
    language
  );
};

export const isZhLanguage = (language: Language) => language.startsWith("zh");

export const getStoredLanguage = async (): Promise<Language> => {
  const storedLanguage = await readEncryptedLocalStorage<string | null>(
    LANGUAGE_STORAGE_KEY,
    null,
  );
  return normalizeLanguage(storedLanguage) ?? detectSystemLanguage();
};

function detectSystemLanguage(): Language {
  if (typeof window === "undefined") {
    return "en";
  }

  const browserLang = navigator.language;
  return normalizeLanguage(browserLang) ?? "en";
}

export function useLanguage(): [Language, (lang: Language) => void] {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    let active = true;
    const loadLanguage = () =>
      readEncryptedLocalStorage<string | null>(LANGUAGE_STORAGE_KEY, null).then(
        (storedLanguage) => {
          if (!active) return;
          const normalized =
            normalizeLanguage(storedLanguage) ?? detectSystemLanguage();
          setLanguageState(normalized);
          if (storedLanguage && normalized !== storedLanguage) {
            void writeEncryptedLocalStorage(LANGUAGE_STORAGE_KEY, normalized);
          }
        },
      );

    loadLanguage();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LANGUAGE_STORAGE_KEY) {
        readEncryptedLocalStorage<string | null>(
          LANGUAGE_STORAGE_KEY,
          null,
        ).then((newLanguage) => {
          const normalized = normalizeLanguage(newLanguage);
          if (normalized) {
            setLanguageState(normalized);
          }
        });
      }
    };

    const handleCustomLanguageChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ language?: string }>;
      const normalized = normalizeLanguage(customEvent.detail?.language);
      if (normalized) {
        setLanguageState(normalized);
      }
    };

    const unsubscribe = subscribeEncryptionState(() => {
      if (getEncryptionState().ready) {
        loadLanguage();
      }
    });

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("languagechange", handleCustomLanguageChange);
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("languagechange", handleCustomLanguageChange);
    };
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    void writeEncryptedLocalStorage(LANGUAGE_STORAGE_KEY, lang);

    window.dispatchEvent(
      new CustomEvent("languagechange", { detail: { language: lang } }),
    );
  };

  return [language, setLanguage];
}
export type { Language };
