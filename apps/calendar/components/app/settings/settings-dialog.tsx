'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@zntr/ui/dialog'
import { Button } from '@zntr/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@zntr/ui/select'
import { Switch } from '@zntr/ui/switch'
import { Kbd } from '@zntr/ui/kbd'
import { ScrollArea } from '@zntr/ui/scroll-area'
import { cn } from '@zntr/utils'
import { useTheme } from 'next-themes'
import type { ThemeOption } from '@/lib/theme'
import { useSettings } from '@/components/providers/data-provider'
import {
  getLanguageAutonym,
  supportedLanguages,
  translations,
  type Language,
} from '@zntr/i18n/calendar'
import {
  Bot,
  CalendarDays,
  CircleUserRound,
  Clock,
  Database,
  Globe2,
  Info,
  Keyboard,
  Languages,
  Monitor,
  Palette,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { AccountPanel, type AccountSection } from '@zntr/auth/account'
import { AccountHost } from '@/components/app/profile/account-host'
import BuildInfoCard from '@/components/app/analytics/build-info-card'
import ImportExport from '@/components/app/analytics/import-export'
import MCPSettings from '@/components/app/settings/mcp-settings'
import type { CalendarEvent } from '@/components/app/calendar'
import {
  isCalendarView,
  CalendarViewType,
  type CalendarViewTypeValue,
  FirstDayOfWeek,
  type FirstDayOfWeekValue,
  TimeFormat,
} from '@/lib/calendar-types'

type SettingsSection = 'general' | 'account' | 'mcp' | 'data' | 'about'

interface GeneralSettingsProps {
  language: string
  setLanguage: (lang: string) => void
  firstDayOfWeek: FirstDayOfWeek
  setFirstDayOfWeek: (day: FirstDayOfWeek) => void
  timezone: string
  setTimezone: (timezone: string) => void
  defaultView: CalendarViewType
  setDefaultView: (view: CalendarViewType) => void
  enableShortcuts: boolean
  setEnableShortcuts: (enable: boolean) => void
  timeFormat: TimeFormat
  setTimeFormat: (format: TimeFormat) => void
}

interface SettingsDialogProps extends GeneralSettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  focusSection?: AccountSection | null
  onFocusSectionHandled?: () => void
  events: CalendarEvent[]
  onImportEvents: (events: CalendarEvent[]) => void
}

function SettingRow({
  icon,
  title,
  description,
  children,
  className,
}: {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 py-3.5 pl-4 pr-3',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-4">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <div className="text-sm leading-snug font-medium">{title}</div>
          {description ? (
            <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

function SettingsGroup({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'divide-y divide-border rounded-xl border bg-card',
        className,
      )}
    >
      {children}
    </div>
  )
}

function GeneralSettings({
  language,
  setLanguage,
  firstDayOfWeek,
  setFirstDayOfWeek,
  timezone,
  setTimezone,
  defaultView,
  setDefaultView,
  enableShortcuts,
  setEnableShortcuts,
  timeFormat,
  setTimeFormat,
}: GeneralSettingsProps) {
  const { theme, setTheme } = useTheme()
  const { updateSettings } = useSettings()
  const langCode = language as keyof typeof translations
  const t = translations[langCode]
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const gmtTimezones = useMemo(() => {
    const timezones = Intl.supportedValuesOf('timeZone')

    const getUTCOffset = (timeZone: string) => {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName: 'shortOffset',
      }).formatToParts(new Date())

      const timeZoneName =
        parts.find((part) => part.type === 'timeZoneName')?.value ?? ''

      if (timeZoneName === 'GMT' || timeZoneName === 'UTC') {
        return { offsetString: 'UTC+00:00', offsetMinutes: 0 }
      }

      const match = timeZoneName.match(
        /(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?/,
      )
      if (!match) {
        return { offsetString: 'UTC+00:00', offsetMinutes: 0 }
      }

      const [, sign, hours, minutes = '00'] = match
      const parsedHours = Number.parseInt(hours, 10)
      const parsedMinutes = Number.parseInt(minutes, 10)
      const totalMinutes = parsedHours * 60 + parsedMinutes
      const offsetMinutes = sign === '-' ? -totalMinutes : totalMinutes

      return {
        offsetString: `UTC${sign}${hours.padStart(2, '0')}:${minutes}`,
        offsetMinutes,
      }
    }

    return timezones
      .map((tz) => {
        try {
          const { offsetString, offsetMinutes } = getUTCOffset(tz)

          return {
            value: tz,
            label: `${offsetString} · ${tz}`,
            offsetMinutes,
          }
        } catch {
          return {
            value: tz,
            label: `UTC+00:00 · ${tz}`,
            offsetMinutes: 0,
          }
        }
      })
      .sort(
        (a, b) =>
          a.offsetMinutes - b.offsetMinutes || a.value.localeCompare(b.value),
      )
  }, [])

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang)
  }

  const selectClass = 'w-40 sm:w-48'

  return (
    <div className="space-y-6">
      <SettingsGroup>
        <SettingRow
          icon={<Palette />}
          title={t.theme}
          description={t.settingsThemeDesc}
        >
          <Select
            value={theme || 'system'}
            onValueChange={(value: ThemeOption) => {
              setTheme(value)
              updateSettings({ theme: value }).catch(() => {})
            }}
          >
            <SelectTrigger id="theme" className={selectClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">{t.themeLight}</SelectItem>
              <SelectItem value="dark">{t.themeDark}</SelectItem>
              <SelectItem value="system">{t.themeSystem}</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow
          icon={<Languages />}
          title={t.language}
          description={t.settingsLanguageDesc}
        >
          <Select
            value={language}
            onValueChange={(value: Language) => handleLanguageChange(value)}
          >
            <SelectTrigger id="language" className={selectClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {supportedLanguages.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {getLanguageAutonym(lang)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow
          icon={<CalendarDays />}
          title={t.firstDayOfWeek}
          description={t.settingsFirstDayDesc}
        >
          <Select
            value={firstDayOfWeek.value.toString()}
            onValueChange={(value) => {
              const day = Number(value) as FirstDayOfWeekValue
              setFirstDayOfWeek(FirstDayOfWeek.create(day))
            }}
          >
            <SelectTrigger id="first-day" className={selectClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">{t.sunday}</SelectItem>
              <SelectItem value="1">{t.monday}</SelectItem>
              <SelectItem value="6">{t.saturday}</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow
          icon={<Monitor />}
          title={t.defaultView}
          description={t.settingsDefaultViewDesc}
        >
          <Select
            value={defaultView.value}
            onValueChange={(value) => {
              if (isCalendarView(value)) {
                setDefaultView(
                  CalendarViewType.create(value as CalendarViewTypeValue),
                )
              }
            }}
          >
            <SelectTrigger id="default-view" className={selectClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">{t.day}</SelectItem>
              <SelectItem value="week">{t.week}</SelectItem>
              <SelectItem value="month">{t.month}</SelectItem>
              <SelectItem value="year">{t.year}</SelectItem>
              <SelectItem value="four-day">{t.fourDay}</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow
          icon={<Globe2 />}
          title={t.timezone}
          description={t.settingsTimezoneDesc}
        >
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger id="timezone" className={selectClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {gmtTimezones.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow
          icon={<Clock />}
          title={t.timeFormat}
          description={t.settingsTimeFormatDesc}
        >
          <Select
            value={timeFormat.value}
            onValueChange={(value: '24h' | '12h') =>
              setTimeFormat(TimeFormat.create(value))
            }
          >
            <SelectTrigger id="time-format" className={selectClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">{t.timeFormat24h}</SelectItem>
              <SelectItem value="12h">{t.timeFormat12hWithMeridiem}</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup>
        <SettingRow
          icon={<Keyboard />}
          title={t.shortCuts}
          description={t.settingsShortcutsDesc}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShortcutsOpen(true)}
          >
            {t.availableShortcuts}
          </Button>
          <Switch
            id="enable-shortcuts"
            checked={enableShortcuts}
            onCheckedChange={setEnableShortcuts}
          />
        </SettingRow>
      </SettingsGroup>

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.availableShortcuts}</DialogTitle>
            <DialogDescription>{t.shortcutsDialogDesc}</DialogDescription>
          </DialogHeader>
          {/*
            One card per group instead of a single divided list: the group
            headings used to be children of the `divide-y` container, so a
            divider was drawn through every heading. Headings are also no longer
            forced `lowercase`, which mangles non-Latin labels.
          */}
          <div className="space-y-4">
            {[
              {
                id: 'actions',
                title: t.shortcutsActions,
                items: [
                  { keys: 'N', label: t.newEvent },
                  { keys: '/', label: t.searchEvents },
                ],
              },
              {
                id: 'views',
                title: t.shortcutsViews,
                items: [
                  { keys: '1', label: t.day },
                  { keys: '2', label: t.week },
                  { keys: '3', label: t.month },
                  { keys: '4', label: t.year },
                  { keys: '5', label: t.fourDay },
                ],
              },
              {
                id: 'navigation',
                title: t.shortcutsNavigation,
                items: [
                  { keys: 'T', label: t.today },
                  { keys: '←', label: t.previousPeriod },
                  { keys: '→', label: t.nextPeriod },
                ],
              },
            ].map((group) => (
              <section key={group.id} className="space-y-1.5">
                <h3 className="px-1 text-xs font-medium text-muted-foreground">
                  {group.title}
                </h3>
                <div className="divide-y divide-border overflow-hidden rounded-lg border bg-card">
                  {group.items.map((item) => (
                    <div
                      key={item.keys}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <span className="min-w-0 truncate text-sm">
                        {item.label}
                      </span>
                      <Kbd className="shrink-0">{item.keys}</Kbd>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function SettingsDialog({
  open,
  onOpenChange,
  focusSection,
  onFocusSectionHandled,
  events,
  onImportEvents,
  ...general
}: SettingsDialogProps) {
  const [section, setSection] = useState<SettingsSection>('general')
  const langCode = general.language as keyof typeof translations
  const t = translations[langCode]

  useEffect(() => {
    if (open && focusSection) {
      setSection('account')
      onFocusSectionHandled?.()
    }
  }, [open, focusSection, onFocusSectionHandled])

  // Reset AFTER the close animation, not the moment `open` flips: resetting
  // synchronously re-rendered the dialog on the first tab while it was still
  // fading out, which showed as a flash to "General" on every close.
  useEffect(() => {
    if (open) return
    const timer = window.setTimeout(() => setSection('general'), 250)
    return () => window.clearTimeout(timer)
  }, [open])

  const sections: Array<{
    id: SettingsSection
    label: string
    icon: React.ReactNode
  }> = [
    {
      id: 'general',
      label: t.settingsGeneral,
      icon: <SlidersHorizontal />,
    },
    {
      id: 'account',
      label: t.account,
      icon: <CircleUserRound />,
    },
    {
      id: 'mcp',
      label: t.settingsMcp,
      icon: <Bot />,
    },
    {
      id: 'data',
      label: t.settingsData,
      icon: <Database />,
    },
    {
      id: 'about',
      label: t.settingsAbout,
      icon: <Info />,
    },
  ]

  const activeSection = sections.find((s) => s.id === section)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        // Below 768px the settings dialog becomes a full-screen overlay
        // (ADR-0019), spelled out as plain max-md: utilities: the dialog's
        // centering (top/left-1/2 + translate) and size caps are each
        // overridden at the breakpoint, and nothing changes at md and up.
        // The zoom entrance reads as a jump on a full-screen surface, so the
        // mobile variant slides up instead (zoom-*-100 neutralises the base).
        className="max-w-[calc(100vw-1rem)] p-0 sm:max-w-3xl max-md:top-0 max-md:left-0 max-md:h-dvh max-md:max-h-none max-md:w-dvw max-md:max-w-none max-md:translate-none max-md:rounded-none max-md:data-open:zoom-in-100 max-md:data-open:slide-in-from-bottom-8 max-md:data-closed:zoom-out-100 max-md:data-closed:slide-out-to-bottom-8 max-md:duration-200"
      >
        {/* max-md:h-dvh, not h-full: the fullscreen DialogContent is a grid
            with an auto row, where a child's percentage height does not
            resolve; dvh measures the viewport the overlay now fills. */}
        <div className="flex h-[min(86vh,46rem)] max-md:h-dvh flex-col overflow-hidden sm:flex-row">
          <aside className="flex shrink-0 flex-col border-b bg-muted/30 sm:w-56 sm:border-r sm:border-b-0 sm:bg-card/40">
            {/* Same height and type scale as the content header on the right,
                so the two tops line up instead of stepping. */}
            <div className="hidden h-14 shrink-0 items-center border-b px-4 sm:flex">
              <span className="font-heading text-base leading-snug font-semibold">
                {t.settings}
              </span>
            </div>
            <nav
              aria-label={t.settings}
              className="flex gap-1 overflow-x-auto p-2 sm:flex-col sm:overflow-y-auto sm:p-2.5"
            >
              {sections.map((s) => {
                const active = s.id === section
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSection(s.id)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors sm:w-full sm:min-w-0',
                      active
                        ? 'bg-accent font-medium text-accent-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <span className="shrink-0 [&_svg]:size-4">{s.icon}</span>
                    {/*
                      On the desktop layout this rail is a fixed `sm:w-56`
                      column, so a bare `whitespace-nowrap` label pushed past
                      its own border — "O programu" (sl) and "Tietoja" (fi) are
                      fine, but "Parapëlime" and "Преференции" are not. Wrapping
                      is wrong here (it would break the 8px row rhythm against
                      the header on the right), so it truncates instead. The
                      horizontal scroller on mobile keeps `nowrap`, which is
                      what makes it scrollable rather than squashed.
                    */}
                    <span className="whitespace-nowrap sm:min-w-0 sm:truncate">
                      {s.label}
                    </span>
                  </button>
                )
              })}
            </nav>
          </aside>

          {/* max-md:min-h-0: on mobile the shell is a COLUMN, so this pane's
              flex-1 runs along the vertical axis where the default
              min-height:auto refuses to shrink below the content — the pane
              silently overflows the h-dvh shell and the ScrollArea inside
              never gets a scrollable height. In the desktop ROW layout the
              height comes from cross-axis stretch, so this class is inert
              there. */}
          <div className="flex min-w-0 flex-1 flex-col max-md:min-h-0">
            <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b px-5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-muted-foreground [&_svg]:size-4">
                  {activeSection?.icon}
                </span>
                <h2 className="font-heading truncate text-base leading-snug font-semibold">
                  {activeSection?.label}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t.cancel}
                onClick={() => onOpenChange(false)}
              >
                <X />
              </Button>
            </header>

            <ScrollArea className="min-h-0 flex-1">
              <div className="px-5 pt-4 pb-8">
                <div hidden={section !== 'general'}>
                  <GeneralSettings {...general} />
                </div>
                <div hidden={section !== 'account'}>
                  <AccountHost>
                    <AccountPanel focusSection={focusSection} />
                  </AccountHost>
                </div>
                <div hidden={section !== 'mcp'}>
                  <MCPSettings />
                </div>
                <div hidden={section !== 'data'}>
                  <ImportExport
                    events={events}
                    onImportEvents={onImportEvents}
                  />
                </div>
                <div hidden={section !== 'about'}>
                  <BuildInfoCard language={langCode} />
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
