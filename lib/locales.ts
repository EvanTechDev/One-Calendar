import localeBn from '@/locales/calendar/bn.json'
import localeDe from '@/locales/calendar/de.json'
import localeEl from '@/locales/calendar/el.json'
import localeEnGB from '@/locales/calendar/en-GB.json'
import localeEn from '@/locales/calendar/en.json'
import localeEs from '@/locales/calendar/es.json'
import localeFi from '@/locales/calendar/fi.json'
import localeFr from '@/locales/calendar/fr.json'
import localeHi from '@/locales/calendar/hi.json'
import localeIs from '@/locales/calendar/is.json'
import localeIt from '@/locales/calendar/it.json'
import localeJa from '@/locales/calendar/ja.json'
import localeKo from '@/locales/calendar/ko.json'
import localeLt from '@/locales/calendar/lt.json'
import localeLv from '@/locales/calendar/lv.json'
import localeMk from '@/locales/calendar/mk.json'
import localeNb from '@/locales/calendar/nb.json'
import localeNl from '@/locales/calendar/nl.json'
import localePl from '@/locales/calendar/pl.json'
import localePt from '@/locales/calendar/pt.json'
import localeRo from '@/locales/calendar/ro.json'
import localeRu from '@/locales/calendar/ru.json'
import localeSl from '@/locales/calendar/sl.json'
import localeSq from '@/locales/calendar/sq.json'
import localeSr from '@/locales/calendar/sr.json'
import localeSv from '@/locales/calendar/sv.json'
import localeSw from '@/locales/calendar/sw.json'
import localeTh from '@/locales/calendar/th.json'
import localeTr from '@/locales/calendar/tr.json'
import localeUk from '@/locales/calendar/uk.json'
import localeVi from '@/locales/calendar/vi.json'
import localeYue from '@/locales/calendar/yue.json'
import localeZhCN from '@/locales/calendar/zh-CN.json'
import localeZhHK from '@/locales/calendar/zh-HK.json'
import localeZhTW from '@/locales/calendar/zh-TW.json'

export const translations = {
  bn: localeBn,
  de: localeDe,
  el: localeEl,
  'en-GB': localeEnGB,
  en: localeEn,
  es: localeEs,
  fi: localeFi,
  fr: localeFr,
  hi: localeHi,
  is: localeIs,
  it: localeIt,
  ja: localeJa,
  ko: localeKo,
  lt: localeLt,
  lv: localeLv,
  mk: localeMk,
  nb: localeNb,
  nl: localeNl,
  pl: localePl,
  pt: localePt,
  ro: localeRo,
  ru: localeRu,
  sl: localeSl,
  sq: localeSq,
  sr: localeSr,
  sv: localeSv,
  sw: localeSw,
  th: localeTh,
  tr: localeTr,
  uk: localeUk,
  vi: localeVi,
  yue: localeYue,
  'zh-CN': localeZhCN,
  'zh-HK': localeZhHK,
  'zh-TW': localeZhTW,
} as const

export type Language = keyof typeof translations
