'use client'

import UserProfileButton, {
  type UserProfileSection,
} from '@/components/app/profile/user-profile-button'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getLanguageAutonym,
  supportedLanguages,
  translations,
  type Language,
} from '@/lib/i18n'
import ShareManagement from '@/components/app/analytics/share-management'
import BuildInfoCard from '@/components/app/analytics/build-info-card'
import ImportExport from '@/components/app/analytics/import-export'
import type { NOTIFICATION_SOUNDS } from '@/lib/notifications'
import type { CalendarEvent } from '@/components/app/calendar'
import {
  isCalendarView,
  type CalendarViewType,
  type FirstDayOfWeek,
} from '@/components/app/calendar-types'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useTheme } from 'next-themes'
import {
  Bell,
  CalendarDays,
  Globe2,
  Keyboard,
  Monitor,
  Palette,
  ArrowLeft,
} from 'lucide-react'

interface SettingsProps {
  language: Language
  setLanguage: (lang: Language) => void
  firstDayOfWeek: FirstDayOfWeek
  setFirstDayOfWeek: (day: FirstDayOfWeek) => void
  timezone: string
  setTimezone: (timezone: string) => void
  notificationSound: NOTIFICATION_SOUNDS
  setNotificationSound: (sound: NOTIFICATION_SOUNDS) => void
  defaultView: CalendarViewType
  setDefaultView: (view: CalendarViewType) => void
  enableShortcuts: boolean
  setEnableShortcuts: (enable: boolean) => void
  timeFormat: '24h' | '12h'
  setTimeFormat: (format: '24h' | '12h') => void
  events: CalendarEvent[]
  onImportEvents: (events: CalendarEvent[]) => void
  focusUserProfileSection?: UserProfileSection | null
  toastPosition: 'bottom-left' | 'bottom-center' | 'bottom-right'
  setToastPosition: (
    position: 'bottom-left' | 'bottom-center' | 'bottom-right',
  ) => void
  onBackToCalendar?: () => void
}

export default function Settings({
  language,
  setLanguage,
  firstDayOfWeek,
  setFirstDayOfWeek,
  timezone,
  setTimezone,
  notificationSound,
  setNotificationSound,
  defaultView,
  setDefaultView,
  enableShortcuts,
  setEnableShortcuts,
  timeFormat,
  setTimeFormat,
  events,
  onImportEvents,
  focusUserProfileSection = null,
  toastPosition,
  setToastPosition,
  onBackToCalendar,
}: SettingsProps) {
  const { theme, setTheme } = useTheme()
  const t = translations[language]

  const getGMTTimezones = () => {
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
  }

  const gmtTimezones = getGMTTimezones()

  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang)
    window.dispatchEvent(
      new CustomEvent('languagechange', { detail: { language: newLang } }),
    )
  }

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme)
  }

  return (
    <div className="space-y-8 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t.settings}</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onBackToCalendar?.()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t.back || 'Back'}
        </Button>
      </div>

      <div className="rounded-lg border p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Palette className="h-4 w-4" />
              {t.theme}
            </div>
            <Select value={theme || 'system'} onValueChange={handleThemeChange}>
              <SelectTrigger id="theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">{t.themeLight}</SelectItem>
                <SelectItem value="dark">{t.themeDark}</SelectItem>
                <SelectItem value="green">{t.themeGreen}</SelectItem>
                <SelectItem value="orange">{t.themeOrange}</SelectItem>
                <SelectItem value="azalea">{t.themeAzalea}</SelectItem>
                <SelectItem value="system">{t.themeSystem}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Globe2 className="h-4 w-4" />
              {t.language}
            </div>
            <Select
              value={language}
              onValueChange={(value: Language) => handleLanguageChange(value)}
            >
              <SelectTrigger id="language">
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
          </div>
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="h-4 w-4" />
              {t.firstDayOfWeek}
            </div>
            <Select
              value={firstDayOfWeek.toString()}
              onValueChange={(value) => {
                const day = Number(value)
                setFirstDayOfWeek(day === 0 || day === 1 || day === 6 ? day : 0)
              }}
            >
              <SelectTrigger id="first-day">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">{t.sunday}</SelectItem>
                <SelectItem value="1">{t.monday}</SelectItem>
                <SelectItem value="6">{t.saturday}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Monitor className="h-4 w-4" />
              {t.defaultView}
            </div>
            <Select
              value={defaultView}
              onValueChange={(value) => {
                if (isCalendarView(value)) {
                  setDefaultView(value)
                }
              }}
            >
              <SelectTrigger id="default-view">
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
          </div>
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Globe2 className="h-4 w-4" />
              {t.timezone}
            </div>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[240px]">
                {gmtTimezones.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Bell className="h-4 w-4" />
              {t.timeFormat}
            </div>
            <Select
              value={timeFormat}
              onValueChange={(value: '24h' | '12h') => setTimeFormat(value)}
            >
              <SelectTrigger id="time-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">{t.timeFormat24h}</SelectItem>
                <SelectItem value="12h">
                  {t.timeFormat12hWithMeridiem}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border bg-card p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Keyboard className="h-4 w-4" />
              {t.shortCuts}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Switch
                  id="enable-shortcuts"
                  checked={enableShortcuts}
                  onCheckedChange={setEnableShortcuts}
                />
                <Label htmlFor="enable-shortcuts">{t.enableShortcuts}</Label>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    {t.availableShortcuts}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t.availableShortcuts}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <kbd className="min-w-8 rounded-md border bg-muted px-2 py-0.5 text-center font-mono text-xs">
                        N
                      </kbd>
                      <span>{t.newEvent}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <kbd className="min-w-8 rounded-md border bg-muted px-2 py-0.5 text-center font-mono text-xs">
                        /
                      </kbd>
                      <span>{t.searchEvents}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <kbd className="min-w-8 rounded-md border bg-muted px-2 py-0.5 text-center font-mono text-xs">
                        T
                      </kbd>
                      <span>{t.today}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <kbd className="min-w-8 rounded-md border bg-muted px-2 py-0.5 text-center font-mono text-xs">
                        1
                      </kbd>
                      <span>{t.day}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <kbd className="min-w-8 rounded-md border bg-muted px-2 py-0.5 text-center font-mono text-xs">
                        2
                      </kbd>
                      <span>{t.week}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <kbd className="min-w-8 rounded-md border bg-muted px-2 py-0.5 text-center font-mono text-xs">
                        3
                      </kbd>
                      <span>{t.month}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <kbd className="min-w-8 rounded-md border bg-muted px-2 py-0.5 text-center font-mono text-xs">
                        4
                      </kbd>
                      <span>{t.year}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <kbd className="min-w-8 rounded-md border bg-muted px-2 py-0.5 text-center font-mono text-xs">
                        5
                      </kbd>
                      <span>{t.fourDay}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <kbd className="min-w-8 rounded-md border bg-muted px-2 py-0.5 text-center font-mono text-xs">
                        ←
                      </kbd>
                      <span>{t.previousPeriod}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <kbd className="min-w-8 rounded-md border bg-muted px-2 py-0.5 text-center font-mono text-xs">
                        →
                      </kbd>
                      <span>{t.nextPeriod}</span>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t.account}</h2>
        <UserProfileButton
          mode="settings"
          focusSection={focusUserProfileSection}
        />
      </div>
      <ShareManagement />
      <ImportExport events={events} onImportEvents={onImportEvents} />
      <BuildInfoCard language={language} />
    </div>
  )
}
