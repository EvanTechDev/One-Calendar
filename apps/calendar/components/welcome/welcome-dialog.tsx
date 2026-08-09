'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@zntr/ui/dialog'
import { Button } from '@zntr/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@zntr/ui/select'
import {
  Globe,
  CalendarDays,
  LayoutGrid,
  Timer,
  CheckCircle2,
  Languages,
} from 'lucide-react'

interface OnboardingStep {
  icon: React.ElementType
  title: string
  description: string
  options: { value: string; label: string }[]
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    icon: Languages,
    title: 'Language',
    description: 'Choose your preferred language for the interface.',
    options: [
      { value: 'en', label: 'English' },
      { value: 'zh-CN', label: '简体中文' },
      { value: 'zh-TW', label: '繁體中文' },
      { value: 'ja', label: '日本語' },
      { value: 'ko', label: '한국어' },
      { value: 'es', label: 'Español' },
      { value: 'fr', label: 'Français' },
      { value: 'de', label: 'Deutsch' },
    ],
  },
  {
    icon: Globe,
    title: 'Timezone',
    description: 'Select your timezone for accurate event scheduling.',
    options: [
      { value: 'UTC', label: 'UTC' },
      { value: 'America/New_York', label: 'Eastern Time (ET)' },
      { value: 'America/Chicago', label: 'Central Time (CT)' },
      { value: 'America/Denver', label: 'Mountain Time (MT)' },
      { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
      { value: 'Europe/London', label: 'London (GMT)' },
      { value: 'Europe/Paris', label: 'Central European (CET)' },
      { value: 'Asia/Tokyo', label: 'Japan (JST)' },
      { value: 'Asia/Shanghai', label: 'China (CST)' },
      { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
      { value: 'Asia/Kolkata', label: 'India (IST)' },
      { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
    ],
  },
  {
    icon: CalendarDays,
    title: 'Week Starts On',
    description: 'Choose which day your week begins on.',
    options: [
      { value: 'sunday', label: 'Sunday' },
      { value: 'monday', label: 'Monday' },
      { value: 'saturday', label: 'Saturday' },
    ],
  },
  {
    icon: LayoutGrid,
    title: 'Default View',
    description: 'Pick your preferred calendar view.',
    options: [
      { value: 'month', label: 'Month' },
      { value: 'week', label: 'Week' },
      { value: 'day', label: 'Day' },
      { value: 'agenda', label: 'Agenda' },
    ],
  },
  {
    icon: Timer,
    title: 'Time Format',
    description: 'Choose how times are displayed.',
    options: [
      { value: '12h', label: '12-hour (AM/PM)' },
      { value: '24h', label: '24-hour' },
    ],
  },
]

interface WelcomeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

export function WelcomeDialog({
  open,
  onOpenChange,
  onComplete,
}: WelcomeDialogProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isCompleting, setIsCompleting] = useState(false)
  const [selections, setSelections] = useState<Record<number, string>>({})

  const step = ONBOARDING_STEPS[currentStep]
  const isFirst = currentStep === 0
  const isLast = currentStep === ONBOARDING_STEPS.length - 1

  const handleNext = () => {
    if (isLast) {
      handleFinish()
    } else {
      setCurrentStep((s) => s + 1)
    }
  }

  const handlePrev = () => {
    if (!isFirst) {
      setCurrentStep((s) => s - 1)
    }
  }

  const handleFinish = async () => {
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
    void handleFinish()
  }

  return (
    <Dialog open={open} onOpenChange={handleDismiss}>
      <DialogContent
        className="max-w-md p-0"
        showCloseButton={false}
        onEscapeKeyDown={handleDismiss}
        onPointerDownOutside={handleDismiss}
      >
        <div className="flex flex-col">
          {/* Progress dots */}
          <div className="flex justify-center gap-2 pt-6">
            {ONBOARDING_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-2 w-2 rounded-full transition-all ${
                  i === currentStep
                    ? 'bg-foreground w-4'
                    : i < currentStep
                      ? 'bg-foreground/50'
                      : 'bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>

          {/* Content */}
          <div className="flex flex-col items-center gap-4 px-8 py-6">
            {/* Icon */}
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <step.icon className="h-8 w-8 text-primary" />
            </div>

            {/* Title & Description */}
            <div className="text-center">
              <DialogTitle className="text-lg">{step.title}</DialogTitle>
              <DialogDescription className="mt-1 text-sm">
                {step.description}
              </DialogDescription>
            </div>

            {/* Select */}
            <div className="w-full pt-2">
              <Select
                value={selections[currentStep] || ''}
                onValueChange={(value) =>
                  setSelections((s) => ({ ...s, [currentStep]: value }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent>
                  {step.options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t bg-muted/30 px-6 py-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrev}
              disabled={isFirst}
            >
              Previous
            </Button>
            <Button
              size="sm"
              onClick={handleNext}
              disabled={isCompleting || !selections[currentStep]}
            >
              {isLast ? (
                isCompleting ? (
                  'Completing...'
                ) : (
                  <>
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Finish
                  </>
                )
              ) : (
                'Next'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
