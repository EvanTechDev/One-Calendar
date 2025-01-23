"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"

const colorOptions = [
  { value: "#4f46e5", label: "靛蓝" },
  { value: "#0891b2", label: "青色" },
  { value: "#059669", label: "绿色" },
  { value: "#ca8a04", label: "黄色" },
  { value: "#dc2626", label: "红色" },
  { value: "#9333ea", label: "紫色" },
  { value: "#be185d", label: "粉色" },
]

interface EventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onEventAdd: (event: CalendarEvent) => void
  onEventUpdate: (event: CalendarEvent) => void
  onEventDelete: (eventId: string) => void
  initialDate: Date | null
  event: CalendarEvent | null
}

export default function EventDialog({
  open,
  onOpenChange,
  onEventAdd,
  onEventUpdate,
  onEventDelete,
  initialDate,
  event,
}: EventDialogProps) {
  const [title, setTitle] = useState("")
  const [isAllDay, setIsAllDay] = useState(false)
  const [startDate, setStartDate] = useState(initialDate || new Date())
  const [endDate, setEndDate] = useState(initialDate || new Date())
  const [recurrence, setRecurrence] = useState<"none" | "daily" | "weekly" | "monthly" | "yearly">("none")
  const [location, setLocation] = useState("")
  const [participants, setParticipants] = useState("")
  const [notification, setNotification] = useState("0")
  const [description, setDescription] = useState("")
  const [color, setColor] = useState(colorOptions[0].value)

  useEffect(() => {
    if (event) {
      setTitle(event.title)
      setIsAllDay(event.isAllDay)
      setStartDate(new Date(event.startDate))
      setEndDate(new Date(event.endDate))
      setRecurrence(event.recurrence)
      setLocation(event.location || "")
      setParticipants(event.participants.join(", "))
      setNotification(event.notification.toString())
      setDescription(event.description || "")
      setColor(event.color)
    } else {
      resetForm()
    }
  }, [event])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const eventData = {
      id: event?.id || Date.now().toString(),
      title,
      isAllDay,
      startDate,
      endDate,
      recurrence,
      location,
      participants: participants.split(",").map((p) => p.trim()),
      notification: Number.parseInt(notification),
      description,
      color,
    }

    if (event) {
      onEventUpdate(eventData)
    } else {
      onEventAdd(eventData)
    }
    resetForm()
  }

  const resetForm = () => {
    setTitle("")
    setIsAllDay(false)
    setStartDate(initialDate || new Date())
    setEndDate(initialDate || new Date())
    setRecurrence("none")
    setLocation("")
    setParticipants("")
    setNotification("0")
    setDescription("")
    setColor(colorOptions[0].value)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{event ? "编辑日程" : "添加新日程"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input placeholder="标题" value={title} onChange={(e) => setTitle(e.target.value)} required />

          <div className="flex items-center space-x-2">
            <Checkbox id="all-day" checked={isAllDay} onCheckedChange={(checked) => setIsAllDay(checked as boolean)} />
            <label htmlFor="all-day">全天事件</label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              type="datetime-local"
              value={format(startDate, "yyyy-MM-dd'T'HH:mm")}
              onChange={(e) => setStartDate(new Date(e.target.value))}
              required
            />
            <Input
              type="datetime-local"
              value={format(endDate, "yyyy-MM-dd'T'HH:mm")}
              onChange={(e) => setEndDate(new Date(e.target.value))}
              required
            />
          </div>

          <Select value={color} onValueChange={setColor}>
            <SelectTrigger>
              <SelectValue placeholder="选择颜色" />
            </SelectTrigger>
            <SelectContent>
              {colorOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: option.value }} />
                    {option.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={recurrence} onValueChange={(value: any) => setRecurrence(value)}>
            <SelectTrigger>
              <SelectValue placeholder="重复" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">不重复</SelectItem>
              <SelectItem value="daily">每天</SelectItem>
              <SelectItem value="weekly">每周</SelectItem>
              <SelectItem value="monthly">每月</SelectItem>
              <SelectItem value="yearly">每年</SelectItem>
            </SelectContent>
          </Select>

          <Input placeholder="地点" value={location} onChange={(e) => setLocation(e.target.value)} />

          <Input
            placeholder="参与者 (用逗号分隔)"
            value={participants}
            onChange={(e) => setParticipants(e.target.value)}
          />

          <Select value={notification} onValueChange={setNotification}>
            <SelectTrigger>
              <SelectValue placeholder="提醒时间" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">事件开始时</SelectItem>
              <SelectItem value="5">5分钟前</SelectItem>
              <SelectItem value="15">15分钟前</SelectItem>
              <SelectItem value="30">30分钟前</SelectItem>
              <SelectItem value="60">1小时前</SelectItem>
            </SelectContent>
          </Select>

          <Textarea placeholder="描述" value={description} onChange={(e) => setDescription(e.target.value)} />

          <div className="flex justify-between">
            <div>
              {event && (
                <Button type="button" variant="destructive" onClick={() => onEventDelete(event.id)}>
                  删除
                </Button>
              )}
            </div>
            <div className="flex space-x-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="submit">{event ? "更新" : "保存"}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

