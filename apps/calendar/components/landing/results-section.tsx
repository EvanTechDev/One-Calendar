import * as motion from 'motion/react-client'

const EASE = [0.16, 1, 0.3, 1] as const

export function ResultsSection() {
  return (
    <section className="mx-auto w-full max-w-5xl overflow-hidden px-4 pt-10 pb-16 md:px-8 md:pb-24">
      <div className="space-y-2 text-center">
        <motion.p
          className="text-muted-foreground text-[11px] font-medium uppercase tracking-[0.18em]"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          Real results
        </motion.p>
      </div>

      <motion.div
        className="mx-auto mt-6 max-w-4xl text-center"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
      >
        <p className="text-foreground text-[28px] leading-[1.15] font-medium tracking-tight text-balance md:text-[44px]">
          Teams on Zentra clear{' '}
          <span className="text-foreground">3&times; more</span> scheduling
          requests a day, move an entire afternoon with{' '}
          <span className="text-foreground">one sentence</span>, and stop
          tracking reminders by hand —{' '}
          <span className="text-foreground/40">
            99.9% of them go out on time
          </span>{' '}
          without anyone checking.
        </p>

        <motion.p
          className="text-muted-foreground mx-auto mt-6 max-w-[46ch] text-sm leading-relaxed"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          No migration project, no re-training, no per-seat pricing. The agent
          reads the schedule you already have and starts from there.
        </motion.p>
      </motion.div>
    </section>
  )
}
