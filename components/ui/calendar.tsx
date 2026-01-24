"use client"

import * as React from "react"
import { DayPicker, getDefaultClassNames, type ClassNames } from "react-day-picker"
import "react-day-picker/dist/style.css"
import { cn } from "@/lib/utils"

export interface CalendarProps {
  selected?: Date
  onSelect?: (date: Date | undefined) => void
  className?: string
}

export function Calendar({ selected, onSelect, className }: CalendarProps) {
  const defaultClassNames = getDefaultClassNames()

  const classNames: ClassNames = {
    ...defaultClassNames,
    months: "flex flex-col space-y-4",
    month: "space-y-4",
    caption: "flex justify-center pt-1 relative items-center",
    caption_label: "text-sm font-medium",
    nav: "space-x-1 flex items-center",
    nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
    nav_button_previous: "absolute left-1",
    nav_button_next: "absolute right-1",
    table: "w-full border-collapse space-y-1",
    head_row: "flex",
    head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
    row: "flex w-full mt-2",
    cell: "h-9 w-9 text-center text-sm p-0 relative",
    day: cn("h-9 w-9 p-0 font-normal aria-selected:opacity-100"),
    day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
    day_today: "bg-accent text-accent-foreground",
    day_outside: "text-muted-foreground opacity-50",
    day_disabled: "text-muted-foreground opacity-50",
    day_hidden: "invisible",
  }

  return (
    <DayPicker
      mode="single"
      selected={selected}
      onSelect={onSelect}
      className={cn("p-3", className)}
      classNames={classNames}
    />
  )
}
