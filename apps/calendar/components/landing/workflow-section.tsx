import * as motion from 'motion/react-client'
import { BellRing, MessagesSquare, PlugZap } from 'lucide-react'

const steps = [
  {
    num: '01',
    icon: PlugZap,
    title: 'Connect your agent',
    desc: 'Point Claude, Cursor, or any MCP client at Zentra with a scoped key or OAuth. You decide exactly what it can touch, and revoke it whenever.',
  },
  {
    num: '02',
    icon: MessagesSquare,
    title: 'Describe the week you want',
    desc: 'Ask for a deep-work block on Thursday, a standup every weekday, and a lunch that is not a sandwich. Your agent creates the events and reschedules what it moves.',
  },
  {
    num: '03',
    icon: BellRing,
    title: 'Reminders reconcile themselves',
    desc: 'Move an event and its reminders move with it. Recurrence, RSVP, and ICS export stay in step, so nothing is left to reconcile by hand.',
  },
]

const EASE = [0.16, 1, 0.3, 1] as const

export function WorkflowSection() {
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
          From prompt to plan
        </motion.p>
        <motion.h2
          className="text-foreground text-lg font-medium tracking-tight text-balance md:text-xl"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
        >
          The scheduling workflow,{' '}
          <span className="text-foreground/40">run by your agent.</span>
        </motion.h2>
      </div>

      <div className="relative mt-10">
        <div className="absolute top-2 bottom-2 left-4 hidden w-px bg-border/60 md:block" />

        {steps.map((step, i) => (
          <motion.div
            key={step.num}
            className="relative flex items-start gap-4 pb-8 last:pb-0"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.15 + i * 0.15 }}
          >
            <div className="bg-background ring-foreground/5 relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border ring-1">
              <step.icon className="text-foreground/70 size-3.5" />
            </div>

            <div className="min-w-0 flex-1 pt-1">
              <span className="text-muted-foreground text-[11px] font-medium tracking-widest uppercase">
                Step {step.num}
              </span>
              <h3 className="text-foreground mt-1 text-base leading-none font-medium tracking-tight">
                {step.title}
              </h3>
              <p className="text-muted-foreground mt-2 max-w-[46ch] text-sm leading-relaxed">
                {step.desc}
              </p>
            </div>
          </motion.div>
        ))}

        <motion.p
          className="text-muted-foreground/60 mt-6 text-center text-xs"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.7 }}
        >
          No copy-pasting. No double booking. No reminder graveyard.
        </motion.p>
      </div>
    </section>
  )
}
