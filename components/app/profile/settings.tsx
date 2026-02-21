"use client"

import UserProfileButton, { type UserProfileSection } from "@/components/app/profile/user-profile-button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getLanguageAutonym, supportedLanguages, translations, type Language } from "@/lib/i18n"
import ShareManagement from "@/components/app/analytics/share-management"
import BuildInfoCard from "@/components/app/analytics/build-info-card"
import ImportExport from "@/components/app/analytics/import-export"
import type { NOTIFICATION_SOUNDS } from "@/utils/notifications"
import type { CalendarEvent } from "@/components/app/calendar"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Kbd } from "@/components/ui/kbd"
import { useTheme } from "next-themes"

interface SettingsProps {
  language: Language
  setLanguage: (lang: Language) => void
  firstDayOfWeek: number
  setFirstDayOfWeek: (day: number) => void
  timezone: string
  setTimezone: (timezone: string) => void
  notificationSound: keyof typeof NOTIFICATION_SOUNDS
  setNotificationSound: (sound: keyof typeof NOTIFICATION_SOUNDS) => void
  defaultView: string
  setDefaultView: (view: string) => void
  enableShortcuts: boolean
  setEnableShortcuts: (enable: boolean) => void
  timeFormat: "24h" | "12h"
  setTimeFormat: (format: "24h" | "12h") => void
  events: CalendarEvent[]
  onImportEvents: (events: CalendarEvent[]) => void
  focusUserProfileSection?: UserProfileSection | null
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
}: SettingsProps) {
  const { theme, setTheme } = useTheme()
  const t = translations[language]

  const getGMTTimezones = () => {
    const timezones = Intl.supportedValuesOf("timeZone")

    const getUTCOffset = (timeZone: string) => {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        timeZoneName: "shortOffset",
      }).formatToParts(new Date())

      const timeZoneName = parts.find((part) => part.type === "timeZoneName")?.value ?? ""

      if (timeZoneName === "GMT" || timeZoneName === "UTC") {
        return { offsetString: "UTC+00:00", offsetMinutes: 0 }
      }

      const match = timeZoneName.match(/(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?/)
      if (!match) {
        return { offsetString: "UTC+00:00", offsetMinutes: 0 }
      }

      const [, sign, hours, minutes = "00"] = match
      const parsedHours = Number.parseInt(hours, 10)
      const parsedMinutes = Number.parseInt(minutes, 10)
      const totalMinutes = parsedHours * 60 + parsedMinutes
      const offsetMinutes = sign === "-" ? -totalMinutes : totalMinutes

      return {
        offsetString: `UTC${sign}${hours.padStart(2, "0")}:${minutes}`,
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
      .sort((a, b) => a.offsetMinutes - b.offsetMinutes || a.value.localeCompare(b.value))
  }

  const gmtTimezones = getGMTTimezones()

  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang)
    window.dispatchEvent(new CustomEvent("languagechange", { detail: { language: newLang } }))
  }

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme)
  }

  return (
    <div className="space-y-8 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.settings}</h1>
      </div>

      <div className="rounded-lg border p-4 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="theme">{t.theme}</Label>
          <Select value={theme || "system"} onValueChange={handleThemeChange}>
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

        <div className="space-y-2">
          <Label htmlFor="language">{t.language}</Label>
          <Select value={language} onValueChange={(value: Language) => handleLanguageChange(value)}>
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

        <div className="space-y-2">
          <Label htmlFor="first-day">{t.firstDayOfWeek}</Label>
          <Select
            value={firstDayOfWeek.toString()}
            onValueChange={(value) => setFirstDayOfWeek(Number.parseInt(value))}
          >
            <SelectTrigger id="first-day">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">{t.sunday}</SelectItem>
              <SelectItem value="1">{t.monday}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="default-view">{t.defaultView}</Label>
          <Select value={defaultView} onValueChange={setDefaultView}>
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

        <div className="space-y-2">
          <Label htmlFor="timezone">{t.timezone}</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger id="timezone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[200px]">
              {gmtTimezones.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="time-format">{t.timeFormat}</Label>
          <Select value={timeFormat} onValueChange={(value: "24h" | "12h") => setTimeFormat(value)}>
            <SelectTrigger id="time-format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">{t.timeFormat24h}</SelectItem>
              <SelectItem value="12h">{t.timeFormat12hWithMeridiem}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <Switch id="enable-shortcuts" checked={enableShortcuts} onCheckedChange={setEnableShortcuts} />
          <Label htmlFor="enable-shortcuts">{t.enableShortcuts}</Label>
        </div>

        {enableShortcuts && (
          <div className="rounded-md border p-4">
            <h3 className="mb-2 font-medium">{t.availableShortcuts}</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><Kbd>N</Kbd> - {t.newEvent}</div>
              <div><Kbd>/</Kbd> - {t.searchEvents}</div>
              <div><Kbd>T</Kbd> - {t.today}</div>
              <div><Kbd>1</Kbd> - {t.dayView}</div>
              <div><Kbd>2</Kbd> - {t.weekView}</div>
              <div><Kbd>3</Kbd> - {t.monthView}</div>
              <div><Kbd>4</Kbd> - {t.yearView}</div>
              <div><Kbd>5</Kbd> - {t.fourDayView}</div>
              <div><Kbd>→</Kbd> - {t.nextPeriod}</div>
              <div><Kbd>←</Kbd> - {t.previousPeriod}</div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t.account}</h2>
        <UserProfileButton mode="settings" focusSection={focusUserProfileSection} />
      </div>

      <ShareManagement />
      <ImportExport events={events} onImportEvents={onImportEvents} />
      <BuildInfoCard language={language} />
    </div>
  )
}
