import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@zntr/utils'

const markerVariants = cva(
  "group/marker relative flex min-h-4 w-full items-center gap-2 text-left text-sm text-muted-foreground [&_svg:not([class*='size-'])]:size-4 [a]:underline [a]:underline-offset-3 [a]:hover:text-foreground",
  {
    variants: {
      variant: {
        default: '',
        separator:
          'before:mr-1 before:h-px before:min-w-0 before:flex-1 before:bg-border after:ml-1 after:h-px after:min-w-0 after:flex-1 after:bg-border',
        border: 'border-b border-border pb-2',
      },
    },
  },
)

/**
 * Inline status row for transcripts and logs: an icon plus a short line,
 * optionally rendered as a separator or with a bottom border.
 *
 * Ported from the user-supplied shadcn component. The original rendered
 * through @base-ui/react's useRender for polymorphism; this repo does not
 * depend on base-ui, so it is a plain div — same classes, same slots.
 */
function Marker({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof markerVariants>) {
  return (
    <div
      data-slot="marker"
      data-variant={variant}
      className={cn(markerVariants({ variant, className }))}
      {...props}
    />
  )
}

function MarkerIcon({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="marker-icon"
      aria-hidden="true"
      className={cn(
        "size-4 shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  )
}

function MarkerContent({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="marker-content"
      className={cn(
        'min-w-0 wrap-break-word group-data-[variant=separator]/marker:flex-none group-data-[variant=separator]/marker:text-center *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground',
        className,
      )}
      {...props}
    />
  )
}

export { Marker, MarkerIcon, MarkerContent, markerVariants }
