"use client"

import { useEffect } from "react"
import { SettingsIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { translations, type Language } from "@/lib/i18n"
import type { NOTIFICATION_SOUNDS } from "@/utils/notifications"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTheme } from "next-themes"
import { usePathname } from "next/navigation"
import { Kbd } from "@/components/ui/kbd"

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
}: SettingsProps) {
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()
  const t = translations[language]

  const isAppPage = pathname === "/app" || pathname?.startsWith("/app/")

  useEffect(() => {
    const body = document.body
    const colorThemes = ["green", "orange", "azalea", "pink", "crimson"]
    
    if (isAppPage) {
      body.classList.add("app")
      
      if (theme && colorThemes.includes(theme)) {
        body.classList.add(theme)
      }
    } else {
      body.classList.remove("app")
      colorThemes.forEach((colorTheme) => {
        body.classList.remove(colorTheme)
      })
      
      if (theme && colorThemes.includes(theme)) {
        setTheme("system")
      }
    }

    return () => {
      body.classList.remove("app")
      colorThemes.forEach((colorTheme) => {
        body.classList.remove(colorTheme)
      })
    }
  }, [isAppPage, theme, setTheme])

  useEffect(() => {
    if (!isAppPage) return
    
    const body = document.body
    const colorThemes = ["blue", "green", "purple", "orange", "azalea", "pink", "crimson"]
    
    colorThemes.forEach((colorTheme) => {
      body.classList.remove(colorTheme)
    })
    
    if (theme && colorThemes.includes(theme)) {
      body.classList.add(theme)
    }
  }, [theme, isAppPage])

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
        } catch (e) {
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
    if (!isAppPage && ["blue", "green", "purple", "orange", "azalea", "pink", "crimson"].includes(newTheme)) {
      setTheme("system")
    } else {
      setTheme(newTheme)
    }
  }

  const getEffectiveTheme = () => {
    if (!isAppPage && ["green", "orange", "azalea", "pink", "crimson"].includes(theme || "")) {
      return "system"
    }
    return theme || "system"
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <SettingsIcon className="h-5 w-5" />
          <span className="sr-only">Settings</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="h-full flex flex-col min-h-0">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>{t.settings}</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 pr-4 min-h-0">
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="theme">{t.theme}</Label>
              <Select value={getEffectiveTheme()} onValueChange={handleThemeChange}>
                <SelectTrigger id="theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t.themeLight}</SelectItem>
                  <SelectItem value="dark">{t.themeDark}</SelectItem>
                  {isAppPage && (
                    <>
                      <SelectItem value="green">{t.themeGreen}</SelectItem>
                      <SelectItem value="orange">{t.themeOrange}</SelectItem>
                      <SelectItem value="azalea">{t.themeAzalea}</SelectItem>
                      <SelectItem value="pink">{t.themePink}</SelectItem>
                      <SelectItem value="crimson">{t.themeCrimson}</SelectItem>
                    </>
                  )}
                  <SelectItem value="system">{t.themeSystem}</SelectItem>
                </SelectContent>
              </Select>
              {!isAppPage && (
                <p className="text-xs text-muted-foreground">
                  {t.themeColorOnlyApp}
                </p>
              )}
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

            {/*<div className="space-y-2">
              <Label htmlFor="notification-sound">{t.notificationSound}</Label>
              <div className="flex gap-2">
                <Select
                  value={notificationSound}
                  onValueChange={(value: keyof typeof NOTIFICATION_SOUNDS) => setNotificationSound(value)}
                >
                  <SelectTrigger id="notification-sound" className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="telegram">{t.telegramSound}</SelectItem>
                    <SelectItem value="telegramSfx">{t.telegramSfxSound}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>*/}

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
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
                  }
