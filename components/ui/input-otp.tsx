'use client'

import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

interface InputOTPProps {
  value: string
  onChange: (value: string) => void
  maxLength?: number
  className?: string
}

export function InputOTP({ value, onChange, maxLength = 6, className }: InputOTPProps) {
  const chars = Array.from({ length: maxLength }, (_, i) => value[i] ?? '')

  return (
    <div className={cn('flex gap-2', className)}>
      {chars.map((char, index) => (
        <Input
          key={index}
          value={char}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          className="h-10 w-10 text-center"
          onChange={(e) => {
            const nextChar = e.target.value.replace(/\D/g, '')
            const next = value.split('')
            next[index] = nextChar
            onChange(next.join('').slice(0, maxLength))
            if (nextChar) {
              const el = document.querySelector<HTMLInputElement>(`input[data-otp-index='${index + 1}']`)
              el?.focus()
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !chars[index] && index > 0) {
              const el = document.querySelector<HTMLInputElement>(`input[data-otp-index='${index - 1}']`)
              el?.focus()
            }
          }}
          data-otp-index={index}
        />
      ))}
    </div>
  )
}
