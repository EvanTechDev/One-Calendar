import type { Locale } from 'date-fns'
import {
  bn,
  de,
  el,
  enGB,
  enUS,
  es,
  fi,
  fr,
  hi,
  is,
  it,
  ja,
  ko,
  lt,
  lv,
  mk,
  nb,
  nl,
  pl,
  pt,
  ro,
  ru,
  sl,
  sq,
  sr,
  sv,
  th,
  tr,
  uk,
  vi,
  zhCN,
  zhHK,
  zhTW,
} from 'date-fns/locale'
import type { Language } from '@zntr/i18n/calendar'

/**
 * The date-fns locale for each language the app ships.
 *
 * This exists because every caller used to write `isZh ? zhCN : enUS`. The app
 * supports 35 languages, so that expression resolved to English for 32 of them:
 * a Norwegian user with a fully translated interface still read "Wednesday,
 * March 4th, 2026" from `format(date, 'PPP')`, and the date picker's own weekday
 * header came out in English. Two locales were reachable out of the ones that
 * were paid to be translated.
 *
 * Kept as one map rather than repeated per component so a component cannot
 * quietly fall back to English on its own.
 *
 * Two gaps, both upstream rather than oversights:
 *  - `sw` (Swahili) has no date-fns locale.
 *  - `yue` (Cantonese) has none either; zh-HK is the closest written form, which
 *    is what a Cantonese reader would expect to see in a date anyway.
 */
const DATE_LOCALES: Partial<Record<Language, Locale>> = {
  bn,
  de,
  el,
  'en-GB': enGB,
  en: enUS,
  es,
  fi,
  fr,
  hi,
  is,
  it,
  ja,
  ko,
  lt,
  lv,
  mk,
  nb,
  nl,
  pl,
  pt,
  ro,
  ru,
  sl,
  sq,
  sr,
  sv,
  th,
  tr,
  uk,
  vi,
  yue: zhHK,
  'zh-CN': zhCN,
  'zh-HK': zhHK,
  'zh-TW': zhTW,
}

/**
 * The date-fns locale to format with, falling back to English.
 *
 * The fallback is the same shape the i18n barrel uses for strings: an untranslated
 * surface degrades to English rather than throwing or rendering `undefined`.
 */
export const dateLocale = (language: Language): Locale =>
  DATE_LOCALES[language] ?? enUS
