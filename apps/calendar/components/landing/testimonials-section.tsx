import * as motion from 'motion/react-client'
import { Star } from 'lucide-react'

const testimonials = [
  {
    quote:
      'We were re-planning the same week every Monday afternoon. Now I tell the agent what the week needs to look like on the Friday before, and Monday is just a review.',
    name: 'Elena Fischer',
    company: 'Fieldnote',
    rating: 5,
  },
  {
    quote:
      'Recurring events used to be the thing that broke every other calendar we tried. Zentra edits one occurrence or the whole series, and the day, week, and month views all agree afterwards.',
    name: 'Marcus Oyelaran',
    company: 'Cadence Labs',
    rating: 5,
  },
]

const EASE = [0.16, 1, 0.3, 1] as const

export function TestimonialsSection() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 pt-4 md:px-8">
      <div className="text-center">
        <motion.p
          className="text-muted-foreground text-[11px] font-medium uppercase tracking-[0.18em]"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          Trusted by teams
        </motion.p>
        <motion.h2
          className="text-foreground mt-2 text-[28px] leading-[1.1] font-medium tracking-tight text-balance md:text-[40px]"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
        >
          The calendar people{' '}
          <span className="text-foreground/40">actually keep open.</span>
        </motion.h2>
      </div>

      <div className="mt-10 space-y-10 md:space-y-12">
        {testimonials.map((testimonial, i) => (
          <motion.figure
            key={testimonial.name}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.15 + i * 0.2 }}
          >
            <svg
              aria-hidden
              className="text-foreground/30 mb-3"
              fill="currentColor"
              height="20"
              viewBox="0 0 36 28"
              width="26"
            >
              <path d="M13.5 0C9.75 0 6.375 1.3125 3.375 3.9375C0.75 6.1875 0 9 0 12.375C0 16.125 1.5 19.3125 4.5 21.9375C7.5 24.5625 10.875 27.375 14.625 28.125V22.5C12.75 21.75 10.875 20.4375 10.125 18.375C9.5625 16.6875 9.5625 15 9.5625 13.5C9.5625 13.125 9.5625 12.75 9.75 12.375H13.5V0ZM34.875 0C31.125 0 27.75 1.3125 24.75 3.9375C22.125 6.1875 21.375 9 21.375 12.375C21.375 16.125 22.875 19.3125 25.875 21.9375C28.875 24.5625 32.25 27.375 36 28.125V22.5C34.125 21.75 32.25 20.4375 31.5 18.375C30.9375 16.6875 30.9375 15 30.9375 13.5C30.9375 13.125 30.9375 12.75 31.125 12.375H34.875V0Z" />
            </svg>

            <blockquote className="text-foreground max-w-[62ch] text-[18px] leading-[1.35] font-medium tracking-tight text-balance md:text-[22px]">
              {testimonial.quote}
            </blockquote>

            <figcaption className="mt-4 flex items-center gap-3">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: testimonial.rating }).map((_, star) => (
                  <Star className="fill-foreground/70 size-3" key={star} />
                ))}
              </div>
              <span className="bg-border h-3 w-px" />
              <div className="text-xs">
                <span className="text-foreground font-semibold">
                  {testimonial.name}
                </span>
                <span className="text-muted-foreground">
                  {' '}
                  · {testimonial.company}
                </span>
              </div>
            </figcaption>

            {i < testimonials.length - 1 && (
              <div className="border-border/40 mt-10 border-t md:mt-12" />
            )}
          </motion.figure>
        ))}
      </div>
    </section>
  )
}
