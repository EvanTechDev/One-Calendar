"use client"

import { useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { translations, type Language } from "@/lib/i18n"
import type { NOTIFICATION_SOUNDS } from "@/utils/notifications"
import { Switch } from "@/components/ui/switch"
import { Kbd } from "@/components/ui/kbd"
import ImportExport from "@/components/analytics/ImportExport"
import ShareManagement from "@/components/analytics/ShareManagement"
import BuildInfoCard from "@/components/analytics/BuildInfoCard"
import type { CalendarEvent } from "@/components/Calendar"
import { useTheme } from "next-themes"
import UserProfileButton, { type UserProfileSection } from "@/components/home/UserProfileButton"

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
  events,
  onImportEvents,
  focusUserProfileSection = null,
}: SettingsProps) {
  const { theme, setTheme } = useTheme()
  const t = translations[language]

  useEffect(() => {
    const body = document.body
    const colorThemes = ["blue", "green", "purple", "orange", "azalea", "pink", "crimson"]

    body.classList.add("app")
    colorThemes.forEach((colorTheme) => body.classList.remove(colorTheme))

    if (theme && colorThemes.includes(theme)) {
      body.classList.add(theme)
    }

    return () => {
      body.classList.remove("app")
      colorThemes.forEach((colorTheme) => body.classList.remove(colorTheme))
    }
  }, [theme])

  const getGMTTimezones = () => {
    const timezones = Intl.supportedValuesOf("timeZone")
    const now = new Date()

    return timezones
      .map((tz) => {
        try {
          const offsetMinutes = new Date(now.toLocaleString("en-US", { timeZone: tz })).getTimezoneOffset() * -1
          const offsetHours = Math.abs(Math.floor(offsetMinutes / 60))
          const offsetMins = Math.abs(offsetMinutes % 60)
          const offsetSign = offsetMinutes >= 0 ? "+" : "-"
          const offsetString = `GMT${offsetSign}${offsetHours.toString().padStart(2, "0")}:${offsetMins.toString().padStart(2, "0")}`

          return {
            value: tz,
            label: `${tz} (${offsetString})`,
          }
        } catch {
          return {
            value: tz,
            label: tz,
          }
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label))
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
              <SelectItem value="pink">{t.themePink}</SelectItem>
              <SelectItem value="crimson">{t.themeCrimson}</SelectItem>
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
              <SelectItem value="en">{t.languageEnglish}</SelectItem>
              <SelectItem value="zh-CN">{t.languageChinese}</SelectItem>
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
              <div><Kbd>→</Kbd> - {t.nextPeriod}</div>
              <div><Kbd>←</Kbd> - {t.previousPeriod}</div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{language.startsWith("zh") ? "账户" : "Account"}</h2>
        <UserProfileButton mode="settings" focusSection={focusUserProfileSection} />
      </div>

      <ShareManagement />
      <ImportExport events={events} onImportEvents={onImportEvents} />
      <BuildInfoCard language={language} />
    </div>
  )
}
