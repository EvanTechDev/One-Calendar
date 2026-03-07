"use client"

import * as React from "react"
import * as ReactDayPicker from "react-day-picker"
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

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
    "h-[var(--cell-size)] w-[var(--cell-size)] p-0 select-none aria-disabled:opacity-50"
  )

  const dayButtonClass = cn(
    buttonVariants({ variant: "ghost" }),
    "relative isolate z-10 flex aspect-square size-auto w-full min-w-[var(--cell-size)] flex-col gap-1 border-0 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50 data-[range-end=true]:rounded-[var(--cell-radius)] data-[range-end=true]:rounded-r-[var(--cell-radius)] data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-muted data-[range-middle=true]:text-foreground data-[range-start=true]:rounded-[var(--cell-radius)] data-[range-start=true]:rounded-l-[var(--cell-radius)] data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground dark:hover:text-foreground [&>span]:text-xs [&>span]:opacity-70"
  )

  return (
    <ReactDayPicker.DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "group/calendar bg-background p-2 [--cell-radius:var(--radius-md)] [--cell-size:1.75rem] in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent",
        String.raw`rtl:**:[.rdp-nav_button_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-nav_button_previous>svg]:rotate-180`,
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
      classNames={{
        // v8 keys (currently used by this repo)
        months: cn("relative flex flex-col gap-4 md:flex-row", defaultClassNames.months),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        caption: cn(
          "flex h-[var(--cell-size)] w-full items-center justify-center px-[var(--cell-size)]",
          defaultClassNames.caption
        ),
        caption_label: cn(
          "font-medium select-none",
          captionLayout === "label"
            ? "text-sm"
            : "cn-calendar-caption-label flex items-center gap-1 rounded-[var(--cell-radius)] text-sm [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:text-muted-foreground",
          defaultClassNames.caption_label
        ),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaultClassNames.nav
        ),
        nav_button: cn(navButtonClass, defaultClassNames.nav_button),
        nav_button_previous: cn(defaultClassNames.nav_button_previous),
        nav_button_next: cn(defaultClassNames.nav_button_next),
        table: cn("w-full border-collapse", defaultClassNames.table),
        head_row: cn("flex", defaultClassNames.head_row),
        head_cell: cn(
          "flex-1 rounded-[var(--cell-radius)] text-[0.8rem] font-normal text-muted-foreground select-none",
          defaultClassNames.head_cell
        ),
        row: cn("mt-2 flex w-full", defaultClassNames.row),
        cell: cn(
          "group/day relative aspect-square h-full w-full rounded-[var(--cell-radius)] p-0 text-center select-none [&:last-child[data-selected=true]_button]:rounded-r-[var(--cell-radius)]",
          props.showWeekNumber
            ? "[&:nth-child(2)[data-selected=true]_button]:rounded-l-[var(--cell-radius)]"
            : "[&:first-child[data-selected=true]_button]:rounded-l-[var(--cell-radius)]",
          defaultClassNames.cell
        ),
        day: cn(dayButtonClass, defaultClassNames.day),
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today:
          "rounded-[var(--cell-radius)] bg-muted text-foreground data-[selected=true]:rounded-none",
        day_outside:
          "text-muted-foreground aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_hidden: "invisible",
        day_range_start:
          "relative isolate z-0 rounded-l-[var(--cell-radius)] bg-muted after:absolute after:inset-y-0 after:right-0 after:w-4 after:bg-muted",
        day_range_middle: "rounded-none",
        day_range_end:
          "relative isolate z-0 rounded-r-[var(--cell-radius)] bg-muted after:absolute after:inset-y-0 after:left-0 after:w-4 after:bg-muted",
        weeknumber_header: cn("w-[var(--cell-size)] select-none", defaultClassNames.weeknumber_header),
        weeknumber: cn(
          "text-[0.8rem] text-muted-foreground select-none",
          defaultClassNames.weeknumber
        ),

        // v9+ keys (for forward compatibility)
        root: cn("w-fit", defaultClassNames.root),
        month_caption: cn(
          "flex h-[var(--cell-size)] w-full items-center justify-center px-[var(--cell-size)]",
          defaultClassNames.month_caption
        ),
        button_previous: cn(navButtonClass, defaultClassNames.button_previous),
        button_next: cn(navButtonClass, defaultClassNames.button_next),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "flex-1 rounded-[var(--cell-radius)] text-[0.8rem] font-normal text-muted-foreground select-none",
          defaultClassNames.weekday
        ),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        day_button: cn(dayButtonClass, defaultClassNames.day_button),
        range_start: cn(
          "relative isolate z-0 rounded-l-[var(--cell-radius)] bg-muted after:absolute after:inset-y-0 after:right-0 after:w-4 after:bg-muted",
          defaultClassNames.range_start
        ),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn(
          "relative isolate z-0 rounded-r-[var(--cell-radius)] bg-muted after:absolute after:inset-y-0 after:left-0 after:w-4 after:bg-muted",
          defaultClassNames.range_end
        ),
        today: cn(
          "rounded-[var(--cell-radius)] bg-muted text-foreground data-[selected=true]:rounded-none",
          defaultClassNames.today
        ),
        outside: cn("text-muted-foreground aria-selected:text-muted-foreground", defaultClassNames.outside),
        disabled: cn("text-muted-foreground opacity-50", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        week_number_header: cn("w-[var(--cell-size)] select-none", defaultClassNames.week_number_header),
        week_number: cn(
          "text-[0.8rem] text-muted-foreground select-none",
          defaultClassNames.week_number
        ),

        ...classNames,
      } as DayPickerProps["classNames"]}
      components={{
        Chevron: ({ className, orientation, ...iconProps }: any) => {
          if (orientation === "left") {
            return <ChevronLeftIcon className={cn("cn-rtl-flip h-4 w-4", className)} {...iconProps} />
          }

          if (orientation === "right") {
            return <ChevronRightIcon className={cn("cn-rtl-flip h-4 w-4", className)} {...iconProps} />
          }

          return <ChevronDownIcon className={cn("h-4 w-4", className)} {...iconProps} />
        },
        DayButton: (dayButtonProps: any) => (
          <CalendarDayButton locale={locale as CalendarLocale | undefined} {...dayButtonProps} />
        ),
        WeekNumber: ({ children, ...weekProps }: any) => {
          return (
            <td {...weekProps}>
              <div className="flex h-[var(--cell-size)] w-[var(--cell-size)] items-center justify-center text-center">
                {children}
              </div>
            </td>
          )
        },
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
        "relative isolate z-10 flex aspect-square size-auto w-full min-w-[var(--cell-size)] flex-col gap-1 border-0 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50 data-[range-end=true]:rounded-[var(--cell-radius)] data-[range-end=true]:rounded-r-[var(--cell-radius)] data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-muted data-[range-middle=true]:text-foreground data-[range-start=true]:rounded-[var(--cell-radius)] data-[range-start=true]:rounded-l-[var(--cell-radius)] data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground dark:hover:text-foreground [&>span]:text-xs [&>span]:opacity-70",
        className
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
