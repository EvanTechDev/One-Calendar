"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="input-group" className={cn("flex items-center border", className)} {...props} />
}

function InputGroupAddon({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group-addon"
      className={cn("text-muted-foreground inline-flex items-center px-2", className)}
      {...props}
    />
  )
}

export { InputGroup, InputGroupAddon }
