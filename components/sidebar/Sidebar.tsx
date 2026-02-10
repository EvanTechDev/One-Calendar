"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { translations, type Language } from "@/lib/i18n"
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
  selectedCategoryFilters?: string[]
  onCategoryFilterChange?: (categoryId: string, checked: boolean) => void
}

export interface CalendarCategory {
  id: string
  name: string
  color: string
  keywords?: string[]
}

const CALENDAR_COLOR_OPTIONS = [
  { value: "bg-blue-500", hex: "#3b82f6" },
  { value: "bg-green-500", hex: "#10b981" },
  { value: "bg-yellow-500", hex: "#f59e0b" },
  { value: "bg-red-500", hex: "#ef4444" },
  { value: "bg-purple-500", hex: "#8b5cf6" },
  { value: "bg-pink-500", hex: "#ec4899" },
  { value: "bg-teal-500", hex: "#14b8a6" },
]

const CALENDAR_COLOR_MAP = Object.fromEntries(CALENDAR_COLOR_OPTIONS.map((option) => [option.value, option.hex]))

export default function Sidebar({
  onCreateEvent,
  onDateSelect,
  onViewChange,
  language = "zh",
  selectedDate,
  isCollapsed = false,
  onToggleCollapse,
  selectedCategoryFilters = [],
  onCategoryFilterChange,
}: SidebarProps) {

  const { calendars, addCategory: addCategoryToContext, removeCategory: removeCategoryFromContext } = useCalendar()

  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryColor, setNewCategoryColor] = useState("bg-blue-500")
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [localSelectedDate, setLocalSelectedDate] = useState<Date | undefined>(selectedDate || new Date())
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null)
  const t = translations[language || "zh"]

  const deleteText = {
    title: t.deleteConfirmationTitle,
    description: t.deleteConfirmationDescription,
    cancel: t.cancel,
    delete: t.delete,
    toastSuccess: t.categoryDeleted,
    toastDescription: t.categoryDeletedDescription,
  }
  
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
      toast(t.categoryAdded || "分类已添加", {
        description: `${t.categoryAddedDesc || "已成功添加"} "${newCategoryName}" ${t.category || "分类"}`,
      })
    }
  }

  const handleDeleteClick = (id: string) => {
    setCategoryToDelete(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
  if (categoryToDelete) {
    removeCategoryFromContext(categoryToDelete)
    toast(deleteText.toastSuccess, {
      description: deleteText.toastDescription,
    })
  }
  setDeleteDialogOpen(false)
  setCategoryToDelete(null)
}

  return (
    <div
      className={cn(
        "border-r bg-background overflow-y-auto transition-all duration-300 ease-in-out",
        isCollapsed ? "w-0 opacity-0 overflow-hidden" : "w-72 opacity-100",
      )}
    >
      <div className="p-4">
        <div className="flex items-center mb-4">
          <CalendarIcon className="h-6 w-6 text-[#0066ff] mr-2 green:text-[#24a854] orange:text-[#e26912] azalea:text-[#CD2F7B] pink:text-[#FFAFA5] crimson:text-[#9B0032]" />
          <h1 className="text-lg font-semibold">{t.oneCalendar}</h1>
        </div>

        <Button
          className="w-full justify-center bg-[#0066FF] text-white hover:bg-[#0052CC] mb-4 h-10 green:bg-[#24a854] orange:bg-[#e26912] azalea:bg-[#CD2F7B] pink:bg-[#FFAFA5] crimson:bg-[#9B0032]"
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
            className="rounded-lg border"
          />
        </div>

        <div className="mt-8 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t.myCalendars}</span>
          </div>
          {calendars.map((calendar) => (
            <div key={calendar.id} className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={selectedCategoryFilters.includes(calendar.id)}
                  onCheckedChange={(checked) => onCategoryFilterChange?.(calendar.id, checked === true)}
                  className="h-4 w-4 rounded-md border-0 data-[state=checked]:text-white"
                  style={{
                    backgroundColor: CALENDAR_COLOR_MAP[calendar.color] ?? "#3b82f6",
                  }}
                />
                <span className="text-sm">{calendar.name}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(calendar.id)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {calendars.length > 0 && (
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={selectedCategoryFilters.includes("__uncategorized__")}
                onCheckedChange={(checked) => onCategoryFilterChange?.("__uncategorized__", checked === true)}
                className="h-4 w-4 rounded-md border border-muted-foreground/60"
              />
              <span className="text-sm text-muted-foreground">{t.uncategorized}</span>
            </div>
          )}
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

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{deleteText.title}</DialogTitle>
            <DialogDescription>
              {deleteText.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {deleteText.cancel}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {deleteText.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manageCategoriesOpen} onOpenChange={setManageCategoriesOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.createCategories}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">{t.categoryName}</Label>
              <Input
                id="category-name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Name"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.color}</Label>
              <div className="flex flex-wrap gap-2">
                {CALENDAR_COLOR_OPTIONS.map((option) => (
                  <div
                    key={option.value}
                    className={cn(
                      option.value,
                      "w-6 h-6 rounded-full cursor-pointer",
                      newCategoryColor === option.value ? "ring-2 ring-offset-2 ring-black" : "",
                    )}
                    onClick={() => setNewCategoryColor(option.value)}
                  />
                ))}
              </div>
            </div>
            <div>
            <Button onClick={addCategory} disabled={!newCategoryName}>
              <Plus className="mr-2 h-4 w-4" />
              {t.addCategory}
            </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
