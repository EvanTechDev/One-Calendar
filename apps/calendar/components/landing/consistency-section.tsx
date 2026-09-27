import * as motion from 'motion/react-client'

const EASE = [0.16, 1, 0.3, 1] as const

export function ConsistencySection() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 md:px-8">
      <div className="space-y-2 text-center">
        <motion.p
          className="text-muted-foreground text-[11px] font-medium uppercase tracking-[0.18em]"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          One source of truth
        </motion.p>
        <motion.h2
          className="text-foreground text-lg font-medium tracking-tight text-balance md:text-xl"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
        >
          Plan in the month, refine in the week, finish in the day — all from{' '}
          <span className="text-foreground/40">one recurrence engine</span>,
          with <span className="text-foreground">34 languages</span>,{' '}
          <span className="text-foreground">RSVP tracking</span>, and reminders
          that reconcile themselves.
        </motion.h2>
      </div>

      <motion.p
        className="text-muted-foreground mx-auto mt-5 max-w-[46ch] text-center text-sm leading-relaxed"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        No view re-derives your schedule on its own, so an edit made in one
        place shows up everywhere else — no drift, no duplicated series, no
        phantom occurrences.
      </motion.p>
    </section>
  )
}
