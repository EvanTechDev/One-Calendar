import { translations, type Language } from '@zntr/i18n/calendar'

import { ZentraLogo } from '#calendar/components/brand/zentra-logo'

export function AboutBrand({ language }: { language: Language }) {
  const t = translations[language]

  return (
    <div className="flex select-none flex-col items-center gap-3 px-4 pt-8 pb-2 text-center">
      <ZentraLogo decorative className="size-12" />
      <p className="font-heading text-base font-semibold">Zentra Calendar</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        {t.aboutBrandTagline}
      </p>
      <p className="text-xs text-muted-foreground">{t.aboutBrandLicense}</p>
      <p className="text-xs text-muted-foreground/70">{t.aboutBrandCopyright}</p>
    </div>
  )
}
