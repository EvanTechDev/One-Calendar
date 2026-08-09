'use client'

import { useMemo, useState } from 'react'
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
  Globe2,
  CalendarDays,
  Monitor,
  Clock,
  Languages,
  ArrowRight,
  ArrowLeft,
  PartyPopper,
} from 'lucide-react'
import { getLanguageAutonym, supportedLanguages } from '@zntr/i18n/calendar'

interface OnboardingStep {
  icon: React.ElementType
  title: string
  description: string
  key: string
  options: { value: string; label: string }[]
}

function buildTimezoneOptions(): { value: string; label: string }[] {
  try {
    const timezones = Intl.supportedValuesOf('timeZone')

    const getUTCOffset = (timeZone: string) => {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName: 'shortOffset',
      }).formatToParts(new Date())

      const timeZoneName =
        parts.find((part) => part.type === 'timeZoneName')?.value ?? ''

      if (timeZoneName === 'GMT' || timeZoneName === 'UTC') {
        return { offsetString: 'UTC+00:00', offsetMinutes: 0 }
      }

      const match = timeZoneName.match(
        /(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?/,
      )
      if (!match) {
        return { offsetString: 'UTC+00:00', offsetMinutes: 0 }
      }

      const [, sign, hours, minutes = '00'] = match
      const parsedHours = Number.parseInt(hours, 10)
      const parsedMinutes = Number.parseInt(minutes, 10)
      const totalMinutes = parsedHours * 60 + parsedMinutes
      const offsetMinutes = sign === '-' ? -totalMinutes : totalMinutes

      return {
        offsetString: `UTC${sign}${hours.padStart(2, '0')}:${minutes}`,
        offsetMinutes,
      }
    }

    return timezones
      .map((tz) => {
        try {
          const { offsetString, offsetMinutes } = getUTCOffset(tz)
          return {
            value: tz,
            label: `${offsetString} · ${tz}`,
            offsetMinutes,
          }
        } catch {
          return {
            value: tz,
            label: `UTC+00:00 · ${tz}`,
            offsetMinutes: 0,
          }
        }
      })
      .sort(
        (a, b) =>
          a.offsetMinutes - b.offsetMinutes || a.value.localeCompare(b.value),
      )
  } catch {
    return [
      { value: 'UTC', label: 'UTC+00:00 · UTC' },
      { value: 'Asia/Shanghai', label: 'UTC+08:00 · Asia/Shanghai' },
      { value: 'America/New_York', label: 'UTC-05:00 · America/New_York' },
    ]
  }
}

const VIEW_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'four-day', label: 'Four Day' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
]

const LANGUAGE_OPTIONS = supportedLanguages.map((lang) => ({
  value: lang,
  label: getLanguageAutonym(lang),
}))

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
  const [selections, setSelections] = useState<Record<string, string>>({})

  const timezoneOptions = useMemo(() => buildTimezoneOptions(), [])

  const settingSteps: OnboardingStep[] = [
    {
      icon: Languages,
      title: 'Language',
      description: 'Choose your preferred language for the interface.',
      key: 'language',
      options: LANGUAGE_OPTIONS,
    },
    {
      icon: Globe2,
      title: 'Timezone',
      description: 'Select your timezone for accurate event scheduling.',
      key: 'timezone',
      options: timezoneOptions,
    },
    {
      icon: CalendarDays,
      title: 'Week Starts On',
      description: 'Choose which day your week begins on.',
      key: 'firstDayOfWeek',
      options: [
        { value: '0', label: 'Sunday' },
        { value: '1', label: 'Monday' },
        { value: '6', label: 'Saturday' },
      ],
    },
    {
      icon: Monitor,
      title: 'Default View',
      description: 'Pick your preferred calendar view.',
      key: 'defaultView',
      options: VIEW_OPTIONS,
    },
    {
      icon: Clock,
      title: 'Time Format',
      description: 'Choose how times are displayed.',
      key: 'timeFormat',
      options: [
        { value: '24h', label: '24-hour' },
        { value: '12h', label: '12-hour (AM/PM)' },
      ],
    },
  ]

  const totalSteps = settingSteps.length
  const step = settingSteps[currentStep]
  const isFirst = currentStep === 0
  const isLast = currentStep === totalSteps - 1

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
      await fetch('/api/account/onboarding-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: selections }),
      })
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

  const handleSkip = () => {
    void handleFinish()
  }

  return (
    <Dialog open={open} onOpenChange={handleDismiss}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[calc(100vw-2rem)] p-0 sm:max-w-2xl"
        onEscapeKeyDown={handleDismiss}
        onPointerDownOutside={handleDismiss}
      >
        <div className="flex min-h-[28rem] flex-col">
          {/* Progress dots */}
          <div className="flex justify-center gap-2 pt-6">
            {settingSteps.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === currentStep
                    ? 'bg-foreground w-6'
                    : i < currentStep
                      ? 'bg-foreground/50 w-2'
                      : 'bg-muted-foreground/30 w-2'
                }`}
              />
            ))}
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col items-center gap-5 px-8 py-6">
            {/* Icon */}
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/10">
              <step.icon className="h-9 w-9 text-primary" />
            </div>

            {/* Title & Description */}
            <div className="text-center">
              <DialogTitle className="text-xl font-semibold">
                {step.title}
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-sm">
                {step.description}
              </DialogDescription>
            </div>

            {/* Select */}
            <div className="w-full max-w-xs pt-2">
              <Select
                value={selections[step.key] || ''}
                onValueChange={(value) =>
                  setSelections((s) => ({ ...s, [step.key]: value }))
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
          <div className="flex items-center justify-between border-t bg-muted/20 px-6 py-4">
            <div className="flex gap-2">
              {!isFirst && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrev}
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Previous
                </Button>
              )}
              {isFirst && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkip}
                >
                  Skip for now
                </Button>
              )}
            </div>
            <Button
              size="sm"
              onClick={handleNext}
              disabled={isCompleting}
            >
              {isLast ? (
                isCompleting ? (
                  'Completing...'
                ) : (
                  <>
                    <PartyPopper className="mr-1.5 h-3.5 w-3.5" />
                    Finish
                  </>
                )
              ) : (
                <>
                  Next
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
