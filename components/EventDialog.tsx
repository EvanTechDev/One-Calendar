"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { format } from "date-fns"
import type { CalendarEvent } from "./Calendar"
import { cn } from "@/lib/utils"
import { translations, type Language } from "@/lib/i18n"
import { useCalendar } from "@/contexts/CalendarContext"

const colorOptions = [
  { value: "bg-blue-500", label: "Blue" },
  { value: "bg-green-500", label: "Green" },
  { value: "bg-yellow-500", label: "Yellow" },
  { value: "bg-red-500", label: "Red" },
  { value: "bg-purple-500", label: "Purple" },
  { value: "bg-pink-500", label: "Pink" },
]

interface EventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onEventAdd: (event: CalendarEvent) => void
  onEventUpdate: (event: CalendarEvent) => void
  onEventDelete: (eventId: string) => void
  initialDate: Date
  event: CalendarEvent | null
  language: Language
  timezone: string
}

export default function EventDialog({
  open,
  onOpenChange,
  onEventAdd,
  onEventUpdate,
  onEventDelete,
  initialDate,
  event,
  language,
  timezone,
}: EventDialogProps) {
  // 使用 Context 中的日历分类数据
  const { calendars } = useCalendar()

  const [title, setTitle] = useState("")
  const [isAllDay, setIsAllDay] = useState(false)
  const [startDate, setStartDate] = useState(initialDate)
  const [endDate, setEndDate] = useState(initialDate)
  const [location, setLocation] = useState("")
  const [participants, setParticipants] = useState("")
  const [notification, setNotification] = useState("0")
  const [customNotificationTime, setCustomNotificationTime] = useState("10")
  const [description, setDescription] = useState("")
  const [color, setColor] = useState(colorOptions[0].value)
  const [selectedCalendar, setSelectedCalendar] = useState(calendars[0]?.id || "")

  // 添加调试日志
  console.log("EventDialog render - event:", event, "initialDate:", initialDate)

  const t = translations[language]

  // 每次对话框打开时重置表单
  useEffect(() => {
    if (open) {
      if (event) {
        // 编辑现有事件
        setTitle(event.title)
        setIsAllDay(event.isAllDay)
        setStartDate(new Date(event.startDate))
        setEndDate(new Date(event.endDate))
        setLocation(event.location || "")
        setParticipants(event.participants.join(", "))

        // 修复notification undefined问题
        if (event.notification !== undefined) {
          // 处理通知时间
          if (
            event.notification > 0 &&
            event.notification !== 5 &&
            event.notification !== 15 &&
            event.notification !== 30 &&
            event.notification !== 60
          ) {
            setNotification("custom")
            setCustomNotificationTime(event.notification.toString())
          } else {
            setNotification(event.notification.toString())
          }
        } else {
          // 如果notification未定义，设置默认值
          setNotification("0")
        }

        setDescription(event.description || "")
        setColor(event.color)
        setSelectedCalendar(event.calendarId || (calendars.length > 0 ? calendars[0]?.id : ""))
      } else {
        // 创建新事件
        resetForm()

        // 如果有初始日期，使用它设置开始和结束时间
        if (initialDate) {
          const endTime = new Date(initialDate.getTime() + 30 * 60000) // 30分钟后结束
          setStartDate(initialDate)
          setEndDate(endTime)
        }
      }
    }
  }, [event, calendars, initialDate, open])

  const resetForm = () => {
    const now = new Date()
    const thirtyMinutesLater = new Date(now.getTime() + 30 * 60000)
    setTitle("")
    setIsAllDay(false)
    setStartDate(now)
    setEndDate(thirtyMinutesLater)
    setLocation("")
    setParticipants("")
    setNotification("0")
    setCustomNotificationTime("10")
    setDescription("")
    setColor(colorOptions[0].value)
    setSelectedCalendar(calendars.length > 0 ? calendars[0]?.id : "")
  }

  const handleStartDateChange = (newStartDate: Date) => {
    setStartDate(newStartDate)
    // 修改为30分钟后结束
    const newEndDate = new Date(newStartDate.getTime() + 30 * 60000)
    if (newEndDate > endDate) {
      setEndDate(newEndDate)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Form submitted")

    // Determine the actual notification time in minutes
    let notificationMinutes = Number.parseInt(notification)
    if (notification === "custom") {
      notificationMinutes = Number.parseInt(customNotificationTime)
    }

    // Ensure we have valid dates
    const validStartDate = startDate instanceof Date && !isNaN(startDate.getTime()) ? startDate : new Date()

    const validEndDate =
      endDate instanceof Date && !isNaN(endDate.getTime()) ? endDate : new Date(validStartDate.getTime() + 30 * 60000)

    // Create the event data object
    const eventData: CalendarEvent = {
      id: event?.id || Date.now().toString() + Math.random().toString(36).substring(2, 9),
      title: title.trim() || (language === "zh" ? "未命名事件" : "Untitled Event"),
      isAllDay,
      startDate: validStartDate,
      endDate: validEndDate,
      recurrence: "none",
      location,
      participants: participants
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
      notification: notificationMinutes,
      description,
      color,
      calendarId: selectedCalendar || (calendars.length > 0 ? calendars[0]?.id : "1"),
    }

    // Call the appropriate handler based on whether we're editing or creating
    if (event) {
      console.log("Updating event:", eventData)
      onEventUpdate(eventData)
    } else {
      console.log("Adding new event:", eventData)
      onEventAdd(eventData)
    }

    // Close the dialog
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{event ? t.update : t.createEvent}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pb-6">
          <div>
            <Label htmlFor="title">{t.title}</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="all-day"
              checked={isAllDay}
              onCheckedChange={(checked) => {
                const isChecked = checked as boolean
                setIsAllDay(isChecked)

                if (isChecked) {
                  // If checked, set start time to beginning of day and end time to end of day
                  const startOfDay = new Date(startDate)
                  startOfDay.setHours(0, 0, 0, 0)

                  const endOfDay = new Date(startDate)
                  endOfDay.setHours(23, 59, 59, 999)

                  setStartDate(startOfDay)
                  setEndDate(endOfDay)
                }
              }}
            />
            <Label htmlFor="all-day">{t.allDay}</Label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start-date">{t.startTime}</Label>
              <Input
                id="start-date"
                type="datetime-local"
                value={format(startDate, "yyyy-MM-dd'T'HH:mm")}
                onChange={(e) => handleStartDateChange(new Date(e.target.value))}
                required
              />
            </div>
            <div>
              <Label htmlFor="end-date">{t.endTime}</Label>
              <Input
                id="end-date"
                type="datetime-local"
                value={format(endDate, "yyyy-MM-dd'T'HH:mm")}
                onChange={(e) => {
                  const newEndDate = new Date(e.target.value)
                  if (newEndDate > startDate) {
                    setEndDate(newEndDate)
                  } else {
                    alert(t.endTimeError)
                  }
                }}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="calendar">{t.calendar}</Label>
            <Select value={selectedCalendar} onValueChange={setSelectedCalendar}>
              <SelectTrigger>
                <SelectValue placeholder={t.selectCalendar} />
              </SelectTrigger>
              <SelectContent>
                {calendars.map((calendar) => (
                  <SelectItem key={calendar.id} value={calendar.id}>
                    <div className="flex items-center">
                      <div className={cn("w-4 h-4 rounded-full mr-2", calendar.color)} />
                      {calendar.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="color">{t.color}</Label>
            <Select value={color} onValueChange={setColor}>
              <SelectTrigger>
                <SelectValue placeholder={t.selectColor} />
              </SelectTrigger>
              <SelectContent>
                {colorOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center">
                      <div className={cn("w-4 h-4 rounded-full mr-2", option.value)} />
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="location">{t.location}</Label>
            <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="participants">{t.participants}</Label>
            <Input
              id="participants"
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              placeholder={t.participantsPlaceholder}
            />
          </div>

          <div>
            <Label htmlFor="notification">{t.notification}</Label>
            <Select value={notification} onValueChange={setNotification}>
              <SelectTrigger>
                <SelectValue placeholder={t.selectNotification} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">{t.atEventTime}</SelectItem>
                <SelectItem value="5">{t.minutesBefore.replace("{minutes}", "5")}</SelectItem>
                <SelectItem value="15">{t.minutesBefore.replace("{minutes}", "15")}</SelectItem>
                <SelectItem value="30">{t.minutesBefore.replace("{minutes}", "30")}</SelectItem>
                <SelectItem value="60">{t.hourBefore.replace("{hours}", "1")}</SelectItem>
                <SelectItem value="custom">{t.customTime}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {notification === "custom" && (
            <div>
              <Label htmlFor="custom-notification-time">{t.customTimeMinutes}</Label>
              <Input
                id="custom-notification-time"
                type="number"
                min="1"
                value={customNotificationTime}
                onChange={(e) => setCustomNotificationTime(e.target.value)}
                required
              />
            </div>
          )}

          <div>
            <Label htmlFor="description">{t.description}</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="flex justify-between">
            {event && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  onEventDelete(event.id)
                  onOpenChange(false)
                }}
              >
                {t.delete}
              </Button>
            )}
            <div className="flex space-x-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t.cancel}
              </Button>
              <Button type="submit">{event ? t.update : t.save}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

