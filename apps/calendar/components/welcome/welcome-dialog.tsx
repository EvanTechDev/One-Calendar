'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@zntr/ui/dialog'
import { Button } from '@zntr/ui/button'
import {
  CalendarPlus,
  FolderOpen,
  Share2,
  Sparkles,
  CheckCircle2,
} from 'lucide-react'

interface WelcomeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

const FEATURES = [
  {
    icon: CalendarPlus,
    title: 'Create events',
    description:
      'Add events with dates, times, locations, and descriptions.',
  },
  {
    icon: FolderOpen,
    title: 'Organize with categories',
    description:
      'Group events by Personal, Work, Health, or custom categories.',
  },
  {
    icon: Share2,
    title: 'Share securely',
    description: 'Share events with password protection and burn-after-read.',
  },
]

const QUICK_START_STEPS = [
  'Click the "+" button to create your first event',
  'Use categories to keep your calendar organized',
  'Access your calendar from any device',
]

export function WelcomeDialog({
  open,
  onOpenChange,
  onComplete,
}: WelcomeDialogProps) {
  const [isCompleting, setIsCompleting] = useState(false)

  const handleComplete = async () => {
    setIsCompleting(true)
    try {
      await fetch('/api/account/onboarding-complete', { method: 'POST' })
      onComplete()
    } finally {
      setIsCompleting(false)
    }
  }

  const handleDismiss = () => {
    if (!open) return
    onOpenChange(false)
    void handleComplete()
  }

  return (
    <Dialog open={open} onOpenChange={handleDismiss}>
      <DialogContent className="max-w-lg p-0">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-b from-primary/5 to-background p-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">
                Welcome to One Calendar!
              </DialogTitle>
              <DialogDescription>
                Your privacy-first calendar is ready to go.
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-6 py-4">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">
              What you can do
            </h4>
            <div className="space-y-3">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <feature.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{feature.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">
              Quick start
            </h4>
            <ul className="space-y-2">
              {QUICK_START_STEPS.map((step) => (
                <li key={step} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="text-xs text-muted-foreground">{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter className="px-6 pb-6 pt-0">
          <Button onClick={handleComplete} disabled={isCompleting} className="w-full">
            {isCompleting ? 'Getting started...' : "Let's get started"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
