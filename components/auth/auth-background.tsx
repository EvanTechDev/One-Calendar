'use client'

import Dither from '@/components/landing/dither'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function AuthBackground() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="fixed inset-0 -z-10 bg-white dark:bg-black" />
  }

  return (
    <div
      style={{ width: '100%', height: '600px', position: 'relative' }}
    >
      <Dither
        waveColor={[0.5, 0.5, 0.5]}
        disableAnimation={false}
        enableMouseInteraction
        mouseRadius={0.3}
        colorNum={4}
        waveAmplitude={0.3}
        waveFrequency={3}
        waveSpeed={0.05}
      />
    </div>
  )
}
