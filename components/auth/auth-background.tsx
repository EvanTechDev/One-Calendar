'use client'

import Dither from '@/components/landing/dither'

export function AuthBackground() {
  return (
    <div style={{ width: '100%', height: '600px', position: 'relative' }}>
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
