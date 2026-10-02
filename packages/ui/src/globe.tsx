'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import createGlobe, { type COBEOptions } from 'cobe'
import { useMotionValue, useSpring } from 'motion/react'

import { cn } from '@zntr/utils'

const MOVEMENT_DAMPING = 1400

/**
 * Theme-independent globe settings: geometry and where the markers sit.
 *
 * Colours are NOT here. They are per-theme in {@link GLOBE_PALETTES}, because
 * cobe bakes them into WebGL uniforms when the globe is created — a single
 * fixed palette is legible on one background and invisible on the other. The
 * dark palette used to be the only one, and at `baseColor` 0.08 the sphere was
 * black on a black card: the atmosphere ring was the only thing you could see.
 */
const GLOBE_CONFIG: COBEOptions = {
  width: 800,
  height: 800,
  onRender: () => {},
  devicePixelRatio: 2,
  phi: 0,
  theta: 0.3,
  mapSamples: 16000,
  markers: [
    { location: [14.5995, 120.9842], size: 0.03 },
    { location: [19.076, 72.8777], size: 0.1 },
    { location: [23.8103, 90.4125], size: 0.05 },
    { location: [30.0444, 31.2357], size: 0.07 },
    { location: [39.9042, 116.4074], size: 0.08 },
    { location: [-23.5505, -46.6333], size: 0.1 },
    { location: [19.4326, -99.1332], size: 0.1 },
    { location: [40.7128, -74.006], size: 0.1 },
    { location: [34.6937, 135.5022], size: 0.05 },
    { location: [41.0082, 28.9784], size: 0.06 },
  ],
}

/**
 * cobe colours are linear RGB in 0..1, not CSS values — hence the fractions.
 *
 * Dark is deliberately a mid slate rather than a near-black: the sphere needs
 * to separate from the card behind it, and `mapBrightness` above 1 lifts the
 * landmasses off the ocean without blowing out the marker colour.
 */
const GLOBE_PALETTES = {
  light: {
    dark: 0.4,
    diffuse: 1.2,
    mapBrightness: 0.72,
    baseColor: [0.82, 0.85, 0.9],
    glowColor: [0.55, 0.68, 0.88],
    markerColor: [251 / 255, 100 / 255, 21 / 255],
  },
  dark: {
    dark: 0.55,
    diffuse: 1.15,
    mapBrightness: 1.05,
    baseColor: [0.17, 0.19, 0.24],
    glowColor: [0.38, 0.52, 0.78],
    markerColor: [251 / 255, 100 / 255, 21 / 255],
  },
} as const satisfies Record<string, Partial<COBEOptions>>

type GlobeTheme = keyof typeof GLOBE_PALETTES

/** Reads the class next-themes writes, so this needs no provider context. */
function readTheme(): GlobeTheme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function Globe({
  className,
  config,
}: {
  className?: string
  /**
   * Overrides applied on top of the base settings and the active theme's
   * palette. Omit it to follow the theme.
   */
  config?: COBEOptions
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [theme, setTheme] = useState<GlobeTheme>(readTheme)

  // cobe has no notion of a theme, and its palette becomes GL uniforms at
  // construction, so a theme change has to rebuild the globe rather than
  // repaint it. next-themes writes `.dark` onto <html> before paint; watching
  // that class attribute is the only signal available without pulling the
  // provider's context into a component that is otherwise standalone.
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readTheme()))
    observer.observe(document.documentElement, {
      attributeFilter: ['class'],
      attributes: true,
    })
    return () => observer.disconnect()
  }, [])

  // Memoised on identity so the create/destroy effect below does not tear the
  // globe down on every render. A caller passing an inline `config` literal
  // will still churn it; that was true before this too.
  const resolvedConfig = useMemo<COBEOptions>(
    () => ({ ...GLOBE_CONFIG, ...GLOBE_PALETTES[theme], ...config }),
    [theme, config],
  )
  const phiRef = useRef(0)
  const widthRef = useRef(0)
  const pointerInteracting = useRef<number | null>(null)
  const pointerInteractionMovement = useRef(0)

  const r = useMotionValue(0)
  const rs = useSpring(r, {
    mass: 1,
    damping: 30,
    stiffness: 100,
  })

  const updatePointerInteraction = (value: number | null) => {
    pointerInteracting.current = value
    if (canvasRef.current) {
      canvasRef.current.style.cursor = value !== null ? 'grabbing' : 'grab'
    }
  }

  const updateMovement = (clientX: number) => {
    if (pointerInteracting.current !== null) {
      const delta = clientX - pointerInteracting.current
      pointerInteractionMovement.current = delta
      r.set(r.get() + delta / MOVEMENT_DAMPING)
    }
  }

  useEffect(() => {
    const onResize = () => {
      if (canvasRef.current) {
        widthRef.current = canvasRef.current.offsetWidth
      }
    }

    window.addEventListener('resize', onResize)
    onResize()

    const globe = createGlobe(canvasRef.current!, {
      ...resolvedConfig,
      width: widthRef.current * 2,
      height: widthRef.current * 2,
      onRender: (state) => {
        if (!pointerInteracting.current) phiRef.current += 0.005
        state.phi = phiRef.current + rs.get()
        state.width = widthRef.current * 2
        state.height = widthRef.current * 2
      },
    })

    setTimeout(() => (canvasRef.current!.style.opacity = '1'), 0)
    return () => {
      globe.destroy()
      window.removeEventListener('resize', onResize)
    }
  }, [rs, resolvedConfig])

  return (
    <div
      className={cn(
        'absolute inset-0 mx-auto aspect-square w-full max-w-150',
        className,
      )}
    >
      <canvas
        className={cn(
          'size-full opacity-0 transition-opacity duration-500 contain-[layout_paint_size]',
        )}
        ref={canvasRef}
        onPointerDown={(e) => {
          pointerInteracting.current = e.clientX
          updatePointerInteraction(e.clientX)
        }}
        onPointerUp={() => updatePointerInteraction(null)}
        onPointerOut={() => updatePointerInteraction(null)}
        onMouseMove={(e) => updateMovement(e.clientX)}
        onTouchMove={(e) =>
          e.touches[0] && updateMovement(e.touches[0].clientX)
        }
      />
    </div>
  )
}
