'use client'

import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

interface InputOTPProps {
  value: string
  onChange: (value: string) => void
  maxLength?: number
  className?: string
}

interface InputOTPSlotProps {
  index: number
  value: string
  onSlotChange: (index: number, value: string) => void
  onSlotBackspace: (index: number) => void
  className?: string
}

export function InputOTPSlot({ index, value, onSlotChange, onSlotBackspace, className }: InputOTPSlotProps) {
  return (
    <Input
      value={value}
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={1}
      className={cn('h-12 w-11 text-center text-xl', className)}
      data-slot="input-otp-slot"
      data-otp-index={index}
      onChange={(e) => onSlotChange(index, e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Backspace' && !value) onSlotBackspace(index)
      }}
    />
  )
}

export function InputOTPGroup({ className, children }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={cn('flex items-center gap-2', className)}>{children}</div>
}

export function InputOTPSeparator({ className }: { className?: string }) {
  return <span className={cn('mx-2 text-muted-foreground', className)}>-</span>
}

export function InputOTP({ value, onChange, maxLength = 6, className }: InputOTPProps) {
  const chars = Array.from({ length: maxLength }, (_, i) => value[i] ?? '')

  const onSlotChange = (index: number, nextRaw: string) => {
    const nextChar = nextRaw.replace(/\D/g, '')
    const next = chars.slice()
    next[index] = nextChar
    onChange(next.join('').slice(0, maxLength))
    if (nextChar) {
      const el = document.querySelector<HTMLInputElement>(`input[data-otp-index='${index + 1}']`)
      el?.focus()
    }
  }

  const onSlotBackspace = (index: number) => {
    if (index <= 0) return
    const el = document.querySelector<HTMLInputElement>(`input[data-otp-index='${index - 1}']`)
    el?.focus()
  }

  return (
    <div className={cn('flex w-full items-center justify-between', className)}>
      <InputOTPGroup>
        <InputOTPSlot index={0} value={chars[0]} onSlotChange={onSlotChange} onSlotBackspace={onSlotBackspace} />
        <InputOTPSlot index={1} value={chars[1]} onSlotChange={onSlotChange} onSlotBackspace={onSlotBackspace} />
        <InputOTPSlot index={2} value={chars[2]} onSlotChange={onSlotChange} onSlotBackspace={onSlotBackspace} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} value={chars[3]} onSlotChange={onSlotChange} onSlotBackspace={onSlotBackspace} />
        <InputOTPSlot index={4} value={chars[4]} onSlotChange={onSlotChange} onSlotBackspace={onSlotBackspace} />
        <InputOTPSlot index={5} value={chars[5]} onSlotChange={onSlotChange} onSlotBackspace={onSlotBackspace} />
      </InputOTPGroup>
    </div>
  )
}
