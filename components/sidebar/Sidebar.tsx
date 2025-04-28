"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Plus, ChevronDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { translations } from "@/lib/i18n"
import { useCalendar } from "@/components/context/CalendarContext"
import { CalendarIcon } from "lucide-react"

interface SidebarProps {
  onCreateEvent: () => void
  onDateSelect: (date: Date) => void
  onViewChange?: (view: string) => void
  language?: Language
  selectedDate?: Date
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

export type Language = "en" | "zh"

export interface CalendarCategory {
  id: string
  name: string
  color: string
  keywords?: string[]
}

export default function Sidebar({
  onCreateEvent,
  onDateSelect,
  onViewChange,
  language = "zh",
  selectedDate,
  isCollapsed = false,
  onToggleCollapse,
}: SidebarProps) {

  const { calendars, addCategory: addCategoryToContext, removeCategory: removeCategoryFromContext } = useCalendar()

  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryColor, setNewCategoryColor] = useState("bg-blue-500")
  const [showAddCategory, setShowAddCategory] = useState(false)
  // 使用传入的selectedDate，如果没有则使用当前日期
  const [localSelectedDate, setLocalSelectedDate] = useState<Date | undefined>(selectedDate || new Date())
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false)
  const t = translations[language || "zh"]

  // 当外部selectedDate变化时，更新本地状态
  if (selectedDate && (!localSelectedDate || selectedDate.getTime() !== localSelectedDate.getTime())) {
    setLocalSelectedDate(selectedDate)
  }

  const addCategory = () => {
    if (newCategoryName.trim()) {
      const newCategory: CalendarCategory = {
        id: Date.now().toString(),
        name: newCategoryName.trim(),
        color: newCategoryColor,
        keywords: [],
      }
      addCategoryToContext(newCategory)
      setNewCategoryName("")
      setNewCategoryColor("bg-blue-500")
      setShowAddCategory(false)
      toast({
        title: "分类已添加",
        description: `已成功添加"${newCategoryName}"分类`,
      })
    }
  }

  const removeCategory = (id: string) => {
    removeCategoryFromContext(id)
    toast({
      title: "分类已删除",
      description: "已成功删除分类",
    })
  }

  return (
    <div className={cn(
      "border-r bg-background overflow-y-auto transition-all duration-300 ease-in-out",
      isCollapsed ? "w-0 opacity-0 overflow-hidden" : "w-72 opacity-100"
    )}>
      <div className="p-4">
        <div className="flex items-center mb-4">
          <CalendarIcon className="h-6 w-6 text-[#0066ff] mr-2" />
          <h1 className="text-lg font-semibold">{t.oneCalendar}</h1>
        </div>

        <Button
          className="w-full justify-center bg-[#0066FF] text-white hover:bg-[#0052CC] mb-4 h-10"
          onClick={onCreateEvent}
        >
          {t.createEvent}
        </Button>

        <div className="mt-4">
          <Calendar
            mode="single"
            selected={localSelectedDate}
            onSelect={(date) => {
              setLocalSelectedDate(date)
              date && onDateSelect(date)
            }}
            className="rounded-md border"
          />
        </div>

        <div className="mt-8 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t.myCalendars}</span>
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
                placeholder={t.categoryName || "新日历名称"}
                className="text-sm"
              />
              <Button size="sm" onClick={addCategory}>
                {t.addCategory || "添加"}
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={() => setManageCategoriesOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t.addNewCalendar}
            </Button>
          )}
        </div>
      </div>
      <Dialog open={manageCategoriesOpen} onOpenChange={setManageCategoriesOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.manageCategories}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">{t.categoryName}</Label>
              <Input
                id="category-name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="输入分类名称"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.color}</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  "blue-500",
                  "green-500",
                  "purple-500",
                  "yellow-500",
                  "red-500",
                  "pink-500",
                  "indigo-500",
                  "orange-500",
                  "teal-500",
                ].map((color) => (
                  <div
                    key={color}
                    className={cn(
                      `bg-${color} w-6 h-6 rounded-full cursor-pointer`,
                      newCategoryColor === `bg-${color}` ? "ring-2 ring-offset-2 ring-black" : "",
                    )}
                    onClick={() => setNewCategoryColor(`bg-${color}`)}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
            <Button onClick={addCategory} disabled={!newCategoryName}>
              <Plus className="mr-2 h-4 w-4" />
              {t.addCategory}
            </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

