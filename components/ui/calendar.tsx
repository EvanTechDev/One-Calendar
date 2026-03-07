"use client"

import * as React from "react"
import * as ReactDayPicker from "react-day-picker"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"

type DayPickerProps = React.ComponentProps<typeof ReactDayPicker.DayPicker>
type CalendarLocale = { code?: string }

type CalendarProps = DayPickerProps & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  locale,
  formatters,
  components,
  ...props
}: CalendarProps) {
  const getDefaultClassNames =
    (ReactDayPicker as { getDefaultClassNames?: () => Record<string, string> })
      .getDefaultClassNames ?? (() => ({}))
  const defaultClassNames = getDefaultClassNames()

  const navButtonClass = cn(
    buttonVariants({ variant: buttonVariant }),
    "h-7 w-7 bg-transparent p-0 opacity-60 hover:opacity-100"
  )

  const dayButtonClass = cn(
    buttonVariants({ variant: "ghost" }),
    "h-8 w-8 p-0 font-normal aria-selected:opacity-100"
  )

  const composedClassNames = {
    // react-day-picker v8 keys
    months: cn("relative flex flex-col gap-4 md:flex-row", defaultClassNames.months),
    month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
    caption: cn("relative flex h-8 items-center justify-center", defaultClassNames.caption),
    caption_label: cn(
      "font-medium select-none",
      captionLayout === "label"
        ? "text-sm"
        : "flex items-center gap-1 rounded-md text-sm [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:text-muted-foreground",
      defaultClassNames.caption_label
    ),
    nav: cn("absolute inset-x-0 top-0 flex items-center justify-between", defaultClassNames.nav),
    nav_button: cn(navButtonClass, defaultClassNames.nav_button),
    nav_button_previous: cn("absolute left-0", defaultClassNames.nav_button_previous),
    nav_button_next: cn("absolute right-0", defaultClassNames.nav_button_next),
    table: cn("w-full border-collapse", defaultClassNames.table),
    head_row: cn("flex", defaultClassNames.head_row),
    head_cell: cn(
      "w-8 rounded-md text-[0.8rem] font-normal text-muted-foreground",
      defaultClassNames.head_cell
    ),
    row: cn("mt-2 flex w-full", defaultClassNames.row),
    cell: cn(
      "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
      props.mode === "range"
        ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
        : "[&:has([aria-selected])]:rounded-md",
      defaultClassNames.cell
    ),
    day: cn(dayButtonClass, defaultClassNames.day),
    day_selected:
      "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
    day_today: "bg-muted text-foreground",
    day_outside:
      "text-muted-foreground opacity-60 aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
    day_disabled: "text-muted-foreground opacity-50",
    day_range_start: "day-range-start",
    day_range_middle: "aria-selected:bg-muted aria-selected:text-foreground",
    day_range_end: "day-range-end",
    day_hidden: "invisible",
    weeknumber: "text-[0.8rem] text-muted-foreground",

    // react-day-picker v9+ keys (kept for forward compatibility)
    root: cn("w-fit", defaultClassNames.root),
    month_caption: cn("flex h-8 w-full items-center justify-center px-8", defaultClassNames.month_caption),
    button_previous: cn(navButtonClass, defaultClassNames.button_previous),
    button_next: cn(navButtonClass, defaultClassNames.button_next),
    weekdays: cn("flex", defaultClassNames.weekdays),
    weekday: cn(
      "flex-1 rounded-md text-[0.8rem] font-normal text-muted-foreground",
      defaultClassNames.weekday
    ),
    week: cn("mt-2 flex w-full", defaultClassNames.week),
    day_button: cn(dayButtonClass, defaultClassNames.day_button),
    range_start: cn("bg-muted", defaultClassNames.range_start),
    range_middle: cn("bg-muted", defaultClassNames.range_middle),
    range_end: cn("bg-muted", defaultClassNames.range_end),
    outside: cn("text-muted-foreground opacity-60", defaultClassNames.outside),
    disabled: cn("text-muted-foreground opacity-50", defaultClassNames.disabled),
    hidden: cn("invisible", defaultClassNames.hidden),

    ...classNames,
  }

  return (
    <ReactDayPicker.DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "w-fit p-2 bg-background in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent",
        className
      )}
      captionLayout={captionLayout}
      locale={locale}
      formatters={{
        formatMonthDropdown: (date: Date) =>
          date.toLocaleString((locale as CalendarLocale | undefined)?.code, {
            month: "short",
          }),
        ...formatters,
      }}
      classNames={composedClassNames as DayPickerProps["classNames"]}
      components={{
        Chevron: ({ className, orientation, ...iconProps }: any) => {
          if (orientation === "left") {
            return <ChevronLeftIcon className={cn("h-4 w-4", className)} {...iconProps} />
          }
          if (orientation === "right") {
            return <ChevronRightIcon className={cn("h-4 w-4", className)} {...iconProps} />
          }
          return <ChevronDownIcon className={cn("h-4 w-4", className)} {...iconProps} />
        },
        DayButton: (dayButtonProps: any) => (
          <CalendarDayButton locale={locale as CalendarLocale | undefined} {...dayButtonProps} />
        ),
        IconLeft: ({ className, ...iconProps }: any) => (
          <ChevronLeftIcon className={cn("h-4 w-4", className)} {...iconProps} />
        ),
        IconRight: ({ className, ...iconProps }: any) => (
          <ChevronRightIcon className={cn("h-4 w-4", className)} {...iconProps} />
        ),
        ...components,
      } as DayPickerProps["components"]}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  locale,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  day?: { date: Date }
  modifiers?: Record<string, boolean>
  locale?: CalendarLocale
}) {
  const ref = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (modifiers?.focused) ref.current?.focus()
  }, [modifiers?.focused])

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day?.date?.toLocaleDateString(locale?.code)}
      data-selected-single={
        modifiers?.selected &&
        !modifiers?.range_start &&
        !modifiers?.range_end &&
        !modifiers?.range_middle
      }
      data-range-start={modifiers?.range_start}
      data-range-end={modifiers?.range_end}
      data-range-middle={modifiers?.range_middle}
      className={cn(
        "h-8 w-8 p-0 font-normal aria-selected:opacity-100",
        className
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
