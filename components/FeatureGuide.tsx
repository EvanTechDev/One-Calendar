"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { HelpCircle } from "lucide-react"

interface FeatureGuideProps {
  title: string
  description: string
  steps: {
    title: string
    description: string
  }[]
}

export default function FeatureGuide({ title, description, steps }: FeatureGuideProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} className="absolute right-2 top-2 z-10">
        <HelpCircle className="h-5 w-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={index}>
                <h3 className="font-medium">
                  步骤 {index + 1}: {step.title}
                </h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setOpen(false)}>明白了</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

