import type { ReactNode } from 'react'
import { cn } from '@zntr/utils'

/** Shared preference layout: compact icon, summary, and a shrinkable control.
 * Keep the control track shrinkable and the row free of percentage widths:
 * Radix ScrollArea's table wrapper otherwise lets long selects overflow.
 */
export function SettingRow({
  icon,
  title,
  description,
  children,
  className,
}: {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-3 px-4 py-3', className)}>
      {icon ? (
        <span className="shrink-0 text-muted-foreground [&_svg]:size-4">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        {description ? (
          <span className="block truncate text-xs text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
      <div className="flex min-w-0 shrink basis-40 items-center justify-end gap-2 sm:basis-48">
        {children}
      </div>
    </div>
  )
}

export function SettingsGroup({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('divide-y rounded-lg border', className)}>
      {children}
    </div>
  )
}
