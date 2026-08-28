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
} from 'lucide-react'
import { getLanguageAutonym, supportedLanguages } from '@zntr/i18n/calendar'
import { ZentraLogo } from '@/components/brand/zentra-logo'

interface OnboardingStep {
  icon: React.ElementType
  title: string
  description: string
  key: string
  options: { value: string; label: string }[]
}

/**
 * The brand logo as the welcome step's icon. Typed like the lucide icons in
 * the other steps (a component taking `className`), so it drops into the same
 * `icon` slot.
 */
const WelcomeIcon = ({ className }: { className?: string }) => (
  <ZentraLogo decorative className={className} />
)

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

  const welcomeStep: OnboardingStep = {
    icon: WelcomeIcon,
    title: 'Welcome to Zentra Calendar',
    description:
      'A few quick questions to make your calendar feel like yours. Change anything later in Settings.',
    key: 'welcome',
    options: [],
  }

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

  const steps = [welcomeStep, ...settingSteps]

  const totalSteps = steps.length
  const step = steps[currentStep]
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
        <div className="flex min-h-[28rem] flex-col overflow-hidden">
          {/* Progress dots */}
          <div className="flex justify-center gap-2 pt-6">
            {steps.map((_, i) => (
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
          <div className="flex flex-1 flex-col items-center gap-5 px-8 pt-8 pb-6">
            {/* Icon */}
            {isFirst ? (
              <div className="relative">
                <div
                  aria-hidden="true"
                  className="absolute -inset-12 rounded-full bg-primary/5 blur-2xl"
                />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-inset ring-primary/15">
                  {/* No `text-primary`: the logo carries its own colours. */}
                  <WelcomeIcon className="h-9 w-9" />
                </div>
              </div>
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <step.icon className="h-9 w-9 text-primary" />
              </div>
            )}

            {/* Title & Description */}
            <div className="mt-4 text-center">
              <DialogTitle className="text-xl font-semibold">
                {step.title}
              </DialogTitle>
              <DialogDescription className="mx-auto mt-1.5 max-w-sm text-sm">
                {step.description}
              </DialogDescription>
            </div>

            {/* Coming next */}
            {isFirst && (
              <div className="mt-2 flex w-full max-w-md flex-wrap items-center justify-center gap-2 pt-1">
                {settingSteps.map((s) => (
                  <span
                    key={s.key}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground"
                  >
                    <s.icon className="h-3.5 w-3.5" />
                    {s.title}
                  </span>
                ))}
              </div>
            )}

            {/* Select */}
            <div className="w-full max-w-xs pt-4">
              {step.options.length > 0 && (
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
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t bg-muted/20 px-6 py-4">
            <div className="flex gap-2">
              {!isFirst && (
                <Button variant="outline" size="sm" onClick={handlePrev}>
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Previous
                </Button>
              )}
              {currentStep === 1 && (
                <Button variant="ghost" size="sm" onClick={handleSkip}>
                  Skip for now
                </Button>
              )}
            </div>
            <Button size="sm" onClick={handleNext} disabled={isCompleting}>
              {isLast ? (
                isCompleting ? (
                  'Completing...'
                ) : (
                  'Finish'
                )
              ) : isFirst ? (
                <>
                  Get started
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </>
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
