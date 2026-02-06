"use client"

import * as React from "react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon } from "lucide-react"

type CalendarLocale = { code?: string }
type CalendarDayButtonProps = React.ComponentPropsWithoutRef<"button"> & {
  day: { date: Date }
  modifiers: Record<string, boolean>
  locale?: CalendarLocale
}

function getFallbackClassNames() {
  return {
    root: "",
    months: "",
    month: "",
    nav: "",
    button_previous: "",
    button_next: "",
    month_caption: "",
    dropdowns: "",
    dropdown_root: "",
    dropdown: "",
    caption_label: "",
    weekdays: "",
    weekday: "",
    week: "",
    week_number_header: "",
    week_number: "",
    day: "",
    range_start: "",
    range_middle: "",
    range_end: "",
    today: "",
    outside: "",
    disabled: "",
    hidden: "",
  }
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
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
}) {
  const defaultClassNames = getFallbackClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "p-2 [--cell-radius:var(--radius-md)] [--cell-size:1.75rem] bg-background group/calendar in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className,
      )}
      captionLayout={captionLayout as any}
      locale={locale as any}
      formatters={{
        formatMonthDropdown: (date: Date) => date.toLocaleString((locale as CalendarLocale | undefined)?.code, { month: "short" }),
        ...(formatters as any),
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("flex gap-4 flex-col md:flex-row relative", defaultClassNames.months),
        month: cn("flex flex-col w-full gap-4", defaultClassNames.month),
        nav: cn("flex items-center gap-1 w-full absolute top-0 inset-x-0 justify-between", defaultClassNames.nav),
        nav_button: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-7 w-7 bg-transparent p-0 opacity-80 hover:opacity-100",
        ),
        nav_button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-7 w-7 bg-transparent p-0 opacity-80 hover:opacity-100",
        ),
        nav_button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-7 w-7 bg-transparent p-0 opacity-80 hover:opacity-100",
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-[var(--cell-size)] aria-disabled:opacity-50 p-0 select-none",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-[var(--cell-size)] aria-disabled:opacity-50 p-0 select-none",
          defaultClassNames.button_next,
        ),
        month_caption: cn("flex items-center justify-center h-[var(--cell-size)] w-full px-[var(--cell-size)]", defaultClassNames.month_caption),
        dropdowns: cn(
          "w-full flex items-center text-sm font-medium justify-center h-[var(--cell-size)] gap-1.5",
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn("relative cn-calendar-dropdown-root rounded-[var(--cell-radius)]", defaultClassNames.dropdown_root),
        dropdown: cn("absolute bg-popover inset-0 opacity-0", defaultClassNames.dropdown),
        caption_label: cn(
          "select-none font-medium",
          captionLayout === "label"
            ? "text-sm"
            : "cn-calendar-caption-label rounded-[var(--cell-radius)] flex items-center gap-1 text-sm  [&>svg]:text-muted-foreground [&>svg]:size-3.5",
          defaultClassNames.caption_label,
        ),
        table: "w-full border-collapse",
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn("text-muted-foreground rounded-[var(--cell-radius)] flex-1 font-normal text-[0.8rem] select-none", defaultClassNames.weekday),
        week: cn("flex w-full mt-2", defaultClassNames.week),
        week_number_header: cn("select-none w-[var(--cell-size)]", defaultClassNames.week_number_header),
        week_number: cn("text-[0.8rem] select-none text-muted-foreground", defaultClassNames.week_number),
        day: cn(
          "relative w-full rounded-[var(--cell-radius)] h-full p-0 text-center [&:last-child[data-selected=true]_button]:rounded-r-[var(--cell-radius)] group/day aspect-square select-none",
          props.showWeekNumber
            ? "[&:nth-child(2)[data-selected=true]_button]:rounded-l-[var(--cell-radius)]"
            : "[&:first-child[data-selected=true]_button]:rounded-l-[var(--cell-radius)]",
          defaultClassNames.day,
        ),
        range_start: cn(
          "rounded-l-[var(--cell-radius)] bg-muted relative after:bg-muted after:absolute after:inset-y-0 after:w-4 after:right-0 z-0 isolate",
          defaultClassNames.range_start,
        ),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn(
          "rounded-r-[var(--cell-radius)] bg-muted relative after:bg-muted after:absolute after:inset-y-0 after:w-4 after:left-0 z-0 isolate",
          defaultClassNames.range_end,
        ),
        today: cn("bg-muted text-foreground rounded-[var(--cell-radius)] data-[selected=true]:rounded-none", defaultClassNames.today),
        outside: cn("text-muted-foreground aria-selected:text-muted-foreground", defaultClassNames.outside),
        disabled: cn("text-muted-foreground opacity-50", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...(classNames as any),
      }}
      components={{
        IconLeft: ({ className, ...iconProps }: any) => <ChevronLeftIcon className={cn("cn-rtl-flip size-4", className)} {...iconProps} />,
        IconRight: ({ className, ...iconProps }: any) => <ChevronRightIcon className={cn("cn-rtl-flip size-4", className)} {...iconProps} />,
        Chevron: ({ className, orientation, ...iconProps }: any) => {
          if (orientation === "left") return <ChevronLeftIcon className={cn("cn-rtl-flip size-4", className)} {...iconProps} />
          if (orientation === "right") return <ChevronRightIcon className={cn("cn-rtl-flip size-4", className)} {...iconProps} />
          return <ChevronDownIcon className={cn("size-4", className)} {...iconProps} />
        },
        DayButton: ({ ...buttonProps }: any) => <CalendarDayButton locale={locale as CalendarLocale | undefined} {...buttonProps} />,
        WeekNumber: ({ children, ...weekProps }: any) => (
          <td {...weekProps}>
            <div className="flex size-[var(--cell-size)] items-center justify-center text-center">{children}</div>
          </td>
        ),
        ...(components as any),
      } as any}
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
}: CalendarDayButtonProps) {
  const ref = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString(locale?.code)}
      data-selected-single={
        modifiers.selected && !modifiers.range_start && !modifiers.range_end && !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-middle=true]:bg-muted data-[range-middle=true]:text-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 dark:hover:text-foreground relative isolate z-10 flex aspect-square size-auto w-full min-w-[var(--cell-size)] flex-col gap-1 border-0 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] data-[range-end=true]:rounded-[var(--cell-radius)] data-[range-end=true]:rounded-r-[var(--cell-radius)] data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-[var(--cell-radius)] data-[range-start=true]:rounded-l-[var(--cell-radius)] [&>span]:text-xs [&>span]:opacity-70",
        className,
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
