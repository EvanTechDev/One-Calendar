"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Download, Upload, CalendarIcon, ExternalLink, AlertCircle } from "lucide-react"
import type { CalendarEvent } from "../Calendar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { translations, useLanguage } from "@/lib/i18n"

interface ImportExportProps {
  events: CalendarEvent[]
  onImportEvents: (events: CalendarEvent[]) => void
}

export default function ImportExport({ events, onImportEvents }: ImportExportProps) {
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState("ics")
  const [importTab, setImportTab] = useState("file")
  const [importUrl, setImportUrl] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [includeCompleted, setIncludeCompleted] = useState(true)
  const [dateRangeOption, setDateRangeOption] = useState("all")
  const [isLoading, setIsLoading] = useState(false)
  const [debugMode, setDebugMode] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string>("")
  const [language] = useLanguage() // 使用useLanguage钩子
  const t = translations[language]
  // 添加一个状态来强制组件重新渲染
  const [forceUpdate, setForceUpdate] = useState(0)

  // 监听语言变化事件
  useEffect(() => {
    const handleLanguageChange = () => {
      // 强制组件重新渲染
      setForceUpdate((prev) => prev + 1)
    }

    window.addEventListener("languagechange", handleLanguageChange)
    return () => {
      window.removeEventListener("languagechange", handleLanguageChange)
    }
  }, [])

  const handleExport = async () => {
    try {
      setIsLoading(true)

      // Filter events based on options
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

      // Convert events to appropriate format
      if (exportFormat === "ics") {
        // Create iCalendar format
        const icsContent = generateICSFile(filteredEvents)
        downloadFile(icsContent, "calendar-export.ics", "text/calendar")
      } else if (exportFormat === "json") {
        // Export as JSON
        const jsonContent = JSON.stringify(filteredEvents, null, 2)
        downloadFile(jsonContent, "calendar-export.json", "application/json")
      } else if (exportFormat === "csv") {
        // Export as CSV
        const csvContent = generateCSV(filteredEvents)
        downloadFile(csvContent, "calendar-export.csv", "text/csv")
      }

      toast(t.exportSuccess.replace("{count}", filteredEvents.length.toString()), {
        description: `${filteredEvents.length} ${t.events || "events"}`,
      })

      setExportDialogOpen(false)
    } catch (error) {
      toast(t.exportError, {
        description: t.exportError,
        variant: "destructive",
      })
      console.error("Export error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleImport = async () => {
    try {
      setIsLoading(true)
      setDebugInfo("")
      let importedEvents: CalendarEvent[] = []
      let rawContent = ""

      if (importTab === "file" && selectedFile) {
        // Parse file content based on extension
        const fileExt = selectedFile.name.split(".").pop()?.toLowerCase()
        rawContent = await selectedFile.text()

        if (fileExt === "ics") {
          importedEvents = parseICS(rawContent)
        } else if (fileExt === "json") {
          importedEvents = JSON.parse(rawContent)
        } else if (fileExt === "csv") {
          importedEvents = parseCSV(rawContent)
        } else {
          throw new Error(t.unsupportedFormat || "Unsupported file format")
        }
      } else if (importTab === "url" && importUrl) {
        // Fetch from URL and parse
        const response = await fetch(importUrl)
        rawContent = await response.text()

        if (importUrl.endsWith(".ics")) {
          importedEvents = parseICS(rawContent)
        } else if (importUrl.endsWith(".json")) {
          importedEvents = JSON.parse(rawContent)
        } else {
          throw new Error(t.unsupportedUrlFormat || "Unsupported URL format")
        }
      }

      if (debugMode) {
        setDebugInfo(`${t.parsedEvents || "Parsed"} ${importedEvents.length} ${t.events || "events"}

${t.rawContentPreview || "Raw content preview"}:
${rawContent.substring(0, 500)}...`)
      }

      if (importedEvents.length === 0) {
        toast(t.importWarning, {
          description: t.importWarning,
          variant: "destructive",
        })
        return
      }

      onImportEvents(importedEvents)

      toast(t.importSuccess.replace("{count}", importedEvents.length.toString()), {
        description: `${importedEvents.length} ${t.events || "events"}`,
      });

      if (!debugMode) {
        setImportDialogOpen(false)
      }
      if (debugMode && importedEvents.length > 0) {
        const firstEvent = importedEvents[0]
        setDebugInfo(`${t.parsedEvents || "Parsed"} ${importedEvents.length} ${t.events || "events"}

First event details:
Title: ${firstEvent.title}
Start: ${new Date(firstEvent.startDate).toLocaleString()} (Local)
End: ${new Date(firstEvent.endDate).toLocaleString()} (Local)
UTC Start: ${new Date(firstEvent.startDate).toUTCString()}
UTC End: ${new Date(firstEvent.endDate).toUTCString()}

${t.rawContentPreview || "Raw content preview"}:
${rawContent.substring(0, 500)}...`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t.unknownError || "Unknown error"
      toast(t.importError.replace("{error}", errorMessage), {
        description: errorMessage,
        variant: "destructive",
      })
      console.error("Import error:", error)

      if (debugMode) {
        setDebugInfo(`${t.importError}: ${errorMessage}`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const generateICSFile = (events: CalendarEvent[]): string => {
    let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//One Calendar//NONSGML v1.0//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
`

    // 修改格式化日期的函数，确保使用UTC时间
    const formatDate = (date: Date) => {
      // 转换为UTC时间
      const utcYear = date.getUTCFullYear()
      const utcMonth = String(date.getUTCMonth() + 1).padStart(2, "0")
      const utcDay = String(date.getUTCDate()).padStart(2, "0")
      const utcHours = String(date.getUTCHours()).padStart(2, "0")
      const utcMinutes = String(date.getUTCMinutes()).padStart(2, "0")
      const utcSeconds = String(date.getUTCSeconds()).padStart(2, "0")

      // 返回UTC格式的日期字符串
      return `${utcYear}${utcMonth}${utcDay}T${utcHours}${utcMinutes}${utcSeconds}Z`
    }

    events.forEach((event) => {
      const startDate = new Date(event.startDate)
      const endDate = new Date(event.endDate)

      // Format dates for ICS format

      icsContent += `BEGIN:VEVENT
UID:${event.id}
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${event.title}
${event.description ? `DESCRIPTION:${event.description.replace(/\n/g, "\\n")}` : ""}
${event.location ? `LOCATION:${event.location}` : ""}
END:VEVENT
`
    })

    icsContent += "END:VCALENDAR"
    return icsContent
  }

  const generateCSV = (events: CalendarEvent[]): string => {
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

  const parseICS = (icsContent: string): CalendarEvent[] => {
    const events: CalendarEvent[] = []
    const lines = icsContent.split(/\r\n|\n|\r/)

    let currentEvent: Partial<CalendarEvent> = {}
    let inEvent = false
    const continuationLine = ""

    // 预处理：处理折叠行（长行被分成多行，后续行以空格或制表符开头）
    const processedLines: string[] = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.startsWith(" ") || line.startsWith("\t")) {
        // 这是一个折叠行，附加到前一行
        if (processedLines.length > 0) {
          processedLines[processedLines.length - 1] += line.substring(1)
        }
      } else {
        processedLines.push(line)
      }
    }

    for (const line of processedLines) {
      if (line.startsWith("BEGIN:VEVENT")) {
        currentEvent = {
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
          title: t.unnamedEvent || "Unnamed Event",
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
          // 确保结束时间不早于开始时间
          if (!currentEvent.endDate || new Date(currentEvent.endDate) < new Date(currentEvent.startDate)) {
            currentEvent.endDate = new Date(new Date(currentEvent.startDate).getTime() + 60 * 60 * 1000) // 默认1小时
          }

          events.push(currentEvent as CalendarEvent)
        }
        currentEvent = {}
        inEvent = false
      } else if (inEvent) {
        // 解析事件属性
        const colonIndex = line.indexOf(":")
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex)
          const value = line.substring(colonIndex + 1)

          // 处理带参数的属性（如 DTSTART;TZID=America/New_York:20230101T120000）
          const [mainKey, ...params] = key.split(";")

          switch (mainKey) {
            case "SUMMARY":
              currentEvent.title = value
              break
            case "DESCRIPTION":
              currentEvent.description = value.replace(/\\n/g, "\n").replace(/\\,/g, ",")
              break
            case "LOCATION":
              currentEvent.location = value
              break
            case "UID":
              currentEvent.id = value
              break
            case "DTSTART":
              try {
                // 检查是否有时区参数
                const hasTimeZone = params.some((p) => p.startsWith("TZID="))
                const isAllDay = !value.includes("T")

                currentEvent.startDate = parseICSDate(value, hasTimeZone)
                currentEvent.isAllDay = isAllDay
              } catch (e) {
                console.error("Error parsing DTSTART:", value, e)
              }
              break
            case "DTEND":
              try {
                const hasTimeZone = params.some((p) => p.startsWith("TZID="))
                currentEvent.endDate = parseICSDate(value, hasTimeZone)
              } catch (e) {
                console.error("Error parsing DTEND:", value, e)
              }
              break
            case "RRULE":
              // 处理重复规则
              if (value.includes("FREQ=DAILY")) {
                currentEvent.recurrence = "daily"
              } else if (value.includes("FREQ=WEEKLY")) {
                currentEvent.recurrence = "weekly"
              } else if (value.includes("FREQ=MONTHLY")) {
                currentEvent.recurrence = "monthly"
              } else if (value.includes("FREQ=YEARLY")) {
                currentEvent.recurrence = "yearly"
              }
              break
          }
        }
      }
    }

    return events
  }

  // 改进的ICS日期解析函数
  const parseICSDate = (dateString: string, hasTimeZone: boolean): Date => {
    // 处理不同格式的日期
    // 1. 基本格式：20230101T120000Z (UTC时间)
    // 2. 没有T的格式（全天事件）：20230101
    // 3. 带时区的格式：20230101T120000 或 20230101T120000+0800

    let year,
      month,
      day,
      hour = 0,
      minute = 0,
      second = 0

    // 检查是否有时区偏移信息
    const hasOffset = dateString.includes("+") || (dateString.includes("-") && dateString.indexOf("-") > 8)
    const isUTC = dateString.endsWith("Z")

    if (dateString.includes("T")) {
      // 有时间部分
      let datePart, timePart

      if (hasOffset) {
        // 处理带有明确时区偏移的格式 (如 20230101T120000+0800)
        const offsetIndex = Math.max(dateString.lastIndexOf("+"), dateString.lastIndexOf("-"))
        datePart = dateString.substring(0, dateString.indexOf("T"))
        timePart = dateString.substring(dateString.indexOf("T") + 1, offsetIndex)

        // 解析日期和时间
        year = Number.parseInt(datePart.substring(0, 4), 10)
        month = Number.parseInt(datePart.substring(4, 6), 10) - 1 // JavaScript月份从0开始
        day = Number.parseInt(datePart.substring(6, 8), 10)

        if (timePart.length >= 6) {
          hour = Number.parseInt(timePart.substring(0, 2), 10)
          minute = Number.parseInt(timePart.substring(2, 4), 10)
          second = Number.parseInt(timePart.substring(4, 6), 10)
        }

        // 创建日期对象，使用本地时间
        const date = new Date(year, month, day, hour, minute, second)

        // 解析时区偏移
        const offsetStr = dateString.substring(offsetIndex)
        const offsetSign = offsetStr.charAt(0) === "+" ? 1 : -1
        const offsetHours = Number.parseInt(offsetStr.substring(1, 3), 10)
        const offsetMinutes = Number.parseInt(offsetStr.substring(3, 5), 10)
        const totalOffsetMinutes = offsetSign * (offsetHours * 60 + offsetMinutes)

        // 调整时间以考虑时区偏移
        const userTimezoneOffset = date.getTimezoneOffset()
        date.setMinutes(date.getMinutes() + userTimezoneOffset + totalOffsetMinutes)

        return date
      } else if (isUTC) {
        // 处理UTC时间 (Z结尾)
        datePart = dateString.split("T")[0]
        timePart = dateString.split("T")[1].replace("Z", "")

        year = Number.parseInt(datePart.substring(0, 4), 10)
        month = Number.parseInt(datePart.substring(4, 6), 10) - 1
        day = Number.parseInt(datePart.substring(6, 8), 10)

        if (timePart.length >= 6) {
          hour = Number.parseInt(timePart.substring(0, 2), 10)
          minute = Number.parseInt(timePart.substring(2, 4), 10)
          second = Number.parseInt(timePart.substring(4, 6), 10)
        }

        // 创建UTC日期
        return new Date(Date.UTC(year, month, day, hour, minute, second))
      } else {
        // 处理没有明确时区的时间，假定为本地时间
        datePart = dateString.split("T")[0]
        timePart = dateString.split("T")[1]

        year = Number.parseInt(datePart.substring(0, 4), 10)
        month = Number.parseInt(datePart.substring(4, 6), 10) - 1
        day = Number.parseInt(datePart.substring(6, 8), 10)

        if (timePart.length >= 6) {
          hour = Number.parseInt(timePart.substring(0, 2), 10)
          minute = Number.parseInt(timePart.substring(2, 4), 10)
          second = Number.parseInt(timePart.substring(4, 6), 10)
        }

        // 创建本地日期
        return new Date(year, month, day, hour, minute, second)
      }
    } else {
      // 只有日期部分（全天事件）
      year = Number.parseInt(dateString.substring(0, 4), 10)
      month = Number.parseInt(dateString.substring(4, 6), 10) - 1
      day = Number.parseInt(dateString.substring(6, 8), 10)

      // 创建本地日期
      return new Date(year, month, day)
    }
  }

  const parseCSV = (csvContent: string): CalendarEvent[] => {
    const lines = csvContent.split("\n")
    if (lines.length < 2) return [] // 至少需要标题行和一行数据

    const headers = parseCSVLine(lines[0])

    const events: CalendarEvent[] = []

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue

      const values = parseCSVLine(lines[i])

      if (values.length >= 2) {
        const titleIndex = headers.findIndex((h) => h.toLowerCase().includes("title"))
        const startDateIndex = headers.findIndex((h) => h.toLowerCase().includes("start"))
        const endDateIndex = headers.findIndex((h) => h.toLowerCase().includes("end"))
        const locationIndex = headers.findIndex((h) => h.toLowerCase().includes("location"))
        const descriptionIndex = headers.findIndex((h) => h.toLowerCase().includes("description"))
        const colorIndex = headers.findIndex((h) => h.toLowerCase().includes("color"))

        const title =
          titleIndex >= 0 && titleIndex < values.length ? values[titleIndex] : t.unnamedEvent || "Unnamed Event"
        const startDate =
          startDateIndex >= 0 && startDateIndex < values.length ? new Date(values[startDateIndex]) : new Date()
        let endDate =
          endDateIndex >= 0 && endDateIndex < values.length
            ? new Date(values[endDateIndex])
            : new Date(startDate.getTime() + 60 * 60 * 1000)

        // 确保结束时间不早于开始时间
        if (endDate < startDate) {
          endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
        }

        events.push({
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
          title,
          startDate,
          endDate,
          isAllDay: false,
          recurrence: "none",
          location: locationIndex >= 0 && locationIndex < values.length ? values[locationIndex] : undefined,
          participants: [],
          notification: 0,
          description: descriptionIndex >= 0 && descriptionIndex < values.length ? values[descriptionIndex] : undefined,
          color: colorIndex >= 0 && colorIndex < values.length ? values[colorIndex] : "bg-blue-500",
          calendarId: "1",
        })
      }
    }

    return events
  }

  const parseCSVLine = (line: string): string[] => {
    const result = []
    let insideQuotes = false
    let currentValue = ""

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"') {
        if (i < line.length - 1 && line[i + 1] === '"') {
          // 处理转义的引号
          currentValue += '"'
          i++
        } else {
          insideQuotes = !insideQuotes
        }
      } else if (char === "," && !insideQuotes) {
        result.push(currentValue.trim())
        currentValue = ""
      } else {
        currentValue += char
      }
    }

    result.push(currentValue.trim())
    return result
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
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>{t.importExport}</CardTitle>
            <CardDescription>{t.importExportDesc || "Exchange data with other calendar applications"}</CardDescription>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              {t.importCalendar}
            </Button>
            <Button onClick={() => setExportDialogOpen(true)}>
              <Download className="mr-2 h-4 w-4" />
              {t.exportCalendar}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t.googleCalendarGuide}</AlertTitle>
            <AlertDescription>{t.googleCalendarGuideText}</AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center space-y-2">
                  <CalendarIcon className="h-8 w-8 text-blue-500" />
                  <h3 className="font-medium">{t.iCalendarFormat}</h3>
                  <p className="text-sm text-muted-foreground">{t.iCalendarFormatDesc}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center space-y-2">
                  <Download className="h-8 w-8 text-green-500" />
                  <h3 className="font-medium">{t.backupData}</h3>
                  <p className="text-sm text-muted-foreground">{t.backupDataDesc}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center space-y-2">
                  <ExternalLink className="h-8 w-8 text-purple-500" />
                  <h3 className="font-medium">{t.crossPlatformSync}</h3>
                  <p className="text-sm text-muted-foreground">{t.crossPlatformSyncDesc}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-2">{t.importExportTips}</h3>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              <li>{t.tip1}</li>
              <li>{t.tip2}</li>
              <li>{t.tip3}</li>
              <li>{t.tip4}</li>
              <li>{t.tip5}</li>
            </ul>
          </div>
        </div>
      </CardContent>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.importCalendar}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="file" value={importTab} onValueChange={setImportTab}>
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="file">{t.fileImport}</TabsTrigger>
              <TabsTrigger value="url">{t.urlImport}</TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="calendar-file">{t.selectCalendarFile}</Label>
                <Input
                  id="calendar-file"
                  type="file"
                  accept=".ics,.json,.csv"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
                <p className="text-xs text-muted-foreground">{t.supportedFormats}</p>
              </div>

              <Alert variant="outline">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{t.googleCalendarGuideText}</AlertDescription>
              </Alert>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="debug-mode"
                  checked={debugMode}
                  onCheckedChange={(checked) => setDebugMode(checked as boolean)}
                />
                <Label htmlFor="debug-mode">{t.debugMode}</Label>
              </div>
            </TabsContent>

            <TabsContent value="url" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="calendar-url">{t.calendarUrl}</Label>
                <Input
                  id="calendar-url"
                  type="url"
                  placeholder="https://example.com/calendar.ics"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t.enterUrl}</p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="debug-mode-url"
                  checked={debugMode}
                  onCheckedChange={(checked) => setDebugMode(checked as boolean)}
                />
                <Label htmlFor="debug-mode-url">{t.debugMode}</Label>
              </div>
            </TabsContent>
          </Tabs>

          {debugInfo && (
            <div className="mt-4 p-2 bg-gray-100 dark:bg-gray-800 rounded-md">
              <h4 className="font-medium mb-1">{t.debugInfo}</h4>
              <pre className="text-xs overflow-auto max-h-40 whitespace-pre-wrap">{debugInfo}</pre>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              {t.cancel}
            </Button>
            <Button onClick={handleImport} disabled={isLoading}>
              {isLoading ? t.importing : t.import}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.exportCalendar}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="export-format">{t.exportFormat}</Label>
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
              <Label htmlFor="date-range">{t.dateRange}</Label>
              <Select value={dateRangeOption} onValueChange={setDateRangeOption}>
                <SelectTrigger id="date-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.allEvents}</SelectItem>
                  <SelectItem value="future">{t.futureEvents}</SelectItem>
                  <SelectItem value="past">{t.pastEvents}</SelectItem>
                  <SelectItem value="30days">{t.last30Days}</SelectItem>
                  <SelectItem value="90days">{t.last90Days}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-completed"
                checked={includeCompleted}
                onCheckedChange={(checked) => setIncludeCompleted(checked as boolean)}
              />
              <Label htmlFor="include-completed">{t.includeCompleted}</Label>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
              {t.cancel}
            </Button>
            <Button onClick={handleExport} disabled={isLoading}>
              {isLoading ? t.exporting : t.export}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

