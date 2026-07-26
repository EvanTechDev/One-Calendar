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
    <section className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-[2.5rem] border border-white/5">
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

      <div className="relative flex min-h-[560px] flex-col items-center justify-center px-8 py-24">
        <div className="max-w-3xl space-y-5 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-6xl">
            Ready to take control of your time?
          </h2>

          <p className="mx-auto max-w-2xl text-base text-sm leading-7 text-white/55 md:text-lg">
            One Calendar helps you keep every event, reminder, and schedule in
            sync. Free forever.
          </p>
        </div>

        <div className="mt-10 flex items-center justify-center">
          <Link href="/sign-up">
            <Button className="group h-12 rounded-full bg-white/8 px-5 text-white backdrop-blur-sm transition-all duration-300 hover:bg-white/12">
              <span className="mr-3">Get started</span>
              <div className="flex size-7 items-center justify-center rounded-full bg-white/10 transition-all duration-300 group-hover:translate-x-1">
                <ArrowRightIcon className="size-4" />
              </div>
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}