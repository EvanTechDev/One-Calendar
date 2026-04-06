import localeBn from "@/locales/bn.json";
import localeDe from "@/locales/de.json";
import localeEl from "@/locales/el.json";
import localeEnGb from "@/locales/en-GB.json";
import localeEn from "@/locales/en.json";
import localeEs from "@/locales/es.json";
import localeFi from "@/locales/fi.json";
import localeFr from "@/locales/fr.json";
import localeHi from "@/locales/hi.json";
import localeIs from "@/locales/is.json";
import localeIt from "@/locales/it.json";
import localeJa from "@/locales/ja.json";
import localeKo from "@/locales/ko.json";
import localeLt from "@/locales/lt.json";
import localeLv from "@/locales/lv.json";
import localeMk from "@/locales/mk.json";
import localeNb from "@/locales/nb.json";
import localeNl from "@/locales/nl.json";
import localePl from "@/locales/pl.json";
import localePt from "@/locales/pt.json";
import localeRo from "@/locales/ro.json";
import localeRu from "@/locales/ru.json";
import localeSl from "@/locales/sl.json";
import localeSq from "@/locales/sq.json";
import localeSr from "@/locales/sr.json";
import localeSv from "@/locales/sv.json";
import localeSw from "@/locales/sw.json";
import localeTh from "@/locales/th.json";
import localeTr from "@/locales/tr.json";
import localeUk from "@/locales/uk.json";
import localeVi from "@/locales/vi.json";
import localeYue from "@/locales/yue.json";
import localeZhCn from "@/locales/zh-CN.json";
import localeZhHk from "@/locales/zh-HK.json";
import localeZhTw from "@/locales/zh-TW.json";

export const translations = {
  bn: localeBn,
  de: localeDe,
  el: localeEl,
  "en-GB": localeEnGb,
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
  "zh-CN": localeZhCn,
  "zh-HK": localeZhHk,
  "zh-TW": localeZhTw,
} as const;

export type Language = keyof typeof translations;
