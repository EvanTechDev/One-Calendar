import { Button } from '@zntr/ui/button'
import { ArrowRightIcon } from 'lucide-react'
import Link from 'next/link'

const stars = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  top: `${Math.random() * 100}%`,
  left: `${Math.random() * 100}%`,
  opacity: 0.15 + Math.random() * 0.7,
  size: Math.random() > 0.9 ? 2 : 1,
}))

function StarLayer() {
  return (
    <>
      {[0, 1].map((copy) => (
        <div
          key={copy}
          className="absolute top-0 h-full w-full animate-[starDrift_120s_linear_infinite]"
          style={{
            left: copy === 0 ? '0%' : '100%',
          }}
        >
          {stars.map((star) => (
            <span
              key={`${copy}-${star.id}`}
              className="absolute rounded-full bg-white"
              style={{
                top: star.top,
                left: star.left,
                opacity: star.opacity,
                width: star.size,
                height: star.size,
              }}
            />
          ))}
        </div>
      ))}
    </>
  )
}

export function CallToAction() {
  return (
    <section className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-md border border-white/5">
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(
              to bottom,
              #101010 0%,
              #141414 30%,
              #1b1b1b 65%,
              #262626 100%
            )
          `,
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.06) 100%)',
        }}
      />

      <div className="absolute inset-0 overflow-hidden">
        <StarLayer />
      </div>

      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at center, rgba(255,255,255,0.04) 0%, transparent 60%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.45) 100%)',
        }}
      />

      <div className="relative flex flex-col justify-center items-center h-full w-full rounded-[calc(2.5rem-0.375rem)] border border-foreground/10 bg-background/80 backdrop-blur-2xl px-6 py-20 md:py-24 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
        <div className="space-y-4">
          <h2 className="text-center font-semibold text-3xl tracking-tight leading-none md:text-5xl">
            Ready to take control of your time?
          </h2>
          <p className="text-balance text-center text-muted-foreground text-sm md:text-base">
            One Calendar helps you keep every event, reminder, and schedule in
            sync. Free forever.
          </p>
        </div>
        <div className="flex items-center justify-center gap-4 mt-6">
          <Link href="/sign-up">
            <Button className="rounded-full pl-4 pr-1 py-2 text-sm active:scale-[0.97] transition-transform duration-[160ms] ease-[var(--ease-out)] group">
              <span className="mr-3">Get started</span>
              <div className="flex size-6 items-center justify-center rounded-full bg-background/20 transition-transform duration-300 group-hover:translate-x-1 group-hover:scale-105">
                <ArrowRightIcon data-icon="inline-end" />
              </div>
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}