import { Button } from '@zntr/ui/button'
import { ArrowRightIcon } from 'lucide-react'
import Link from 'next/link'

const stars = Array.from({ length: 120 }, (_, i) => ({
  id: i,
  top: `${Math.random() * 100}%`,
  left: `${Math.random() * 100}%`,
  opacity: 0.2 + Math.random() * 0.8,
  size: Math.random() > 0.8 ? 2 : 1,
}))

export function CallToAction() {
  return (
    <section className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-[2.5rem] border border-white/10 bg-black">
      <div className="absolute inset-0">
        {stars.map((star) => (
          <span
            key={star.id}
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

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08)_0%,transparent_60%)]" />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,0.55)_100%)]" />

      <div className="relative flex min-h-[520px] flex-col items-center justify-center px-8 py-24">
        <div className="max-w-3xl space-y-5 text-center">
          <h2 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">
            Ready to take control of your time?
          </h2>

          <p className="text-balance text-base text-white/60 md:text-lg">
            One Calendar helps you keep every event, reminder, and schedule in
            sync. Free forever.
          </p>
        </div>

        <div className="mt-10 flex items-center justify-center">
          sign-up">
            <Button className="group rounded-full pl-4 pr-1 py-2 text-sm active:scale-[0.97] transition-transform duration-200">
              <span className="mr-3">Get started</span>

              <div className="flex size-6 items-center justify-center rounded-full bg-background/20 transition-all duration-300 group-hover:translate-x-1 group-hover:scale-105">
                <ArrowRightIcon data-icon="inline-end" />
              </div>
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}