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

interface OnboardingStep {
  icon: React.ElementType
  title: string
  description: string
  key: string
  options: { value: string; label: string }[]
}

function CalendarMark({ className }: { className?: string }) {
  return (
    <svg
      version="1.0"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      className={className}
    >
      <g
        transform="translate(0,1000) scale(0.1,-0.1)"
        fill="currentColor"
        stroke="none"
      >
        <path d="M4960 8206 c-87 -24 -164 -70 -231 -136 -101 -101 -149 -217 -149 -360 0 -144 48 -259 150 -360 102 -102 218 -150 360 -150 140 0 264 53 365 156 194 198 194 508 0 709 -67 69 -165 125 -253 144 -68 14 -184 13 -242 -3z" />
        <path d="M3616 6859 c-109 -26 -239 -117 -307 -215 -97 -141 -111 -350 -34 -510 61 -126 166 -217 305 -264 55 -19 82 -21 175 -18 102 3 115 6 185 39 147 70 239 172 281 311 17 57 21 88 18 182 -4 109 -5 115 -46 198 -68 136 -202 245 -343 277 -54 13 -180 12 -234 0z" />
        <path d="M4963 6855 c-228 -64 -383 -263 -383 -493 0 -149 45 -259 149 -363 105 -105 212 -149 362 -149 188 0 345 90 443 254 70 117 85 297 35 434 -48 130 -170 250 -306 302 -75 29 -225 37 -300 15z" />
        <path d="M4940 5491 c-91 -29 -142 -61 -211 -130 -103 -103 -149 -214 -149 -361 0 -328 308 -570 629 -495 279 66 450 358 373 636 -46 164 -177 299 -340 349 -83 26 -224 26 -302 1z" />
        <path d="M4980 4149 c-81 -16 -188 -76 -255 -145 -97 -100 -145 -215 -145 -354 0 -147 46 -258 149 -361 105 -105 212 -149 362 -149 455 0 680 547 358 869 -121 122 -296 174 -469 140z" />
        <path d="M3601 2784 c-116 -31 -242 -125 -306 -229 -65 -105 -87 -283 -50 -410 61 -215 263 -365 490 -365 134 0 244 43 343 135 118 109 162 211 162 376 0 160 -46 267 -159 371 -103 96 -213 139 -351 137 -41 0 -99 -7 -129 -15z" />
        <path d="M4959 2785 c-85 -23 -162 -69 -229 -135 -102 -101 -150 -216 -150 -360 0 -147 57 -278 162 -374 205 -187 515 -181 709 13 157 157 193 397 91 600 -56 112 -196 223 -326 257 -63 17 -195 17 -257 -1z" />
        <path d="M6311 2784 c-76 -20 -146 -60 -212 -122 -113 -104 -159 -211 -159 -371 0 -189 74 -329 228 -431 103 -68 259 -97 385 -71 130 28 271 129 336 245 86 151 86 361 1 512 -38 65 -141 164 -208 198 -109 55 -256 71 -371 40z" />
      </g>
    </svg>
  )
}

const WelcomeIcon = CalendarMark

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
    title: 'Welcome to One Calendar',
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
                  <WelcomeIcon className="h-9 w-9 text-primary" />
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
