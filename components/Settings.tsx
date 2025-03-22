"use client"

import { SettingsIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { translations, type Language } from "@/lib/i18n"
import type { NOTIFICATION_SOUNDS } from "@/utils/notifications"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { useState } from "react"
import { toast } from "@/components/ui/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Download } from "lucide-react"

interface SettingsProps {
  language: Language
  setLanguage: (lang: Language) => void
  firstDayOfWeek: number
  setFirstDayOfWeek: (day: number) => void
  timezone: string
  setTimezone: (timezone: string) => void
  notificationSound: keyof typeof NOTIFICATION_SOUNDS
  setNotificationSound: (sound: keyof typeof NOTIFICATION_SOUNDS) => void
  events?: any[] // 添加事件数据
  onImportEvents?: (events: any[]) => void // 添加导入事件回调
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
  events = [],
  onImportEvents = () => {},
}: SettingsProps) {
  const t = translations[language]
  const timezones = Intl.supportedValuesOf("timeZone")

  // 导入导出状态
  const [activeTab, setActiveTab] = useState("general")
  const [importTab, setImportTab] = useState("file")
  const [exportFormat, setExportFormat] = useState("ics")
  const [dateRangeOption, setDateRangeOption] = useState("all")
  const [includeCompleted, setIncludeCompleted] = useState(true)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importUrl, setImportUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // 添加一个处理语言变化的函数
  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang)
    // 触发一个自定义事件，通知其他组件语言已更改
    window.dispatchEvent(new CustomEvent("languagechange", { detail: { language: newLang } }))
  }

  // 导入事件处理
  const handleImport = async () => {
    try {
      setIsLoading(true)
      let importedEvents: any[] = []
      let rawContent = ""

      if (importTab === "file" && selectedFile) {
        // 解析文件内容
        const fileExt = selectedFile.name.split(".").pop()?.toLowerCase()
        rawContent = await selectedFile.text()

        if (fileExt === "ics") {
          // 解析ICS文件
          importedEvents = parseICS(rawContent)
        } else if (fileExt === "json") {
          // 解析JSON文件
          importedEvents = JSON.parse(rawContent)
        } else if (fileExt === "csv") {
          // 解析CSV文件
          importedEvents = parseCSV(rawContent)
        } else {
          throw new Error(language === "zh" ? "不支持的文件格式" : "Unsupported file format")
        }
      } else if (importTab === "url" && importUrl) {
        // 从URL获取并解析
        const response = await fetch(importUrl)
        rawContent = await response.text()

        if (importUrl.endsWith(".ics")) {
          importedEvents = parseICS(rawContent)
        } else if (importUrl.endsWith(".json")) {
          importedEvents = JSON.parse(rawContent)
        } else {
          throw new Error(language === "zh" ? "不支持的URL格式" : "Unsupported URL format")
        }
      }

      if (importedEvents.length === 0) {
        toast({
          title: language === "zh" ? "导入警告" : "Import Warning",
          description: language === "zh" ? "未能从文件中解析出任何事件" : "No events could be parsed from the file",
          variant: "destructive",
        })
        return
      }

      onImportEvents(importedEvents)

      toast({
        title: language === "zh" ? "导入成功" : "Import Success",
        description: `${language === "zh" ? "成功导入" : "Successfully imported"} ${importedEvents.length} ${language === "zh" ? "个事件" : "events"}`,
      })

      // 重置表单
      setSelectedFile(null)
      setImportUrl("")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : language === "zh" ? "未知错误" : "Unknown error"
      toast({
        title: language === "zh" ? "导入错误" : "Import Error",
        description: errorMessage,
        variant: "destructive",
      })
      console.error("Import error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // 导出事件处理
  const handleExport = async () => {
    try {
      setIsLoading(true)

      // 根据选项过滤事件
      let filteredEvents = [...events]

      if (dateRangeOption === "future") {
        const now = new Date()
        filteredEvents = filteredEvents.filter((event) => new Date(event.startDate) >= now)
      } else if (dateRangeOption === "past") {
        const now = new Date()
        filteredEvents = filteredEvents.filter((event) => new Date(event.startDate) < now)
      } else if (dateRangeOption === "30days") {
        const now = new Date()
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        filteredEvents = filteredEvents.filter(
          (event) => new Date(event.startDate) >= thirtyDaysAgo && new Date(event.startDate) <= now,
        )
      } else if (dateRangeOption === "90days") {
        const now = new Date()
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        filteredEvents = filteredEvents.filter(
          (event) => new Date(event.startDate) >= ninetyDaysAgo && new Date(event.startDate) <= now,
        )
      }

      // 转换为适当的格式
      if (exportFormat === "ics") {
        // 创建iCalendar格式
        const icsContent = generateICSFile(filteredEvents)
        downloadFile(icsContent, "calendar-export.ics", "text/calendar")
      } else if (exportFormat === "json") {
        // 导出为JSON
        const jsonContent = JSON.stringify(filteredEvents, null, 2)
        downloadFile(jsonContent, "calendar-export.json", "application/json")
      } else if (exportFormat === "csv") {
        // 导出为CSV
        const csvContent = generateCSV(filteredEvents)
        downloadFile(csvContent, "calendar-export.csv", "text/csv")
      }

      toast({
        title: language === "zh" ? "导出成功" : "Export Success",
        description: `${language === "zh" ? "成功导出" : "Successfully exported"} ${filteredEvents.length} ${language === "zh" ? "个事件" : "events"}`,
      })
    } catch (error) {
      toast({
        title: language === "zh" ? "导出错误" : "Export Error",
        description: language === "zh" ? "导出日历数据时出错" : "Error exporting calendar data",
        variant: "destructive",
      })
      console.error("Export error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // 辅助函数
  const parseICS = (icsContent: string): any[] => {
    const events: any[] = []
    const lines = icsContent.split(/\r\n|\n|\r/)
    let currentEvent: any = {}
    let inEvent = false

    for (const line of lines) {
      if (line.startsWith("BEGIN:VEVENT")) {
        currentEvent = {
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
          title: language === "zh" ? "未命名事件" : "Unnamed Event",
          isAllDay: false,
          recurrence: "none",
          participants: [],
          notification: 0,
          color: "bg-blue-500",
          calendarId: "1",
        }
        inEvent = true
      } else if (line.startsWith("END:VEVENT")) {
        if (inEvent && currentEvent.title && currentEvent.startDate) {
          if (!currentEvent.endDate || new Date(currentEvent.endDate) < new Date(currentEvent.startDate)) {
            currentEvent.endDate = new Date(new Date(currentEvent.startDate).getTime() + 60 * 60 * 1000)
          }
          events.push(currentEvent)
        }
        currentEvent = {}
        inEvent = false
      } else if (inEvent) {
        const colonIndex = line.indexOf(":")
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex)
          const value = line.substring(colonIndex + 1)

          const [mainKey] = key.split(";")

          switch (mainKey) {
            case "SUMMARY":
              currentEvent.title = value
              break
            case "DESCRIPTION":
              currentEvent.description = value
              break
            case "LOCATION":
              currentEvent.location = value
              break
            case "UID":
              currentEvent.id = value
              break
            case "DTSTART":
              try {
                currentEvent.startDate = new Date(value)
                currentEvent.isAllDay = !value.includes("T")
              } catch (e) {
                console.error("Error parsing DTSTART:", value, e)
              }
              break
            case "DTEND":
              try {
                currentEvent.endDate = new Date(value)
              } catch (e) {
                console.error("Error parsing DTEND:", value, e)
              }
              break
          }
        }
      }
    }

    return events
  }

  const parseCSV = (csvContent: string): any[] => {
    const lines = csvContent.split("\n")
    if (lines.length < 2) return []

    const headers = lines[0].split(",").map((h) => h.trim())
    const events: any[] = []

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue

      const values = lines[i].split(",").map((v) => v.trim())
      if (values.length >= 2) {
        const titleIndex = headers.findIndex((h) => h.toLowerCase().includes("title"))
        const startDateIndex = headers.findIndex((h) => h.toLowerCase().includes("start"))
        const endDateIndex = headers.findIndex((h) => h.toLowerCase().includes("end"))

        const title = titleIndex >= 0 ? values[titleIndex] : language === "zh" ? "未命名事件" : "Unnamed Event"
        const startDate = startDateIndex >= 0 ? new Date(values[startDateIndex]) : new Date()
        const endDate =
          endDateIndex >= 0
            ? new Date(startDate.getTime() + 60 * 60 * 1000)
            : new Date(startDate.getTime() + 60 * 60 * 1000)

        events.push({
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
          title,
          startDate,
          endDate,
          isAllDay: false,
          recurrence: "none",
          participants: [],
          notification: 15,
          color: "bg-blue-500",
          calendarId: "1",
        })
      }
    }

    return events
  }

  const generateICSFile = (events: any[]): string => {
    let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//One Calendar//NONSGML v1.0//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
`

    const formatDate = (date: Date) => {
      const utcYear = date.getUTCFullYear()
      const utcMonth = String(date.getUTCMonth() + 1).padStart(2, "0")
      const utcDay = String(date.getUTCDate()).padStart(2, "0")
      const utcHours = String(date.getUTCHours()).padStart(2, "0")
      const utcMinutes = String(date.getUTCMinutes()).padStart(2, "0")
      const utcSeconds = String(date.getUTCSeconds()).padStart(2, "0")

      return `${utcYear}${utcMonth}${utcDay}T${utcHours}${utcMinutes}${utcSeconds}Z`
    }

    events.forEach((event) => {
      const startDate = new Date(event.startDate)
      const endDate = new Date(event.endDate)

      icsContent += `BEGIN:VEVENT
UID:${event.id}
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${event.title}
${event.description ? `DESCRIPTION:${event.description}` : ""}
${event.location ? `LOCATION:${event.location}` : ""}
END:VEVENT
`
    })

    icsContent += "END:VCALENDAR"
    return icsContent
  }

  const generateCSV = (events: any[]): string => {
    const headers = ["Title", "Start Date", "End Date", "Location", "Description", "Color"]

    const rows = events.map((event) => [
      event.title,
      new Date(event.startDate).toISOString(),
      new Date(event.endDate).toISOString(),
      event.location || "",
      event.description || "",
      event.color,
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n")

    return csvContent
  }

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
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

        <Tabs defaultValue="general" value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="general">{language === "zh" ? "常规" : "General"}</TabsTrigger>
            <TabsTrigger value="importExport">{language === "zh" ? "导入导出" : "Import & Export"}</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6 py-4">
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
          </TabsContent>

          <TabsContent value="importExport" className="space-y-6 py-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{language === "zh" ? "Google日历导入指南" : "Google Calendar Import Guide"}</AlertTitle>
              <AlertDescription>
                {language === "zh"
                  ? "从Google日历导入时，请先在Google日历中选择\"设置 {'>'}  导入和导出 {'>'}  导出\"，下载.ics文件后在此处导入。"
                  : "When importing from Google Calendar, first select 'Settings > Import & Export > Export' in Google Calendar, download the .ics file and import it here."}
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-2">{language === "zh" ? "导入日历" : "Import Calendar"}</h3>\
                <Tabs defaultValue="file" value={importTab} onValueChange={setImportTab}>
                  <TabsList className="grid grid-cols-2 mb-4">
                    <TabsTrigger value="file">{language === "zh" ? "文件导入" : "File Import"}</TabsTrigger>
                    <TabsTrigger value="url">{language === "zh" ? "URL导入" : "URL Import"}</TabsTrigger>
                  </TabsList>

                  <TabsContent value="file" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="calendar-file">
                        {language === "zh" ? "选择日历文件" : "Select Calendar File"}
                      </Label>
                      <Input
                        id="calendar-file"
                        type="file"
                        accept=".ics,.json,.csv"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      />
                      <p className="text-xs text-muted-foreground">
                        {language === "zh"
                          ? "支持 .ics (iCalendar), .json 和 .csv 文件格式"
                          : "Supported formats: .ics (iCalendar), .json and .csv"}
                      </p>
                    </div>
                    <Button onClick={handleImport} disabled={!selectedFile || isLoading} className="w-full">
                      {isLoading
                        ? language === "zh"
                          ? "导入中..."
                          : "Importing..."
                        : language === "zh"
                          ? "导入"
                          : "Import"}
                    </Button>
                  </TabsContent>

                  <TabsContent value="url" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="calendar-url">{language === "zh" ? "日历URL" : "Calendar URL"}</Label>
                      <Input
                        id="calendar-url"
                        type="url"
                        placeholder="https://example.com/calendar.ics"
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        {language === "zh" ? "输入指向 .ics 或 .json 文件的URL" : "Enter URL to .ics or .json file"}
                      </p>
                    </div>
                    <Button onClick={handleImport} disabled={!importUrl || isLoading} className="w-full">
                      {isLoading
                        ? language === "zh"
                          ? "导入中..."
                          : "Importing..."
                        : language === "zh"
                          ? "导入"
                          : "Import"}
                    </Button>
                  </TabsContent>
                </Tabs>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">{language === "zh" ? "导出日历" : "Export Calendar"}</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="export-format">{language === "zh" ? "导出格式" : "Export Format"}</Label>
                    <Select value={exportFormat} onValueChange={setExportFormat}>
                      <SelectTrigger id="export-format">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ics">iCalendar (.ics)</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="csv">CSV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date-range">{language === "zh" ? "日期范围" : "Date Range"}</Label>
                    <Select value={dateRangeOption} onValueChange={setDateRangeOption}>
                      <SelectTrigger id="date-range">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{language === "zh" ? "所有事件" : "All Events"}</SelectItem>
                        <SelectItem value="future">{language === "zh" ? "未来事件" : "Future Events"}</SelectItem>
                        <SelectItem value="past">{language === "zh" ? "过去事件" : "Past Events"}</SelectItem>
                        <SelectItem value="30days">{language === "zh" ? "最近30天" : "Last 30 Days"}</SelectItem>
                        <SelectItem value="90days">{language === "zh" ? "最近90天" : "Last 90 Days"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-completed"
                      checked={includeCompleted}
                      onCheckedChange={(checked) => setIncludeCompleted(checked as boolean)}
                    />
                    <Label htmlFor="include-completed">
                      {language === "zh" ? "包含已完成的事件" : "Include Completed Events"}
                    </Label>
                  </div>

                  <Button onClick={handleExport} disabled={isLoading} className="w-full">
                    {isLoading
                      ? language === "zh"
                        ? "导出中..."
                        : "Exporting..."
                      : language === "zh"
                        ? "导出"
                        : "Export"}
                    <Download className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

