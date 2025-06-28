"use client"

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
import { useEffect } from "react"

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

  const isAppPage = pathname === '/app' || pathname?.startsWith('/app/')

  useEffect(() => {
    const body = document.body
    
    if (isAppPage) {
      body.classList.add('app')
    } else {
      body.classList.remove('app')
      if (theme && ['blue', 'green', 'purple', 'orange'].includes(theme)) {
        setTheme('system')
      }
    }

    return () => {
      body.classList.remove('app')
    }
  }, [isAppPage, theme, setTheme])

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
    if (!isAppPage && ['blue', 'green', 'purple', 'orange'].includes(newTheme)) {
      setTheme('system')
    } else {
      setTheme(newTheme)
    }
  }

  const getEffectiveTheme = () => {
    if (!isAppPage && ['blue', 'green', 'purple', 'orange'].includes(theme || '')) {
      return 'system'
    }
    return theme || 'system'
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <SettingsIcon className="h-5 w-5" />
          <span className="sr-only">Settings</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="h-full flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>{t.settings}</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="theme">{language === "zh" ? "主题" : "Theme"}</Label>
              <Select value={getEffectiveTheme()} onValueChange={handleThemeChange}>
                <SelectTrigger id="theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{language === "zh" ? "亮色" : "Light"}</SelectItem>
                  <SelectItem value="dark">{language === "zh" ? "暗色" : "Dark"}</SelectItem>
                  {isAppPage && (
                    <>
                      <SelectItem value="blue">{language === "zh" ? "蓝色" : "Blue"}</SelectItem>
                      <SelectItem value="green">{language === "zh" ? "绿色" : "Green"}</SelectItem>
                      <SelectItem value="purple">{language === "zh" ? "紫色" : "Purple"}</SelectItem>
                      <SelectItem value="orange">{language === "zh" ? "橙色" : "Orange"}</SelectItem>
                    </>
                  )}
                  <SelectItem value="system">{language === "zh" ? "系统" : "System"}</SelectItem>
                </SelectContent>
              </Select>
              {!isAppPage && (
                <p className="text-xs text-muted-foreground">
                  {language === "zh" ? "彩色主题仅在应用页面可用" : "Color themes are only available on the app page"}
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
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
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
              <Label htmlFor="default-view">{language === "zh" ? "默认视图" : "Default View"}</Label>
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

            <div className="space-y-2">
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
            </div>

            <div className="flex items-center space-x-2">
              <Switch id="enable-shortcuts" checked={enableShortcuts} onCheckedChange={setEnableShortcuts} />
              <Label htmlFor="enable-shortcuts">{language === "zh" ? "开启快捷键" : "Enable Keyboard Shortcuts"}</Label>
            </div>

            {enableShortcuts && (
              <div className="rounded-md border p-4">
                <h3 className="mb-2 font-medium">{language === "zh" ? "可用快捷键" : "Available Shortcuts"}</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>N - {language === "zh" ? "创建新事件" : "New Event"}</div>
                  <div>/ - {language === "zh" ? "搜索事件" : "Search Events"}</div>
                  <div>T - {language === "zh" ? "今天" : "Today"}</div>
                  <div>1 - {language === "zh" ? "日视图" : "Day View"}</div>
                  <div>2 - {language === "zh" ? "周视图" : "Week View"}</div>
                  <div>3 - {language === "zh" ? "月视图" : "Month View"}</div>
                  <div>→ - {language === "zh" ? "下个周期" : "Next Period"}</div>
                  <div>← - {language === "zh" ? "上个周期" : "Previous Period"}</div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
