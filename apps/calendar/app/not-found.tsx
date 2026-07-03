import Link from 'next/link'
import { ArrowLeftIcon, HomeIcon } from 'lucide-react'

import { Button } from '@zntr/ui/button'

export default function NotFound() {
  return (
    <div className="relative min-h-svh overflow-hidden bg-background">
      <Grid />

      <div className="relative mx-auto flex min-h-svh max-w-3xl flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
          STATUS · 404
        </div>

        <BigNumerals />

        <h1 className="mt-10 max-w-md text-2xl font-semibold leading-tight md:text-3xl">
          We can't find that page.
        </h1>

        <p className="mt-3 max-w-sm text-balance text-sm text-muted-foreground">
          The link may be outdated, or the page might have been moved. Please
          check the URL or return to a known location.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeftIcon className="h-4 w-4" />
            Go back
          </Button>

          <Button asChild>
            <Link href="/">
              <HomeIcon className="h-4 w-4" />
              Take me home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

function BigNumerals() {
  return (
    <div className="relative">
      <span className="bg-gradient-to-b from-foreground to-foreground/30 bg-clip-text text-[clamp(8rem,22vw,16rem)] font-bold leading-none tracking-tighter text-transparent">
        404
      </span>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -bottom-2 h-1/2"
        style={{
          background:
            'radial-gradient(60% 100% at 50% 100%, color-mix(in srgb, var(--background) 80%, transparent) 50%, transparent 100%)',
        }}
      />
    </div>
  )
}

function Grid() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-35"
      style={{
        backgroundImage: `
          linear-gradient(
            to right,
            color-mix(in srgb, var(--foreground) 8%, transparent) 1px,
            transparent 1px
          ),
          linear-gradient(
            to bottom,
            color-mix(in srgb, var(--foreground) 8%, transparent) 1px,
            transparent 1px
          )
        `,
        backgroundSize: '48px 48px',
        maskImage:
          'radial-gradient(ellipse at center, black 35%, transparent 75%)',
        WebkitMaskImage:
          'radial-gradient(ellipse at center, black 35%, transparent 75%)',
      }}
    />
  )
}
