import { translations, type Language } from '@zntr/i18n/calendar'

import { LegalBadge } from '#calendar/components/brand/legal-badge'
import { ZentraLogo } from '#calendar/components/brand/zentra-logo'
import { ZentraWordmark } from '#calendar/components/brand/zentra-wordmark'

const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL ?? '')
  .replace(/^https?:\/\//, '')
  .replace(/\/+$/, '')

export function AboutBrand({ language }: { language: Language }) {
  const t = translations[language]

  return (
    <div className="flex select-none flex-col items-center gap-2 px-4 pt-8 pb-2 text-center text-xs text-muted-foreground">
      <ZentraLogo decorative className="size-12" />
      <p className="font-heading text-base font-semibold text-foreground">
        Zentra Calendar
      </p>
      {BASE_URL && <p>{BASE_URL}</p>}
      <p className="text-sm text-foreground/80">{t.aboutBrandTagline}</p>
      <div className="mt-4 flex flex-col items-center gap-2">
        <p>{t.aboutBrandLabs}</p>
        <p>{t.aboutBrandTypeset}</p>
        <p>{t.aboutBrandThanks}</p>
        <p>{t.aboutBrandLicense}</p>
      </div>
      <div className="mt-4 flex flex-col items-center gap-2">
        <LegalBadge className="h-4 w-auto" />
        <p className="text-sm text-muted-foreground/70">{t.aboutBrandCopyright}</p>
        <ZentraWordmark className="h-4 w-auto" />
      </div>
    </div>
  )
}
