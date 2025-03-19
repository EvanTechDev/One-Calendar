"use client"

import { SettingsIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { translations, type Language } from "@/lib/i18n"
import type { NOTIFICATION_SOUNDS } from "@/utils/notifications"

interface SettingsProps {
  language: Language
  setLanguage: (lang: Language) => void
  firstDayOfWeek: number
  setFirstDayOfWeek: (day: number) => void
  timezone: string
  setTimezone: (timezone: string) => void
  notificationSound: keyof typeof NOTIFICATION_SOUNDS
  setNotificationSound: (sound: keyof typeof NOTIFICATION_SOUNDS) => void
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
}: SettingsProps) {
  const t = translations[language]

  // 获取list of timezones
  const timezones = Intl.supportedValuesOf("timeZone")

  // 移除测试通知声音的功能

  // 移除测试通知声音的函数
  // const testNotificationSound = (sound: keyof typeof NOTIFICATION_SOUNDS) => {
  //   playNotificationSound(sound)
  // }

  // 添加一个处理语言变化的函数
  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang)
    // 触发一个自定义事件，通知其他组件语言已更改
    window.dispatchEvent(new CustomEvent("languagechange", { detail: { language: newLang } }))
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <SettingsIcon className="h-5 w-5" />
          <span className="sr-only">Settings</span>
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t.settings}</SheetTitle>
        </SheetHeader>
        <div className="space-y-6 py-6">
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
            <Label htmlFor="timezone">{t.timezone}</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {timezones.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
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
        </div>
      </SheetContent>
    </Sheet>
  )
}
