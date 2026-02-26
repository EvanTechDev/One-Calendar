"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCalendar } from "@/components/providers/calendar-context"
import { translations, type Language } from "@/lib/i18n"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, X, Edit2 } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import Image from "next/image"

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
  onCollapseTransitionEnd?: () => void
}

export interface CalendarCategory {
  id: string
  name: string
  color: string
  keywords?: string[]
}

const CALENDAR_COLOR_OPTIONS = [
  { value: "bg-blue-500", hex: "#3b82f6", labelKey: "colorBlue" },
  { value: "bg-green-500", hex: "#10b981", labelKey: "colorGreen" },
  { value: "bg-yellow-500", hex: "#f59e0b", labelKey: "colorYellow" },
  { value: "bg-red-500", hex: "#ef4444", labelKey: "colorRed" },
  { value: "bg-purple-500", hex: "#8b5cf6", labelKey: "colorPurple" },
  { value: "bg-pink-500", hex: "#ec4899", labelKey: "colorPink" },
  { value: "bg-teal-500", hex: "#14b8a6", labelKey: "colorTeal" },
] as const

const CALENDAR_COLOR_MAP = Object.fromEntries(CALENDAR_COLOR_OPTIONS.map((option) => [option.value, option.hex]))

export default function Sidebar({
  onCreateEvent,
  onDateSelect,
  onViewChange,
  language = "zh-CN",
  selectedDate,
  isCollapsed = false,
  onToggleCollapse,
  selectedCategoryFilters = [],
  onCategoryFilterChange,
  onCollapseTransitionEnd,
}: SidebarProps) {

  const {
    calendars,
    events,
    setEvents,
    addCategory: addCategoryToContext,
    removeCategory: removeCategoryFromContext,
    updateCategory: updateCategoryInContext,
  } = useCalendar()

  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryColor, setNewCategoryColor] = useState("bg-blue-500")
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [localSelectedDate, setLocalSelectedDate] = useState<Date | undefined>(selectedDate || new Date())
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null)
  const [deleteCategoryEvents, setDeleteCategoryEvents] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState("")
  const [editingCategoryColor, setEditingCategoryColor] = useState("bg-blue-500")
  const t = translations[language || "zh-CN"]
  const weekdayNames = t.sidebarCalendarWeekdaysShort
  const monthNames = t.sidebarCalendarMonthsLong
  const monthYearTemplate = t.sidebarCalendarMonthYearFormat

  const formatCalendarCaption = (date: Date) => {
    const month = monthNames[date.getMonth()]
    const year = new Intl.NumberFormat(language, { useGrouping: false }).format(date.getFullYear())
    return monthYearTemplate.replace("{{month}}", month).replace("{{year}}", year)
  }

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
      setManageCategoriesOpen(false)
      toast(t.categoryAdded || "分类已添加", {
        description: `${t.categoryAddedDesc || "已成功添加"} "${newCategoryName}" ${t.category || "分类"}`,
      })
    }
  }

  const handleDeleteClick = (id: string) => {
    setCategoryToDelete(id)
    setDeleteCategoryEvents(false)
    setDeleteDialogOpen(true)
  }

  const handleEditClick = (id: string) => {
    const category = calendars.find((calendar) => calendar.id === id)
    if (!category) return
    setEditingCategoryId(id)
    setEditingCategoryName(category.name)
    setEditingCategoryColor(category.color)
    setEditDialogOpen(true)
  }

  const saveCategoryEdit = () => {
    if (!editingCategoryId || !editingCategoryName.trim()) return
    updateCategoryInContext(editingCategoryId, {
      name: editingCategoryName.trim(),
      color: editingCategoryColor,
    })
    setEditDialogOpen(false)
    setEditingCategoryId(null)
    toast(t.categoryUpdated || "分类已更新")
  }

  const confirmDelete = () => {
  if (categoryToDelete) {
    if (deleteCategoryEvents) {
      setEvents(events.filter((event) => event.calendarId !== categoryToDelete))
    }
    removeCategoryFromContext(categoryToDelete)
    toast(deleteText.toastSuccess, {
      description: deleteCategoryEvents ? t.categoryDeletedWithEvents : deleteText.toastDescription,
    })
  }
  setDeleteDialogOpen(false)
  setCategoryToDelete(null)
  setDeleteCategoryEvents(false)
}

  return (
    <div
      className={cn(
        "border-r bg-background overflow-y-auto transition-all duration-300 ease-in-out",
        isCollapsed ? "w-0 opacity-0 overflow-hidden" : "w-72 opacity-100",
      )}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && event.propertyName === "width") {
          onCollapseTransitionEnd?.()
        }
      }}
    >
      <div className="p-4">
        <div className="mb-4 flex items-center">
          <Image
            src="/icon.svg"
            alt="One Calendar"
            width={24}
            height={24}
            className="mr-2 brightness-0 dark:invert"
          />
          <h1 className="text-lg font-semibold">{t.oneCalendar}</h1>
        </div>

        <Button
          className="w-full justify-center bg-[#0066FF] text-white hover:bg-[#0052CC] mb-4 h-10 green:bg-[#24a854] orange:bg-[#e26912] azalea:bg-[#CD2F7B]"
          onClick={onCreateEvent}
        >
          {t.createEvent}
        </Button>

        <div className="mt-4">
          <Calendar
            mode="single"
            selected={localSelectedDate}
            formatters={{
              formatCaption: (date) => formatCalendarCaption(date),
              formatWeekdayName: (date) => weekdayNames[date.getDay()],
            }}
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
              <div className="flex items-center">
                <Button variant="ghost" size="sm" onClick={() => handleEditClick(calendar.id)}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(calendar.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
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
              <div className="mt-3 flex items-center space-x-2">
                <Checkbox
                  id="delete-category-events"
                  checked={deleteCategoryEvents}
                  onCheckedChange={(checked) => setDeleteCategoryEvents(checked === true)}
                />
                <Label htmlFor="delete-category-events">{t.deleteCategoryEvents}</Label>
              </div>
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
              <Label htmlFor="category-color">{t.color}</Label>
              <Select value={newCategoryColor} onValueChange={setNewCategoryColor}>
                <SelectTrigger id="category-color">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CALENDAR_COLOR_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center">
                        <div className={cn("w-4 h-4 rounded-full mr-2", option.value)} />
                        {t[option.labelKey]}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="justify-end">
            <Button variant="outline" onClick={() => setManageCategoriesOpen(false)}>{t.cancel}</Button>
            <Button onClick={addCategory} disabled={!newCategoryName}>
              <Plus className="mr-2 h-4 w-4" />
              {t.addCategory}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.editCategory}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-category-name">{t.categoryName}</Label>
              <Input
                id="edit-category-name"
                value={editingCategoryName}
                onChange={(e) => setEditingCategoryName(e.target.value)}
                placeholder={t.categoryName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-category-color">{t.color}</Label>
              <Select value={editingCategoryColor} onValueChange={setEditingCategoryColor}>
                <SelectTrigger id="edit-category-color">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CALENDAR_COLOR_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center">
                        <div className={cn("w-4 h-4 rounded-full mr-2", option.value)} />
                        {t[option.labelKey]}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>{t.cancel}</Button>
            <Button onClick={saveCategoryEdit} disabled={!editingCategoryName.trim()}>{t.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
