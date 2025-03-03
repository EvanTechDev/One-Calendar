"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Plus, ChevronDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLocalStorage } from "@/hooks/useLocalStorage"

interface SidebarProps {
  open: boolean
  onCreateEvent: () => void
  onDateSelect: (date: Date) => void
}

export interface CalendarCategory {
  id: string
  name: string
  color: string
}

export default function Sidebar({ open, onCreateEvent, onDateSelect }: SidebarProps) {
  const [calendars, setCalendars] = useLocalStorage<CalendarCategory[]>("calendar-categories", [
    { id: "1", name: "Personal", color: "bg-blue-500" },
    { id: "2", name: "Work", color: "bg-green-500" },
    { id: "3", name: "Family", color: "bg-yellow-500" },
  ])
  const [newCategoryName, setNewCategoryName] = useState("")
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())

  const addCategory = () => {
    if (newCategoryName.trim()) {
      const newCategory: CalendarCategory = {
        id: Date.now().toString(),
        name: newCategoryName.trim(),
        color: `bg-${["red", "green", "blue", "yellow", "purple", "pink"][Math.floor(Math.random() * 6)]}-500`,
      }
      setCalendars([...calendars, newCategory])
      setNewCategoryName("")
      setShowAddCategory(false)
    }
  }

  const removeCategory = (id: string) => {
    setCalendars(calendars.filter((cal) => cal.id !== id))
  }

  return (
    <div className={cn("w-80 border-r bg-background transition-all duration-300 overflow-y-auto", !open && "w-0")}>
      <div className="p-4">
        <Button
          className="w-full justify-start bg-[#0066FF] text-white hover:bg-[#0052CC] mb-4"
          onClick={onCreateEvent}
        >
          <Plus className="mr-2 h-4 w-4" />
          创建日程
        </Button>

        <div className="mt-4">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              setSelectedDate(date)
              date && onDateSelect(date)
            }}
            className="rounded-md border"
          />
        </div>

        <div className="mt-8 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">我的日历</span>
            <ChevronDown className="h-4 w-4" />
          </div>
          {calendars.map((calendar) => (
            <div key={calendar.id} className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={cn("h-3 w-3 rounded-sm", calendar.color)} />
                <span className="text-sm">{calendar.name}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeCategory(calendar.id)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {showAddCategory ? (
            <div className="flex items-center space-x-2">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="新日历名称"
                className="text-sm"
              />
              <Button size="sm" onClick={addCategory}>
                添加
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={() => setShowAddCategory(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              添加新日历
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
