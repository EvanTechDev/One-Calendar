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
import type { CalendarCategory } from "./Sidebar"
import { cn } from "@/lib/utils"

const colorOptions = [
  { value: "bg-blue-500", label: "蓝色" },
  { value: "bg-green-500", label: "绿色" },
  { value: "bg-yellow-500", label: "黄色" },
  { value: "bg-red-500", label: "红色" },
  { value: "bg-purple-500", label: "紫色" },
  { value: "bg-pink-500", label: "粉色" },
]

interface EventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onEventAdd: (event: CalendarEvent) => void
  onEventUpdate: (event: CalendarEvent) => void
  onEventDelete: (eventId: string) => void
  initialDate: Date
  event: CalendarEvent | null
  calendars: CalendarCategory[]
}

export default function EventDialog({
  open,
  onOpenChange,
  onEventAdd,
  onEventUpdate,
  onEventDelete,
  initialDate,
  event,
  calendars,
}: EventDialogProps) {
  const [title, setTitle] = useState("")
  const [isAllDay, setIsAllDay] = useState(false)
  const [startDate, setStartDate] = useState(initialDate)
  const [endDate, setEndDate] = useState(initialDate)
  const [location, setLocation] = useState("")
  const [participants, setParticipants] = useState("")
  const [notification, setNotification] = useState("0")
  const [description, setDescription] = useState("")
  const [color, setColor] = useState(colorOptions[0].value)
  const [selectedCalendar, setSelectedCalendar] = useState(calendars[0]?.id || "")

  useEffect(() => {
    if (event) {
      setTitle(event.title)
      setIsAllDay(event.isAllDay)
      setStartDate(new Date(event.startDate))
      setEndDate(new Date(event.endDate))
      setLocation(event.location || "")
      setParticipants(event.participants.join(", "))
      setNotification(event.notification.toString())
      setDescription(event.description || "")
      setColor(event.color)
      setSelectedCalendar(event?.calendarId || calendars[0]?.id || "")
    } else {
      resetForm()
    }
  }, [event, calendars])

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
    setDescription("")
    setColor(colorOptions[0].value)
    setSelectedCalendar(calendars[0]?.id || "")
  }

  const handleStartDateChange = (newStartDate: Date) => {
    setStartDate(newStartDate)
    const newEndDate = new Date(newStartDate.getTime() + 30 * 60000)
    if (newEndDate > endDate) {
      setEndDate(newEndDate)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const eventData: CalendarEvent = {
      id: event?.id || Date.now().toString(),
      title,
      isAllDay,
      startDate,
      endDate,
      recurrence: "none",
      location,
      participants: participants.split(",").map((p) => p.trim()),
      notification: Number.parseInt(notification),
      description,
      color,
      calendarId: selectedCalendar,
    }

    if (event) {
      onEventUpdate(eventData)
    } else {
      onEventAdd(eventData)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? "编辑日程" : "创建新日程"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pb-6">
          <div>
            <Label htmlFor="title">标题</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox id="all-day" checked={isAllDay} onCheckedChange={(checked) => setIsAllDay(checked as boolean)} />
            <Label htmlFor="all-day">全天事件</Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start-date">开始时间</Label>
              <Input
                id="start-date"
                type="datetime-local"
                value={format(startDate, "yyyy-MM-dd'T'HH:mm")}
                onChange={(e) => handleStartDateChange(new Date(e.target.value))}
                required
              />
            </div>
            <div>
              <Label htmlFor="end-date">结束时间</Label>
              <Input
                id="end-date"
                type="datetime-local"
                value={format(endDate, "yyyy-MM-dd'T'HH:mm")}
                onChange={(e) => {
                  const newEndDate = new Date(e.target.value)
                  if (newEndDate > startDate) {
                    setEndDate(newEndDate)
                  } else {
                    alert("结束时间不能早于开始时间")
                  }
                }}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="calendar">日历</Label>
            <Select value={selectedCalendar} onValueChange={setSelectedCalendar}>
              <SelectTrigger>
                <SelectValue placeholder="选择日历" />
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
            <Label htmlFor="color">颜色</Label>
            <Select value={color} onValueChange={setColor}>
              <SelectTrigger>
                <SelectValue placeholder="选择颜色" />
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
            <Label htmlFor="location">地点</Label>
            <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="participants">参与者</Label>
            <Input
              id="participants"
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              placeholder="用逗号分隔多个参与者"
            />
          </div>

          <div>
            <Label htmlFor="notification">提醒时间</Label>
            <Select value={notification} onValueChange={setNotification}>
              <SelectTrigger>
                <SelectValue placeholder="选择提醒时间" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">事件开始时</SelectItem>
                <SelectItem value="5">5分钟前</SelectItem>
                <SelectItem value="15">15分钟前</SelectItem>
                <SelectItem value="30">30分钟前</SelectItem>
                <SelectItem value="60">1小时前</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">描述</Label>
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
                删除
              </Button>
            )}
            <div className="flex space-x-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="submit">{event ? "更新" : "创建"}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
