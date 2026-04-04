import * as React from "react"

import { cn } from "@/lib/utils"

function Field({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="field" className={cn("grid gap-2", className)} {...props} />
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="field-group" className={cn("grid gap-5", className)} {...props} />
}

function FieldLabel({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="field-label"
      className={cn("text-sm font-medium leading-none", className)}
      {...props}
    />
  )
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function FieldSeparator({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="field-separator" className={cn("relative", className)} {...props}>
      <div className="absolute inset-0 top-1/2 -translate-y-1/2 border-t border-border" />
      <span className="data-[slot=field-separator-content]:bg-background relative block w-fit mx-auto px-2 text-sm text-muted-foreground" data-slot="field-separator-content">
        {children}
      </span>
    </div>
  )
}

export { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator }
